import { gql } from "@apollo/client";
import type { DocumentNode } from "graphql";
import { ForestRun } from "../ForestRun";
import { resolveOperationDescriptor } from "../cache/descriptor";
import { canReleaseOperationDescriptor } from "../cache/store";
import type {
  ExecutionKey,
  IncrementalDeferResult,
  IncrementalDeliverySubsequentResult,
  PendingResult,
} from "../incremental/types";
import type { IndexedTree } from "../forest/types";
import type { GraphChunk, ObjectChunk } from "../values/types";
import { assert } from "../jsutils/assert";
import {
  isCompositeListValue,
  isObjectValue,
  resolveFieldChunk,
  resolveListItemChunk,
} from "../values";
import * as DiffTree from "../diff/diffTree";
import * as Difference from "../diff/difference";

class TestCache extends ForestRun {
  operation(query: DocumentNode, variables = {}) {
    return resolveOperationDescriptor(this.env, this.store, query, variables);
  }
  storedTree(query: DocumentNode, variables = {}) {
    return this.store.dataForest.trees.get(this.operation(query, variables).id);
  }
  execution(query: DocumentNode, variables = {}) {
    return this.store.incrementalExecutions.get(
      this.operation(query, variables),
    );
  }
  placeholders(query: DocumentNode, variables = {}) {
    const keys = this.execution(query, variables)?.placeholders.keys();
    return keys ? [...keys].sort() : undefined;
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
      cache.writeExecutionResult({
        query,
        variables,
        execution: { data, hasNext: true, key },
      });
    },
    subsequent(
      incremental: IncrementalDeferResult[],
      { hasNext = false }: { hasNext?: boolean } = {},
    ) {
      return cache.writeExecutionResult({
        query,
        variables,
        execution: { incremental, hasNext, key },
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

const nestedQuery = gql`
  query {
    user {
      id
      ... @defer(label: "outer") {
        name
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
const user = { __typename: "User", id: "u" };
const friend = (id: string, bio?: string) => ({
  __typename: "User",
  id,
  ...(bio !== undefined && { bio }),
});

describe("@defer: subsequent results", () => {
  it("writes a deferred fragment to its node", () => {
    const cache = new TestCache();
    const execution = execute(cache, messagesQuery);
    execution.initial({ messages: [message("1"), message("2")] });
    const watch = jest.fn();
    cache.watch({ query: messagesQuery, optimistic: true, callback: watch });

    const ref = execution.subsequent([
      { path: ["messages", 0], label: "name", data: { name: "one" } },
      { path: ["messages", 1], label: "name", data: { name: "two" } },
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
    execution.initial({ info: { __typename: "Info", item: message("1") } });
    cache.writeFragment({
      id: "Message:1",
      fragment: gql`
        fragment Edit on Message {
          text
        }
      `,
      data: { __typename: "Message", text: "edited" },
    });

    execution.subsequent([{ path: ["info"], data: { name: "delivered" } }]);

    expect(cache.readQuery({ query })).toEqual({
      info: {
        __typename: "Info",
        item: { ...message("1"), text: "edited" },
        name: "delivered",
      },
    });
  });

  it("writes all results of a payload as one result", () => {
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
    execution.initial({ message: { ...message("1"), rows: [[cell], [cell]] } });
    expect(cache.placeholders(query)).toEqual([
      "message.rows.0.0",
      "message.rows.1.0",
    ]);
    const watch = jest.fn();
    cache.watch({ query, optimistic: true, callback: watch });
    const diffTree = jest.spyOn(DiffTree, "diffTree");

    execution.subsequent([
      { path: ["message", "rows", 1, 0], data: { name: "b" } },
      { path: ["message", "rows", 0, 0], data: { name: "a" } },
    ]);

    // One write: one diff of the incoming result
    expect(diffTree).toHaveBeenCalledTimes(1);
    expect(watch).toHaveBeenCalledTimes(1);
    expect(cache.readQuery({ query })).toEqual({
      message: {
        ...message("1"),
        rows: [[{ ...cell, name: "a" }], [{ ...cell, name: "b" }]],
      },
    });
    diffTree.mockRestore();
  });

  it("writes results of nested @defer within delivered data", () => {
    const cache = new TestCache();
    const execution = execute(cache, nestedQuery);
    execution.initial({ user });
    expect(cache.placeholders(nestedQuery)).toEqual(["user"]);

    execution.subsequent(
      [
        {
          path: ["user"],
          label: "outer",
          data: { name: "user", friends: [friend("1"), friend("2")] },
        },
      ],
      { hasNext: true },
    );
    expect(cache.placeholders(nestedQuery)).toEqual([
      "user",
      "user.friends.0",
      "user.friends.1",
    ]);
    expect(
      cache.diff({ query: nestedQuery, optimistic: false }).result,
    ).toEqual({
      user: { ...user, name: "user", friends: [friend("1"), friend("2")] },
    });

    execution.subsequent([
      { path: ["user", "friends", 1], label: "inner", data: { bio: "second" } },
      { path: ["user", "friends", 0], label: "inner", data: { bio: "first" } },
    ]);

    expect(cache.execution(nestedQuery)).toBeUndefined();
    expect(cache.diff({ query: nestedQuery, optimistic: false })).toMatchObject(
      {
        complete: true,
        result: {
          user: {
            ...user,
            name: "user",
            friends: [friend("1", "first"), friend("2", "second")],
          },
        },
      },
    );
  });

  it("writes results of nested @defer delivered with their parent in the same payload", () => {
    const cache = new TestCache();
    const execution = execute(cache, nestedQuery);
    execution.initial({ user });

    execution.subsequent([
      { path: ["user", "friends", 1], label: "inner", data: { bio: "second" } },
      {
        path: ["user"],
        label: "outer",
        data: { name: "user", friends: [friend("1"), friend("2")] },
      },
      { path: ["user", "friends", 0], label: "inner", data: { bio: "first" } },
    ]);

    expect(cache.diff({ query: nestedQuery, optimistic: false })).toMatchObject(
      {
        complete: true,
        result: {
          user: {
            ...user,
            name: "user",
            friends: [friend("1", "first"), friend("2", "second")],
          },
        },
      },
    );
  });

  it("locates nested @defer within delivered data after a list prepend", () => {
    const cache = new TestCache();
    const query = gql`
      query {
        messages {
          id
          text
          ... @defer(label: "details") {
            info {
              size
              ... @defer(label: "more") {
                more
              }
            }
          }
        }
      }
    `;
    const execution = execute(cache, query);
    execution.initial({ messages: [message("1")] });
    cache.modify({
      fields: {
        messages(existing) {
          const ref = cache.writeFragment({
            fragment: gql`
              fragment Sent on Message {
                id
                text
                info {
                  size
                  more
                }
              }
            `,
            data: {
              ...message("2"),
              info: { __typename: "Info", size: 2, more: "not deferred" },
            },
          });
          return [ref, ...existing];
        },
      },
    });

    execution.subsequent(
      [
        {
          path: ["messages", 0],
          data: { info: { __typename: "Info", size: 1 } },
        },
      ],
      { hasNext: true },
    );
    execution.subsequent([
      { path: ["messages", 0, "info"], data: { more: "deferred" } },
    ]);

    expect(cache.readQuery({ query })).toEqual({
      messages: [
        {
          ...message("2"),
          info: { __typename: "Info", size: 2, more: "not deferred" },
        },
        {
          ...message("1"),
          info: { __typename: "Info", size: 1, more: "deferred" },
        },
      ],
    });
  });

  it("captures placeholders in data shared by multiple results", () => {
    const cache = new TestCache();
    const query = gql`
      query {
        messages {
          id
          ... @defer {
            info {
              size
              ... @defer {
                more
              }
            }
          }
        }
      }
    `;
    const execution = execute(cache, query);
    execution.initial({ messages: [message("1"), message("2")] });
    const info = { __typename: "Info", size: 1 };

    execution.subsequent(
      [
        { path: ["messages", 0], data: { info } },
        { path: ["messages", 1], data: { info } },
      ],
      { hasNext: true },
    );
    expect(cache.placeholders(query)).toEqual([
      "messages.0",
      "messages.0.info",
      "messages.1",
      "messages.1.info",
    ]);
    execution.subsequent([
      { path: ["messages", 1, "info"], data: { more: "b" } },
      { path: ["messages", 0, "info"], data: { more: "a" } },
    ]);

    expect(cache.readQuery({ query })).toEqual({
      messages: [
        { ...message("1"), info: { ...info, more: "a" } },
        { ...message("2"), info: { ...info, more: "b" } },
      ],
    });
  });

  it("does not re-capture placeholders of stored objects outside of delivered data", () => {
    const cache = new TestCache();
    const query = gql`
      query {
        user {
          id
          friends {
            id
            ... @defer {
              bio
            }
          }
          ... @defer {
            name
          }
        }
      }
    `;
    const execution = execute(cache, query);
    execution.initial({ user: { ...user, friends: [friend("1")] } });
    // A local prepend: the server path of the friend stays `user.friends.0`
    cache.modify({
      id: "User:u",
      fields: {
        friends(existing) {
          const ref = cache.writeFragment({
            fragment: gql`
              fragment Friend on User {
                id
                bio
              }
            `,
            data: friend("0", "local"),
          });
          return [ref, ...existing];
        },
      },
    });

    execution.subsequent([{ path: ["user"], data: { name: "user" } }], {
      hasNext: true,
    });
    execution.subsequent([
      { path: ["user", "friends", 0], data: { bio: "first" } },
    ]);

    expect(cache.readQuery({ query })).toEqual({
      user: {
        ...user,
        name: "user",
        friends: [friend("0", "local"), friend("1", "first")],
      },
    });
  });

  it("writes results of fragments deferred on different objects", () => {
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
    const post = (id: string) => ({ __typename: "Post", id });
    const execution = execute(cache, query);
    execution.initial({ user: { ...user, posts: [post("1"), post("2")] } });

    execution.subsequent([
      { path: ["user", "posts", 0], data: { title: "first" } },
      { path: ["user"], data: { bio: "bio" } },
      { path: ["user", "posts", 1], data: { title: "second" } },
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
    const execution = execute(cache, query);
    execution.initial({ user });

    execution.subsequent([
      { path: ["user"], label: "a", data: { a: "a", nested: { x: "x" } } },
      { path: ["user"], label: "b", data: { b: "b", nested: { y: "y" } } },
    ]);

    expect(cache.readQuery({ query })).toEqual({
      user: { ...user, a: "a", b: "b", nested: { x: "x", y: "y" } },
    });
  });

  it("merges results delivered to the same nested object in one payload", () => {
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
    const profile = { __typename: "Profile", id: "p" };
    const execution = execute(cache, query);
    execution.initial({ user: { ...user, profile } });

    execution.subsequent([
      { path: ["user", "profile"], data: { settings: { theme: "dark" } } },
      {
        path: ["user"],
        data: { profile: { ...profile, settings: { language: "en" } } },
      },
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
    execution.initial({ messages: [{ __typename: "Message", id: "1" }] });

    execution.subsequent([
      { path: ["messages", 0], data: { author: user("new") } },
    ]);

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
    const meta = (id: string, fields: Record<string, string> = {}) => ({
      meta: { __typename: "Meta", id, a: `a${id}`, ...fields },
    });
    const execution = execute(cache, query);
    execution.initial({ user: { ...user, items: [meta("0"), meta("1")] } });
    // Make the second item partial
    cache.modify({
      id: "Meta:1",
      fields: { a: (_, { DELETE }) => DELETE },
    });

    execution.subsequent([
      { path: ["user", "items", 0, "meta"], data: { b: "b0" } },
      { path: ["user", "items", 1, "meta"], data: { b: "b1" } },
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
    execution.initial({ messages: [message("1")] });
    cache.writeQuery({ query: messagesQuery, data: { messages: [] } });

    execution.subsequent([{ path: ["messages", 0], data: { name: "one" } }]);

    expect(cache.readQuery({ query: messagesQuery })).toEqual({
      messages: [],
    });
  });

  it("ignores results without data", () => {
    const cache = new TestCache();
    const execution = execute(cache, messagesQuery);
    execution.initial({ messages: [message("1")] });
    const before = cache.extract();

    execution.subsequent([
      { path: ["messages", 0], data: null, errors: [{ message: "failed" }] },
    ]);

    expect(cache.extract()).toEqual(before);
  });

  it("ignores results of a superseded execution", () => {
    const cache = new TestCache();
    const first = execute(cache, messagesQuery, { key: 1 });
    const second = execute(cache, messagesQuery, { key: 2 });
    first.initial({ messages: [message("1")] });
    second.initial({ messages: [message("2")] });

    first.subsequent([{ path: ["messages", 0], data: { name: "first" } }]);
    expect(cache.readQuery({ query: messagesQuery })).toEqual({
      messages: [message("2")],
    });
    second.subsequent([{ path: ["messages", 0], data: { name: "second" } }]);
    expect(cache.readQuery({ query: messagesQuery })).toEqual({
      messages: [message("2", "second")],
    });
  });

  it("ignores results after a complete result of the operation", () => {
    const cache = new TestCache();
    const execution = execute(cache, messagesQuery);
    execution.initial({ messages: [message("1")] });
    cache.writeExecutionResult({
      query: messagesQuery,
      execution: { data: { messages: [message("1", "complete")] } },
    });

    execution.subsequent([{ path: ["messages", 0], data: { name: "late" } }]);

    expect(cache.execution(messagesQuery)).toBeUndefined();
    expect(cache.readQuery({ query: messagesQuery })).toEqual({
      messages: [message("1", "complete")],
    });
  });

  it("supersedes an execution even when its stored data is reused", () => {
    const cache = new TestCache();
    const first = execute(cache, messagesQuery, { key: "A" });
    const second = execute(cache, messagesQuery, { key: "B" });
    first.initial({ messages: [message("1")] });
    const stored = cache.storedTree(messagesQuery);
    assert(stored);
    second.initial(stored.result.data);

    first.subsequent([{ path: ["messages", 0], data: { name: "late" } }]);
    second.subsequent([{ path: ["messages", 0], data: { name: "current" } }]);

    expect(cache.readQuery({ query: messagesQuery })).toEqual({
      messages: [message("1", "current")],
    });
  });

  it("closes an execution when a complete write reuses its stored data", () => {
    const cache = new TestCache();
    const execution = execute(cache, messagesQuery);
    execution.initial({ messages: [message("1", "inline")] });
    const stored = cache.storedTree(messagesQuery);
    assert(stored);
    cache.writeExecutionResult({
      query: messagesQuery,
      execution: { data: stored.result.data },
    });

    execution.subsequent([{ path: ["messages", 0], data: { name: "late" } }]);

    expect(cache.readQuery({ query: messagesQuery })).toEqual({
      messages: [message("1", "inline")],
    });
  });

  it("updates normalized data from @defer below a non-cacheable mutation field", () => {
    const cache = new TestCache({ cleanupNonCacheableOperations: true });
    const mutation = gql`
      mutation {
        send {
          id
          text
          ... @defer {
            name
          }
        }
      }
    `;
    cache.writeQuery({
      query: messagesQuery,
      data: { messages: [message("1", "old"), message("2")] },
    });
    const execution = execute(cache, mutation);
    execution.initial({ send: [message("1"), message("2")] });
    expect(cache.getStats().treeCount).toBe(1);
    const updated = { ...message("2"), text: "edited" };
    cache.writeQuery({
      query: messagesQuery,
      data: { messages: [message("1", "old"), updated] },
    });

    execution.subsequent([{ path: ["send", 0], data: { name: "new" } }], {
      hasNext: true,
    });
    execution.subsequent([]);

    expect(cache.readQuery({ query: messagesQuery })).toEqual({
      messages: [message("1", "new"), updated],
    });
    expect(cache.getStats()).toMatchObject({ treeCount: 1, operationCount: 1 });
  });

  it("does not track results with deferred data resolved inline (a complete result)", () => {
    const cache = new TestCache();
    cache.writeExecutionResult({
      query: messagesQuery,
      execution: { data: { messages: [message("1", "inline")] } },
    });

    expect(cache.execution(messagesQuery)).toBeUndefined();
  });

  it("writes results of partially inlined fragments", () => {
    const cache = new TestCache();
    const execution = execute(cache, messagesQuery);
    execution.initial({ messages: [message("1", "inline"), message("2")] });
    expect(cache.placeholders(messagesQuery)).toEqual([
      "messages.0",
      "messages.1",
    ]);

    execution.subsequent([{ path: ["messages", 1], data: { name: "two" } }]);

    expect(cache.readQuery({ query: messagesQuery })).toEqual({
      messages: [message("1", "inline"), message("2", "two")],
    });
  });

  it("captures placeholders of fragments enabled by variables only", () => {
    const cache = new TestCache();
    const query = gql`
      query ($defer: Boolean) {
        messages {
          id
          ... @defer(if: $defer) {
            name
          }
        }
      }
    `;
    const variables = { defer: false };
    cache.writeExecutionResult({
      query,
      variables,
      execution: { data: { messages: [message("1")] }, hasNext: true },
    });
    expect(cache.execution(query, variables)).toBeUndefined();
  });

  it("forgets the execution without next results", () => {
    const cache = new TestCache();
    const execution = execute(cache, messagesQuery);
    execution.initial({ messages: [message("1"), message("2")] });

    execution.subsequent([{ path: ["messages", 0], data: { name: "one" } }], {
      hasNext: true,
    });
    expect(cache.execution(messagesQuery)).toBeDefined();

    execution.subsequent([], { hasNext: false });
    expect(cache.execution(messagesQuery)).toBeUndefined();
    expect(cache.readQuery({ query: messagesQuery })).toEqual({
      messages: [message("1", "one"), message("2")],
    });
  });

  it("keeps the descriptor of a non-cacheable operation while results are pending", () => {
    const cache = new TestCache({
      autoEvict: false,
      cleanupNonCacheableOperations: true,
    });
    const mutation = gql`
      mutation Send {
        send {
          id
          ... @defer {
            name
          }
        }
      }
    `;
    const execution = execute(cache, mutation);
    execution.initial({ send: message("1") });
    expect(cache.placeholders(mutation)).toEqual(["send"]);
    expect(cache.canRelease(mutation)).toBe(false);

    execution.subsequent([{ path: ["send"], data: { name: "one" } }]);

    expect(cache.execution(mutation)).toBeUndefined();
    expect(cache.canRelease(mutation)).toBe(true);
  });

  it("writes execution results to the base forest only", () => {
    const cache = new TestCache();
    expect(() =>
      cache.recordOptimisticTransaction(() => {
        execute(cache, messagesQuery).initial({ messages: [message("1")] });
      }, "layer"),
    ).toThrow();
  });

  it("writes results after an optimistic write of the operation is rolled back", () => {
    const cache = new TestCache();
    const execution = execute(cache, messagesQuery);
    execution.initial({ messages: [message("1")] });
    cache.recordOptimisticTransaction(() => {
      cache.writeQuery({
        query: messagesQuery,
        data: { messages: [message("1", "optimistic")] },
      });
    }, "layer");
    cache.removeOptimistic("layer");

    execution.subsequent([{ path: ["messages", 0], data: { name: "final" } }]);

    expect(cache.readQuery({ query: messagesQuery })).toEqual({
      messages: [message("1", "final")],
    });
  });

  describe.each(["subPath", "parent result"])(
    "delivers objects in the server view (%s)",
    (format) => {
      it.each([true, false])(
        "after another write replaced the object (the original is still reachable: %s)",
        (reachable) => {
          const cache = new TestCache();
          const query = gql`
            query {
              viewers {
                id
                profile {
                  id
                  title
                }
                ... @defer {
                  name
                  profile {
                    bio
                  }
                }
              }
            }
          `;
          const profile = (id: string) => ({
            __typename: "Profile",
            id,
            title: id,
          });
          const viewer = { ...user, profile: profile("A") };
          const other = { ...user, id: "other", profile: profile("A") };
          const peers = reachable ? [other] : [];
          const path = ["viewers", 0];
          cache.writeExecutionResult({
            query,
            execution: {
              data: { viewers: [viewer, ...peers] },
              ...(format === "subPath" && { pending: [{ id: "0", path }] }),
              hasNext: true,
            },
          });
          const replacement = { ...user, profile: profile("B") };
          cache.writeQuery({
            query,
            data: { viewers: [replacement, ...peers] },
          });
          const name = "delivered";
          const bio = "for A";

          cache.writeExecutionResult({
            query,
            execution:
              format === "subPath"
                ? {
                    incremental: [
                      { id: "0", data: { name } },
                      { id: "0", subPath: ["profile"], data: { bio } },
                    ],
                    completed: [{ id: "0" }],
                    hasNext: false,
                  }
                : {
                    incremental: [{ path, data: { name, profile: { bio } } }],
                    hasNext: false,
                  },
          });

          // The server view of the delivered fragment wins (as with a refetch): A gets `bio` and is linked again
          expect(
            cache.readQuery<{ viewers: unknown[] }>({
              query,
              returnPartialData: true,
            })?.viewers,
          ).toEqual([
            { ...user, profile: { ...profile("A"), bio }, name },
            ...(reachable
              ? [{ ...other, profile: { ...profile("A"), bio } }]
              : []),
          ]);
        },
      );
    },
  );

  it("keeps a local edit when another deferred fragment merges the same embedded field", () => {
    const merge = jest.fn((existing, incoming) => ({
      ...existing,
      ...incoming,
    }));
    const cache = new TestCache({
      typePolicies: { User: { fields: { profile: { merge } } } },
    });
    const query = gql`
      query {
        viewer {
          id
          profile {
            title
          }
          ... @defer(label: "a") {
            profile {
              bio
            }
          }
          ... @defer(label: "b") {
            profile {
              lang
            }
          }
        }
      }
    `;
    const execution = execute(cache, query);
    const profile = { __typename: "Profile", title: "title" };
    execution.initial({ viewer: { ...user, profile } });
    execution.subsequent(
      [{ path: ["viewer"], label: "a", data: { profile: { bio: "old bio" } } }],
      { hasNext: true },
    );
    cache.writeQuery({
      query: gql`
        {
          viewer {
            id
            profile {
              bio
            }
          }
        }
      `,
      data: {
        viewer: { ...user, profile: { __typename: "Profile", bio: "edited" } },
      },
    });
    merge.mockClear();
    execution.subsequent([
      { path: ["viewer"], label: "b", data: { profile: { lang: "en" } } },
    ]);
    expect(cache.readQuery({ query })).toEqual({
      viewer: { ...user, profile: { ...profile, bio: "edited", lang: "en" } },
    });
    expect(merge).toHaveBeenCalledTimes(1);
    expect(merge.mock.calls[0][1]).not.toHaveProperty("bio");
  });

  it("keeps the tree needed by a pending execution through gc, but releases it after completion", () => {
    const cache = new TestCache({ maxOperationCount: 1, autoEvict: false });
    const query = gql`
      query Stream {
        viewer {
          id
          ... @defer {
            bio
          }
        }
      }
    `;
    const other = gql`
      query Profile {
        user {
          id
          bio
        }
      }
    `;
    const execution = execute(cache, query);
    execution.initial({ viewer: user });
    cache.writeQuery({
      query: other,
      data: { user: { ...user, bio: "previous" } },
    });
    cache.gc();
    execution.subsequent([{ path: ["viewer"], data: { bio: "from patch" } }]);
    expect(cache.readQuery({ query: other })).toEqual({
      user: { ...user, bio: "from patch" },
    });
    cache.gc();
    expect(cache.storedTree(query)).toBeUndefined();
  });

  it("passes only delivered data of embedded objects to merge policies of non-cacheable operations", () => {
    const merge = jest.fn((existing, incoming) => ({
      ...existing,
      ...incoming,
    }));
    const cache = new TestCache({
      typePolicies: { User: { fields: { profile: { merge } } } },
    });
    const mutation = gql`
      mutation {
        edit {
          id
          profile {
            title
          }
          ... @defer {
            profile {
              bio
            }
          }
        }
      }
    `;
    const query = gql`
      query {
        user {
          id
          profile {
            title
            bio
          }
        }
      }
    `;
    const profile = { __typename: "Profile", title: "initial" };
    const execution = execute(cache, mutation);
    execution.initial({ edit: { ...user, profile } });
    cache.writeQuery({
      query,
      data: { user: { ...user, profile: { ...profile, title: "local" } } },
    });
    merge.mockClear();

    execution.subsequent([
      { path: ["edit"], data: { profile: { bio: "new" } } },
    ]);

    expect(cache.readQuery({ query })).toEqual({
      user: { ...user, profile: { ...profile, title: "local", bio: "new" } },
    });
    expect(merge).toHaveBeenCalledTimes(1);
    expect(merge.mock.calls[0][1]).not.toHaveProperty("title");
  });
});

describe("@defer: deferred chunks of trees", () => {
  // All chunks with deferred fragments reachable from the root of the tree
  function collectDeferredChunks(tree: IndexedTree): ObjectChunk[] {
    const chunks: ObjectChunk[] = [];
    const visit = (value: GraphChunk) => {
      if (isObjectValue(value)) {
        if (value.selection.deferredFragments) {
          chunks.push(value);
        }
        for (const ref of value.fieldChunks.values()) {
          visit(ref.value);
        }
      } else if (isCompositeListValue(value)) {
        for (let index = 0; index < value.data.length; index++) {
          visit(resolveListItemChunk(value, index));
        }
      }
    };
    const root = tree.dataMap.get(tree.result.data)?.value;
    assert(root);
    visit(root);
    return chunks;
  }

  function expectCurrentDeferredChunks(tree: IndexedTree | undefined) {
    assert(tree?.deferredChunks);
    for (const chunk of tree.deferredChunks) {
      expect(tree.dataMap.get(chunk.data)?.value).toBe(chunk);
    }
    expect(new Set(tree.deferredChunks)).toEqual(
      new Set(collectDeferredChunks(tree)),
    );
    expect(tree.deferredChunks).toHaveLength(new Set(tree.deferredChunks).size);
    return tree.deferredChunks;
  }

  const textQuery = gql`
    query {
      messages {
        id
        text
      }
    }
  `;

  it("are not collected for operations without @defer", () => {
    const cache = new TestCache();
    cache.writeQuery({ query: textQuery, data: { messages: [message("1")] } });
    expect(cache.storedTree(textQuery)?.deferredChunks).toBeUndefined();
  });

  it("are current after the initial write", () => {
    const cache = new TestCache();
    execute(cache, messagesQuery).initial({
      messages: [message("1"), message("2")],
    });
    expect(
      expectCurrentDeferredChunks(cache.storedTree(messagesQuery)),
    ).toHaveLength(2);
  });

  it("are current after re-indexing with recycled chunks (updateTree)", () => {
    const cache = new TestCache();
    execute(cache, messagesQuery).initial({
      messages: [message("1"), message("2")],
    });
    const before = cache.storedTree(messagesQuery);
    const [, second] = before?.deferredChunks ?? [];

    // Another operation changes a node of the tree
    cache.writeQuery({
      query: gql`
        query {
          message {
            id
            text
          }
        }
      `,
      data: { message: { ...message("1"), text: "changed" } },
    });

    const after = cache.storedTree(messagesQuery);
    expect(after).not.toBe(before);
    const chunks = expectCurrentDeferredChunks(after);
    expect(chunks).toHaveLength(2);
    // The unchanged chunk is recycled (and current), the changed one is new
    expect(chunks).toContain(second);
    expect(chunks.map((chunk) => chunk.data.text)).toEqual([
      "changed",
      "text 2",
    ]);
  });

  it("are current after merge policies are applied", () => {
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
    cache.writeQuery({
      query: messagesQuery,
      data: { messages: [message("1", "one")] },
    });
    execute(cache, messagesQuery).initial({ messages: [message("2")] });

    const chunks = expectCurrentDeferredChunks(cache.storedTree(messagesQuery));
    expect(chunks.map((chunk) => chunk.key)).toEqual([
      "Message:1",
      "Message:2",
    ]);
  });

  it("are current after repair of shared references", () => {
    const cache = new TestCache();
    const query = gql`
      query {
        message {
          id
          rows: grid {
            __typename
            ... @defer {
              name
            }
          }
        }
      }
    `;
    const cell = { __typename: "Cell" };
    execute(cache, query).initial({
      message: { ...message("1"), rows: [[cell], [cell]] },
    });

    const chunks = expectCurrentDeferredChunks(cache.storedTree(query));
    expect(chunks).toHaveLength(2);
    expect(chunks[0].data).not.toBe(chunks[1].data);
  });

  it("are current after splicing", () => {
    const cache = new TestCache();
    const execution = execute(cache, nestedQuery);
    execution.initial({ user });

    execution.subsequent(
      [
        {
          path: ["user"],
          data: { name: "user", friends: [friend("1"), friend("2")] },
        },
      ],
      { hasNext: true },
    );

    const chunks = expectCurrentDeferredChunks(cache.storedTree(nestedQuery));
    expect(chunks.map((chunk) => chunk.key)).toEqual([
      "User:u",
      "User:1",
      "User:2",
    ]);
  });

  it("are current after deleting fields in place (cache.modify)", () => {
    const cache = new TestCache();
    const execution = execute(cache, messagesQuery);
    execution.initial({ messages: [message("1")] });

    cache.modify({ fields: { messages: (_, { DELETE }) => DELETE } });

    expect(
      expectCurrentDeferredChunks(cache.storedTree(messagesQuery)),
    ).toEqual([]);
    // The deleted object is not written to
    execution.subsequent([{ path: ["messages", 0], data: { name: "one" } }]);
    expect(cache.storedTree(messagesQuery)?.result.data.messages).toEqual([
      message("1"),
    ]);
  });
});

describe("@defer: results in the incremental delivery format", () => {
  // Incremental execution in the incremental delivery format (`pending`, `id`, `subPath`, `completed`)
  function executeIncrementalDelivery(cache: ForestRun, query: DocumentNode) {
    return {
      initial(data: Record<string, unknown>, pending: PendingResult[]) {
        cache.writeExecutionResult({
          query,
          execution: { data, pending, hasNext: true },
        });
      },
      subsequent(execution: IncrementalDeliverySubsequentResult) {
        cache.writeExecutionResult({ query, execution });
      },
    };
  }

  it("converts results with ids and sub-paths", () => {
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
    const profile = { __typename: "Profile", id: "p" };
    const execution = executeIncrementalDelivery(cache, query);
    execution.initial({ user: { ...user, profile } }, [
      { id: "0", path: ["user"], label: "inner" },
      { id: "1", path: ["user", "profile"], label: "outer" },
    ]);

    execution.subsequent({
      incremental: [
        { id: "1", data: { settings: { theme: "dark" } } },
        { id: "0", subPath: ["profile", "settings"], data: { language: "en" } },
      ],
      completed: [{ id: "0" }, { id: "1" }],
      hasNext: false,
    });

    expect(cache.readQuery({ query })).toEqual({
      user: {
        ...user,
        profile: { ...profile, settings: { theme: "dark", language: "en" } },
      },
    });
  });

  it("converts results with sub-paths of objects delivered by earlier payloads", () => {
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
    const profile = { __typename: "Profile", id: "p" };
    const execution = executeIncrementalDelivery(cache, query);
    execution.initial({ user: { ...user, profile } }, [
      { id: "0", path: ["user"], label: "inner" },
      { id: "1", path: ["user", "profile"], label: "outer" },
    ]);

    execution.subsequent({
      incremental: [{ id: "1", data: { settings: { theme: "dark" } } }],
      completed: [{ id: "1" }],
      hasNext: true,
    });
    execution.subsequent({
      incremental: [
        { id: "0", subPath: ["profile", "settings"], data: { language: "en" } },
      ],
      completed: [{ id: "0" }],
      hasNext: false,
    });

    expect(cache.readQuery({ query })).toEqual({
      user: {
        ...user,
        profile: { ...profile, settings: { theme: "dark", language: "en" } },
      },
    });
  });

  it.each([true, false])(
    "retains data delivered above a pending sub-path (split: %s)",
    (split) => {
      const query = gql`
        query {
          viewer {
            id
            profile {
              id
              ... @defer(label: "inner") {
                settings {
                  language
                }
              }
            }
            ... @defer(label: "outer") {
              profile {
                settings {
                  theme
                }
              }
            }
          }
        }
      `;
      const cache = new TestCache();
      const execution = executeIncrementalDelivery(cache, query);
      const profile = { __typename: "Profile", id: "p" };
      execution.initial({ viewer: { ...user, profile } }, [
        { id: "inner", path: ["viewer", "profile"], label: "inner" },
        { id: "outer", path: ["viewer"], label: "outer" },
      ]);
      const outer = {
        id: "outer",
        data: { profile: { settings: { theme: "dark" } } },
      };
      const inner = {
        id: "inner",
        subPath: ["settings"],
        data: { language: "en" },
      };
      if (split) {
        execution.subsequent({
          incremental: [outer],
          completed: [{ id: "outer" }],
          hasNext: true,
        });
      }
      execution.subsequent({
        incremental: split ? [inner] : [outer, inner],
        completed: split
          ? [{ id: "inner" }]
          : [{ id: "outer" }, { id: "inner" }],
        hasNext: false,
      });
      expect(cache.diff({ query, optimistic: false })).toMatchObject({
        complete: true,
        result: {
          viewer: {
            ...user,
            profile: {
              ...profile,
              settings: { theme: "dark", language: "en" },
            },
          },
        },
      });
    },
  );

  it("does not append a reconstructed list when a sub-path delivers one item field", () => {
    const merge = jest.fn((existing: unknown[] = [], incoming: unknown[]) => [
      ...existing,
      ...incoming,
    ]);
    const cache = new TestCache({
      typePolicies: { Query: { fields: { messages: { merge } } } },
    });
    const query = gql`
      query {
        messages {
          id
          text
        }
        ... @defer {
          messages {
            name
          }
        }
      }
    `;
    const execution = executeIncrementalDelivery(cache, query);
    execution.initial({ messages: [message("1"), message("2")] }, [
      { id: "name", path: [] },
    ]);
    merge.mockClear();
    execution.subsequent({
      incremental: [
        { id: "name", subPath: ["messages", 0], data: { name: "one" } },
      ],
      completed: [{ id: "name" }],
      hasNext: false,
    });
    expect(cache.readQuery({ query, returnPartialData: true })).toEqual({
      __typename: "Query",
      messages: [message("1", "one"), message("2")],
    });
    expect(merge).not.toHaveBeenCalled();
  });

  // The result carries the server view of the list: a local reorder is overwritten (as by a refetch)
  it("resolves a list index in subPath against the server's original order", () => {
    const cache = new TestCache();
    const query = gql`
      query {
        messages {
          id
          text
        }
        ... @defer {
          messages {
            name
          }
        }
      }
    `;
    const execution = executeIncrementalDelivery(cache, query);
    execution.initial({ messages: [message("1"), message("2")] }, [
      { id: "0", path: [] },
    ]);
    cache.modify({
      fields: { messages: (existing) => [...existing].reverse() },
    });

    execution.subsequent({
      incremental: [
        { id: "0", subPath: ["messages", 0], data: { name: "one" } },
      ],
      completed: [{ id: "0" }],
      hasNext: false,
    });

    expect(cache.readQuery({ query, returnPartialData: true })).toEqual({
      __typename: "Query",
      messages: [message("1", "one"), message("2")],
    });
  });

  it("keeps data of list items when a subPath crosses a list", () => {
    const cache = new TestCache();
    const query = gql`
      query {
        messages {
          id
          info {
            size
          }
        }
        ... @defer {
          messages {
            info {
              more
            }
          }
        }
      }
    `;
    const info = { __typename: "Info", size: 1 };
    const item = { __typename: "Message", id: "1", info };
    const execution = executeIncrementalDelivery(cache, query);
    execution.initial({ messages: [item] }, [{ id: "0", path: [] }]);

    execution.subsequent({
      incremental: [
        { id: "0", subPath: ["messages", 0, "info"], data: { more: "more" } },
      ],
      completed: [{ id: "0" }],
      hasNext: false,
    });

    expect(cache.readQuery({ query })).toEqual({
      __typename: "Query",
      messages: [{ ...item, info: { ...info, more: "more" } }],
    });
  });

  it("converts results of pending fragments announced by subsequent results", () => {
    const cache = new TestCache();
    const execution = executeIncrementalDelivery(cache, nestedQuery);
    execution.initial({ user }, [{ id: "0", path: ["user"], label: "outer" }]);

    execution.subsequent({
      incremental: [
        { id: "0", data: { name: "user", friends: [friend("1")] } },
      ],
      pending: [{ id: "1", path: ["user", "friends", 0], label: "inner" }],
      completed: [{ id: "0" }],
      hasNext: true,
    });
    expect([
      ...(cache.execution(nestedQuery)?.pendingResults?.keys() ?? []),
    ]).toEqual(["1"]);

    execution.subsequent({
      incremental: [{ id: "1", data: { bio: "first" } }],
      completed: [{ id: "1" }],
      hasNext: false,
    });

    expect(cache.execution(nestedQuery)).toBeUndefined();
    expect(cache.readQuery({ query: nestedQuery })).toEqual({
      user: { ...user, name: "user", friends: [friend("1", "first")] },
    });
  });

  it("writes results of fragments nested in omitted fragments", () => {
    const cache = new TestCache();
    const query = gql`
      query {
        user {
          id
          friends {
            id
          }
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
    const execution = executeIncrementalDelivery(cache, query);
    execution.initial({ user: { ...user, friends: [friend("1")] } }, [
      { id: "0", path: ["user"], label: "outer" },
    ]);

    // All fields of the outer fragment were delivered: the fragment is omitted
    execution.subsequent({
      pending: [{ id: "1", path: ["user", "friends", 0], label: "inner" }],
      completed: [{ id: "0" }],
      hasNext: true,
    });
    execution.subsequent({
      incremental: [{ id: "1", data: { bio: "first" } }],
      completed: [{ id: "1" }],
      hasNext: false,
    });

    expect(cache.readQuery({ query })).toEqual({
      user: { ...user, friends: [friend("1", "first")] },
    });
  });

  it("ignores failed fragments and results of unknown ids", () => {
    const cache = new TestCache();
    const execution = executeIncrementalDelivery(cache, messagesQuery);
    execution.initial({ messages: [message("1"), message("2")] }, [
      { id: "0", path: ["messages", 0], label: "name" },
      { id: "1", path: ["messages", 1], label: "name" },
    ]);
    const before = cache.extract();

    execution.subsequent({
      incremental: [{ id: "unknown", data: { name: "unknown" } }],
      completed: [{ id: "0", errors: [{ message: "failed" }] }],
      hasNext: true,
    });

    expect(cache.extract()).toEqual(before);
    expect([
      ...(cache.execution(messagesQuery)?.pendingResults?.keys() ?? []),
    ]).toEqual(["1"]);
  });
});

describe("@defer: diffing of subsequent results", () => {
  it("compares only delivered fields and paths to them", () => {
    const cache = new TestCache();
    const query = gql`
      query {
        user {
          id
          name
          profile {
            bio
            age
            ... @defer {
              avatar
            }
          }
        }
      }
    `;
    const user = { __typename: "User", id: "u", name: "name" };
    const profile = { __typename: "Profile", bio: "bio", age: 1 };
    const execution = execute(cache, query);
    execution.initial({ user: { ...user, profile } });
    const getFieldEntryQueue = jest.spyOn(Difference, "getFieldEntryQueue");

    execution.subsequent([
      { path: ["user", "profile"], data: { avatar: "avatar" } },
    ]);

    const compared = new Set(getFieldEntryQueue.mock.calls.map(([, f]) => f));
    getFieldEntryQueue.mockRestore();
    expect(compared).toEqual(new Set(["profile", "avatar"]));
    expect(cache.readQuery({ query })).toEqual({
      user: { ...user, profile: { ...profile, avatar: "avatar" } },
    });
  });

  it("compares all fields of nodes with chunks in delivered data", () => {
    const cache = new TestCache();
    const query = gql`
      query {
        user {
          id
          ... @defer {
            self {
              id
              name
            }
          }
        }
      }
    `;
    const name = gql`
      query {
        user {
          id
          name
        }
      }
    `;
    const user = (fields = {}) => ({ __typename: "User", id: "u", ...fields });
    cache.writeQuery({ query: name, data: { user: user({ name: "old" }) } });
    const execution = execute(cache, query);
    execution.initial({ user: user() });

    execution.subsequent([
      { path: ["user"], data: { self: user({ name: "new" }) } },
    ]);

    expect(cache.readQuery({ query: name })).toEqual({
      user: user({ name: "new" }),
    });
    expect(cache.readQuery({ query })).toEqual({
      user: { ...user(), self: user({ name: "new" }) },
    });
  });
});

describe("@defer: merge policies of subsequent results", () => {
  const query = gql`
    query {
      feed {
        id
        items {
          id
        }
        ... @defer(label: "comments") {
          title
          comments {
            id
          }
        }
      }
    }
  `;
  const comments = gql`
    query {
      feed {
        id
        comments {
          id
        }
      }
    }
  `;
  const item = (id: string) => ({ __typename: "Item", id });
  const comment = (id: string) => ({ __typename: "Comment", id });
  const feed = { __typename: "Feed", id: "1" };

  function createCache() {
    const concat = (existing: unknown[] = [], incoming: unknown[]) => [
      ...existing,
      ...incoming,
    ];
    const mergeItems = jest.fn(concat);
    const mergeComments = jest.fn(concat);
    const cache = new TestCache({
      typePolicies: {
        Feed: {
          fields: {
            items: { merge: mergeItems },
            comments: { merge: mergeComments },
          },
        },
      },
    });
    return { cache, mergeItems, mergeComments };
  }

  it("does not re-apply merge policies of fields outside of delivered data", () => {
    const { cache, mergeItems } = createCache();
    const execution = execute(cache, query);
    execution.initial({ feed: { ...feed, items: [item("a"), item("b")] } });
    expect(mergeItems).toHaveBeenCalledTimes(1);

    execution.subsequent([
      { path: ["feed"], data: { title: "title", comments: [comment("x")] } },
    ]);

    expect(mergeItems).toHaveBeenCalledTimes(1);
    expect(cache.readQuery({ query })).toEqual({
      feed: {
        ...feed,
        items: [item("a"), item("b")],
        title: "title",
        comments: [comment("x")],
      },
    });
  });

  it("applies merge policies of delivered fields once (with existing values)", () => {
    const { cache, mergeComments } = createCache();
    cache.writeQuery({
      query: comments,
      data: { feed: { ...feed, comments: [comment("x")] } },
    });
    const execution = execute(cache, query);
    execution.initial({ feed: { ...feed, items: [item("a")] } });
    mergeComments.mockClear();

    execution.subsequent([
      { path: ["feed"], data: { title: "title", comments: [comment("y")] } },
    ]);

    expect(mergeComments).toHaveBeenCalledTimes(1);
    expect(mergeComments.mock.calls[0][0]).toHaveLength(1);
    expect(cache.readQuery({ query })).toEqual({
      feed: {
        ...feed,
        items: [item("a")],
        title: "title",
        comments: [comment("x"), comment("y")],
      },
    });
  });

  it("does not re-apply merge policies within stored values of fields outside of delivered data", () => {
    const { cache, mergeItems } = createCache();
    const nested = gql`
      query {
        user {
          id
          feed {
            id
            items {
              id
            }
          }
          ... @defer {
            name
          }
        }
      }
    `;
    const user = { __typename: "User", id: "u" };
    const execution = execute(cache, nested);
    execution.initial({
      user: { ...user, feed: { ...feed, items: [item("a")] } },
    });
    expect(mergeItems).toHaveBeenCalledTimes(1);

    execution.subsequent([{ path: ["user"], data: { name: "user" } }]);

    expect(mergeItems).toHaveBeenCalledTimes(1);
    expect(cache.readQuery({ query: nested })).toEqual({
      user: { ...user, feed: { ...feed, items: [item("a")] }, name: "user" },
    });
  });

  it("applies merge policies of objects delivered as a whole", () => {
    const { cache, mergeItems } = createCache();
    const nested = gql`
      query {
        user {
          id
          ... @defer {
            feed {
              id
              items {
                id
              }
            }
          }
        }
      }
    `;
    const user = { __typename: "User", id: "u" };
    const execution = execute(cache, nested);
    execution.initial({ user });

    execution.subsequent([
      { path: ["user"], data: { feed: { ...feed, items: [item("a")] } } },
    ]);

    expect(mergeItems).toHaveBeenCalledTimes(1);
    expect(cache.readQuery({ query: nested })).toEqual({
      user: { ...user, feed: { ...feed, items: [item("a")] } },
    });
  });

  it("merges an explicitly delivered object but not one traversed by a result", () => {
    const merge = jest.fn((_, incoming) =>
      incoming.bio ? { ...incoming, title: "merged" } : incoming,
    );
    const cache = new TestCache({
      typePolicies: { User: { fields: { profile: { merge } } } },
    });
    const query = gql`
      query {
        user {
          id
          profile {
            title
            ... @defer {
              language
            }
          }
          ... @defer {
            profile {
              bio
            }
          }
        }
      }
    `;
    const user = { __typename: "User", id: "u" };
    const execution = execute(cache, query);
    execution.initial({ user: { ...user, profile: { title: "a" } } });
    merge.mockClear();

    execution.subsequent(
      [{ path: ["user", "profile"], data: { language: "en" } }],
      { hasNext: true },
    );
    expect(merge).not.toHaveBeenCalled();
    execution.subsequent([{ path: ["user"], data: { profile: { bio: "b" } } }]);

    expect(merge).toHaveBeenCalledTimes(1);
    expect(cache.readQuery({ query })).toEqual({
      user: { ...user, profile: { title: "merged", language: "en", bio: "b" } },
    });
  });
});
