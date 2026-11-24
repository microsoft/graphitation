import { buildASTSchema, parse } from "graphql";
import {
  createLiveSource,
  executeWithSchema,
  executeWithoutSchema,
  extractMinimalViableSchemaForRequestDocument,
  isLiveSource,
} from "..";
import type { ExecutionResult, LiveExecutionResult, UserResolvers } from "..";
import type { ExecutionHooks } from "../hooks/types";

const definitions = parse(`
  directive @live(if: Boolean = true) on QUERY
  directive @defer(if: Boolean = true) on INLINE_FRAGMENT | FRAGMENT_SPREAD
  directive @stream(if: Boolean = true) on FIELD
  type Query {
    value: Int
    required: Int!
    other: Int
    parent: Node
    items: [Node!]!
  }
  type Mutation { set: Int }
  type Node { id: ID!, value: Int }
`);
const schema = buildASTSchema(definitions);

function cell<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  const read = jest.fn(() => value);
  const unsubscribe = jest.fn();
  const subscribe = jest.fn((invalidate: () => void) => {
    listeners.add(invalidate);
    return () => {
      unsubscribe();
      listeners.delete(invalidate);
    };
  });
  return {
    source: createLiveSource({ read, subscribe }),
    read,
    subscribe,
    unsubscribe,
    listeners,
    set(next: T) {
      value = next;
      listeners.forEach((invalidate) => invalidate());
    },
  };
}

function stream(result: ExecutionResult): LiveExecutionResult {
  if (!(Symbol.asyncIterator in result)) {
    throw new Error(`Expected live stream: ${JSON.stringify(result)}`);
  }
  return result as LiveExecutionResult;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe.each(["with schema", "without schema"])(
  "live execution %s",
  (mode) => {
    function execute(
      query: string,
      resolvers: UserResolvers,
      variableValues?: Record<string, unknown>,
      fieldExecutionHooks?: ExecutionHooks,
    ) {
      const document = parse(query);
      const args = {
        document,
        resolvers,
        definitions,
        variableValues,
        fieldExecutionHooks,
      };
      return mode === "with schema"
        ? executeWithSchema(args)
        : executeWithoutSchema({
            document,
            variableValues,
            fieldExecutionHooks,
            schemaFragment: {
              schemaId: "live-test",
              definitions: extractMinimalViableSchemaForRequestDocument(
                schema,
                document,
              ).definitions,
              resolvers,
            },
          });
    }

    it.each([
      "{ value }",
      "query @live(if: false) { value }",
      "query @live(if: null) { value }",
      "query($enabled: Boolean = false) @live(if: $enabled) { value }",
      "mutation { set }",
    ])("reads a source without subscribing for %s", async (query) => {
      const state = cell(1);
      const result = await execute(query, {
        Query: { value: () => state.source },
        Mutation: { set: () => state.source },
      });
      expect(result).toEqual({
        data: query.startsWith("mutation") ? { set: 1 } : { value: 1 },
      });
      expect(state.read).toHaveBeenCalledTimes(1);
      expect(state.subscribe).not.toHaveBeenCalled();
    });

    it("natively streams snapshots and deduplicates a source across aliases", async () => {
      const state = cell(1);
      const iterator = stream(
        await execute("query @live { a: value b: value }", {
          Query: { value: () => state.source },
        }),
      );
      try {
        expect(await iterator.next()).toEqual({
          done: false,
          value: { data: { a: 1, b: 1 } },
        });
        expect(state.subscribe).toHaveBeenCalledTimes(1);
        state.set(2);
        state.set(3);
        expect(await iterator.next()).toEqual({
          done: false,
          value: { data: { a: 3, b: 3 } },
        });
        expect(state.subscribe).toHaveBeenCalledTimes(1);
      } finally {
        await iterator.return();
      }
      expect(state.listeners.size).toBe(0);
      expect(state.unsubscribe).toHaveBeenCalledTimes(1);
    });

    it("uses coerced variable defaults and conditional fragments", async () => {
      const state = cell(1);
      const iterator = stream(
        await execute(
          `
      query($enabled: Boolean! = true, $show: Boolean! = false) @live(if: $enabled) {
        value
        ...Other @include(if: $show)
      }
      fragment Other on Query { other }
    `,
          { Query: { value: () => state.source, other: () => 10 } },
        ),
      );
      try {
        expect((await iterator.next()).value).toEqual({ data: { value: 1 } });
      } finally {
        await iterator.return();
      }
    });

    it("reads synchronous subscribe updates without an unnecessary revision", async () => {
      const state = cell(1);
      const source = createLiveSource({
        read: state.read,
        subscribe(invalidate) {
          state.set(2);
          invalidate();
          return state.source.subscribe(invalidate);
        },
      });
      const iterator = stream(
        await execute("query @live { value }", {
          Query: { value: () => source },
        }),
      );
      try {
        expect((await iterator.next()).value).toEqual({ data: { value: 2 } });
        expect(state.subscribe).toHaveBeenCalledTimes(1);
        expect(state.read).toHaveBeenCalledTimes(1);
      } finally {
        await iterator.return();
      }
      expect(state.listeners.size).toBe(0);
    });

    it("keeps subscriptions independent between operations sharing a source", async () => {
      const state = cell(1);
      const resolvers = { Query: { value: () => state.source } };
      const first = stream(await execute("query @live { value }", resolvers));
      const second = stream(await execute("query @live { value }", resolvers));
      try {
        await first.next();
        await second.next();
        expect(state.listeners.size).toBe(2);
        await first.return();
        expect(state.listeners.size).toBe(1);
        state.set(2);
        expect((await second.next()).value).toEqual({ data: { value: 2 } });
      } finally {
        await first.return();
        await second.return();
      }
      expect(state.listeners.size).toBe(0);
      expect(state.unsubscribe).toHaveBeenCalledTimes(2);
    });

    it("reconciles dynamic nested sources and list membership", async () => {
      const first = cell(1);
      const second = cell(2);
      const items = cell([{ id: "first", value: first.source }]);
      const iterator = stream(
        await execute("query @live { items { id alias: value } }", {
          Query: { items: () => items.source },
        }),
      );
      try {
        expect((await iterator.next()).value).toEqual({
          data: { items: [{ id: "first", alias: 1 }] },
        });
        items.set([{ id: "second", value: second.source }]);
        expect((await iterator.next()).value).toEqual({
          data: { items: [{ id: "second", alias: 2 }] },
        });
        expect(first.listeners.size).toBe(0);
        expect(second.listeners.size).toBe(1);
        second.set(3);
        expect((await iterator.next()).value).toEqual({
          data: { items: [{ id: "second", alias: 3 }] },
        });
      } finally {
        await iterator.return();
      }
      expect(
        items.listeners.size + first.listeners.size + second.listeners.size,
      ).toBe(0);
    });

    it("retains a source after non-null read failure and clears errors on recovery", async () => {
      let failed = true;
      const state = cell(1);
      const source = createLiveSource({
        read() {
          if (failed) throw new Error("temporarily unavailable");
          return state.read();
        },
        subscribe: state.source.subscribe,
      });
      const iterator = stream(
        await execute("query @live { alias: required }", {
          Query: { required: () => source },
        }),
      );
      try {
        const failedResult = (await iterator.next()).value;
        expect(failedResult).toMatchObject({
          data: null,
          errors: [{ message: "temporarily unavailable", path: ["alias"] }],
        });
        expect(state.listeners.size).toBe(1);
        failed = false;
        state.set(2);
        expect((await iterator.next()).value).toEqual({ data: { alias: 2 } });
      } finally {
        await iterator.return();
      }
    });

    it("serializes async resolver factories and discards invalidated revisions", async () => {
      const state = cell(1);
      const entered = deferred<void>();
      const gate = deferred<void>();
      let calls = 0;
      const iterator = stream(
        await execute("query @live { value other }", {
          Query: {
            value: () => state.source,
            other: async () => {
              calls++;
              if (calls === 1) {
                entered.resolve();
                await gate.promise;
              }
              return 10;
            },
          },
        }),
      );
      try {
        const pending = iterator.next();
        await entered.promise;
        state.set(2);
        state.set(3);
        gate.resolve();
        expect((await pending).value).toEqual({
          data: { value: 3, other: 10 },
        });
        expect(calls).toBe(2);
      } finally {
        gate.resolve();
        await iterator.return();
      }
    });

    it("cancels a pending invalidation wait immediately", async () => {
      const state = cell(1);
      const iterator = stream(
        await execute("query @live { value }", {
          Query: { value: () => state.source },
        }),
      );
      await iterator.next();
      const waiting = iterator.next();
      expect(await iterator.return()).toEqual({ done: true, value: undefined });
      expect(await waiting).toEqual({ done: true, value: undefined });
      expect(state.listeners.size).toBe(0);
      expect(await iterator.next()).toEqual({ done: true, value: undefined });
    });

    it("rejects concurrent reads without cancelling the outstanding read", async () => {
      const state = cell(1);
      const iterator = stream(
        await execute("query @live { value }", {
          Query: { value: () => state.source },
        }),
      );
      try {
        await iterator.next();
        const pending = iterator.next();
        await expect(iterator.next()).rejects.toThrow("Concurrent");
        state.set(2);
        expect((await pending).value).toEqual({ data: { value: 2 } });
      } finally {
        await iterator.return();
      }
    });

    it("does not acquire late sources after cancellation during resolver creation", async () => {
      const state = cell(1);
      const entered = deferred<void>();
      const gate = deferred<void>();
      const finished = deferred<void>();
      const iterator = stream(
        await execute("query @live { value }", {
          Query: {
            value: async () => {
              entered.resolve();
              await gate.promise;
              finished.resolve();
              return state.source;
            },
          },
        }),
      );
      const pending = iterator.next();
      await entered.promise;
      await iterator.return();
      expect((await pending).done).toBe(true);
      gate.resolve();
      await finished.promise;
      await Promise.resolve();
      expect(state.subscribe).not.toHaveBeenCalled();
      expect(state.read).not.toHaveBeenCalled();
    });

    it("does not acquire late sibling sources after a non-null failure", async () => {
      const state = cell(1);
      const gate = deferred<void>();
      const finished = deferred<void>();
      const iterator = stream(
        await execute("query @live { required value }", {
          Query: {
            required: async () => {
              throw new Error("failed");
            },
            value: async () => {
              await gate.promise;
              finished.resolve();
              return state.source;
            },
          },
        }),
      );
      expect((await iterator.next()).value).toMatchObject({ data: null });
      gate.resolve();
      await finished.promise;
      await Promise.resolve();
      expect(state.subscribe).not.toHaveBeenCalled();
      await iterator.return();
    });

    it("treats subscription setup failure as terminal and releases other sources", async () => {
      const state = cell(1);
      const source = createLiveSource({
        read: () => 2,
        subscribe() {
          throw new Error("cannot observe");
        },
      });
      const iterator = stream(
        await execute("query @live { value other }", {
          Query: { value: () => state.source, other: () => source },
        }),
      );
      await expect(iterator.next()).rejects.toThrow("cannot observe");
      expect(state.listeners.size).toBe(0);
      expect((await iterator.next()).done).toBe(true);
    });

    it("attempts every disposer even if one throws", async () => {
      const state = cell(1);
      const source = createLiveSource({
        read: () => 2,
        subscribe: () => () => {
          throw new Error("dispose failed");
        },
      });
      const iterator = stream(
        await execute("query @live { other value }", {
          Query: { value: () => state.source, other: () => source },
        }),
      );
      await iterator.next();
      await expect(iterator.return()).rejects.toThrow("dispose failed");
      expect(state.listeners.size).toBe(0);
    });

    it("preserves an undefined first cleanup failure while releasing every source", async () => {
      const state = cell(1);
      const source = createLiveSource({
        read: () => 2,
        subscribe: () => () => {
          throw undefined;
        },
      });
      const iterator = stream(
        await execute("query @live { other value }", {
          Query: { value: () => state.source, other: () => source },
        }),
      );
      await iterator.next();
      const pending = iterator.next();
      await expect(iterator.return()).rejects.toBeUndefined();
      expect((await pending).done).toBe(true);
      expect(state.listeners.size).toBe(0);
    });

    it("retains a live stream with no sources until cancelled", async () => {
      const iterator = stream(
        await execute("query @live { value }", {
          Query: { value: () => 1 },
        }),
      );
      expect((await iterator.next()).value).toEqual({ data: { value: 1 } });
      const pending = iterator.next();
      await iterator.return();
      expect((await pending).done).toBe(true);
    });

    it.each([
      "mutation @live { set }",
      "{ value @live }",
      "query @live @live { value }",
      "query @live { ... @defer { value } }",
      "query @live { items @stream { id } }",
      "query @live { ...Part } fragment Part on Query @live { value }",
    ])("rejects unsupported live placement/composition: %s", async (query) => {
      const resolver = jest.fn(() => 1);
      const result = await execute(query, { Query: { value: resolver } });
      expect(result).toMatchObject({
        errors: [
          expect.objectContaining({
            message: expect.stringContaining("@live"),
          }),
        ],
      });
      expect(resolver).not.toHaveBeenCalled();
    });

    it("allows disabled incremental directives and skipped deferred selections", async () => {
      const iterator = stream(
        await execute(
          `
      query @live {
        ... @defer(if: false) { value }
        ... @skip(if: true) @defer { other }
      }
    `,
          { Query: { value: () => 1 } },
        ),
      );
      try {
        expect((await iterator.next()).value).toEqual({ data: { value: 1 } });
      } finally {
        await iterator.return();
      }
    });

    it("passes snapshots rather than source handles to field hooks", async () => {
      const state = cell(1);
      const afterFieldResolve = jest.fn();
      const afterBuildResponse = jest.fn();
      const iterator = stream(
        await execute(
          "query @live { value other }",
          {
            Query: {
              value: () => state.source,
              other: async () => state.source,
            },
          },
          undefined,
          { afterFieldResolve, afterBuildResponse },
        ),
      );
      try {
        await iterator.next();
        expect(
          afterFieldResolve.mock.calls.map(([args]) => args.result),
        ).toEqual([1, 1]);
        state.set(2);
        await iterator.next();
        expect(afterBuildResponse).toHaveBeenCalledTimes(2);
      } finally {
        await iterator.return();
      }
    });
  },
);

it("does not confuse ordinary resolver objects with branded sources", async () => {
  const read = jest.fn();
  const result = executeWithSchema({
    definitions,
    document: parse("{ parent { id } }"),
    resolvers: {
      Query: { parent: () => ({ id: "ordinary", read, subscribe: read }) },
    },
  });
  expect(result).toEqual({ data: { parent: { id: "ordinary" } } });
  expect(isLiveSource({ read, subscribe: read })).toBe(false);
  expect(read).not.toHaveBeenCalled();
});
