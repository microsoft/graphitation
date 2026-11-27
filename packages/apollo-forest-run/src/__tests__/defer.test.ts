import { gql } from "@apollo/client";
import type { TypePolicies } from "@apollo/client";
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
    return this.store.executions.get(this.operation(query, variables));
  }
  layer(query: DocumentNode, variables = {}) {
    const execution = this.inFlight(query, variables);
    return this.store.optimisticLayers.find(
      (layer) => layer.layerTag === execution?.layerTag,
    );
  }
  optimisticLayerCount() {
    return this.store.optimisticLayers.length;
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

// Streamed data is optimistic data: optimistic reads see it
const read = (cache: ForestRun, query: DocumentNode, optimistic = true) =>
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

  it("writes untyped execution options of write like write without result", () => {
    const cache = new ForestRun();
    const legacyCache = new ForestRun();
    const data = { messages: [message("1", "one")] };
    cache.write({ query: preloaderQuery, result: data });
    legacyCache.write({ query: preloaderQuery, result: data });

    // Untyped options (not Cache.WriteOptions)
    const options = {
      query: preloaderQuery,
      execution: { incremental: [], hasNext: false },
    };
    // @ts-expect-error write accepts results only (Apollo Cache.WriteOptions)
    cache.write(options);
    legacyCache.write({ query: preloaderQuery, result: undefined });

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
    const tree = cache
      .layer(preloaderQuery)
      ?.trees.get(cache.operation(preloaderQuery).id);
    // Adapted: optimistic reads re-hydrate (an equal result, not the tree in the layer)
    expect(diff.result).toEqual(tree?.result.data);
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
    // Adapted: all optimistic reads see streamed data (like optimistic data), non-optimistic reads don't
    expect(read(cache, nameQuery).result).toEqual({
      messages: [{ __typename: "Message", id: "1", name: "one" }],
    });
    expect(read(cache, nameQuery, false).result).toEqual({ messages: [] });
    expect(read(cache, preloaderQuery, false).result).toEqual({ messages: [] });
    expect(
      cache.readFragment({
        id: "Message:1",
        fragment: messageFragment,
        optimistic: true,
      }),
    ).toEqual({ __typename: "Message", id: "1", name: "one" });
    expect(
      cache.readFragment({ id: "Message:1", fragment: messageFragment }),
    ).toBe(null);
    // Adapted: grown by reads of the data forest (nothing written there)
    expect(cache.mainTree(preloaderQuery)).toMatchObject({ grown: true });
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
    // Adapted: optimistic watches of other operations are notified on each result
    expect(watch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        result: { messages: [{ __typename: "Message", id: "1", name: "new" }] },
      }),
      expect.anything(),
    );
    watch.mockClear();

    execution.complete();
    // Adapted: notified with an equal result on completion (new objects, as on commits of optimistic data)
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

    // Adapted: re-hydrated through the layer (an equal result, new objects)
    expect(watch).toHaveBeenCalledTimes(2);
    for (const [diff] of watch.mock.calls) {
      expect(diff).toEqual(before);
    }
    expect(read(cache, preloaderQuery, true).result).toEqual(before.result);
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
    // Adapted: optimistic reads of other operations see the result, non-optimistic reads don't
    expect(read(cache, textQuery).result).toEqual({
      messages: [{ __typename: "Message", id: "1", text: "edited" }],
    });
    expect(read(cache, textQuery, false).result).toEqual({
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
    // Adapted: non-optimistic reads see neither layer
    expect(read(cache, preloaderQuery, false).result).toEqual({});
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
    // Adapted: `name` is pending (missing), as with a regular optimistic layer (covering chunks are only recycled
    //   as a whole from the layer of the covered operation)
    expect(read(cache, chatQuery)).toMatchObject({
      complete: false,
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

    // Adapted: optimistic reads (any operation)
    expect(
      cache.diff({ query: chatWithVariables, variables, optimistic: true }),
    ).toMatchObject({
      complete: true,
      result: { messages: [message("1", "one")] },
    });
  });

  it("do not see their own results written while streaming (the commit wins)", () => {
    const cache = new TestCache();
    cache.write({
      query: chatQuery,
      result: { messages: [message("1", "old")] },
    });
    const execution = execute(cache, preloaderQuery);
    execution.initial({ messages: [message("1")] });

    // Own (network) result of the covered operation: written to the data forest
    cache.write({
      query: chatQuery,
      result: { messages: [message("1", "own"), message("2", "own")] },
    });
    // Adapted: the list of the layer, but its pending `name` falls through to the data forest
    expect(read(cache, chatQuery).result).toEqual({
      messages: [message("1", "own")],
    });

    // Updated by results of the execution
    execution.subsequent([{ path: ["messages", 0], data: { name: "new" } }]);
    expect(read(cache, chatQuery).result).toEqual({
      messages: [message("1", "new")],
    });

    // The commit is a later write to the data forest (last write wins)
    execution.complete();
    expect(read(cache, chatQuery).result).toEqual({
      messages: [message("1", "new")],
    });
  });

  it("read only the layer for data it holds, also with optimistic layers (no blending with their own results)", () => {
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
    // Own result of the covered operation: in the data forest only
    cache.write({
      query: chatQuery,
      result: { messages: [message("3", "three"), message("4", "four")] },
    });
    // Optimistic layers make reads re-hydrate results from all layers
    cache.recordOptimisticTransaction((c) => {
      c.writeFragment({
        id: "Message:2",
        fragment: gql`
          fragment Text on Message {
            text
          }
        `,
        data: { __typename: "Message", text: "optimistic" },
      });
    }, "layer");

    expect(read(cache, chatQuery, true).result).toEqual({
      messages: [message("1"), { ...message("2"), text: "optimistic" }],
    });
  });

  it("read data the layer doesn't hold from the data forest (cache-first)", () => {
    const cache = new TestCache();
    cache.write({
      query: nameQuery,
      result: { messages: [{ __typename: "Message", id: "1", name: "old" }] },
    });
    execute(cache, preloaderQuery).initial({ messages: [message("1")] });
    // Covered, another selection (chunks of the preloader are not recycled as a whole)
    const chatNames = gql`
      query Chat {
        messages {
          id
          name
        }
      }
    `;

    expect(read(cache, chatNames)).toMatchObject({
      complete: true,
      result: { messages: [{ __typename: "Message", id: "1", name: "old" }] },
    });
  });

  it("do not see their own results where the layer has data, without blending lists", () => {
    const cache = new TestCache();
    const namesQuery = gql`
      query Names {
        messages {
          id
          name
        }
      }
    `;
    const preloader = gql`
      query Preloader @cache(covers: ["Names"]) {
        messages {
          id
          text
          ... @defer {
            name
          }
        }
      }
    `;
    execute(cache, preloader).initial({
      messages: [message("1"), message("2")],
    });
    // Own result of the covered operation (another list): in the data forest only
    cache.write({
      query: namesQuery,
      result: {
        messages: [
          { __typename: "Message", id: "3", name: "three" },
          { __typename: "Message", id: "4", name: "four" },
        ],
      },
    });

    // The list of the layer, names of other items of the data forest list are not used
    expect(read(cache, namesQuery)).toMatchObject({
      complete: false,
      result: {
        messages: [
          { __typename: "Message", id: "1" },
          { __typename: "Message", id: "2" },
        ],
      },
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

describe("covered operations: variables", () => {
  const preloader = gql`
    query Preloader($id: ID!) @cache(covers: ["Chat"]) {
      conversation(id: $id) {
        id
        messages {
          id
          text
          ... @defer {
            name
          }
        }
      }
    }
  `;
  const chat = gql`
    query Chat($id: ID!) {
      conversation(id: $id) {
        id
        messages {
          id
          text
          name
        }
      }
    }
  `;
  const chatWithFirst = gql`
    query Chat($id: ID!, $first: Int) {
      conversation(id: $id) {
        id
        messages {
          id
          text
          name
        }
      }
    }
  `;
  const chatWithoutVariables = gql`
    query Chat {
      conversation(id: "c1") {
        id
        messages {
          id
          text
          name
        }
      }
    }
  `;
  const conversation = (id: string, name: string) => ({
    conversation: {
      __typename: "Conversation",
      id,
      messages: [{ ...message("1"), name }],
    },
  });
  const preloaderVariables = { id: "c1" };

  // Adapted: covering doesn't matter, optimistic reads of the same objects see the stream
  //   (Message:1 is the same object in conversations c1 and c2)
  it.each([
    ["the same variables", true, chat, { id: "c1" }, "c1"],
    ["other values", true, chat, { id: "c2" }, "c2"],
    ["other variables", true, chatWithFirst, { id: "c1", first: 1 }, "c1"],
    ["no variables", true, chatWithoutVariables, {}, "c1"],
  ] as const)(
    "with %s: sees the stream %s",
    (_, covered, query, variables, id) => {
      const cache = new TestCache();
      cache.write({ query, variables, result: conversation(id, "old") });
      const watch = jest.fn();
      cache.watch({
        query,
        variables,
        optimistic: true,
        immediate: true,
        callback: watch,
      });
      watch.mockClear();
      const execution = execute(cache, preloader, {
        variables: preloaderVariables,
      });
      execution.initial({
        conversation: {
          __typename: "Conversation",
          id: "c1",
          messages: [message("1")],
        },
      });

      execution.subsequent([
        { path: ["conversation", "messages", 0], data: { name: "new" } },
      ]);
      expect(cache.diff({ query, variables, optimistic: true }).result).toEqual(
        conversation(id, covered ? "new" : "old"),
      );
      expect(
        cache.diff({ query, variables, optimistic: false }).result,
      ).toEqual(conversation(id, "old"));
      expect(watch).toHaveBeenCalledTimes(covered ? 1 : 0);
    },
  );
});

describe("merge policies of execution writes", () => {
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

  // Adapted: standard optimistic merge semantics. Each result merges with the existing tree of the execution's layer,
  //   so a non-idempotent merge (naive concat) duplicates once per payload while streaming (as on a refetch).
  //   The commit is a single write to the data forest (the layer is removed first): the same as without @defer.
  it.each([
    [[], [["x"], ["x", "x"], ["x", "x", "x"]], ["x"]],
    [
      ["a"],
      [
        ["a", "x"],
        ["a", "x", "x"],
        ["a", "x", "x", "x"],
      ],
      ["a", "x"],
    ],
  ])(
    "naive merges duplicate while streaming, the commit merges once (existing: %j)",
    (existing, streaming, committed) => {
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
      const tags = (optimistic = true) =>
        (
          read(cache, query, optimistic).result as {
            viewer: { tags: string[] };
          }
        ).viewer.tags;
      const execution = execute(cache, query);
      execution.initial({ viewer: { ...user, tags: ["x"] } });
      expect(tags()).toEqual(streaming[0]);

      execution.subsequent([
        { path: ["viewer"], label: "a", data: { name: "n" } },
      ]);
      expect(tags()).toEqual(streaming[1]);
      execution.subsequent([
        { path: ["viewer"], label: "b", data: { bio: "b" } },
      ]);
      expect(tags()).toEqual(streaming[2]);

      execution.complete();
      expect(tags()).toEqual(committed);
      expect(tags(false)).toEqual(committed);
      // The commit merges with the data forest
      const [lastPrev] = merge.mock.calls[merge.mock.calls.length - 1];
      expect(lastPrev ?? []).toEqual(existing);
    },
  );

  it("idempotent (offset-based) merges give the same results as without @defer", () => {
    const listQuery = gql`
      query ($offset: Int) {
        feed(offset: $offset) {
          id
          ... @defer {
            title
          }
        }
      }
    `;
    const typePolicies: TypePolicies = {
      Query: {
        fields: {
          feed: {
            keyArgs: false,
            merge: (
              existing: unknown[] = [],
              incoming: unknown[],
              { args }: { args: Record<string, unknown> | null },
            ) => {
              const merged = existing.slice();
              const offset = Number(args?.offset ?? 0);
              incoming.forEach((item, i) => (merged[offset + i] = item));
              return merged;
            },
          },
        },
      },
    };
    const item = (id: string, title?: string) => ({
      __typename: "Item",
      id,
      ...(title !== undefined && { title }),
    });
    const feed = (cache: ForestRun) =>
      cache.diff({
        query: listQuery,
        variables: { offset: 2 },
        optimistic: true,
        returnPartialData: true,
      }).result;

    const cache = new ForestRun({ typePolicies });
    const regular = new ForestRun({ typePolicies });
    for (const c of [cache, regular]) {
      c.writeQuery({
        query: listQuery,
        variables: { offset: 0 },
        data: { feed: [item("1", "one"), item("2", "two")] },
      });
    }
    const variables = { offset: 2 };
    const execution = execute(cache, listQuery, { variables });
    const page = [item("3"), item("4")];
    execution.initial({ feed: page });
    regular.writeQuery({ query: listQuery, variables, data: { feed: page } });
    expect(feed(cache)).toEqual(feed(regular));

    for (const [index, title] of ["three", "four"].entries()) {
      execution.subsequent([{ path: ["feed", index], data: { title } }]);
      page[index] = item(page[index].id, title);
      regular.writeQuery({
        query: listQuery,
        variables,
        data: { feed: page.slice() },
      });
      expect(feed(cache)).toEqual(feed(regular));
    }
    execution.complete();
    expect(feed(cache)).toEqual(feed(regular));
    expect(feed(cache)).toEqual({
      feed: [
        item("1", "one"),
        item("2", "two"),
        item("3", "three"),
        item("4", "four"),
      ],
    });
  });
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
    // Adapted: optimistic reads see the stream, non-optimistic reads don't
    expect(read(cache, nameQuery).result).toEqual({
      messages: [{ __typename: "Message", id: "1", name: "pending" }],
    });
    expect(read(cache, nameQuery, false).result).toEqual({
      messages: [{ __typename: "Message", id: "1", name: "old" }],
    });

    execution.complete([{ path: ["send"], data: { name: "one" } }]);
    expect(cache.canRelease(mutation)).toBe(true);
    expect(read(cache, nameQuery).result).toEqual({
      messages: [{ __typename: "Message", id: "1", name: "one" }],
    });
  });

  // Adapted: notified with equal results (new objects), as on commits of optimistic data
  it.each(["completion", "cancellation"] as const)(
    "notifies readers on %s with equal results when their data is the same",
    (end) => {
      const cache = new TestCache();
      const watches = [preloaderQuery, chatQuery].map((query) => {
        const watch = jest.fn();
        cache.watch({
          query,
          optimistic: true,
          immediate: true,
          callback: watch,
        });
        return watch;
      });
      const execution = execute(cache, preloaderQuery);
      execution.initial({ messages: [message("1")] });
      execution.subsequent([{ path: ["messages", 0], data: { name: "one" } }]);
      const results = watches.map(
        (watch) => watch.mock.calls[watch.mock.calls.length - 1][0].result,
      );
      for (const watch of watches) {
        watch.mockClear();
      }
      const expectEqualResults = () =>
        watches.forEach((watch, index) => {
          for (const [diff] of watch.mock.calls) {
            expect(diff.result).toEqual(results[index]);
          }
          watch.mockClear();
        });

      if (end === "completion") {
        execution.complete();
      } else {
        execute(cache, preloaderQuery).initial({
          messages: [message("1", "one")],
        });
      }
      expectEqualResults();
      // Completes the new execution (a no-op after completion)
      cache.writeExecutionResult({
        query: preloaderQuery,
        execution: { hasNext: false },
      });
      expectEqualResults();

      // Later changes are notified
      cache.writeFragment({
        id: "Message:1",
        fragment: gql`
          fragment Text on Message {
            text
          }
        `,
        data: { __typename: "Message", text: "edited" },
      });
      expect(watches[1]).toHaveBeenCalledTimes(1);
    },
  );

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
        // Adapted: the non-optimistic diff doesn't see page 1 (streamed data is optimistic)
        expect(prev).toEqual({});
        cache.writeQuery({
          query: MessageList,
          variables,
          data: conversation([
            ...(prev.conversation?.messages ?? []),
            ...page2,
          ]),
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
            // Its own write goes to the data forest only: hidden while streaming (page 2 is not visible)
            list: page1Pending,
            // Adapted: notified with an equal result (the data forest changed below the layer)
            watch: [page1Pending],
            preloader: page1Pending,
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
            // Its own write goes to the data forest only (merged with nothing there): hidden while streaming
            list: page1Pending,
            // Adapted: notified with an equal result (the data forest changed below the layer)
            watch: [page1Pending],
            preloader: page1Pending,
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

describe("execution layer: optimistic reads (new)", () => {
  const textFragment = gql`
    fragment Text on Message {
      text
    }
  `;

  it.each([false, true])(
    "fragment watches and reads (useFragment) see each result (optimizeFragmentReads: %s)",
    (optimizeFragmentReads) => {
      const cache = new TestCache({ optimizeFragmentReads });
      const watch = jest.fn();
      // As useFragment / watchFragment
      cache.watch({
        query: cache["getFragmentDoc"](messageFragment),
        id: "Message:1",
        optimistic: true,
        returnPartialData: true,
        immediate: true,
        callback: watch,
      });
      const execution = execute(cache, preloaderQuery);
      const readName = (optimistic: boolean) =>
        cache.readFragment({
          id: "Message:1",
          fragment: messageFragment,
          optimistic,
          returnPartialData: true,
        });

      execution.initial({ messages: [message("1")] });
      expect(readName(true)).toEqual({ __typename: "Message", id: "1" });
      execution.subsequent([{ path: ["messages", 0], data: { name: "one" } }]);
      expect(readName(true)).toEqual({
        __typename: "Message",
        id: "1",
        name: "one",
      });
      expect(readName(false)).toEqual({ __typename: "Message" });

      expect(watch.mock.calls.map(([diff]) => diff.result)).toEqual([
        { __typename: "Message" }, // immediate (nothing cached)
        { __typename: "Message", id: "1" },
        { __typename: "Message", id: "1", name: "one" },
      ]);
      execution.complete();
      expect(readName(false)).toEqual({
        __typename: "Message",
        id: "1",
        name: "one",
      });
    },
  );

  it("is applied over optimistic layers created before the stream", () => {
    const cache = new TestCache();
    cache.write({ query: textQuery, result: { messages: [message("1")] } });
    // e.g. a pending mutation
    cache.recordOptimisticTransaction((c) => {
      c.writeFragment({
        id: "Message:1",
        fragment: textFragment,
        data: { __typename: "Message", text: "optimistic" },
      });
    }, "mutation");
    const execution = execute(cache, preloaderQuery);
    execution.initial({ messages: [message("1")] });

    // NOTE: optimistic layers stack by creation time: the stream shadows the mutation's optimistic data
    expect(read(cache, textQuery).result).toEqual({
      messages: [{ __typename: "Message", id: "1", text: "text 1" }],
    });

    // Removing the lower layer replays the execution's layer with all data received so far
    execution.subsequent([{ path: ["messages", 0], data: { name: "one" } }]);
    cache.removeOptimistic("mutation");
    expect(cache.layer(preloaderQuery)).toBeDefined();
    expect(read(cache, preloaderQuery).result).toEqual({
      messages: [message("1", "one")],
    });

    // Later payloads are written to the replayed layer
    execution.complete();
    expect(cache.optimisticLayerCount()).toBe(0);
    expect(read(cache, preloaderQuery, false).result).toEqual({
      messages: [message("1", "one")],
    });
  });

  it("is applied below optimistic layers created while streaming, which are replayed on completion", () => {
    const cache = new TestCache();
    const execution = execute(cache, preloaderQuery);
    execution.initial({ messages: [message("1")] });
    cache.recordOptimisticTransaction((c) => {
      c.writeFragment({
        id: "Message:1",
        fragment: textFragment,
        data: { __typename: "Message", text: "optimistic" },
      });
    }, "mutation");

    execution.complete([{ path: ["messages", 0], data: { name: "one" } }]);
    expect(read(cache, preloaderQuery).result).toEqual({
      messages: [{ ...message("1", "one"), text: "optimistic" }],
    });
    cache.removeOptimistic("mutation");
    expect(read(cache, preloaderQuery).result).toEqual({
      messages: [message("1", "one")],
    });
  });

  it("is rolled back on cancellation (nothing written)", () => {
    const cache = new TestCache();
    cache.write({
      query: preloaderQuery,
      result: { messages: [message("1", "old")] },
    });
    const watch = jest.fn();
    cache.watch({ query: chatQuery, optimistic: true, callback: watch });
    const first = execute(cache, preloaderQuery, { key: 1 });
    first.initial({ messages: [{ ...message("1"), text: "first" }] });
    first.subsequent([{ path: ["messages", 0], data: { name: "first" } }]);
    expect(read(cache, chatQuery).result).toEqual({
      messages: [{ ...message("1", "first"), text: "first" }],
    });

    // A new execution of the operation with a complete result (e.g. a refetch without @defer)
    cache.writeExecutionResult({
      query: preloaderQuery,
      execution: { data: { messages: [message("1", "old")] }, key: 2 },
    });
    expect(cache.optimisticLayerCount()).toBe(0);
    expect(read(cache, chatQuery).result).toEqual({
      messages: [message("1", "old")],
    });
    expect(watch).toHaveBeenLastCalledWith(
      expect.objectContaining({ result: { messages: [message("1", "old")] } }),
      expect.anything(),
    );
    // Late results of the cancelled execution are ignored
    first.complete([{ path: ["messages", 0], data: { name: "late" } }]);
    expect(read(cache, chatQuery).result).toEqual({
      messages: [message("1", "old")],
    });
  });

  it("is committed on completion: the layer is removed and the data is written to the data forest", () => {
    const cache = new TestCache();
    const execution = execute(cache, preloaderQuery);
    execution.initial({ messages: [message("1")] });
    execution.subsequent([{ path: ["messages", 0], data: { name: "one" } }]);
    expect(cache.mainTree(preloaderQuery)).toBeUndefined();

    execution.complete();
    expect(cache.optimisticLayerCount()).toBe(0);
    expect(cache.inFlight(preloaderQuery)).toBeUndefined();
    expect(cache.mainTree(preloaderQuery)?.result.data).toEqual({
      messages: [message("1", "one")],
    });
    expect(read(cache, chatQuery, false)).toMatchObject({
      complete: true,
      result: { messages: [message("1", "one")] },
    });
  });
});

describe("execution layer: pending fields fall through to cached values (new)", () => {
  it.each([
    [
      "a keyed object",
      gql`
        query Viewer {
          viewer {
            id
            name
            ... @defer {
              bio
            }
          }
        }
      `,
      { viewer: { __typename: "User", id: "u", name: "n", bio: "cached" } },
      { viewer: { __typename: "User", id: "u", name: "n" } },
    ],
    [
      "an unkeyed embedded object",
      gql`
        query Viewer {
          viewer {
            id
            settings {
              theme
              ... @defer {
                locale
              }
            }
          }
        }
      `,
      {
        viewer: {
          __typename: "User",
          id: "u",
          settings: { __typename: "Settings", theme: "dark", locale: "en" },
        },
      },
      {
        viewer: {
          __typename: "User",
          id: "u",
          settings: { __typename: "Settings", theme: "dark" },
        },
      },
    ],
    [
      "keyed list items",
      preloaderQuery,
      { messages: [message("1", "one"), message("2", "two")] },
      { messages: [message("1"), message("2")] },
    ],
  ])(
    "in %s: complete reads of cached values, equal watch results",
    (_, query, cached, initial) => {
      const cache = new TestCache();
      cache.write({ query, result: cached });
      const watch = jest.fn();
      cache.watch({
        query,
        optimistic: true,
        immediate: true,
        callback: watch,
      });
      watch.mockClear();

      // Unchanged, deferred fields pending
      execute(cache, query).initial(initial);

      const diff = read(cache, query);
      expect(diff).toEqual({ complete: true, result: cached });
      expect(diff.missing).toBeUndefined();
      for (const [notified] of watch.mock.calls) {
        expect(notified).toEqual({ complete: true, result: cached });
      }
    },
  );
});
