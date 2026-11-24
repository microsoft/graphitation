import { gql } from "@apollo/client";
import { DocumentNode } from "graphql";
import { ForestRun } from "../ForestRun";
import {
  handleIncrementalSymbol,
  IncrementalPatch,
  WriteIncrementalInfo,
} from "../cache/incremental";

class InspectableCache extends ForestRun {
  deferTargetCount(): number {
    let count = 0;
    for (const tree of this.store.dataForest.trees.values()) {
      count += tree.deferIndex?.targets.size ?? 0;
    }
    return count;
  }
}

function execution(
  cache: ForestRun,
  query: DocumentNode,
  variables = {},
  isDeferPending: WriteIncrementalInfo["isDeferPending"] = () => true,
) {
  return {
    initial(data: Record<string, unknown>) {
      cache.write({
        query,
        variables,
        result: data,
        [handleIncrementalSymbol]: { isDeferPending },
      });
    },
    patch(incremental: IncrementalPatch[], hasNext = true) {
      cache.write({
        query,
        variables,
        result: {},
        [handleIncrementalSymbol]: { isDeferPending, incremental, hasNext },
      });
    },
  };
}

const list = gql`
  query Messages {
    messages {
      id
      text
      ...MessageName @defer(label: "name")
    }
  }
  fragment MessageName on Message {
    name
  }
`;
const message = (id: string, name?: string) => ({
  __typename: "Message",
  id,
  text: `text ${id}`,
  ...(name !== undefined && { name }),
});
const namePatch = (name: string, index = 0) => ({
  path: ["messages", index],
  label: "name",
  data: { name },
});

describe("@defer", () => {
  test("a deferred fragment is written to its original entity after a list prepend", () => {
    // https://github.com/apollographql/apollo-client/issues/13530
    const cache = new ForestRun();
    const delivery = execution(cache, list);
    delivery.initial({ messages: [message("1")] });

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
    delivery.patch([namePatch("one")], false);

    expect(cache.readQuery({ query: list })).toEqual({
      messages: [message("2", "not deferred"), message("1", "one")],
    });
  });

  test.each([false, true])(
    "a fragment is written to its original entity after a relationship change (retained elsewhere: %s)",
    (retained) => {
      const cache = new ForestRun();
      const query = gql`
        query Conversation {
          conversation {
            id
            lastMessage {
              id
              text
              ... @defer(label: "sender") {
                name
              }
            }
          }
        }
      `;
      const pinned = gql`
        query Pinned {
          pinned {
            id
            text
            name
          }
        }
      `;
      const conversation = (lastMessage: ReturnType<typeof message>) => ({
        conversation: { __typename: "Conversation", id: "c1", lastMessage },
      });
      const delivery = execution(cache, query);
      delivery.initial(conversation(message("1")));
      if (retained) {
        cache.writeQuery({
          query: pinned,
          data: { pinned: message("1", "existing") },
        });
      }
      cache.writeQuery({ query, data: conversation(message("2", "two")) });
      delivery.patch(
        [
          {
            path: ["conversation", "lastMessage"],
            label: "sender",
            data: { name: "one" },
          },
        ],
        false,
      );

      expect(cache.readQuery({ query })).toEqual(
        conversation(message("2", "two")),
      );
      if (retained) {
        expect(cache.readQuery({ query: pinned })).toEqual({
          pinned: message("1", "one"),
        });
      } else {
        // Entities which are not in the cache anymore are not re-created
        expect(
          cache.readFragment({
            id: "Message:1",
            fragment: gql`
              fragment Name on Message {
                name
              }
            `,
          }),
        ).toBeNull();
      }
    },
  );

  test("targets keep original paths, aliases and variables", () => {
    const cache = new ForestRun();
    const query = gql`
      query Nested($lang: String = "en", $include: Boolean = true) {
        list: messages {
          id
          from: sender {
            id
            ... @include(if: $include) @defer(label: "inner") {
              display: name(lang: $lang)
            }
          }
        }
      }
    `;
    const initial = { __typename: "Message", id: "1" };
    const delivery = execution(cache, query);
    delivery.initial({
      list: [{ ...initial, from: { __typename: "User", id: "a" } }],
    });
    const saved = {
      __typename: "Message",
      id: "2",
      from: { __typename: "User", id: "b", display: "preserve" },
    };
    cache.writeQuery({
      query,
      data: {
        list: [saved, { ...initial, from: { __typename: "User", id: "a" } }],
      },
    });
    delivery.patch(
      [
        {
          path: ["list", 0, "from"],
          label: "inner",
          data: { display: "Alice" },
        },
      ],
      false,
    );

    expect(cache.readQuery({ query })).toEqual({
      list: [
        saved,
        { ...initial, from: { __typename: "User", id: "a", display: "Alice" } },
      ],
    });
  });

  test("an embedded target is written in place and survives writes to its children", () => {
    const cache = new ForestRun();
    const query = gql`
      query {
        info {
          item {
            id
            text
          }
          ... @defer(label: "name") {
            name
          }
        }
      }
    `;
    const delivery = execution(cache, query);
    delivery.initial({ info: { __typename: "Info", item: message("1") } });
    cache.writeFragment({
      id: "Message:1",
      fragment: gql`
        fragment Edit on Message {
          text
        }
      `,
      data: { __typename: "Message", text: "edited" },
    });
    delivery.patch(
      [{ path: ["info"], label: "name", data: { name: "delivered" } }],
      false,
    );

    expect(cache.readQuery({ query })).toEqual({
      info: {
        __typename: "Info",
        item: { ...message("1"), text: "edited" },
        name: "delivered",
      },
    });
  });

  test("embedded targets are addressed by path from their closest entity", () => {
    const query = gql`
      query Embedded {
        message {
          id
          rows: grid {
            __typename
            ... @defer(label: "cell") {
              name
            }
          }
        }
      }
    `;
    const cache = new ForestRun();
    const delivery = execution(cache, query);
    const cell = { __typename: "Cell" };
    // The same source object at different positions
    delivery.initial({
      message: { ...message("1"), rows: [[cell], [cell]] },
    });
    delivery.patch(
      [
        { path: ["message", "rows", 1, 0], label: "cell", data: { name: "b" } },
        { path: ["message", "rows", 0, 0], label: "cell", data: { name: "a" } },
      ],
      false,
    );

    expect(cache.readQuery({ query })).toEqual({
      message: {
        ...message("1"),
        rows: [[{ ...cell, name: "a" }], [{ ...cell, name: "b" }]],
      },
    });
  });

  test("a patch registers its nested deferred fragments", () => {
    const cache = new ForestRun();
    const query = gql`
      query {
        messages {
          id
          ... @defer(label: "author") {
            author {
              text
              ... @defer(label: "name") {
                name
              }
            }
          }
        }
      }
    `;
    const delivery = execution(cache, query);
    delivery.initial({ messages: [{ __typename: "Message", id: "1" }] });
    delivery.patch([
      {
        path: ["messages", 0],
        label: "author",
        data: { author: { __typename: "Author", text: "keep" } },
      },
    ]);
    delivery.patch(
      [
        {
          path: ["messages", 0, "author"],
          label: "name",
          data: { name: "Ada" },
        },
      ],
      false,
    );

    expect(cache.readQuery({ query })).toEqual({
      messages: [
        {
          __typename: "Message",
          id: "1",
          author: { __typename: "Author", text: "keep", name: "Ada" },
        },
      ],
    });
  });

  test("a disabled outer defer delivers its nested sites; skipped sites are not written", () => {
    const cache = new ForestRun();
    const query = gql`
      query Conditional($enabled: Boolean!, $show: Boolean!) {
        messages {
          id
          ... @defer(if: $enabled, label: "outer") {
            text
            ... @defer(label: "inner") {
              name
            }
            ... @include(if: $show) @defer(label: "ignored") {
              secret
            }
          }
        }
      }
    `;
    const variables = { enabled: false, show: false };
    const delivery = execution(cache, query, variables);
    delivery.initial({ messages: [message("1")] });
    const path = ["messages", 0];
    delivery.patch(
      [
        { path, label: "outer", data: { text: "wrong" } },
        { path, label: "ignored", data: { secret: "wrong" } },
        { path, label: "inner", data: { name: "Alice" } },
      ],
      false,
    );

    expect(cache.readQuery({ query, variables })).toEqual({
      messages: [message("1", "Alice")],
    });
  });

  test("merge policies see patches in payload order; repeated fragments are ignored", () => {
    const merge = jest.fn((_existing, incoming) => incoming);
    const cache = new ForestRun({
      typePolicies: { Message: { fields: { name: { merge } } } },
    });
    const query = gql`
      query {
        messages {
          id
          ... @defer(label: "a") {
            name
            text
          }
          ... @defer(label: "b") {
            name
          }
        }
      }
    `;
    const delivery = execution(cache, query);
    delivery.initial({
      messages: ["1", "2"].map((id) => ({ id, __typename: "Message" })),
    });
    merge.mockClear();
    delivery.patch(
      [
        {
          path: ["messages", 0],
          label: "a",
          data: { name: "old", text: "keep" },
        },
        {
          path: ["messages", 1],
          label: "a",
          data: { name: "two", text: "second" },
        },
        { path: ["messages", 0], label: "b", data: { name: "new" } },
        { path: ["messages", 0], label: "b", data: { name: "duplicate" } },
      ],
      false,
    );

    expect(merge.mock.calls).toMatchObject([
      [undefined, "old", expect.anything()],
      [undefined, "two", expect.anything()],
      ["old", "new", expect.anything()],
    ]);
    expect(cache.readQuery({ query })).toMatchObject({
      messages: [
        { id: "1", name: "new", text: "keep" },
        { id: "2", name: "two", text: "second" },
      ],
    });
  });

  test("entities nested in patches are normalized and merged in payload order", () => {
    const cache = new ForestRun({
      typePolicies: {
        User: {
          fields: {
            name: {
              merge: (existing, incoming) =>
                existing ? `${existing}|${incoming}` : incoming,
            },
          },
        },
      },
    });
    const query = gql`
      query {
        messages {
          id
          ... @defer(label: "author") {
            author {
              id
              name
            }
          }
        }
      }
    `;
    const delivery = execution(cache, query);
    delivery.initial({ messages: [message("1"), message("2")] });
    delivery.patch(
      ["Ann", "Bea"].map((name, i) => ({
        path: ["messages", i],
        label: "author",
        data: { author: { __typename: "User", id: "A", name } },
      })),
      false,
    );

    expect(cache.readQuery({ query })).toMatchObject({
      messages: [
        { author: { name: "Ann|Bea" } },
        { author: { name: "Ann|Bea" } },
      ],
    });
  });

  test("merge policies of an embedded target see its existing values", () => {
    const merge = jest.fn((existing = [], incoming) => [
      ...existing,
      ...incoming,
    ]);
    const cache = new ForestRun({
      typePolicies: { Info: { fields: { tags: { merge } } } },
    });
    const query = gql`
      query {
        info {
          tags
          ... @defer(label: "more") {
            tags
          }
        }
      }
    `;
    const delivery = execution(cache, query);
    delivery.initial({ info: { __typename: "Info", tags: ["a"] } });
    delivery.patch(
      [{ path: ["info"], label: "more", data: { tags: ["b"] } }],
      false,
    );

    expect(merge).toHaveBeenLastCalledWith(["a"], ["b"], expect.anything());
    expect(cache.readQuery({ query })).toEqual({
      info: { __typename: "Info", tags: ["a", "b"] },
    });
  });

  test("patches of a non-retained operation (mutation) update entities of other operations", () => {
    const cache = new ForestRun();
    const messages = gql`
      query {
        messages {
          id
          text
          name
        }
      }
    `;
    cache.writeQuery({
      query: messages,
      data: { messages: [message("1", "old")] },
    });
    const mutation = gql`
      mutation Send {
        send {
          id
          text
          ...MessageName @defer(label: "name")
        }
      }
      fragment MessageName on Message {
        name
      }
    `;
    const isDeferPending = () => true;
    const options = { query: mutation, dataId: "ROOT_MUTATION" };
    cache.write({
      ...options,
      result: { send: { ...message("1"), text: "edited" } },
      [handleIncrementalSymbol]: { isDeferPending },
    });
    cache.write({
      ...options,
      result: {},
      [handleIncrementalSymbol]: {
        isDeferPending,
        incremental: [{ path: ["send"], label: "name", data: { name: "new" } }],
        hasNext: false,
      },
    });

    expect(cache.readQuery({ query: messages })).toEqual({
      messages: [{ ...message("1", "new"), text: "edited" }],
    });
  });

  test("watches are notified once per payload and patch writes are not retained", () => {
    const cache = new ForestRun();
    const delivery = execution(cache, list);
    delivery.initial({ messages: [message("1"), message("2")] });
    const treeCount = cache.getStats().treeCount;
    const callback = jest.fn();
    const stop = cache.watch({ query: list, optimistic: false, callback });

    delivery.patch([namePatch("one", 0), namePatch("two", 1)], false);
    stop();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(cache.getStats().treeCount).toBe(treeCount);
    expect(cache.readQuery({ query: list })).toEqual({
      messages: [message("1", "one"), message("2", "two")],
    });
  });

  test("unlabeled fragments sharing a path are ambiguous and not written", () => {
    const cache = new ForestRun();
    const query = gql`
      query {
        message {
          id
          ... @defer {
            text
          }
          ... @defer {
            name
          }
        }
      }
    `;
    const delivery = execution(cache, query);
    delivery.initial({ message: { __typename: "Message", id: "1" } });
    delivery.patch([{ path: ["message"], data: { text: "hi" } }], false);

    expect(
      cache.readQuery({ query, returnPartialData: true }),
    ).not.toMatchObject({ message: { text: "hi" } });
  });

  test("only pending fragments are registered", () => {
    const cache = new InspectableCache();
    const delivery = execution(cache, list, {}, (path) => path[1] === 1);
    delivery.initial({ messages: [message("1"), message("2")] });
    expect(cache.deferTargetCount()).toBe(1);

    delivery.patch([namePatch("one", 0), namePatch("two", 1)], false);
    expect(cache.readQuery({ query: list, returnPartialData: true })).toEqual({
      messages: [message("1"), message("2", "two")],
    });
  });

  test("a new execution replaces targets of the previous one", () => {
    const cache = new InspectableCache();
    const first = execution(cache, list);
    const second = execution(cache, list);
    first.initial({ messages: [message("1")] });
    second.initial({ messages: [message("2"), message("1")] });
    first.patch([namePatch("stale")]);
    expect(cache.readQuery({ query: list, returnPartialData: true })).toEqual({
      messages: [message("2"), message("1")],
    });

    second.patch([namePatch("two")], false);
    expect(cache.deferTargetCount()).toBe(0);
    expect(cache.readQuery({ query: list, returnPartialData: true })).toEqual({
      messages: [message("2", "two"), message("1")],
    });
  });

  test("regular writes keep the targets of the pending execution", () => {
    const cache = new InspectableCache();
    const delivery = execution(cache, list);
    cache.writeQuery({ query: list, data: { messages: [message("3", "x")] } });
    expect(cache.deferTargetCount()).toBe(0);

    delivery.initial({ messages: [message("1")] });
    cache.writeQuery({
      query: list,
      data: { messages: [message("2", "two"), message("1")] },
    });
    expect(cache.deferTargetCount()).toBe(1);

    delivery.patch([namePatch("one")], false);
    expect(cache.readQuery({ query: list })).toEqual({
      messages: [message("2", "two"), message("1", "one")],
    });
  });

  test("the final payload releases remaining targets", () => {
    const cache = new InspectableCache();
    const delivery = execution(cache, list);
    delivery.initial({ messages: [message("1"), message("2")] });
    expect(cache.deferTargetCount()).toBe(2);
    delivery.patch([namePatch("one")]);
    expect(cache.deferTargetCount()).toBe(1);
    delivery.patch([], false);
    expect(cache.deferTargetCount()).toBe(0);
  });

  test("patches are ignored after their tree is evicted", () => {
    const cache = new ForestRun({ maxOperationCount: 1, autoEvict: false });
    const delivery = execution(cache, list);
    delivery.initial({ messages: [message("1")] });
    cache.writeQuery({
      query: gql`
        query Newer {
          x
        }
      `,
      data: { x: 1 },
    });
    expect(cache.gc()).toHaveLength(1);
    delivery.patch([namePatch("late")]);
    expect(cache.getStats().treeCount).toBe(1);

    const next = execution(cache, list);
    next.initial({ messages: [message("2")] });
    delivery.patch([namePatch("stale")], false);
    next.patch([namePatch("two")], false);
    expect(cache.readQuery({ query: list })).toEqual({
      messages: [message("2", "two")],
    });
  });

  test("patches are ignored after a reset", async () => {
    const cache = new ForestRun();
    const delivery = execution(cache, list);
    delivery.initial({ messages: [message("1")] });
    await cache.reset();
    cache.writeQuery({
      query: list,
      data: { messages: [message("1", "after reset")] },
    });
    delivery.patch([namePatch("stale")], false);

    expect(cache.readQuery({ query: list })).toEqual({
      messages: [message("1", "after reset")],
    });
  });

  test("removing an optimistic prepend reveals the patched entity", () => {
    const cache = new ForestRun();
    const delivery = execution(cache, list);
    delivery.initial({ messages: [message("1")] });
    cache.recordOptimisticTransaction(
      (c) =>
        c.writeQuery({
          query: list,
          data: { messages: [message("2", "two"), message("1")] },
        }),
      "send",
    );
    delivery.patch([namePatch("one")], false);

    expect(
      cache.readQuery({
        query: list,
        optimistic: true,
        returnPartialData: true,
      }),
    ).toMatchObject({
      messages: [
        { id: "2", name: "two" },
        { id: "1", name: "one" },
      ],
    });
    cache.removeOptimistic("send");
    expect(cache.readQuery({ query: list })).toEqual({
      messages: [message("1", "one")],
    });
  });
});
