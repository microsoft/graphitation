import { gql } from "@apollo/client";
import { DocumentNode } from "graphql";
import { ForestRun } from "../ForestRun";
import { assert } from "../jsutils/assert";
import { resolveOperationDescriptor } from "../cache/descriptor";

class InspectableCache extends ForestRun {
  deferTargetCount(query: DocumentNode, variables = {}): number {
    const operation = resolveOperationDescriptor(
      this.env,
      this.store,
      query,
      variables,
    );
    const targets =
      this.store.incrementalExecutions.get(operation)?.targets.values() ?? [];
    return new Set([...targets].filter(Boolean)).size;
  }
}

type Patch = {
  path: (string | number)[];
  label?: string;
  data: Record<string, unknown> | null;
};
type Format = "draft" | "latest";

// Writes results of an incremental execution in the earlier draft format (`path` and `label`),
//   or in the latest GraphQL incremental delivery format (`pending` with ids, `completed`)
let format: Format = "draft";

// key is only needed to tell apart overlapping executions of the same operation
function execution(
  cache: ForestRun,
  query: DocumentNode,
  variables = {},
  key?: object,
) {
  let nextId = 0;
  const announce = (path: Patch["path"], label?: string) => ({
    id: String(nextId++),
    path,
    label,
  });
  return {
    key,
    initial(data: Record<string, unknown>) {
      cache.write({
        query,
        variables,
        execution: { data, hasNext: true, key },
      });
    },
    patch(patches: Patch[], hasNext = true) {
      if (format === "draft") {
        cache.write({
          query,
          variables,
          execution: { incremental: patches, hasNext, key },
        });
        return;
      }
      const pending = patches.map(({ path, label }) => announce(path, label));
      cache.write({
        query,
        variables,
        execution: {
          pending,
          incremental: patches.map(({ data }, i) => ({
            id: pending[i].id,
            data,
          })),
          completed: pending.map(({ id }) => ({ id })),
          hasNext,
          key,
        },
      });
    },
    pendingTargets() {
      assert(cache instanceof InspectableCache);
      return cache.deferTargetCount(query, variables);
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

describe.each(["draft", "latest"] as const)("@defer (%s format)", (f) => {
  beforeEach(() => {
    format = f;
  });

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
    delivery.patch([
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
    ]);
    delivery.patch(
      [{ path: ["messages", 0], label: "b", data: { name: "duplicate" } }],
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

  test.each([false, true])(
    "patches of a non-retained operation (mutation) update entities of other operations (cleanupNonCacheableOperations: %s)",
    (cleanupNonCacheableOperations) => {
      const cache = new ForestRun({ cleanupNonCacheableOperations });
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
      const delivery = execution(cache, mutation);
      delivery.initial({ send: { ...message("1"), text: "edited" } });
      delivery.patch([
        { path: ["send"], label: "name", data: { name: "new" } },
      ]);

      expect(cache.readQuery({ query: messages })).toEqual({
        messages: [{ ...message("1", "new"), text: "edited" }],
      });
    },
  );

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

  test("a new execution of an operation replaces the previous one", () => {
    const cache = new InspectableCache();
    const first = execution(cache, list, {}, {});
    const second = execution(cache, list, {}, {});
    first.initial({ messages: [message("1")] });
    second.initial({ messages: [message("2"), message("1")] });

    // Late results of the superseded execution are ignored (their paths refer to its response)
    first.patch([namePatch("stale")], false);
    expect(second.pendingTargets()).toBe(2);
    second.patch([namePatch("two"), namePatch("one", 1)], false);
    expect(second.pendingTargets()).toBe(0);
    expect(cache.readQuery({ query: list })).toEqual({
      messages: [message("2", "two"), message("1", "one")],
    });
  });
  test("regular writes keep the targets of the pending execution", () => {
    const cache = new InspectableCache();
    const delivery = execution(cache, list);
    cache.writeQuery({ query: list, data: { messages: [message("3", "x")] } });
    expect(delivery.pendingTargets()).toBe(0);

    delivery.initial({ messages: [message("1")] });
    cache.writeQuery({
      query: list,
      data: { messages: [message("2", "two"), message("1")] },
    });
    expect(delivery.pendingTargets()).toBe(1);

    delivery.patch([namePatch("one")], false);
    expect(cache.readQuery({ query: list })).toEqual({
      messages: [message("2", "two"), message("1", "one")],
    });
  });

  test("applied fragments are consumed; patches without labels match unambiguous fragments", () => {
    const cache = new InspectableCache();
    const delivery = execution(cache, list);
    delivery.initial({ messages: [message("1"), message("2")] });
    expect(delivery.pendingTargets()).toBe(2);
    delivery.patch([{ path: ["messages", 0], data: { name: "one" } }]);
    expect(delivery.pendingTargets()).toBe(1);
    delivery.patch([namePatch("two", 1)]);
    delivery.patch([namePatch("stale", 1)]);
    expect(delivery.pendingTargets()).toBe(0);

    expect(cache.readQuery({ query: list })).toEqual({
      messages: [message("1", "one"), message("2", "two")],
    });
  });

  test("patches of unknown executions are ignored", () => {
    const cache = new ForestRun();
    execution(cache, list, {}, {}).initial({ messages: [message("1")] });
    execution(cache, list, {}, {}).patch([namePatch("unknown")]);

    expect(cache.readQuery({ query: list, returnPartialData: true })).toEqual({
      messages: [message("1")],
    });
  });

  test("patches are ignored after their tree is evicted", () => {
    const cache = new ForestRun({ maxOperationCount: 1, autoEvict: false });
    const delivery = execution(cache, list, {}, {});
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

    const next = execution(cache, list, {}, {});
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

describe.each(["draft", "latest"] as const)(
  "@defer: pagination (%s format)",
  (f) => {
    beforeEach(() => {
      format = f;
    });

    const feedPolicies = {
      typePolicies: {
        Query: {
          fields: {
            feed: {
              keyArgs: false as const,
              merge: (existing: unknown[] = [], incoming: unknown[]) => [
                ...existing,
                ...incoming,
              ],
            },
          },
        },
      },
    };

    test("pages merged into one result keep targets of every pending page", () => {
      const cache = new ForestRun(feedPolicies);
      const query = gql`
        query Feed($after: Int) @cache(keyVars: []) {
          feed(after: $after) @connection(key: "feed") {
            id
            text
            ... @defer(label: "name") {
              name
            }
          }
        }
      `;
      const page1 = execution(cache, query, { after: 0 });
      const page2 = execution(cache, query, { after: 2 });
      page1.initial({ feed: [message("1"), message("2")] });
      page2.initial({ feed: [message("3")] });

      page1.patch([
        { path: ["feed", 0], label: "name", data: { name: "one" } },
      ]);
      page2.patch(
        [{ path: ["feed", 0], label: "name", data: { name: "three" } }],
        false,
      );
      page1.patch(
        [{ path: ["feed", 1], label: "name", data: { name: "two" } }],
        false,
      );

      expect(cache.readQuery({ query, variables: { after: 2 } })).toEqual({
        feed: [message("1", "one"), message("2", "two"), message("3", "three")],
      });
    });

    test("embedded items keep their targets after a merge policy appends them", () => {
      const cache = new ForestRun(feedPolicies);
      const query = gql`
        query Feed($after: Int) @cache(keyVars: []) {
          feed(after: $after) @connection(key: "feed") {
            text
            ... @defer(label: "name") {
              name
            }
          }
        }
      `;
      const item = (text: string, name?: string) => ({
        __typename: "Item",
        text,
        ...(name && { name }),
      });
      const page1 = execution(cache, query, { after: 0 });
      const page2 = execution(cache, query, { after: 2 });
      page1.initial({ feed: [item("a"), item("b")] });
      page2.initial({ feed: [item("c")] });
      page2.patch(
        [{ path: ["feed", 0], label: "name", data: { name: "C" } }],
        false,
      );
      page1.patch(
        [
          { path: ["feed", 0], label: "name", data: { name: "A" } },
          { path: ["feed", 1], label: "name", data: { name: "B" } },
        ],
        false,
      );

      expect(cache.readQuery({ query, variables: { after: 2 } })).toEqual({
        feed: [item("a", "A"), item("b", "B"), item("c", "C")],
      });
    });

    test("fetchMore with updateQuery: patches reach entities of the merged query", () => {
      const cache = new ForestRun();
      const query = gql`
        query Feed($after: Int) {
          feed(after: $after) {
            id
            text
            ... @defer(label: "name") {
              name
            }
          }
        }
      `;
      const main = execution(cache, query, { after: 0 });
      main.initial({ feed: [message("1")] });
      main.patch(
        [{ path: ["feed", 0], label: "name", data: { name: "one" } }],
        false,
      );

      const more = execution(cache, query, { after: 1 });
      more.initial({ feed: [message("2")] });
      cache.updateQuery(
        { query, variables: { after: 0 }, returnPartialData: true },
        (data: any) => ({ feed: [...data.feed, message("2")] }),
      );
      more.patch(
        [{ path: ["feed", 0], label: "name", data: { name: "two" } }],
        false,
      );

      expect(cache.readQuery({ query, variables: { after: 0 } })).toEqual({
        feed: [message("1", "one"), message("2", "two")],
      });
    });
  },
);

describe.each(["draft", "latest"] as const)(
  "@defer: upstream issues (%s format)",
  (f) => {
    beforeEach(() => {
      format = f;
    });

    test("refetch after a deletion does not duplicate items (apollo-client#12250)", () => {
      const cache = new ForestRun();
      const query = gql`
        query Books {
          books {
            id
            title
            ... @defer(label: "info") {
              info
            }
          }
        }
      `;
      const book = (id: string, info?: string) => ({
        __typename: "Book",
        id,
        title: `Book ${id}`,
        ...(info && { info }),
      });
      const first = execution(cache, query);
      first.initial({ books: [book("1"), book("2")] });
      first.patch(
        [
          { path: ["books", 0], label: "info", data: { info: "i1" } },
          { path: ["books", 1], label: "info", data: { info: "i2" } },
        ],
        false,
      );

      const refetch = execution(cache, query);
      refetch.initial({ books: [book("2")] });
      expect(cache.readQuery({ query })).toEqual({ books: [book("2", "i2")] });
      refetch.patch(
        [{ path: ["books", 0], label: "info", data: { info: "i2*" } }],
        false,
      );

      expect(cache.readQuery({ query })).toEqual({ books: [book("2", "i2*")] });
    });

    test("a patch keeps unchanged items referentially stable (apollo-client#11616)", () => {
      const cache = new ForestRun();
      const delivery = execution(cache, list);
      delivery.initial({ messages: [message("1"), message("2")] });
      const before = cache.diff<any>({
        query: list,
        optimistic: false,
        returnPartialData: true,
      }).result;
      const callback = jest.fn();
      cache.watch({ query: list, optimistic: false, callback });

      delivery.patch([namePatch("one")]);
      const after = cache.diff<any>({
        query: list,
        optimistic: false,
        returnPartialData: true,
      }).result;

      expect(callback).toHaveBeenCalledTimes(1);
      expect(after.messages[0]).toEqual(message("1", "one"));
      expect(after.messages[1]).toBe(before.messages[1]);
    });
  },
);

describe("@defer: incremental delivery format", () => {
  test("data at a sub-path of a fragment is written to the object at that path", () => {
    const cache = new ForestRun();
    const query = gql`
      query {
        message {
          id
          meta {
            a
          }
          ... @defer(label: "b") {
            meta {
              b
            }
          }
        }
      }
    `;
    cache.write({
      query,
      execution: {
        data: {
          message: {
            __typename: "Message",
            id: "1",
            meta: { __typename: "Meta", a: "A" },
          },
        },
        pending: [{ id: "0", path: ["message"], label: "b" }],
        hasNext: true,
      },
    });
    cache.write({
      query,
      execution: {
        incremental: [{ id: "0", subPath: ["meta"], data: { b: "B" } }],
        completed: [{ id: "0" }],
        hasNext: false,
      },
    });

    expect(cache.readQuery({ query })).toEqual({
      message: {
        __typename: "Message",
        id: "1",
        meta: { __typename: "Meta", a: "A", b: "B" },
      },
    });
  });

  test("a fragment completed without data delivers fragments deferred within it", () => {
    const cache = new ForestRun();
    const query = gql`
      query {
        message {
          id
          ... @defer(label: "outer") {
            id
            ... @defer(label: "inner") {
              name
            }
          }
        }
      }
    `;
    cache.write({
      query,
      execution: {
        data: { message: { __typename: "Message", id: "1" } },
        pending: [{ id: "0", path: ["message"], label: "outer" }],
        hasNext: true,
      },
    });
    // All fields of "outer" were already sent
    cache.write({
      query,
      execution: {
        pending: [{ id: "1", path: ["message"], label: "inner" }],
        completed: [{ id: "0" }],
        hasNext: true,
      },
    });
    cache.write({
      query,
      execution: {
        incremental: [{ id: "1", data: { name: "Ada" } }],
        completed: [{ id: "1" }],
        hasNext: false,
      },
    });

    expect(cache.readQuery({ query })).toEqual({
      message: { __typename: "Message", id: "1", name: "Ada" },
    });
  });

  test("the operation identifies the execution when the key is omitted", () => {
    const cache = new ForestRun();
    cache.write({
      query: list,
      execution: { data: { messages: [message("1")] }, hasNext: true },
    });
    cache.write({
      query: list,
      execution: {
        incremental: [namePatch("one")],
        hasNext: false,
      },
    });

    expect(cache.readQuery({ query: list })).toEqual({
      messages: [message("1", "one")],
    });
  });

  test("results passed as `result` are complete results", () => {
    const cache = new ForestRun();
    cache.write({ query: list, result: { messages: [message("1")] } });
    cache.write({
      query: list,
      execution: { incremental: [namePatch("one")], hasNext: false },
    });

    expect(cache.readQuery({ query: list, returnPartialData: true })).toEqual({
      messages: [message("1")],
    });
  });
});

describe("@defer: nested fragments", () => {
  const query = gql`
    query {
      messages {
        id
        ... @defer(label: "l1") {
          author {
            id
            ... @defer(label: "l2") {
              friends {
                id
                ... @defer(label: "l3") {
                  name
                }
              }
            }
          }
        }
      }
    }
  `;
  const write = (cache: ForestRun, execution: any) =>
    cache.write({ query, execution });

  test("three levels in the earlier draft format, within lists", () => {
    const cache = new ForestRun();
    write(cache, {
      data: { messages: [{ __typename: "M", id: "1" }] },
      hasNext: true,
    });
    write(cache, {
      incremental: [
        {
          path: ["messages", 0],
          label: "l1",
          data: { author: { __typename: "U", id: "a" } },
        },
      ],
      hasNext: true,
    });
    write(cache, {
      incremental: [
        {
          path: ["messages", 0, "author"],
          label: "l2",
          data: {
            friends: [
              { __typename: "U", id: "f1" },
              { __typename: "U", id: "f2" },
            ],
          },
        },
      ],
      hasNext: true,
    });
    write(cache, {
      incremental: [
        {
          path: ["messages", 0, "author", "friends", 1],
          label: "l3",
          data: { name: "F2" },
        },
        {
          path: ["messages", 0, "author", "friends", 0],
          label: "l3",
          data: { name: "F1" },
        },
      ],
      hasNext: false,
    });
    expect(cache.readQuery({ query })).toEqual({
      messages: [
        {
          __typename: "M",
          id: "1",
          author: {
            __typename: "U",
            id: "a",
            friends: [
              { __typename: "U", id: "f1", name: "F1" },
              { __typename: "U", id: "f2", name: "F2" },
            ],
          },
        },
      ],
    });
  });

  test("three levels in the latest format, announced by the enclosing fragments", () => {
    const cache = new ForestRun();
    write(cache, {
      data: { messages: [{ __typename: "M", id: "1" }] },
      pending: [{ id: "0", path: ["messages", 0], label: "l1" }],
      hasNext: true,
    });
    write(cache, {
      pending: [{ id: "1", path: ["messages", 0, "author"], label: "l2" }],
      incremental: [
        { id: "0", data: { author: { __typename: "U", id: "a" } } },
      ],
      completed: [{ id: "0" }],
      hasNext: true,
    });
    write(cache, {
      pending: [
        { id: "2", path: ["messages", 0, "author", "friends", 0], label: "l3" },
      ],
      incremental: [
        { id: "1", data: { friends: [{ __typename: "U", id: "f1" }] } },
      ],
      completed: [{ id: "1" }],
      hasNext: true,
    });
    write(cache, {
      incremental: [{ id: "2", data: { name: "F1" } }],
      completed: [{ id: "2" }],
      hasNext: false,
    });
    expect(cache.readQuery({ query })).toEqual({
      messages: [
        {
          __typename: "M",
          id: "1",
          author: {
            __typename: "U",
            id: "a",
            friends: [{ __typename: "U", id: "f1", name: "F1" }],
          },
        },
      ],
    });
  });

  test("a fragment deferred within a fragment on embedded objects", () => {
    const q = gql`
      query {
        message {
          id
          ... @defer(label: "l1") {
            meta {
              tags {
                text
                ... @defer(label: "l2") {
                  extra
                }
              }
            }
          }
        }
      }
    `;
    const cache = new ForestRun();
    cache.write({
      query: q,
      execution: {
        data: { message: { __typename: "M", id: "1" } },
        hasNext: true,
      },
    });
    cache.write({
      query: q,
      execution: {
        incremental: [
          {
            path: ["message"],
            label: "l1",
            data: {
              meta: {
                __typename: "Meta",
                tags: [
                  { __typename: "T", text: "a" },
                  { __typename: "T", text: "b" },
                ],
              },
            },
          },
        ],
        hasNext: true,
      },
    });
    cache.write({
      query: q,
      execution: {
        incremental: [
          {
            path: ["message", "meta", "tags", 1],
            label: "l2",
            data: { extra: "B" },
          },
        ],
        hasNext: false,
      },
    });
    expect(cache.readQuery({ query: q, returnPartialData: true })).toEqual({
      message: {
        __typename: "M",
        id: "1",
        meta: {
          __typename: "Meta",
          tags: [
            { __typename: "T", text: "a" },
            { __typename: "T", text: "b", extra: "B" },
          ],
        },
      },
    });
  });
});
