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
