import { gql } from "@apollo/client";
import type { DocumentNode } from "graphql";
import { ForestRun } from "../ForestRun";
import { resolveOperationDescriptor } from "../cache/descriptor";
import { canReleaseOperationDescriptor } from "../cache/store";
import type {
  ExecutionKey,
  IncrementalDeferResult,
} from "../incremental/types";
import type { ExecutionWriteOptions } from "../cache/types";
import { assert } from "../jsutils/assert";
import {
  isCompositeListValue,
  isObjectValue,
  resolveFieldChunk,
  resolveListItemChunk,
} from "../values";
import * as DiffTree from "../diff/diffTree";

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

  it("ignores results for objects deleted in place (cache.modify)", () => {
    const cache = new TestCache();
    const execution = execute(cache, messagesQuery);
    execution.initial({ messages: [message("1")] });

    cache.modify({ fields: { messages: (_, { DELETE }) => DELETE } });

    // The deleted object is not written to
    execution.subsequent([{ path: ["messages", 0], data: { name: "one" } }]);
    expect(cache.storedTree(messagesQuery)?.result.data.messages).toEqual([
      message("1"),
    ]);
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

  describe("delivers data of objects by identity", () => {
    const profileA = { __typename: "Profile", id: "A", title: "A only" };
    const profileB = { __typename: "Profile", id: "B", title: "B only" };
    const localViewerQuery = gql`
      query {
        viewer {
          id
          profile {
            id
            title
          }
        }
      }
    `;

    it("does not recapture a nested defer site on a replacement link", () => {
      const cache = new TestCache();
      const query = gql`
        query {
          viewer {
            id
            profile {
              id
              title
              ... @defer(label: "inner") {
                note
              }
            }
            ... @defer(label: "outer") {
              name
              profile {
                bio
              }
            }
          }
        }
      `;
      const execution = execute(cache, query);
      execution.initial({ viewer: { ...user, profile: profileA } });
      cache.writeQuery({
        query: localViewerQuery,
        data: { viewer: { ...user, profile: profileB } },
      });
      execution.subsequent(
        [
          {
            label: "outer",
            path: ["viewer"],
            data: {
              name: "N",
              profile: { __typename: "Profile", bio: "for A" },
            },
          },
        ],
        { hasNext: true },
      );
      execution.subsequent([
        {
          label: "inner",
          path: ["viewer", "profile"],
          data: { note: "for A" },
        },
      ]);

      const fragment = gql`
        fragment Note on Profile {
          note
        }
      `;
      expect(cache.readFragment({ id: "Profile:B", fragment })).toBeNull();
      expect(
        cache.diff({ query, optimistic: false, returnPartialData: true })
          .result,
      ).toEqual({
        viewer: { ...user, name: "N", profile: profileB },
      });
    });

    it("does not copy local fields across keys on first delivery of a link", () => {
      const cache = new TestCache();
      const query = gql`
        query {
          viewer {
            id
            ... @defer(label: "outer") {
              profile {
                id
                bio
                ... @defer(label: "inner") {
                  title
                }
              }
            }
          }
        }
      `;
      const execution = execute(cache, query);
      execution.initial({ viewer: user });
      cache.writeQuery({
        query: gql`
          query {
            viewer {
              id
              profile {
                id
                title
              }
            }
            savedProfile {
              id
              title
            }
          }
        `,
        data: {
          viewer: { ...user, profile: profileB },
          savedProfile: profileB,
        },
      });
      const incoming = { __typename: "Profile", id: "A", bio: "for A" };
      execution.subsequent(
        [{ label: "outer", path: ["viewer"], data: { profile: incoming } }],
        { hasNext: true },
      );

      const fragment = gql`
        fragment Title on Profile {
          title
        }
      `;
      expect(cache.readFragment({ id: "Profile:A", fragment })).toBeNull();
      execution.subsequent([
        {
          label: "inner",
          path: ["viewer", "profile"],
          data: { title: "new A" },
        },
      ]);
      expect(cache.readQuery({ query })).toEqual({
        viewer: { ...user, profile: { ...incoming, title: "new A" } },
      });
      expect(cache.readFragment({ id: "Profile:B", fragment })).toEqual({
        __typename: "Profile",
        title: "B only",
      });
    });

    // Limitation: objects reachable only under a different selection are not updated (see resolveReceivedObject)
    it("skips a node reachable in the result only under another selection", () => {
      const cache = new TestCache();
      const query = gql`
        query {
          viewer {
            id
            profile {
              id
              title
            }
            ... @defer {
              profile {
                bio
                caption: bio(locale: "en")
              }
            }
          }
          savedProfile {
            id
            title
            bio
            english: bio(locale: "en")
          }
        }
      `;
      const execution = execute(cache, query);
      execution.initial({
        viewer: { ...user, profile: profileA },
        savedProfile: null,
      });
      const saved = { ...profileA, bio: "cached", english: "old" };
      cache.writeQuery({
        query,
        data: { viewer: { ...user, profile: profileB }, savedProfile: saved },
      });
      execution.subsequent([
        {
          path: ["viewer"],
          data: {
            profile: { __typename: "Profile", bio: "fresh", caption: "new" },
          },
        },
      ]);

      // A is not updated (and nothing is written to B), the result is incomplete (B lacks the deferred fields)
      const diff = cache.diff({
        query,
        optimistic: false,
        returnPartialData: true,
      });
      expect(diff.complete).toBe(false);
      expect(diff.result).toEqual({
        viewer: { ...user, profile: profileB },
        savedProfile: saved,
      });
    });

    it.each([true, false])(
      "after another write replaced the link (the original object is still in the result: %s)",
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
          execution: {
            incremental: [{ path, data: { name, profile: { bio } } }],
            hasNext: false,
          },
        });

        // The structure is local (the link stays B), data goes by identity: A gets `bio` (when in the result)
        const diff = cache.diff<{ viewers: unknown[] }>({
          query,
          optimistic: false,
          returnPartialData: true,
        });
        expect(diff.result?.viewers).toEqual([
          { ...replacement, name },
          ...(reachable
            ? [{ ...other, profile: { ...profile("A"), bio } }]
            : []),
        ]);
        // B didn't receive deferred data: its deferred field is missing, the result is incomplete (refetched)
        expect(diff.complete).toBe(false);
        const bioFragment = gql`
          fragment Bio on Profile {
            bio
          }
        `;
        expect(
          cache.readFragment({ id: "Profile:B", fragment: bioFragment }),
        ).toBeNull();
        expect(
          cache.readFragment({ id: "Profile:A", fragment: bioFragment }),
        ).toEqual(reachable ? { __typename: "Profile", bio } : null);
      },
    );
  });

  it("reports results incomplete when deferred data was delivered to a replaced object", () => {
    const cache = new TestCache();
    const query = gql`
      query {
        viewer {
          id
          profile {
            id
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
    const profile = (id: string, fields = {}) => ({
      __typename: "Profile",
      id,
      title: id,
      ...fields,
    });
    const execution = execute(cache, query);
    execution.initial({ viewer: { ...user, profile: profile("A") } });
    cache.writeQuery({
      query,
      data: { viewer: { ...user, profile: profile("B") } },
    });
    const watch = jest.fn();
    cache.watch({ query, optimistic: false, callback: watch });

    execution.subsequent([
      { path: ["viewer"], data: { profile: { bio: "for A" } } },
    ]);

    const diff = cache.diff({
      query,
      optimistic: false,
      returnPartialData: true,
    });
    expect(diff).toMatchObject({
      complete: false,
      result: { viewer: { ...user, profile: profile("B") } },
    });
    expect(diff.result).not.toHaveProperty(["viewer", "profile", "bio"]);
    expect(diff.missing?.map((error) => error.path)).toEqual([
      ["viewer", "profile", "bio"],
    ]);
    expect(watch).toHaveBeenCalledTimes(1);
    expect(watch.mock.calls[0][0]).toMatchObject({ complete: false });

    // E.g. a refetch provides the field
    cache.writeQuery({
      query: gql`
        query {
          viewer {
            id
            profile {
              id
              bio
            }
          }
        }
      `,
      data: { viewer: { ...user, profile: profile("B", { bio: "for B" }) } },
    });

    expect(cache.diff({ query, optimistic: false })).toMatchObject({
      complete: true,
      result: { viewer: { ...user, profile: profile("B", { bio: "for B" }) } },
    });
  });

  it("keeps concurrent executions of an operation with different variables", () => {
    const query = gql`
      query ($id: ID!) {
        user(id: $id) {
          id
          name
          ... @defer {
            bio
          }
        }
      }
    `;
    const cache = new TestCache();
    const executions = ["A", "B"].map((id) => {
      const execution = execute(cache, query, { variables: { id } });
      execution.initial({ user: { __typename: "User", id, name: id } });
      return execution;
    });

    // B finishes first: A's execution stays pending
    executions[1].subsequent([{ path: ["user"], data: { bio: "for B" } }]);
    expect(cache.execution(query, { id: "A" })).toBeDefined();
    executions[0].subsequent([{ path: ["user"], data: { bio: "for A" } }]);

    for (const id of ["A", "B"]) {
      expect(
        cache.diff({ query, variables: { id }, optimistic: false }),
      ).toMatchObject({
        complete: true,
        result: {
          user: { __typename: "User", id, name: id, bio: `for ${id}` },
        },
      });
      expect(cache.execution(query, { id })).toBeUndefined();
    }
  });

  describe("reports results incomplete when deferred data is not delivered to the local object", () => {
    // The local object at the location didn't receive deferred data: no write, the result is incomplete (refetched)
    function deliver(
      query: DocumentNode,
      initial: Record<string, unknown>,
      replace: { query: DocumentNode; data: Record<string, unknown> },
      incremental: IncrementalDeferResult[],
    ) {
      const cache = new TestCache();
      const execution = execute(cache, query);
      execution.initial(initial);
      cache.writeQuery(replace);
      const watch = jest.fn();
      cache.watch({ query, optimistic: false, callback: watch });
      execution.subsequent(incremental);
      const diff = cache.diff({
        query,
        optimistic: false,
        returnPartialData: true,
      });
      return { cache, watch, diff };
    }

    const pet = (__typename: string, name: string) => ({ __typename, name });
    const petQueries = {
      direct: gql`
        query {
          viewer {
            id
            pet {
              name
              ... @defer {
                nickname
              }
            }
          }
        }
      `,
      parent: gql`
        query {
          viewer {
            id
            pet {
              name
            }
            ... @defer {
              pet {
                nickname
              }
            }
          }
        }
      `,
    };

    it.each(["direct", "parent"] as const)(
      "does not deliver data of an unkeyed object to an object of another type (%s)",
      (shape) => {
        const query = petQueries[shape];
        const { cache, watch, diff } = deliver(
          query,
          { viewer: { ...user, pet: pet("Cat", "Tom") } },
          // A write of the same operation (without deferred fields)
          { query, data: { viewer: { ...user, pet: pet("Dog", "Rex") } } },
          shape === "direct"
            ? [{ path: ["viewer", "pet"], data: { nickname: "for Cat" } }]
            : [{ path: ["viewer"], data: { pet: { nickname: "for Cat" } } }],
        );

        expect(diff.result).toEqual({
          viewer: { ...user, pet: pet("Dog", "Rex") },
        });
        expect(diff.complete).toBe(false);
        expect(diff.missing?.map((error) => error.path)).toEqual([
          ["viewer", "pet", "nickname"],
        ]);
        expect(watch).toHaveBeenCalledTimes(1);
        expect(watch.mock.calls[0][0]).toMatchObject({ complete: false });

        const complete = {
          ...user,
          pet: { ...pet("Dog", "Rex"), nickname: "R" },
        };
        cache.writeQuery({ query, data: { viewer: complete } });
        expect(cache.diff({ query, optimistic: false })).toMatchObject({
          complete: true,
          result: { viewer: complete },
        });
      },
    );

    const profile = (id: string, fields = {}) => ({
      __typename: "Profile",
      id,
      title: id,
      ...fields,
    });
    const cases = {
      direct: {
        query: gql`
          query {
            viewer {
              id
              profile {
                id
                title
                settings {
                  theme
                }
                ... @defer {
                  bio
                }
              }
            }
          }
        `,
        incremental: [{ path: ["viewer", "profile"], data: { bio: "for A" } }],
        missing: ["viewer", "profile", "bio"],
        complete: { bio: "for B" },
      },
      parent: {
        query: gql`
          query {
            viewer {
              id
              profile {
                id
                title
                settings {
                  theme
                }
              }
              ... @defer {
                profile {
                  settings {
                    lang
                  }
                }
              }
            }
          }
        `,
        incremental: [
          {
            path: ["viewer"],
            data: { profile: { settings: { lang: "en" } } },
          },
        ],
        missing: ["viewer", "profile", "settings", "lang"],
        complete: { settings: { theme: "light", lang: "de" } },
      },
    };

    it("reports missing fields of a replaced object when a direct patch goes to the original object elsewhere", () => {
      const query = gql`
        query {
          viewers {
            id
            profile {
              id
              title
              ... @defer {
                bio
              }
            }
          }
        }
      `;
      const other = { ...user, id: "other", profile: profile("A") };
      const { cache, watch, diff } = deliver(
        query,
        { viewers: [{ ...user, profile: profile("A") }, other] },
        // A write of the same operation (without deferred fields): A is still in the result
        {
          query,
          data: { viewers: [{ ...user, profile: profile("B") }, other] },
        },
        [{ path: ["viewers", 0, "profile"], data: { bio: "for A" } }],
      );

      expect(diff.result).toEqual({
        viewers: [
          { ...user, profile: profile("B") },
          { ...other, profile: profile("A", { bio: "for A" }) },
        ],
      });
      expect(diff.complete).toBe(false);
      expect(diff.missing?.map((error) => error.path)).toEqual([
        ["viewers", 0, "profile", "bio"],
      ]);
      expect(watch).toHaveBeenCalledTimes(1);
      expect(watch.mock.calls[0][0]).toMatchObject({ complete: false });

      const viewers = [
        { ...user, profile: profile("B", { bio: "for B" }) },
        { ...other, profile: profile("A", { bio: "for A" }) },
      ];
      cache.writeQuery({ query, data: { viewers } });
      expect(cache.diff({ query, optimistic: false })).toMatchObject({
        complete: true,
        result: { viewers },
      });
    });

    // Server order [A, B]; `layout` is the local list (reordered, or with another occurrence of an entity)
    it.each([
      ["B,A", true],
      ["B,A", false],
      ["A,A,B", true],
      ["A,A,B", false],
    ])(
      "delivers fields to entities of a locally changed list (local list: %s, in one payload: %s)",
      (layout, batched) => {
        const query = gql`
          query {
            users {
              id
              name
              ... @defer {
                bio
              }
            }
          }
        `;
        const userA = { __typename: "User", id: "A", name: "A" };
        const userB = { __typename: "User", id: "B", name: "B" };
        const results = [
          { path: ["users", 0], data: { bio: "for A" } },
          { path: ["users", 1], data: { bio: "for B" } },
        ];
        const cache = new TestCache();
        const execution = execute(cache, query);
        execution.initial({ users: [userA, userB] });
        const local = layout
          .split(",")
          .map((id) => (id === "A" ? userA : userB));
        cache.writeQuery({ query, data: { users: local } });
        const watch = jest.fn();
        cache.watch({ query, optimistic: false, callback: watch });

        if (batched) {
          execution.subsequent(results);
        } else {
          execution.subsequent([results[0]], { hasNext: true });
          execution.subsequent([results[1]]);
        }

        const users = local.map((user) => ({
          ...user,
          bio: `for ${user.id}`,
        }));
        expect(cache.diff({ query, optimistic: false })).toMatchObject({
          complete: true,
          result: { users },
        });
        expect(watch).toHaveBeenCalledTimes(batched ? 1 : 2);
        expect(watch.mock.calls[watch.mock.calls.length - 1][0]).toMatchObject({
          complete: true,
          result: { users },
        });
      },
    );

    // `slot` is an alias of different fields of Cat and Dog (both of type Accessory)
    const accessoryQueries = {
      direct: gql`
        query {
          viewer {
            id
            pet {
              ... on Cat {
                slot: collar {
                  kind
                  ... @defer {
                    note
                  }
                }
              }
              ... on Dog {
                slot: harness {
                  kind
                  note
                }
              }
            }
          }
        }
      `,
      parent: gql`
        query {
          viewer {
            id
            pet {
              ... on Cat {
                slot: collar {
                  kind
                }
              }
              ... on Dog {
                slot: harness {
                  kind
                  note
                }
              }
            }
            ... @defer {
              pet {
                ... on Cat {
                  slot: collar {
                    note
                  }
                }
              }
            }
          }
        }
      `,
    };

    it.each(["direct", "parent"] as const)(
      "does not deliver data through an alias of another field of another type (%s)",
      (shape) => {
        const query = accessoryQueries[shape];
        const accessory = (kind: string, fields = {}) => ({
          __typename: "Accessory",
          kind,
          ...fields,
        });
        const dog = {
          __typename: "Dog",
          slot: accessory("harness", { note: "for harness" }),
        };
        const { watch, diff } = deliver(
          query,
          {
            viewer: {
              ...user,
              pet: { __typename: "Cat", slot: accessory("collar") },
            },
          },
          // A write of the same operation: the cat is replaced with a dog
          { query, data: { viewer: { ...user, pet: dog } } },
          shape === "direct"
            ? [
                {
                  path: ["viewer", "pet", "slot"],
                  data: { note: "for collar" },
                },
              ]
            : [
                {
                  path: ["viewer"],
                  data: {
                    pet: {
                      __typename: "Cat",
                      slot: { __typename: "Accessory", note: "for collar" },
                    },
                  },
                },
              ],
        );

        expect(diff).toMatchObject({
          complete: true,
          result: { viewer: { ...user, pet: dog } },
        });
        expect(watch).not.toHaveBeenCalled();
      },
    );

    it.each(["direct", "parent"] as const)(
      "reports missing fields of a replaced object (%s)",
      (shape) => {
        const { query, incremental, missing, complete } = cases[shape];
        const profileB = profile("B", { settings: { theme: "light" } });
        const { cache, watch, diff } = deliver(
          query,
          {
            viewer: {
              ...user,
              profile: profile("A", { settings: { theme: "dark" } }),
            },
          },
          // A write of the same operation (without deferred fields)
          { query, data: { viewer: { ...user, profile: profileB } } },
          incremental,
        );

        // Neither A (not in the result) nor B received the deferred data
        expect(diff.result).toEqual({ viewer: { ...user, profile: profileB } });
        expect(diff.complete).toBe(false);
        expect(diff.missing?.map((error) => error.path)).toEqual([missing]);
        expect(watch).toHaveBeenCalledTimes(1);
        expect(watch.mock.calls[0][0]).toMatchObject({ complete: false });
        expect(
          cache.readFragment({
            id: "Profile:A",
            fragment: gql`
              fragment A on Profile {
                bio
                settings {
                  lang
                }
              }
            `,
          }),
        ).toBeNull();

        const viewer = { ...user, profile: { ...profileB, ...complete } };
        cache.writeQuery({ query, data: { viewer } });
        expect(cache.diff({ query, optimistic: false })).toMatchObject({
          complete: true,
          result: { viewer },
        });
      },
    );
  });

  // `profile` was received in the initial result: a container (deferred data is spliced into it, not merged)
  it("splices delivered data of embedded objects of non-cacheable operations (without merge policies)", () => {
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
    expect(merge).not.toHaveBeenCalled();
  });
});

describe("@defer: diffing of subsequent results", () => {
  it("changes only delivered data (other fields, objects and operations stay the same)", () => {
    const cache = new TestCache();
    const query = gql`
      query {
        user {
          id
          name
          friends {
            id
            name
          }
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
    const otherQuery = gql`
      query {
        other {
          id
          name
        }
      }
    `;
    const user = { __typename: "User", id: "u", name: "name" };
    const friends = [{ __typename: "User", id: "f", name: "friend" }];
    const profile = { __typename: "Profile", bio: "bio", age: 1 };
    cache.writeQuery({
      query: otherQuery,
      data: { other: { __typename: "User", id: "o", name: "other" } },
    });
    const execution = execute(cache, query);
    execution.initial({ user: { ...user, friends, profile } });
    type Result = { user: { friends: unknown } };
    const before = cache.diff<Result>({ query, optimistic: false }).result;
    const watches = [query, otherQuery].map((query) => {
      const callback = jest.fn();
      cache.watch({ query, optimistic: false, immediate: true, callback });
      callback.mockClear();
      return callback;
    });

    execution.subsequent([
      { path: ["user", "profile"], data: { avatar: "avatar" } },
    ]);

    const result = {
      user: { ...user, friends, profile: { ...profile, avatar: "avatar" } },
    };
    const [watch, otherWatch] = watches;
    expect(watch).toHaveBeenCalledTimes(1);
    expect(watch.mock.calls[0][0]).toMatchObject({ complete: true, result });
    expect(otherWatch).not.toHaveBeenCalled();
    const after = cache.diff<Result>({ query, optimistic: false });
    expect(after).toMatchObject({ complete: true, result });
    // Unchanged objects keep their identity
    expect(after.result?.user.friends).toBe(before?.user.friends);
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

  // `profile` was received in the initial result: a container (deferred data is spliced into it, not merged)
  it("does not merge objects received already (containers)", () => {
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

    expect(merge).not.toHaveBeenCalled();
    expect(cache.readQuery({ query })).toEqual({
      user: { ...user, profile: { title: "a", language: "en", bio: "b" } },
    });
  });

  it("keeps a local edit when another deferred fragment delivers to the same object", () => {
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
    const user = { __typename: "User", id: "u" };
    const profile = { __typename: "Profile", title: "title" };
    const execution = execute(cache, query);
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
    // `profile` was received in the initial result: a container, deferred data is not an incoming value of merge
    expect(merge).not.toHaveBeenCalled();
  });

  it("applies merge policies of fields delivered by multiple fragments once", () => {
    const merge = jest.fn((existing: unknown[] = [], incoming: unknown[]) => [
      ...existing,
      ...incoming,
    ]);
    const cache = new TestCache({
      typePolicies: { User: { fields: { tags: { merge } } } },
    });
    const query = gql`
      query {
        viewer {
          id
          ... @defer(label: "a") {
            tags
          }
          ... @defer(label: "b") {
            name
            tags
          }
        }
      }
    `;
    const user = { __typename: "User", id: "u" };
    const execution = execute(cache, query);
    execution.initial({ viewer: user });

    execution.subsequent(
      [{ path: ["viewer"], label: "a", data: { tags: ["x"] } }],
      { hasNext: true },
    );
    execution.subsequent([
      { path: ["viewer"], label: "b", data: { name: "name", tags: ["x"] } },
    ]);

    expect(merge).toHaveBeenCalledTimes(1);
    expect(cache.readQuery({ query })).toEqual({
      viewer: { ...user, tags: ["x"], name: "name" },
    });
  });

  // Defer on items (the list is a container) or elsewhere (the list is outside of delivered data).
  //   An offset-based merge is idempotent for repeated server pages (a refetch), but not for its own output:
  //   merge policies only run for delivered values (stored values outside of them are merge outputs)
  it.each(["items", "elsewhere"] as const)(
    "produces the same result with an offset-based merge policy as without @defer (defer %s)",
    (site) => {
      const typePolicies = {
        Query: {
          fields: {
            messages: {
              keyArgs: false as const,
              merge(
                existing: unknown[] = [],
                incoming: unknown[],
                { args }: { args: Record<string, unknown> | null },
              ) {
                const merged = existing.slice();
                const offset = Number(args?.offset ?? 0);
                incoming.forEach((item, index) => {
                  merged[offset + index] = item;
                });
                return merged;
              },
            },
          },
        },
      };
      const deferred =
        site === "items"
          ? gql`
              query ($offset: Int) {
                messages(offset: $offset) {
                  id
                  text
                  ... @defer {
                    name
                  }
                }
              }
            `
          : gql`
              query ($offset: Int) {
                messages(offset: $offset) {
                  id
                  text
                  name
                }
                viewer {
                  id
                  ... @defer {
                    name
                  }
                }
              }
            `;
      const plain = gql`
        query ($offset: Int) {
          messages(offset: $offset) {
            id
            text
            name
          }
        }
      `;
      const viewer = { __typename: "User", id: "v" };
      const pages = [["1", "2"], ["3"]];
      const withDefer = new TestCache({ typePolicies });
      const withoutDefer = new TestCache({ typePolicies });
      // The first page is fetched again (e.g. a refetch)
      for (const index of [0, 1, 0]) {
        const variables = { offset: index * 2 };
        const ids = pages[index];
        const execution = execute(withDefer, deferred, { variables });
        if (site === "items") {
          execution.initial({ messages: ids.map((id) => message(id)) });
          execution.subsequent(
            ids.map((id, i) => ({ path: ["messages", i], data: { name: id } })),
          );
        } else {
          execution.initial({
            messages: ids.map((id) => message(id, id)),
            viewer,
          });
          execution.subsequent([{ path: ["viewer"], data: { name: "v" } }]);
        }
        withoutDefer.writeQuery({
          query: plain,
          variables,
          data: { messages: ids.map((id) => message(id, id)) },
        });
      }

      const read = (cache: TestCache) =>
        cache.readQuery({ query: plain, variables: { offset: 0 } });
      expect(read(withDefer)).toEqual({
        messages: ["1", "2", "3"].map((id) => message(id, id)),
      });
      expect(read(withDefer)).toEqual(read(withoutDefer));
    },
  );

  describe("a deferred fragment re-selecting a list with a merge policy", () => {
    const queries = {
      site: gql`
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
      `,
      item: gql`
        query {
          messages {
            id
            text
            ... @defer {
              name
            }
          }
        }
      `,
    };
    const list = gql`
      query {
        messages {
          id
          text
        }
      }
    `;
    const name = gql`
      fragment Name on Message {
        id
        name
      }
    `;
    const page = (prefix: string) =>
      Array.from({ length: 40 }, (_, i) => message(`${prefix}${i}`));

    it.each(["site", "item"] as const)(
      "routes deferred data to items by keys (defer at the %s)",
      (kind) => {
        const merge = jest.fn(
          (existing: unknown[] = [], incoming: unknown[]) => [
            ...existing,
            ...incoming,
          ],
        );
        const cache = new TestCache({
          typePolicies: { Query: { fields: { messages: { merge } } } },
        });
        const query = queries[kind];
        cache.writeQuery({ query: list, data: { messages: page("old") } });
        cache.writeExecutionResult({
          query,
          execution: {
            data: { messages: page("new") },
            hasNext: true,
          },
        });
        expect(
          cache.readQuery<{ messages: unknown[] }>({ query: list })?.messages,
        ).toHaveLength(80);
        // Another write inserts an item
        cache.modify({
          fields: {
            messages(existing: readonly unknown[]) {
              const ref = cache.writeFragment({
                fragment: gql`
                  fragment Inserted on Message {
                    id
                    text
                  }
                `,
                data: message("inserted"),
              });
              return [...existing.slice(0, 40), ref, ...existing.slice(40)];
            },
          },
        });
        merge.mockClear();

        const names = page("new").map((_, i) => ({ name: `name ${i}` }));
        cache.writeExecutionResult({
          query,
          execution: {
            incremental:
              kind === "site"
                ? [{ path: [], data: { messages: names } }]
                : names.map((data, i) => ({ path: ["messages", i], data })),
            hasNext: false,
          },
        });

        const messages = cache.readQuery<{ messages: unknown[] }>({
          query: list,
        })?.messages;
        expect(messages).toHaveLength(81);
        expect(messages?.[40]).toEqual(message("inserted"));
        expect(merge).not.toHaveBeenCalled();
        for (let i = 0; i < 40; i++) {
          expect(
            cache.readFragment({ id: `Message:new${i}`, fragment: name }),
          ).toEqual({
            __typename: "Message",
            id: `new${i}`,
            name: `name ${i}`,
          });
        }
        expect(
          cache.readFragment({ id: "Message:old0", fragment: name }),
        ).toBeNull();
      },
    );
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
  // The same selection as MessageList under another name (not covered by the preloader)
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
  const conversation = (messages: unknown[]) => ({
    __typename: "Conversation",
    id: "c1",
    messages,
  });
  const msg = (id: string, text?: string) => ({
    __typename: "Message",
    id,
    ...(text !== undefined && { text }),
  });
  const page2 = [msg("m3", "t3"), msg("m4", "t4")];

  type Messages = {
    conversation: { messages: { id: string; text?: string }[] };
  };
  type Snapshot = {
    ids: string[] | undefined;
    texts: (string | undefined)[] | undefined;
    complete: boolean;
  };
  function snapshot(
    result: Messages | null | undefined,
    complete: boolean,
  ): Snapshot {
    const messages = result?.conversation?.messages;
    return {
      ids: messages?.map((m) => m.id),
      texts: messages?.map((m) => m.text),
      complete,
    };
  }

  it.each(["updateQuery", "merge policy"] as const)(
    "pages and deferred texts (fetchMore with %s)",
    (variant) => {
      const cache = new TestCache(
        variant === "merge policy"
          ? {
              typePolicies: {
                Conversation: {
                  fields: {
                    messages: {
                      keyArgs: false,
                      merge: (
                        existing: unknown[] = [],
                        incoming: unknown[],
                      ) => [...existing, ...incoming],
                    },
                  },
                },
              },
            }
          : undefined,
      );
      const watchCalls: Snapshot[] = [];
      cache.watch<Messages>({
        query: MessageList,
        variables,
        optimistic: true,
        callback: (diff) =>
          watchCalls.push(snapshot(diff.result, diff.complete ?? false)),
      });
      const read = (query: DocumentNode) => {
        const diff = cache.diff<Messages>({
          query,
          variables,
          optimistic: false,
          returnPartialData: true,
        });
        return snapshot(diff.result, Boolean(diff.complete));
      };
      const steps: Record<string, unknown> = {};
      const record = (step: string) => {
        steps[step] = {
          messageList: read(MessageList),
          watchCalls: watchCalls.length,
          lastWatch: watchCalls[watchCalls.length - 1],
          preloader: read(Preloader),
        };
      };

      // 1. The preloader's initial payload (page 1, `text` deferred)
      cache.writeExecutionResult({
        query: Preloader,
        variables,
        execution: {
          data: { conversation: conversation([msg("m1"), msg("m2")]) },
          hasNext: true,
        },
      });
      record("1. preloader initial");

      // 2. fetchMore of page 2 (as Apollo 3 fetchMore writes it)
      if (variant === "updateQuery") {
        cache.updateQuery<Messages>(
          {
            query: MessageList,
            variables,
            returnPartialData: true,
            optimistic: false,
          },
          (prev) => {
            assert(prev);
            return {
              ...prev,
              conversation: {
                ...prev.conversation,
                messages: [...prev.conversation.messages, ...page2],
              },
            };
          },
        );
      } else {
        // The same query and variables (no `after` variable): the merge policy concatenates
        cache.writeQuery({
          query: MessageList,
          variables,
          data: { conversation: conversation(page2) },
        });
      }
      record("2. fetchMore page 2");

      // 3. The preloader's subsequent payload: texts of page 1 (server paths)
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
      record("3. preloader subsequent");
      steps["data forest (OtherList)"] = read(OtherList);

      // Both variants: the same observations
      const page1 = {
        ids: ["m1", "m2"],
        texts: [undefined, undefined],
        // NOTE: `text` of page 1 is still pending (deferred) but reads are complete: missing scalar fields
        //   are not tracked (a pre-existing limitation, also for regular writes)
        complete: true,
      };
      const withPage2 = {
        ids: ["m1", "m2", "m3", "m4"],
        texts: [undefined, undefined, "t3", "t4"],
        complete: true, // NOTE: same as above (page 1 texts are still pending)
      };
      const final = {
        ids: ["m1", "m2", "m3", "m4"],
        texts: ["t1", "t2", "t3", "t4"],
        complete: true,
      };
      expect(steps).toEqual({
        "1. preloader initial": {
          messageList: page1,
          watchCalls: 1,
          lastWatch: page1,
          preloader: page1,
        },
        "2. fetchMore page 2": {
          messageList: withPage2,
          watchCalls: 2,
          lastWatch: withPage2,
          preloader: withPage2,
        },
        // Texts go to m1 and m2 (by keys at the server paths): page 2 is kept, no duplicates, the order is kept
        "3. preloader subsequent": {
          messageList: final,
          watchCalls: 3,
          lastWatch: final,
          preloader: final,
        },
        "data forest (OtherList)": final,
      });
    },
  );
});

// Ported from #804 (vladar/forest-run-defer-optimistic): behaviour of readers while an execution streams.
//   In #787, deferred data is spliced into the data forest, so it is visible to every reader immediately
//   (optimistic and non-optimistic). Adaptations of expectations are marked with "Adapted (787):".
describe("@defer: readers while streaming (ported from #804)", () => {
  // As in #804: `subsequent` defaults to `hasNext: true`, `complete` sends the last result
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

  describe("streaming operation", () => {
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
  });

  describe("pending fields keep cached values (no loaders)", () => {
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

      // Adapted (787): the initial result is a regular write of the same data (the deferred field is pending,
      //   not deleted): nothing changes, the watch is not notified (#804 re-hydrates through its layer)
      expect(watch).toHaveBeenCalledTimes(1);
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
      // Adapted (804): optimistic reads of other operations see the result, non-optimistic reads don't
      expect(read(cache, textQuery).result).toEqual({
        messages: [{ __typename: "Message", id: "1", text: "edited" }],
      });
      // Adapted (787): the initial result is written to the data forest, non-optimistic reads see it too
      expect(read(cache, textQuery, false).result).toEqual({
        messages: [{ __typename: "Message", id: "1", text: "edited" }],
      });
    });
  });

  describe("pending fields fall through to cached values", () => {
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
      // Adapted (787): `name` is pending (missing) but the read is complete: missing scalar fields of regular and initial
      //   writes are not tracked, as on main (#804 reads `complete: false`: it re-hydrates through its layer)
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

      // Adapted (804): optimistic reads (any operation)
      expect(
        cache.diff({ query: chatWithVariables, variables, optimistic: true }),
      ).toMatchObject({
        complete: true,
        result: { messages: [message("1", "one")] },
      });
    });
  });

  describe("fragment reads and watches", () => {
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
        execution.subsequent([
          { path: ["messages", 0], data: { name: "one" } },
        ]);
        expect(readName(true)).toEqual({
          __typename: "Message",
          id: "1",
          name: "one",
        });
        // Adapted (787): delivered data is written to the data forest, non-optimistic reads see it too
        expect(readName(false)).toEqual({
          __typename: "Message",
          id: "1",
          name: "one",
        });

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
  });

  describe("timeout", () => {
    it("writes received results on timeout (synthetic hasNext: false)", () => {
      const cache = new TestCache();
      cache.write({
        query: preloaderQuery,
        result: { messages: [message("1", "old 1"), message("2", "old 2")] },
      });
      const execution = execute(cache, preloaderQuery);
      execution.initial({ messages: [message("1"), message("2")] });
      execution.subsequent([
        { path: ["messages", 0], data: { name: "new 1" } },
      ]);

      // Timeout
      cache.writeExecutionResult({
        query: preloaderQuery,
        execution: { hasNext: false },
      });

      expect(cache.execution(preloaderQuery)).toBeUndefined();
      // Pending fields keep existing values
      expect(read(cache, chatQuery)).toMatchObject({
        complete: true,
        result: { messages: [message("1", "new 1"), message("2", "old 2")] },
      });
    });
  });

  describe("@defer: covered queries of a preloader (production setup)", () => {
    // Covered queries are separate documents, converted to fragments on Query and spread into the preloader
    //   (the covered selection equals the fragment exactly). Their watches are registered before the preloader
    //   starts streaming (cache-first miss), as `useQuery` does (QueryInfo: diff, then watch with `optimistic: true`).
    const ChatQuery = gql`
      query ChatQuery($id: ID!) {
        conversation(id: $id) {
          id
          messages {
            id
            text
          }
        }
      }
    `;
    const HeaderQuery = gql`
      query HeaderQuery($id: ID!) {
        conversation(id: $id) {
          id
          title
        }
      }
    `;
    const Preloader = gql`
      query Preloader($id: ID!) @cache(covers: ["ChatQuery", "HeaderQuery"]) {
        viewer {
          id
        }
        ...HeaderQuery_query @defer(label: "header")
        ...ChatQuery_query @defer(label: "chat")
      }
      fragment HeaderQuery_query on Query {
        conversation(id: $id) {
          id
          title
        }
      }
      fragment ChatQuery_query on Query {
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
    const conversation = (fields: object) => ({
      conversation: { __typename: "Conversation", id: "c1", ...fields },
    });
    const chat = conversation({
      messages: [{ __typename: "Message", id: "m1", text: "t1" }],
    });
    const header = conversation({ title: "T" });

    type Covered = { query: DocumentNode; variables: object };
    // What the covered component renders after each step: the latest diff its watch was notified with
    type Rendered = { data: unknown; complete: boolean | undefined };

    function stream(
      cache: ForestRun,
      covered: Covered,
      {
        diffFirst = false,
        returnPartialData = undefined as boolean | undefined,
      } = {},
    ) {
      const options = { ...covered, optimistic: true, returnPartialData };
      if (diffFirst) {
        cache.diff({ ...options, returnPartialData: true });
      }
      let rendered: Rendered = { data: undefined, complete: undefined };
      cache.watch({
        ...options,
        callback: (diff) => {
          rendered = { data: diff.result, complete: diff.complete };
        },
      });
      const steps: Rendered[] = [];
      const write = (execution: ExecutionWriteOptions["execution"]) => {
        cache.writeExecutionResult({ query: Preloader, variables, execution });
        steps.push(rendered);
      };
      write({
        data: { viewer: { __typename: "User", id: "u" } },
        hasNext: true,
      });
      write({
        incremental: [{ path: [], label: "header", data: header }],
        hasNext: true,
      });
      write({
        incremental: [{ path: [], label: "chat", data: chat }],
        hasNext: true,
      });
      write({ hasNext: false });
      return steps;
    }

    const delivered: Rendered[] = [
      // initial: nothing of the covered query yet
      { data: {}, complete: false },
      // header payload: another covered query's fragment (shares the conversation node)
      {
        data: { conversation: { __typename: "Conversation", id: "c1" } },
        complete: false,
      },
      // chat payload: rendered while the preloader is still streaming
      { data: chat, complete: true },
      // completion
      { data: chat, complete: true },
    ];

    it.each([
      ["watch only", false],
      ["diff, then watch (as QueryInfo)", true],
    ])("(a) notify covered watches without cached data: %s", (_, diffFirst) => {
      const cache = new ForestRun();
      expect(
        stream(cache, { query: ChatQuery, variables }, { diffFirst }),
      ).toEqual(delivered);
    });

    it("(a) notify each covered query when its own fragment is delivered", () => {
      const cache = new ForestRun();
      expect(stream(cache, { query: HeaderQuery, variables })).toEqual([
        { data: {}, complete: false },
        { data: header, complete: true },
        { data: header, complete: true },
        { data: header, complete: true },
      ]);
    });

    it.each([undefined, true, false])(
      "(b, d) notify covered watches with cached data (returnPartialData: %s)",
      (returnPartialData) => {
        const cache = new ForestRun();
        const cached = conversation({
          messages: [{ __typename: "Message", id: "m0", text: "old" }],
        });
        cache.writeQuery({ query: ChatQuery, variables, data: cached });

        expect(
          stream(
            cache,
            { query: ChatQuery, variables },
            { diffFirst: true, returnPartialData },
          ),
        ).toEqual([
          { data: cached, complete: true },
          { data: cached, complete: true },
          { data: chat, complete: true },
          { data: chat, complete: true },
        ]);
      },
    );
    it("(d) watches with returnPartialData: false throw on missing data (as on main)", () => {
      const cache = new ForestRun();
      // A watch with `returnPartialData: false` throws on missing data (ApolloCompat), so it is only safe
      //   with complete data (see the cached variant above)
      expect(() =>
        stream(
          cache,
          { query: ChatQuery, variables },
          { returnPartialData: false },
        ),
      ).toThrow("Can't find field 'conversation'");
    });

    it("(e) fields deferred within the covered fragment", () => {
      const cache = new ForestRun();
      const preloader = gql`
        query Preloader($id: ID!) @cache(covers: ["ChatQuery"]) {
          ...ChatQuery_query
        }
        fragment ChatQuery_query on Query {
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
      const watch = jest.fn();
      cache.watch({
        query: ChatQuery,
        variables,
        optimistic: true,
        callback: watch,
      });
      const execution = execute(cache, preloader, { variables });

      execution.initial(
        conversation({ messages: [{ __typename: "Message", id: "m1" }] }),
      );
      expect(watch).toHaveBeenCalledTimes(1);
      expect(watch.mock.calls[0][0].result).toEqual(
        conversation({ messages: [{ __typename: "Message", id: "m1" }] }),
      );
      execution.subsequent([
        { path: ["conversation", "messages", 0], data: { text: "t1" } },
      ]);
      expect(watch).toHaveBeenCalledTimes(2);
      expect(watch.mock.calls[1][0]).toMatchObject({
        complete: true,
        result: chat,
      });
    });

    // Adapted (804): `it` instead of `it.failing` (#802): there is no notion of covered operations, all optimistic reads see
    //   the execution's layer, whatever the variables of the reader
    it.each([
      [
        "an extra undeclared variable (e.g. a shared variables object)",
        { query: ChatQuery, variables: { id: "c1", locale: "en" } },
      ],
      [
        "other variable names",
        {
          query: gql`
            query ChatQuery($conversationId: ID!) {
              conversation(id: $conversationId) {
                id
                messages {
                  id
                  text
                }
              }
            }
          `,
          variables: { conversationId: "c1" },
        },
      ],
    ])("(c) notify covered watches with %s", (_, covered) => {
      const cache = new ForestRun();
      expect(stream(cache, covered, { diffFirst: true })).toEqual(delivered);
    });
  });
});

describe("@defer: merge policies of subsequent results (ported from #801)", () => {
  // Defer on items (the list is a container) or elsewhere (the list is outside of delivered data).
  //   An offset-based merge is idempotent for repeated server pages (a refetch), but not for its own output:
  //   merge policies only run for delivered values (stored values outside of them are merge outputs)
  it.each(["items", "elsewhere"] as const)(
    "produces the same result with an offset-based merge policy as without @defer (defer %s)",
    (site) => {
      const typePolicies = {
        Query: {
          fields: {
            messages: {
              keyArgs: false as const,
              merge(
                existing: unknown[] = [],
                incoming: unknown[],
                { args }: { args: Record<string, unknown> | null },
              ) {
                const merged = existing.slice();
                const offset = Number(args?.offset ?? 0);
                incoming.forEach((item, index) => {
                  merged[offset + index] = item;
                });
                return merged;
              },
            },
          },
        },
      };
      const deferred =
        site === "items"
          ? gql`
              query ($offset: Int) {
                messages(offset: $offset) {
                  id
                  text
                  ... @defer {
                    name
                  }
                }
              }
            `
          : gql`
              query ($offset: Int) {
                messages(offset: $offset) {
                  id
                  text
                  name
                }
                viewer {
                  id
                  ... @defer {
                    name
                  }
                }
              }
            `;
      const plain = gql`
        query ($offset: Int) {
          messages(offset: $offset) {
            id
            text
            name
          }
        }
      `;
      const viewer = { __typename: "User", id: "v" };
      const pages = [["1", "2"], ["3"]];
      const withDefer = new TestCache({ typePolicies });
      const withoutDefer = new TestCache({ typePolicies });
      // The first page is fetched again (e.g. a refetch)
      for (const index of [0, 1, 0]) {
        const variables = { offset: index * 2 };
        const ids = pages[index];
        const execution = execute(withDefer, deferred, { variables });
        if (site === "items") {
          execution.initial({ messages: ids.map((id) => message(id)) });
          execution.subsequent(
            ids.map((id, i) => ({ path: ["messages", i], data: { name: id } })),
          );
        } else {
          execution.initial({
            messages: ids.map((id) => message(id, id)),
            viewer,
          });
          execution.subsequent([{ path: ["viewer"], data: { name: "v" } }]);
        }
        withoutDefer.writeQuery({
          query: plain,
          variables,
          data: { messages: ids.map((id) => message(id, id)) },
        });
      }

      const read = (cache: TestCache) =>
        cache.readQuery({ query: plain, variables: { offset: 0 } });
      expect(read(withDefer)).toEqual({
        messages: ["1", "2", "3"].map((id) => message(id, id)),
      });
      expect(read(withDefer)).toEqual(read(withoutDefer));
    },
  );
});
