import { gql } from "@apollo/client";
import type { DocumentNode } from "graphql";
import { ForestRun } from "../ForestRun";
import { resolveOperationDescriptor } from "../cache/descriptor";
import { canReleaseOperationDescriptor } from "../cache/store";
import { assert } from "../jsutils/assert";
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
  it("reads results like regular results (no re-hydration)", () => {
    const cache = new TestCache();
    const regular = new TestCache();
    const data = { messages: [message("1"), message("2")] };
    execute(cache, preloaderQuery).initial(data);
    regular.write({ query: preloaderQuery, result: data });

    const diff = read(cache, preloaderQuery);
    expect(diff).toEqual(read(regular, preloaderQuery));
    const inFlight = cache.inFlight(preloaderQuery);
    const tree = inFlight?.forest.trees.get(cache.operation(preloaderQuery).id);
    expect(diff.result).toBe(tree?.result.data);
  });
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
    // Pending fields read like fields missing in a regular write (complete)
    expect(watch.mock.calls[0][0]).toMatchObject({
      complete: true,
      result: { messages: [message("1"), message("2")] },
    });
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
    // As with a regular write of the preloader result (its chunks are recycled)
    expect(read(cache, chatQuery)).toMatchObject({
      complete: true,
      result: { messages: [message("1")] },
    });

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

  it("keep their own results written while streaming (until a later result of the execution)", () => {
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
    // Written to the layer like to a forest: other trees with its nodes agree (the preloader sees it too)
    expect(read(cache, preloaderQuery).result).toEqual({
      messages: [message("1", "own"), message("2", "own")],
    });

    // A later result of the execution is a later write to the layer (last write wins)
    execution.subsequent([{ path: ["messages", 0], data: { name: "new" } }]);
    expect(read(cache, chatQuery).result).toEqual({
      messages: [message("1", "new")],
    });
  });

  it("never blend values of trees of the layer (e.g. items of different lists)", () => {
    const cache = new TestCache({
      typePolicies: {
        Query: {
          fields: {
            messages: {
              merge: (existing: unknown[] = [], incoming: unknown[]) => [
                ...existing,
                ...incoming,
              ],
            },
          },
        },
      },
    });
    const execution = execute(cache, preloaderQuery);
    execution.initial({ messages: [message("1"), message("2")] });
    // Own result of the covered operation: merged with the data forest (no page 1 there yet)
    cache.write({
      query: chatQuery,
      result: { messages: [message("3", "three"), message("4", "four")] },
    });
    // Optimistic layers make reads re-hydrate results from all trees with their nodes
    cache.recordOptimisticTransaction((c) => {
      c.writeFragment({
        id: "Message:4",
        fragment: gql`
          fragment Text on Message {
            text
          }
        `,
        data: { __typename: "Message", text: "optimistic" },
      });
    }, "layer");

    expect(read(cache, chatQuery, true).result).toEqual({
      messages: [
        message("3", "three"),
        { ...message("4", "four"), text: "optimistic" },
      ],
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

describe("merge policies of in-flight writes", () => {
  const query = gql`
    query {
      viewer {
        id
        tags
        ... @defer(label: "a") {
          name
        }
        ... @defer(label: "b") {
          bio
        }
      }
    }
  `;
  const user = { __typename: "User", id: "u" };

  it.each([
    [[], ["x"]],
    [["a"], ["a", "x"]],
  ])(
    "merge with the data forest (existing: %j) on each result and on completion",
    (existing, expected) => {
      const merge = jest.fn((prev: string[] = [], incoming: string[]) => [
        ...prev,
        ...incoming,
      ]);
      const cache = new ForestRun({
        typePolicies: { User: { fields: { tags: { merge } } } },
      });
      if (existing.length) {
        cache.writeQuery({
          query,
          data: { viewer: { ...user, tags: existing } },
        });
        merge.mockClear();
      }
      const tags = () =>
        (read(cache, query).result as { viewer: { tags: string[] } }).viewer
          .tags;
      const execution = execute(cache, query);
      execution.initial({ viewer: { ...user, tags: ["x"] } });
      expect(tags()).toEqual(expected);

      execution.subsequent([
        { path: ["viewer"], label: "a", data: { name: "n" } },
      ]);
      expect(tags()).toEqual(expected);
      execution.subsequent([
        { path: ["viewer"], label: "b", data: { bio: "b" } },
      ]);
      expect(tags()).toEqual(expected);

      execution.complete();
      expect(tags()).toEqual(expected);
      for (const [prev] of merge.mock.calls) {
        expect(prev ?? []).toEqual(existing);
      }
    },
  );
});

describe("timeout and cancellation", () => {
  it.each([
    [false, false],
    [true, true],
  ])(
    "writes initial results with @defer(if: %s) to the data forest unless deferred (in flight: %s)",
    (defer, inFlight) => {
      const cache = new TestCache();
      const query = gql`
        query ($defer: Boolean) {
          messages {
            id
            text
            ... @defer(if: $defer) {
              name
            }
          }
        }
      `;
      const variables = { defer };
      cache.writeExecutionResult({
        query,
        variables,
        execution: { data: { messages: [message("1")] }, hasNext: true },
      });

      expect(Boolean(cache.inFlight(query, variables))).toBe(inFlight);
      expect(Boolean(cache.mainTree(query, variables))).toBe(!inFlight);
    },
  );
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
    expect(read(cache, chatQuery).result).toEqual({
      messages: [message("2")],
    });

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

describe("@defer: fetchMore on a covered query while the preloader streams", () => {
  const MessageList = gql`
    query MessageList($id: ID!) {
      conversation(id: $id) {
        id
        messages {
          id
          text
        }
      }
    }
  `;
  const Preloader = gql`
    query Preloader($id: ID!) @cache(covers: ["MessageList"]) {
      conversation(id: $id) {
        id
        messages {
          id
          ... @defer {
            text
          }
        }
      }
    }
  `;
  // The same selection as MessageList under another name: not covered, reads the data forest only
  const OtherList = gql`
    query OtherList($id: ID!) {
      conversation(id: $id) {
        id
        messages {
          id
          text
        }
      }
    }
  `;
  const variables = { id: "c1" };
  const msg = (id: string, text?: string) => ({
    __typename: "Message",
    id,
    ...(text !== undefined && { text }),
  });
  const conversation = (messages: object[]) => ({
    conversation: { __typename: "Conversation", id: "c1", messages },
  });
  type Messages = {
    conversation?: { messages?: { id: string; text?: string }[] };
  };
  // e.g. { messages: ["m1:t1", "m2:-"], complete: true }
  const summarize = ({
    result,
    complete,
  }: {
    result?: unknown;
    complete?: boolean;
  }) => ({
    messages: ((result as Messages | null)?.conversation?.messages ?? []).map(
      (m) => `${m.id}:${m.text ?? "-"}`,
    ),
    complete,
  });

  // (A) Apollo 3 fetchMore with `updateQuery` (ObservableQuery.updateQuery: a partial non-optimistic diff + writeQuery).
  //   Note: `cache.updateQuery` can't be used here: it reads complete data only, so `prev` is null while texts are pending
  // (B) Apollo 3 fetchMore without `updateQuery`: writeQuery of the fetchMore result, merged by the field policy.
  //   Note: the same query and variables are written (without an `$after` argument): in ForestRun, a field with arguments
  //   doesn't match the same field without arguments even with `keyArgs: false`, unrelated to @defer
  it.each(["updateQuery", "merge policy"] as const)(
    "fetchMore via %s",
    (variant) => {
      const cache = new ForestRun({
        typePolicies: {
          Conversation: {
            fields: {
              messages:
                variant === "merge policy"
                  ? {
                      keyArgs: false,
                      merge: (
                        existing: unknown[] = [],
                        incoming: unknown[],
                      ) => [...existing, ...incoming],
                    }
                  : { keyArgs: false },
            },
          },
        },
      });
      const watch = jest.fn();
      cache.watch({
        query: MessageList,
        variables,
        optimistic: true,
        returnPartialData: true,
        callback: watch,
      });
      const diff = (query: DocumentNode) =>
        cache.diff({
          query,
          variables,
          optimistic: true,
          returnPartialData: true,
        });
      const record = () => {
        const step = {
          list: summarize(diff(MessageList)),
          watch: watch.mock.calls.map(([d]) => summarize(d)),
          preloader: summarize(diff(Preloader)),
        };
        watch.mockClear();
        return step;
      };
      const steps = [];

      // 1. Initial payload of the preloader (page 1, texts deferred)
      cache.writeExecutionResult({
        query: Preloader,
        variables,
        execution: {
          data: conversation([msg("m1"), msg("m2")]),
          hasNext: true,
        },
      });
      steps.push(record());

      // 2. fetchMore result (page 2)
      const page2 = [msg("m3", "t3"), msg("m4", "t4")];
      if (variant === "updateQuery") {
        const prev = cache.diff<ReturnType<typeof conversation>>({
          query: MessageList,
          variables,
          returnPartialData: true,
          optimistic: false,
        }).result;
        assert(prev);
        cache.writeQuery({
          query: MessageList,
          variables,
          data: {
            ...prev,
            conversation: {
              ...prev.conversation,
              messages: [...prev.conversation.messages, ...page2],
            },
          },
        });
      } else {
        cache.writeQuery({
          query: MessageList,
          variables,
          data: conversation(page2),
        });
      }
      steps.push(record());

      // 3. Subsequent payload of the preloader (texts of page 1), completes the execution (commit)
      cache.writeExecutionResult({
        query: Preloader,
        variables,
        execution: {
          incremental: [
            { path: ["conversation", "messages", 0], data: { text: "t1" } },
            { path: ["conversation", "messages", 1], data: { text: "t2" } },
          ],
          hasNext: false,
        },
      });
      steps.push(record());
      // (no separate commit step: `hasNext: false` commits)

      const dataForest = summarize(diff(OtherList));

      // Pending texts read like fields missing in a regular write (complete)
      const page1Pending = { messages: ["m1:-", "m2:-"], complete: true };
      if (variant === "updateQuery") {
        expect(steps).toEqual([
          {
            list: page1Pending,
            watch: [page1Pending],
            preloader: page1Pending,
          },
          {
            // Its own write wins for itself (pending texts of page 1 as the write left them). It is written to the
            //   layer like to a forest, so the preloader's tree in the layer agrees with it (until its next result)
            list: {
              messages: ["m1:-", "m2:-", "m3:t3", "m4:t4"],
              complete: true,
            },
            watch: [
              { messages: ["m1:-", "m2:-", "m3:t3", "m4:t4"], complete: true },
            ],
            preloader: {
              messages: ["m1:-", "m2:-", "m3:t3", "m4:t4"],
              complete: true,
            },
          },
          {
            // By design, page 2 is lost: the commit writes the preloader's list over it (no merge policy, last write wins,
            //   same as a slow non-deferred preloader response arriving after fetchMore)
            list: { messages: ["m1:t1", "m2:t2"], complete: true },
            watch: [{ messages: ["m1:t1", "m2:t2"], complete: true }],
            preloader: { messages: ["m1:t1", "m2:t2"], complete: true },
          },
        ]);
        expect(dataForest).toEqual({
          messages: ["m1:t1", "m2:t2"],
          complete: true,
        });
      } else {
        expect(steps).toEqual([
          {
            list: page1Pending,
            watch: [page1Pending],
            preloader: page1Pending,
          },
          {
            // Its own write wins for itself: the data forest has no page 1 yet, so page 2 is merged with nothing.
            //   Trees of the layer agree (no texts of one list on items of another)
            list: { messages: ["m3:t3", "m4:t4"], complete: true },
            watch: [{ messages: ["m3:t3", "m4:t4"], complete: true }],
            preloader: { messages: ["m3:t3", "m4:t4"], complete: true },
          },
          {
            // By design, page 1 goes after page 2: the commit is a regular write after fetchMore, so the merge policy
            //   appends page 1 (same as a slow non-deferred preloader response arriving after fetchMore)
            list: {
              messages: ["m3:t3", "m4:t4", "m1:t1", "m2:t2"],
              complete: true,
            },
            watch: [
              {
                messages: ["m3:t3", "m4:t4", "m1:t1", "m2:t2"],
                complete: true,
              },
            ],
            preloader: {
              messages: ["m3:t3", "m4:t4", "m1:t1", "m2:t2"],
              complete: true,
            },
          },
        ]);
        expect(dataForest).toEqual({
          messages: ["m3:t3", "m4:t4", "m1:t1", "m2:t2"],
          complete: true,
        });
      }
    },
  );
});
