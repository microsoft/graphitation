import { gql } from "@apollo/client";
import type { DocumentNode } from "graphql";
import { ForestRun } from "../ForestRun";
import { resolveOperationDescriptor } from "../cache/descriptor";
import { canReleaseOperationDescriptor } from "../cache/store";
import type {
  ExecutionKey,
  IncrementalDeferResult,
} from "../incremental/types";

class TestCache extends ForestRun {
  operation(query: DocumentNode, variables = {}) {
    return resolveOperationDescriptor(this.env, this.store, query, variables);
  }
  inFlight(query: DocumentNode, variables = {}) {
    return this.store.inFlightExecutions.get(this.operation(query, variables));
  }
  mainTree(query: DocumentNode, variables = {}) {
    return this.store.dataForest.trees.get(this.operation(query, variables).id);
  }
  canRelease(query: DocumentNode, variables = {}) {
    return canReleaseOperationDescriptor(
      this.store,
      this.operation(query, variables),
    );
  }
}

// Incremental execution in the 2022-09-17 draft format
function execute(
  cache: ForestRun,
  query: DocumentNode,
  { variables = {}, key }: { variables?: object; key?: ExecutionKey } = {},
) {
  return {
    initial(data: Record<string, unknown>) {
      return cache.writeExecutionResult({
        query,
        variables,
        execution: { data, hasNext: true, key },
      });
    },
    subsequent(
      incremental: IncrementalDeferResult[],
      { hasNext = true }: { hasNext?: boolean } = {},
    ) {
      return cache.writeExecutionResult({
        query,
        variables,
        execution: { incremental, hasNext, key },
      });
    },
    complete(incremental: IncrementalDeferResult[] = []) {
      return this.subsequent(incremental, { hasNext: false });
    },
  };
}

const message = (id: string, name?: string) => ({
  __typename: "Message",
  id,
  text: `text ${id}`,
  ...(name !== undefined && { name }),
});

// Preloader with deferred names, covering the chat query
const preloaderQuery = gql`
  query Preloader @cache(covers: ["Chat"]) {
    messages {
      id
      text
      ... @defer(label: "name") {
        name
      }
    }
  }
`;

const chatQuery = gql`
  query Chat {
    messages {
      id
      text
      name
    }
  }
`;

const nameQuery = gql`
  query Name {
    messages {
      id
      name
    }
  }
`;

// Not covered
const textQuery = gql`
  query Text {
    messages {
      id
      text
    }
  }
`;

const messageFragment = gql`
  fragment MessageName on Message {
    id
    name
  }
`;

const read = (cache: ForestRun, query: DocumentNode, optimistic = false) =>
  cache.diff({ query, optimistic, returnPartialData: true });

describe("writeExecutionResult", () => {
  it("writes a complete result like write", () => {
    const cache = new ForestRun();
    const legacyCache = new ForestRun();
    const data = { messages: [message("1", "one")] };

    const ref = cache.writeExecutionResult({
      query: preloaderQuery,
      execution: { data },
    });
    const legacyRef = legacyCache.write({
      query: preloaderQuery,
      result: data,
    });

    expect(ref).toEqual(legacyRef);
    expect(cache.extract()).toEqual(legacyCache.extract());
  });

  it("returns the root reference for initial results only", () => {
    const cache = new ForestRun();
    const execution = execute(cache, preloaderQuery);

    expect(execution.initial({ messages: [message("1")] })).toEqual({
      __ref: "ROOT_QUERY",
    });
    expect(
      execution.subsequent([{ path: ["messages", 0], data: { name: "one" } }]),
    ).toBeUndefined();
    expect(execution.complete()).toBeUndefined();
  });

  it("writes all received results to the data forest on completion", () => {
    const cache = new TestCache();
    const execution = execute(cache, preloaderQuery);
    execution.initial({ messages: [message("1"), message("2")] });
    execution.subsequent([
      { path: ["messages", 0], label: "name", data: { name: "one" } },
    ]);
    execution.complete([
      { path: ["messages", 1], label: "name", data: { name: "two" } },
    ]);

    expect(cache.inFlight(preloaderQuery)).toBeUndefined();
    expect(read(cache, nameQuery)).toMatchObject({
      complete: true,
      result: {
        messages: [
          { __typename: "Message", id: "1", name: "one" },
          { __typename: "Message", id: "2", name: "two" },
        ],
      },
    });
  });

  it("splices results copy-on-write (received results stay intact)", () => {
    const cache = new TestCache();
    const execution = execute(cache, preloaderQuery);
    const initial = { messages: [message("1"), message("2")] };
    execution.initial(initial);
    const received = cache.inFlight(preloaderQuery)?.data;

    execution.subsequent([{ path: ["messages", 0], data: { name: "one" } }]);
    const spliced = cache.inFlight(preloaderQuery)?.data;

    expect(initial).toEqual({ messages: [message("1"), message("2")] });
    expect(received).toBe(initial);
    expect(spliced).not.toBe(initial);
    // Unchanged subtrees are shared
    expect((spliced?.messages as unknown[])[1]).toBe(initial.messages[1]);
  });

  it("writes results of nested @defer delivered with their parent in one payload", () => {
    const cache = new TestCache();
    const query = gql`
      query {
        user {
          id
          ... @defer(label: "outer") {
            friends {
              id
              ... @defer(label: "inner") {
                bio
              }
            }
          }
        }
      }
    `;
    const execution = execute(cache, query);
    execution.initial({ user: { __typename: "User", id: "u" } });
    execution.subsequent([
      // Child first
      { path: ["user", "friends", 0], label: "inner", data: { bio: "bio" } },
      {
        path: ["user"],
        label: "outer",
        data: { friends: [{ __typename: "User", id: "f" }] },
      },
    ]);

    expect(read(cache, query)).toMatchObject({
      complete: true,
      result: {
        user: {
          id: "u",
          friends: [{ __typename: "User", id: "f", bio: "bio" }],
        },
      },
    });
  });
});

describe("in-flight layer", () => {
  it("is only visible to the operation itself while streaming", () => {
    const cache = new TestCache();
    cache.write({ query: nameQuery, result: { messages: [] } });
    const execution = execute(cache, preloaderQuery);
    execution.initial({ messages: [message("1")] });
    execution.subsequent([{ path: ["messages", 0], data: { name: "one" } }]);

    expect(read(cache, preloaderQuery)).toMatchObject({
      complete: true,
      result: { messages: [message("1", "one")] },
    });
    // Other operations read the data forest only
    expect(read(cache, nameQuery).result).toEqual({ messages: [] });
    expect(
      cache.readFragment({ id: "Message:1", fragment: messageFragment }),
    ).toBe(null);
    expect(cache.mainTree(preloaderQuery)).toBeUndefined();
  });

  it("notifies watches of the operation on each result", () => {
    const cache = new TestCache();
    const execution = execute(cache, preloaderQuery);
    const watch = jest.fn();
    cache.watch({ query: preloaderQuery, optimistic: true, callback: watch });

    execution.initial({ messages: [message("1"), message("2")] });
    execution.subsequent([{ path: ["messages", 0], data: { name: "one" } }]);
    execution.subsequent([{ path: ["messages", 1], data: { name: "two" } }]);

    expect(watch).toHaveBeenCalledTimes(3);
    expect(watch.mock.calls[0][0]).toMatchObject({ complete: false });
    expect(watch.mock.calls[1][0].result).toEqual({
      messages: [message("1", "one"), message("2")],
    });
    expect(watch.mock.calls[2][0]).toMatchObject({
      complete: true,
      result: { messages: [message("1", "one"), message("2", "two")] },
    });
  });

  it("does not notify watches of other operations until completion", () => {
    const cache = new TestCache();
    cache.write({
      query: nameQuery,
      result: { messages: [{ __typename: "Message", id: "1", name: "old" }] },
    });
    const watch = jest.fn();
    cache.watch({
      query: nameQuery,
      optimistic: true,
      immediate: true,
      callback: watch,
    });
    watch.mockClear();
    const execution = execute(cache, preloaderQuery);

    execution.initial({ messages: [message("1")] });
    execution.subsequent([{ path: ["messages", 0], data: { name: "new" } }]);
    expect(watch).not.toHaveBeenCalled();

    execution.complete();
    expect(watch).toHaveBeenCalledTimes(1);
    expect(watch.mock.calls[0][0].result).toEqual({
      messages: [{ __typename: "Message", id: "1", name: "new" }],
    });
  });

  it("starts from the existing result of the operation (no loaders for pending fields)", () => {
    const cache = new TestCache();
    cache.write({
      query: preloaderQuery,
      result: { messages: [message("1", "one")] },
    });
    const watch = jest.fn();
    cache.watch({
      query: preloaderQuery,
      optimistic: true,
      immediate: true,
      callback: watch,
    });
    const before = watch.mock.calls[0][0];

    // The same data as stored, with the deferred field pending
    execute(cache, preloaderQuery).initial({ messages: [message("1")] });

    expect(watch).toHaveBeenCalledTimes(1);
    expect(read(cache, preloaderQuery, true).result).toBe(before.result);
    expect(read(cache, preloaderQuery)).toMatchObject({
      complete: true,
      result: { messages: [message("1", "one")] },
    });
  });

  it("keeps existing values of pending fields when the initial result changes other fields", () => {
    const cache = new TestCache();
    cache.write({
      query: preloaderQuery,
      result: { messages: [message("1", "one")] },
    });
    execute(cache, preloaderQuery).initial({
      messages: [{ ...message("1"), text: "edited" }],
    });

    expect(read(cache, preloaderQuery)).toMatchObject({
      complete: true,
      result: { messages: [{ ...message("1", "one"), text: "edited" }] },
    });
    expect(read(cache, textQuery).result).toEqual({
      messages: [{ __typename: "Message", id: "1", text: "text 1" }],
    });
  });

  it("writes data of an execution over newer results on completion (last write wins)", () => {
    const cache = new TestCache();
    const execution = execute(cache, preloaderQuery);
    execution.initial({ messages: [message("1")] });
    // An external write (e.g. a subscription) lands in the data forest while streaming
    cache.writeFragment({
      id: "Message:1",
      fragment: gql`
        fragment Text on Message {
          text
        }
      `,
      data: { __typename: "Message", text: "external" },
    });
    expect(read(cache, preloaderQuery).result).toEqual({
      messages: [message("1")],
    });

    execution.complete([{ path: ["messages", 0], data: { name: "one" } }]);
    expect(read(cache, chatQuery).result).toEqual({
      messages: [message("1", "one")],
    });
  });

  it("writes a deferred fragment to its server object after a local list prepend (apollo-client#13530)", () => {
    const cache = new TestCache();
    cache.write({ query: preloaderQuery, result: { messages: [] } });
    const execution = execute(cache, preloaderQuery);
    execution.initial({ messages: [message("1")] });
    cache.modify({
      fields: {
        messages(existing) {
          const ref = cache.writeFragment({
            fragment: gql`
              fragment Sent on Message {
                id
                text
                name
              }
            `,
            data: message("2", "not deferred"),
          });
          return [ref, ...existing];
        },
      },
    });

    execution.subsequent([{ path: ["messages", 0], data: { name: "one" } }]);
    expect(read(cache, preloaderQuery).result).toEqual({
      messages: [message("1", "one")],
    });

    execution.complete();
    expect(read(cache, preloaderQuery).result).toEqual({
      messages: [message("1", "one")],
    });
    expect(
      cache.readFragment({ id: "Message:2", fragment: messageFragment }),
    ).toEqual({ __typename: "Message", id: "2", name: "not deferred" });
  });

  it("is applied below optimistic layers", () => {
    const cache = new TestCache();
    const execution = execute(cache, preloaderQuery);
    execution.initial({ messages: [message("1")] });
    execution.subsequent([{ path: ["messages", 0], data: { name: "one" } }]);
    cache.recordOptimisticTransaction((c) => {
      c.writeFragment({
        id: "Message:1",
        fragment: gql`
          fragment Text on Message {
            text
          }
        `,
        data: { __typename: "Message", text: "optimistic" },
      });
    }, "layer");

    expect(read(cache, preloaderQuery, true).result).toEqual({
      messages: [{ ...message("1", "one"), text: "optimistic" }],
    });
    expect(read(cache, preloaderQuery).result).toEqual({
      messages: [message("1", "one")],
    });
    cache.removeOptimistic("layer");
    expect(read(cache, preloaderQuery, true).result).toEqual({
      messages: [message("1", "one")],
    });
  });

  it("can't be written within optimistic transactions", () => {
    const cache = new TestCache();
    expect(() =>
      cache.recordOptimisticTransaction(() => {
        execute(cache, preloaderQuery).initial({ messages: [] });
      }, "layer"),
    ).toThrow();
  });
});

describe("covered operations (@cache(covers))", () => {
  it("read through the in-flight layer and are notified on each result", () => {
    const cache = new TestCache();
    cache.write({
      query: chatQuery,
      result: { messages: [message("1", "old")] },
    });
    const watch = jest.fn();
    cache.watch({
      query: chatQuery,
      optimistic: true,
      immediate: true,
      callback: watch,
    });
    watch.mockClear();
    const execution = execute(cache, preloaderQuery);

    execution.initial({ messages: [message("1")] });
    expect(watch).not.toHaveBeenCalled(); // nothing changed

    execution.subsequent([{ path: ["messages", 0], data: { name: "new" } }]);
    expect(watch).toHaveBeenCalledTimes(1);
    expect(watch.mock.calls[0][0]).toMatchObject({
      complete: true,
      result: { messages: [message("1", "new")] },
    });
  });

  it("read the in-flight layer cache-first (without own results)", () => {
    const cache = new TestCache();
    const execution = execute(cache, preloaderQuery);
    execution.initial({ messages: [message("1")] });
    expect(read(cache, chatQuery).complete).toBe(false);

    const watch = jest.fn();
    cache.watch({ query: chatQuery, optimistic: true, callback: watch });
    execution.subsequent([{ path: ["messages", 0], data: { name: "one" } }]);

    expect(watch).toHaveBeenCalledTimes(1);
    expect(watch.mock.calls[0][0]).toMatchObject({
      complete: true,
      result: { messages: [message("1", "one")] },
    });
  });

  it("are matched by name with any variables", () => {
    const cache = new TestCache();
    const chatWithVariables = gql`
      query Chat($first: Int) {
        messages(first: $first) {
          id
          text
          name
        }
      }
    `;
    const preloader = gql`
      query Preloader($first: Int) @cache(covers: ["Chat"]) {
        messages(first: $first) {
          id
          text
          ... @defer {
            name
          }
        }
      }
    `;
    const variables = { first: 1 };
    const execution = execute(cache, preloader, { variables });
    execution.initial({ messages: [message("1")] });
    execution.subsequent([{ path: ["messages", 0], data: { name: "one" } }]);

    expect(
      cache.diff({ query: chatWithVariables, variables, optimistic: false }),
    ).toMatchObject({
      complete: true,
      result: { messages: [message("1", "one")] },
    });
  });

  it("keep their own results written while streaming", () => {
    const cache = new TestCache();
    cache.write({
      query: chatQuery,
      result: { messages: [message("1", "old")] },
    });
    const execution = execute(cache, preloaderQuery);
    execution.initial({ messages: [message("1")] });

    // Own (network) result of the covered operation
    cache.write({
      query: chatQuery,
      result: { messages: [message("1", "own"), message("2", "own")] },
    });
    expect(read(cache, chatQuery).result).toEqual({
      messages: [message("1", "own"), message("2", "own")],
    });

    // Later results of the execution still update it (in the in-flight layer)
    execution.subsequent([{ path: ["messages", 0], data: { name: "new" } }]);
    expect(read(cache, chatQuery).result).toEqual({
      messages: [message("1", "new"), message("2", "own")],
    });
  });

  it("read the data forest after completion", () => {
    const cache = new TestCache();
    const watch = jest.fn();
    cache.watch({ query: chatQuery, optimistic: true, callback: watch });
    const execution = execute(cache, preloaderQuery);
    execution.initial({ messages: [message("1")] });
    execution.subsequent([{ path: ["messages", 0], data: { name: "one" } }]);
    execution.complete();

    expect(watch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        complete: true,
        result: { messages: [message("1", "one")] },
      }),
      expect.anything(),
    );
    expect(read(cache, chatQuery).result).toEqual({
      messages: [message("1", "one")],
    });
  });
});

describe("timeout and cancellation", () => {
  it("writes received results on timeout (synthetic hasNext: false)", () => {
    const cache = new TestCache();
    cache.write({
      query: preloaderQuery,
      result: { messages: [message("1", "old 1"), message("2", "old 2")] },
    });
    const execution = execute(cache, preloaderQuery);
    execution.initial({ messages: [message("1"), message("2")] });
    execution.subsequent([{ path: ["messages", 0], data: { name: "new 1" } }]);

    // Timeout
    cache.writeExecutionResult({
      query: preloaderQuery,
      execution: { hasNext: false },
    });

    expect(cache.inFlight(preloaderQuery)).toBeUndefined();
    // Pending fields keep existing values
    expect(read(cache, chatQuery)).toMatchObject({
      complete: true,
      result: { messages: [message("1", "new 1"), message("2", "old 2")] },
    });
  });

  it("discards the current execution when a new one starts", () => {
    const cache = new TestCache();
    const first = execute(cache, preloaderQuery, { key: 1 });
    first.initial({ messages: [message("1")] });
    first.subsequent([{ path: ["messages", 0], data: { name: "first" } }]);
    const watch = jest.fn();
    cache.watch({ query: preloaderQuery, optimistic: true, callback: watch });

    const second = execute(cache, preloaderQuery, { key: 2 });
    second.initial({ messages: [message("2")] });
    expect(watch).toHaveBeenCalledTimes(1);
    expect(watch.mock.calls[0][0].result).toEqual({
      messages: [message("2")],
    });

    // Late results of the cancelled execution are ignored
    first.complete([{ path: ["messages", 0], data: { name: "late" } }]);
    expect(cache.inFlight(preloaderQuery)?.key).toBe(2);
    expect(read(cache, chatQuery).complete).toBe(false);

    second.complete([{ path: ["messages", 0], data: { name: "second" } }]);
    // Nothing of the cancelled execution was written
    expect(
      cache.readFragment({ id: "Message:1", fragment: messageFragment }),
    ).toBe(null);
    expect(read(cache, chatQuery).result).toEqual({
      messages: [message("2", "second")],
    });
  });

  it("discards the current execution on a complete result of the operation", () => {
    const cache = new TestCache();
    execute(cache, preloaderQuery).initial({ messages: [message("1")] });
    cache.writeExecutionResult({
      query: preloaderQuery,
      execution: { data: { messages: [message("2", "two")] } },
    });

    expect(cache.inFlight(preloaderQuery)).toBeUndefined();
    expect(read(cache, chatQuery).result).toEqual({
      messages: [message("2", "two")],
    });
  });

  it("ignores results of unknown executions", () => {
    const cache = new TestCache();
    execute(cache, preloaderQuery).complete([
      { path: ["messages", 0], data: { name: "one" } },
    ]);
    expect(cache.extract()).toEqual({});
  });

  it("keeps the descriptor of a non-cacheable operation while streaming", () => {
    const cache = new TestCache({ cleanupNonCacheableOperations: true });
    cache.write({
      query: nameQuery,
      result: { messages: [{ __typename: "Message", id: "1", name: "old" }] },
    });
    const mutation = gql`
      mutation Send {
        send {
          id
          text
          ... @defer {
            name
          }
        }
      }
    `;
    const execution = execute(cache, mutation);
    execution.initial({ send: message("1") });
    execution.subsequent([{ path: ["send"], data: { name: "pending" } }]);
    expect(cache.canRelease(mutation)).toBe(false);
    expect(read(cache, nameQuery).result).toEqual({
      messages: [{ __typename: "Message", id: "1", name: "old" }],
    });

    execution.complete([{ path: ["send"], data: { name: "one" } }]);
    expect(cache.canRelease(mutation)).toBe(true);
    expect(read(cache, nameQuery).result).toEqual({
      messages: [{ __typename: "Message", id: "1", name: "one" }],
    });
  });

  it("is discarded on reset", async () => {
    const cache = new TestCache();
    execute(cache, preloaderQuery).initial({ messages: [message("1")] });
    await cache.reset();
    expect(cache.inFlight(preloaderQuery)).toBeUndefined();
  });
});
