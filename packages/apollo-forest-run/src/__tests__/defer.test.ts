import { gql } from "@apollo/client";
import { ForestRun } from "../ForestRun";
import { incrementalDelivery, WriteOptions } from "../cache/incremental";
import { DocumentNode } from "graphql";

function execution(cache: ForestRun, query: DocumentNode, variables = {}) {
  const controller = new AbortController();
  return {
    controller,
    send(
      payload: NonNullable<WriteOptions[typeof incrementalDelivery]>["payload"],
    ) {
      cache.write({
        query,
        variables,
        dataId: "ROOT_QUERY",
        result: payload.data ?? {},
        [incrementalDelivery]: { request: controller.signal, payload },
      });
    },
  };
}
const list = gql`
  query Messages {
    messages {
      id
      text
      ...MessageName @defer
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
  ...(name && { name }),
});
const namePart = (name: string) => ({
  path: ["messages", 0],
  data: { name },
});

test("one payload applies a field policy once to the final value for each original message", () => {
  const merge = jest.fn((_existing, incoming) => incoming);
  const cache = new ForestRun({
    typePolicies: { Message: { fields: { name: { merge } } } },
  });
  const q = gql`
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
  const delivery = execution(cache, q);
  delivery.send({
    data: {
      messages: ["1", "2"].map((id) => ({ id, __typename: "Message" })),
    },
    hasNext: true,
  });
  merge.mockClear();
  delivery.send({
    incremental: [
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
    ],
    hasNext: false,
  });
  expect(merge.mock.calls.map((call) => call[1])).toEqual(["new", "two"]);
  expect(cache.readQuery({ query: q })).toMatchObject({
    messages: [
      { id: "1", name: "new", text: "keep" },
      { id: "2", name: "two", text: "second" },
    ],
  });
});

test("a parent and its new embedded target can arrive in the same payload", () => {
  const cache = new ForestRun();
  const q = gql`
    query {
      messages {
        id
        ... @defer(label: "a") {
          author {
            text
            ... @defer(label: "b") {
              name
            }
          }
        }
      }
    }
  `;
  const delivery = execution(cache, q);
  delivery.send({ data: { messages: [message("1")] }, hasNext: true });
  const author = Object.freeze({ __typename: "Author", text: "keep" });
  delivery.send({
    incremental: [
      { path: ["messages", 0], label: "a", data: { author } },
      { path: ["messages", 0, "author"], label: "b", data: { name: "Ada" } },
    ],
    hasNext: false,
  });
  expect(cache.readQuery({ query: q })).toMatchObject({
    messages: [{ id: "1", author: { text: "keep", name: "Ada" } }],
  });
  expect(author).not.toHaveProperty("name");
});
test("a deferred fragment follows its original entity across a cache.modify prepend", () => {
  const cache = new ForestRun();
  const delivery = execution(cache, list);
  const initial = message("1");
  delivery.send({ data: { messages: [initial] }, hasNext: true });
  expect(
    cache.diff({ query: list, optimistic: false, returnPartialData: true }),
  ).toMatchObject({
    complete: false,
    result: { messages: [initial] },
  });
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
  // Other fields in a malformed patch must not be treated as part of the fragment.
  delivery.send({
    incremental: [
      { path: ["messages", 0], data: { name: "one", text: "stale" } },
    ],
    hasNext: false,
  });
  expect(cache.readQuery({ query: list })).toEqual({
    messages: [message("2", "not deferred"), message("1", "one")],
  });
});

test.each([false, true])(
  "replacement relation is never restored; retained elsewhere: %s",
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
    const keep = gql`
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
    delivery.send({ data: conversation(message("1")), hasNext: true });
    if (retained)
      cache.writeQuery({
        query: keep,
        data: { pinned: message("1", "existing") },
      });
    cache.writeQuery({ query, data: conversation(message("2", "two")) });
    delivery.send({
      incremental: [
        {
          path: ["conversation", "lastMessage"],
          label: "sender",
          data: { name: "one" },
        },
      ],
      hasNext: false,
    });
    expect(cache.readQuery({ query })).toEqual(
      conversation(message("2", "two")),
    );
    if (retained)
      expect(cache.readQuery({ query: keep })).toEqual({
        pinned: message("1", "one"),
      });
    else
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
  },
);

test("nested deliveries use original paths, alias and variables after the parent site is consumed", () => {
  const cache = new ForestRun();
  const query = gql`
    query Nested($lang: String = "en", $include: Boolean = true) {
      list: messages {
        id
        ... @defer(label: "outer") {
          from: sender {
            id
            ... @include(if: $include) @defer(label: "inner") {
              display: name(lang: $lang)
            }
          }
        }
      }
    }
  `;
  const initial = { __typename: "Message", id: "1" };
  const delivery = execution(cache, query);
  delivery.send({ data: { list: [initial] }, hasNext: true });
  delivery.send({
    incremental: [
      {
        path: ["list", 0],
        label: "outer",
        data: { from: { __typename: "User", id: "a" } },
      },
    ],
    hasNext: true,
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
  delivery.send({
    incremental: [
      { path: ["list", 0, "from"], label: "inner", data: { display: "Alice" } },
    ],
    hasNext: false,
  });
  expect(cache.readQuery({ query })).toEqual({
    list: [
      saved,
      { ...initial, from: { __typename: "User", id: "a", display: "Alice" } },
    ],
  });
});

test("executions are isolated and their indexes are disposed on receipt, abort or empty final delivery", () => {
  class InspectableCache extends ForestRun {
    pending() {
      return [...this.store.dataForest.trees.values()].reduce(
        (n, t) => n + (t.pendingDeferred?.size ?? 0),
        0,
      );
    }
  }
  const cache = new InspectableCache();
  const a = execution(cache, list),
    b = execution(cache, list),
    c = execution(cache, list);
  for (const delivery of [a, b, c])
    delivery.send({ data: { messages: [message("1")] }, hasNext: true });
  expect(cache.pending()).toBe(3);
  b.controller.abort();
  c.send({ hasNext: false });
  expect(cache.pending()).toBe(1);
  a.send({ incremental: [namePart("A")], hasNext: true });
  expect(cache.pending()).toBe(0);
  for (const delivery of [a, b, c])
    delivery.send({ incremental: [namePart("stale")], hasNext: false });
  expect(cache.readQuery({ query: list })).toEqual({
    messages: [message("1", "A")],
  });
});

test("independent unlabelled deliveries do not consume each other on an embedded object", () => {
  const query = gql`
    query Embedded {
      message {
        id
        info {
          __typename
          ... @defer {
            one
          }
          ... @defer {
            two
          }
        }
      }
    }
  `;
  const cache = new ForestRun();
  const delivery = execution(cache, query);
  const info = { __typename: "Info" };
  delivery.send({
    data: { message: { ...message("1"), info } },
    hasNext: true,
  });
  const path = ["message", "info"];
  delivery.send({ incremental: [{ path, data: { two: 2 } }], hasNext: true });
  delivery.send({ incremental: [{ path, data: { one: 1 } }], hasNext: false });
  expect(cache.readQuery({ query })).toMatchObject({
    message: { info: { one: 1, two: 2 } },
  });
});

test("one unlabeled fragment does not consume another with overlapping response keys", () => {
  const cache = new ForestRun();
  const query = gql`
    query Overlap {
      message {
        id
        ... @defer {
          text
          name
        }
        ... @defer {
          text
          subject
        }
      }
    }
  `;
  const delivery = execution(cache, query);
  delivery.send({
    data: { message: { __typename: "Message", id: "1" } },
    hasNext: true,
  });
  delivery.send({
    incremental: [{ path: ["message"], data: { text: "hi", name: "Alice" } }],
    hasNext: true,
  });
  delivery.send({
    incremental: [{ path: ["message"], data: { subject: "Meeting" } }],
    hasNext: false,
  });
  expect(cache.readQuery({ query })).toMatchObject({
    message: { text: "hi", name: "Alice", subject: "Meeting" },
  });
});

test("unlabeled fragments can be distinguished by nested response keys", () => {
  const cache = new ForestRun();
  const query = gql`
    query NestedOverlap {
      message {
        id
        ... @defer {
          detail {
            id
            x
          }
        }
        ... @defer {
          detail {
            id
            y
          }
        }
      }
    }
  `;
  const delivery = execution(cache, query);
  delivery.send({ data: { message: message("1") }, hasNext: true });
  const part = (fields: Record<string, unknown>, hasNext: boolean) =>
    delivery.send({
      incremental: [
        {
          path: ["message"],
          data: { detail: { __typename: "Detail", id: "d", ...fields } },
        },
      ],
      hasNext,
    });
  part({}, true);
  part({ y: 2 }, true);
  part({ x: 1 }, false);
  expect(cache.readQuery({ query })).toMatchObject({
    message: { detail: { id: "d", x: 1, y: 2 } },
  });
});

test("gc neither removes nor reports a pending tree, then releases it after delivery", () => {
  const cache = new ForestRun({ maxOperationCount: 1, autoEvict: false });
  const delivery = execution(cache, list);
  delivery.send({ data: { messages: [message("1")] }, hasNext: true });
  cache.writeQuery({
    query: gql`
      query Newer {
        x
      }
    `,
    data: { x: 1 },
  });
  expect(cache.gc()).toEqual([]);
  delivery.send({ incremental: [namePart("one")], hasNext: false });
  expect(cache.readQuery({ query: list })).toEqual({
    messages: [message("1", "one")],
  });
  cache.writeQuery({
    query: gql`
      query Newest {
        y
      }
    `,
    data: { y: 2 },
  });
  expect(cache.gc()).toHaveLength(2);
  expect(cache.getStats().treeCount).toBe(1);
});

test("removing an optimistic prepend reveals the patched original entity", () => {
  const cache = new ForestRun();
  const delivery = execution(cache, list);
  delivery.send({ data: { messages: [message("1")] }, hasNext: true });
  cache.recordOptimisticTransaction(
    (c) =>
      c.writeQuery({
        query: list,
        data: { messages: [message("2", "two"), message("1")] },
      }),
    "send",
  );
  delivery.send({ incremental: [namePart("one")], hasNext: false });
  expect(
    cache.readQuery({ query: list, optimistic: true, returnPartialData: true }),
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

test("shared embedded objects keep distinct response paths through nested lists", () => {
  const query = gql`
    query Shared {
      rows: grid {
        __typename
        ... @defer {
          name
        }
      }
    }
  `;
  const cache = new ForestRun();
  const delivery = execution(cache, query);
  const shared = { __typename: "Cell" };
  delivery.send({ data: { rows: [[shared], [shared]] }, hasNext: true });
  delivery.send({
    incremental: [
      { path: ["rows", 1, 0], data: { name: "second" } },
      { path: ["rows", 0, 0], data: { name: "first" } },
    ],
    hasNext: false,
  });
  expect(cache.readQuery({ query })).toEqual({
    rows: [[{ ...shared, name: "first" }], [{ ...shared, name: "second" }]],
  });
});

test("nested unkeyed target introduced by a patch", () => {
  const query = gql`
    query Embedded {
      message {
        id
        ... @defer(label: "outer") {
          info {
            __typename
            ... @defer(label: "inner") {
              name
            }
          }
        }
      }
    }
  `;
  const cache = new ForestRun();
  const delivery = execution(cache, query);
  delivery.send({ data: { message: message("1") }, hasNext: true });
  delivery.send({
    incremental: [
      {
        path: ["message"],
        label: "outer",
        data: { info: { __typename: "Info" } },
      },
    ],
    hasNext: true,
  });
  delivery.send({
    incremental: [
      { path: ["message", "info"], label: "inner", data: { name: "A" } },
    ],
    hasNext: false,
  });
  expect(cache.readQuery({ query })).toMatchObject({
    message: { info: { name: "A" } },
  });
});

test("a disabled outer defer allows its enabled nested site; skipped sites cannot write", () => {
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
  delivery.send({ data: { messages: [message("1")] }, hasNext: true });
  const path = ["messages", 0];
  delivery.send({
    incremental: [
      { path, label: "outer", data: { text: "wrong" } },
      { path, label: "ignored", data: { secret: "wrong" } },
      { path, label: "inner", data: { name: "Alice" } },
    ],
    hasNext: false,
  });
  expect(cache.readQuery({ query, variables })).toEqual({
    messages: [message("1", "Alice")],
  });
});

test("a reset between initial and final payload detaches the listener and rejects the late write", async () => {
  const cache = new ForestRun();
  const delivery = execution(cache, list);
  const remove = jest.spyOn(delivery.controller.signal, "removeEventListener");
  delivery.send({ data: { messages: [message("1")] }, hasNext: true });
  await cache.reset();
  expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  cache.writeQuery({
    query: list,
    data: { messages: [message("1", "after reset")] },
  });
  delivery.send({ incremental: [namePart("stale")], hasNext: false });
  expect(cache.readQuery({ query: list })).toEqual({
    messages: [message("1", "after reset")],
  });
});
