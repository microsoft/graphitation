import { gql } from "@apollo/client";
import type { DocumentNode } from "graphql";
import { ForestRun } from "../ForestRun";
import { resolveOperationDescriptor } from "../cache/descriptor";
import { canReleaseOperationDescriptor } from "../cache/store";
import type { ExecutionKey, PendingId } from "../cache/types";
import type { ResponsePath } from "../descriptor/types";
import { assert } from "../jsutils/assert";
import {
  isCompositeListValue,
  isObjectValue,
  resolveFieldChunk,
  resolveListItemChunk,
} from "../values";
import * as IndexTree from "../forest/indexTree";

class TestCache extends ForestRun {
  operation(query: DocumentNode, variables = {}) {
    return resolveOperationDescriptor(this.env, this.store, query, variables);
  }
  storedTree(query: DocumentNode, variables = {}) {
    return this.store.dataForest.trees.get(this.operation(query, variables).id);
  }
  pendingCount(query: DocumentNode, variables = {}) {
    return this.store.incrementalExecutions.get(
      this.operation(query, variables),
    )?.pending.size;
  }
  canRelease(query: DocumentNode, variables = {}) {
    return canReleaseOperationDescriptor(
      this.store,
      this.operation(query, variables),
    );
  }
}

type Pending = { path: ResponsePath; label?: string };
type Incremental = {
  id: PendingId;
  data: Record<string, unknown>;
  subPath?: ResponsePath;
};

// Incremental execution in the latest incremental delivery format
function execute(
  cache: ForestRun,
  query: DocumentNode,
  { variables = {}, key }: { variables?: object; key?: ExecutionKey } = {},
) {
  return {
    initial(data: Record<string, unknown>, pending: Pending[]) {
      cache.write({
        query,
        variables,
        execution: {
          data,
          pending: pending.map((p, i) => ({ id: String(i), ...p })),
          hasNext: true,
          key,
        },
      });
    },
    subsequent(
      incremental: Incremental[],
      {
        completed = incremental.map(({ id }) => id),
        hasNext = false,
      }: { completed?: PendingId[]; hasNext?: boolean } = {},
    ) {
      return cache.write({
        query,
        variables,
        execution: {
          incremental,
          completed: completed.map((id) => ({ id })),
          hasNext,
          key,
        },
      });
    },
  };
}

const messagesQuery = gql`
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

describe("@defer: subsequent results", () => {
  it("writes a deferred fragment to its node", () => {
    const cache = new TestCache();
    const execution = execute(cache, messagesQuery);
    execution.initial({ messages: [message("1"), message("2")] }, [
      { path: ["messages", 0], label: "name" },
      { path: ["messages", 1], label: "name" },
    ]);
    const watch = jest.fn();
    cache.watch({ query: messagesQuery, optimistic: true, callback: watch });

    const ref = execution.subsequent([
      { id: "0", data: { name: "one" } },
      { id: "1", data: { name: "two" } },
    ]);

    expect(ref).toBeUndefined();
    expect(watch).toHaveBeenCalledTimes(1);
    expect(watch.mock.calls[0][0]).toMatchObject({
      complete: true,
      result: { messages: [message("1", "one"), message("2", "two")] },
    });
  });

  it("writes a deferred fragment to its original node after a list prepend (apollo-client#13530)", () => {
    const cache = new TestCache();
    const execution = execute(cache, messagesQuery);
    execution.initial({ messages: [message("1")] }, [
      { path: ["messages", 0], label: "name" },
    ]);
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

    execution.subsequent([{ id: "0", data: { name: "one" } }]);

    expect(cache.readQuery({ query: messagesQuery })).toEqual({
      messages: [message("2", "not deferred"), message("1", "one")],
    });
  });

  it("writes a deferred fragment to an embedded object in place (and keeps later writes of its children)", () => {
    const cache = new TestCache();
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
    const execution = execute(cache, query);
    execution.initial({ info: { __typename: "Info", item: message("1") } }, [
      { path: ["info"], label: "name" },
    ]);
    cache.writeFragment({
      id: "Message:1",
      fragment: gql`
        fragment Edit on Message {
          text
        }
      `,
      data: { __typename: "Message", text: "edited" },
    });

    execution.subsequent([{ id: "0", data: { name: "delivered" } }]);

    expect(cache.readQuery({ query })).toEqual({
      info: {
        __typename: "Info",
        item: { ...message("1"), text: "edited" },
        name: "delivered",
      },
    });
  });

  it("writes results for all objects with the same selection as one operation fragment", () => {
    const cache = new TestCache();
    const query = gql`
      query {
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
    const cell = { __typename: "Cell" };
    const execution = execute(cache, query);
    // The same source object at different positions
    execution.initial(
      { message: { ...message("1"), rows: [[cell], [cell]] } },
      [
        { path: ["message", "rows", 0, 0], label: "cell" },
        { path: ["message", "rows", 1, 0], label: "cell" },
      ],
    );
    const indexOperationFragment = jest.spyOn(
      IndexTree,
      "indexOperationFragment",
    );

    execution.subsequent([
      { id: "1", data: { name: "b" } },
      { id: "0", data: { name: "a" } },
    ]);

    expect(indexOperationFragment).toHaveBeenCalledTimes(1);
    expect(indexOperationFragment.mock.calls[0][3]).toHaveLength(2);
    expect(cache.readQuery({ query })).toEqual({
      message: {
        ...message("1"),
        rows: [[{ ...cell, name: "a" }], [{ ...cell, name: "b" }]],
      },
    });
    indexOperationFragment.mockRestore();
  });

  it("writes results of different selections as separate operation fragments", () => {
    const cache = new TestCache();
    const query = gql`
      query {
        user {
          id
          ... @defer(label: "bio") {
            bio
          }
          posts {
            id
            ... @defer(label: "title") {
              title
            }
          }
        }
      }
    `;
    const user = { __typename: "User", id: "u" };
    const post = (id: string) => ({ __typename: "Post", id });
    const execution = execute(cache, query);
    execution.initial({ user: { ...user, posts: [post("1"), post("2")] } }, [
      { path: ["user"], label: "bio" },
      { path: ["user", "posts", 0], label: "title" },
      { path: ["user", "posts", 1], label: "title" },
    ]);

    execution.subsequent([
      { id: "1", data: { title: "first" } },
      { id: "0", data: { bio: "bio" } },
      { id: "2", data: { title: "second" } },
    ]);

    expect(cache.readQuery({ query })).toEqual({
      user: {
        ...user,
        bio: "bio",
        posts: [
          { ...post("1"), title: "first" },
          { ...post("2"), title: "second" },
        ],
      },
    });
  });

  it("merges results of different fragments deferred on the same object", () => {
    const cache = new TestCache();
    const query = gql`
      query {
        user {
          id
          ... @defer(label: "a") {
            a
            nested {
              x
            }
          }
          ... @defer(label: "b") {
            b
            nested {
              y
            }
          }
        }
      }
    `;
    const user = { __typename: "User", id: "u" };
    const execution = execute(cache, query);
    execution.initial({ user }, [
      { path: ["user"], label: "a" },
      { path: ["user"], label: "b" },
    ]);

    execution.subsequent([
      { id: "0", data: { a: "a", nested: { x: "x" } } },
      { id: "1", data: { b: "b", nested: { y: "y" } } },
    ]);

    expect(cache.readQuery({ query })).toEqual({
      user: { ...user, a: "a", b: "b", nested: { x: "x", y: "y" } },
    });
  });

  it("writes data at a sub-path of a fragment to the object at that path", () => {
    const cache = new TestCache();
    const query = gql`
      query {
        user {
          id
          profile {
            id
            ... @defer(label: "outer") {
              settings {
                theme
              }
            }
          }
          ... @defer(label: "inner") {
            profile {
              id
              settings {
                language
              }
            }
          }
        }
      }
    `;
    const user = { __typename: "User", id: "u" };
    const profile = { __typename: "Profile", id: "p" };
    const execution = execute(cache, query);
    execution.initial({ user: { ...user, profile } }, [
      { path: ["user"], label: "inner" },
      { path: ["user", "profile"], label: "outer" },
    ]);

    execution.subsequent([
      { id: "1", data: { settings: { theme: "dark" } } },
      { id: "0", subPath: ["profile", "settings"], data: { language: "en" } },
    ]);

    expect(cache.readQuery({ query })).toEqual({
      user: {
        ...user,
        profile: { ...profile, settings: { theme: "dark", language: "en" } },
      },
    });
  });

  it("normalizes nodes nested in deferred fragments", () => {
    const cache = new TestCache();
    const query = gql`
      query {
        messages {
          id
          ... @defer {
            author {
              id
              name
            }
          }
        }
      }
    `;
    const author = gql`
      query {
        author {
          id
          name
        }
      }
    `;
    const user = (name: string) => ({ __typename: "User", id: "a", name });
    cache.writeQuery({ query: author, data: { author: user("old") } });
    const execution = execute(cache, query);
    execution.initial({ messages: [{ __typename: "Message", id: "1" }] }, [
      { path: ["messages", 0] },
    ]);

    execution.subsequent([{ id: "0", data: { author: user("new") } }]);

    expect(cache.readQuery({ query: author })).toEqual({
      author: user("new"),
    });
  });

  it("keeps partial flags of the stored tree correct", () => {
    const cache = new TestCache();
    const query = gql`
      query {
        user {
          id
          items {
            meta {
              id
              a
              ... @defer {
                b
              }
            }
          }
        }
      }
    `;
    const user = { __typename: "User", id: "u" };
    const meta = (id: string, fields: Record<string, string> = {}) => ({
      meta: { __typename: "Meta", id, a: `a${id}`, ...fields },
    });
    const execution = execute(cache, query);
    execution.initial({ user: { ...user, items: [meta("0"), meta("1")] } }, [
      { path: ["user", "items", 0, "meta"] },
      { path: ["user", "items", 1, "meta"] },
    ]);
    // Make the second item partial
    cache.modify({
      id: "Meta:1",
      fields: { a: (_, { DELETE }) => DELETE },
    });

    execution.subsequent([
      { id: "0", data: { b: "b0" } },
      { id: "1", data: { b: "b1" } },
    ]);

    const tree = cache.storedTree(query);
    assert(tree);
    expect(
      [...tree.incompleteChunks].map((chunk) =>
        isObjectValue(chunk)
          ? [chunk.key, [...(chunk.missingFields ?? [])].map((f) => f.name)]
          : chunk,
      ),
    ).toEqual([["Meta:1", ["a"]]]);
    const [userChunk] = tree.nodes.get("User:u") ?? [];
    const items = userChunk.selection.fields.get("items")?.[0];
    assert(items);
    expect(userChunk.partialFields).toEqual(new Set([items]));
    const list = resolveFieldChunk(userChunk, items);
    assert(isCompositeListValue(list));
    expect(list.partialItems).toEqual(new Set([1]));
    const [first, second] = [0, 1].map((i) => resolveListItemChunk(list, i));
    assert(isObjectValue(first) && isObjectValue(second));
    expect(first.partialFields?.size ?? 0).toBe(0);
    expect(second.partialFields?.size).toBe(1);
    expect(tree.nodes.get("Meta:1")?.[0].data.b).toBe("b1");
    expect(tree.nodes.get("Meta:0")?.[0].data).toEqual(
      meta("0", { b: "b0" }).meta,
    );
  });
  it("ignores results for objects missing in the stored tree", () => {
    const cache = new TestCache();
    const execution = execute(cache, messagesQuery);
    execution.initial({ messages: [message("1")] }, [
      { path: ["messages", 0], label: "name" },
    ]);
    cache.writeQuery({ query: messagesQuery, data: { messages: [] } });

    execution.subsequent([{ id: "0", data: { name: "one" } }]);

    expect(cache.readQuery({ query: messagesQuery })).toEqual({
      messages: [],
    });
  });

  it("ignores results of a superseded execution", () => {
    const cache = new TestCache();
    const first = execute(cache, messagesQuery, { key: 1 });
    const second = execute(cache, messagesQuery, { key: 2 });
    first.initial({ messages: [message("1")] }, [
      { path: ["messages", 0], label: "name" },
    ]);
    second.initial({ messages: [message("2")] }, [
      { path: ["messages", 0], label: "name" },
    ]);

    first.subsequent([{ id: "0", data: { name: "first" } }]);
    expect(cache.readQuery({ query: messagesQuery })).toEqual({
      messages: [message("2")],
    });
    second.subsequent([{ id: "0", data: { name: "second" } }]);
    expect(cache.readQuery({ query: messagesQuery })).toEqual({
      messages: [message("2", "second")],
    });
  });

  it("ignores results after a complete result of the operation", () => {
    const cache = new TestCache();
    const execution = execute(cache, messagesQuery);
    execution.initial({ messages: [message("1")] }, [
      { path: ["messages", 0], label: "name" },
    ]);
    cache.write({
      query: messagesQuery,
      execution: { data: { messages: [message("1", "complete")] } },
    });

    execution.subsequent([{ id: "0", data: { name: "late" } }]);

    expect(cache.pendingCount(messagesQuery)).toBeUndefined();
    expect(cache.readQuery({ query: messagesQuery })).toEqual({
      messages: [message("1", "complete")],
    });
  });

  it("forgets completed results and the execution without next results", () => {
    const cache = new TestCache();
    const execution = execute(cache, messagesQuery);
    execution.initial({ messages: [message("1"), message("2")] }, [
      { path: ["messages", 0], label: "name" },
      { path: ["messages", 1], label: "name" },
    ]);
    expect(cache.pendingCount(messagesQuery)).toBe(2);

    execution.subsequent([{ id: "0", data: { name: "one" } }], {
      hasNext: true,
    });
    expect(cache.pendingCount(messagesQuery)).toBe(1);
    // Completed results are not written again
    execution.subsequent([{ id: "0", data: { name: "again" } }], {
      completed: [],
      hasNext: true,
    });
    expect(cache.readQuery({ query: messagesQuery })).toEqual({
      messages: [message("1", "one"), message("2")],
    });

    execution.subsequent([], { completed: ["1"], hasNext: false });
    expect(cache.pendingCount(messagesQuery)).toBeUndefined();
  });

  it("keeps the operation descriptor while results are pending", () => {
    const cache = new TestCache({ autoEvict: false });
    const mutation = gql`
      mutation Send @cache {
        send {
          id
          ... @defer {
            name
          }
        }
      }
    `;
    const execution = execute(cache, mutation);
    cache.recordOptimisticTransaction(() => {
      execution.initial({ send: message("1") }, [{ path: ["send"] }]);
    }, "layer");
    cache.removeOptimistic("layer");
    expect(cache.pendingCount(mutation)).toBe(1);
    expect(cache.canRelease(mutation)).toBe(false);
  });

  it("ignores results in the 2022 draft format (not supported yet)", () => {
    const logger = {
      debug: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const cache = new TestCache({ logger });
    const execution = execute(cache, messagesQuery);
    execution.initial({ messages: [message("1")] }, [
      { path: ["messages", 0], label: "name" },
    ]);
    const before = cache.extract();

    cache.write({
      query: messagesQuery,
      execution: {
        incremental: [
          { path: ["messages", 0], label: "name", data: { name: "one" } },
        ],
        hasNext: false,
      },
    });

    expect(cache.extract()).toEqual(before);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it.todo("applies merge policies to fields of deferred fragments");
});
