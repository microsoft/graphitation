import { gql } from "@apollo/client";
import type { DocumentNode } from "graphql";
import { ForestRun } from "../ForestRun";
import { resolveOperationDescriptor } from "../cache/descriptor";
import { canReleaseOperationDescriptor } from "../cache/store";
import type {
  ExecutionKey,
  IncrementalDeferResult,
} from "../incremental/types";
import * as DiffTree from "../diff/diffTree";

class TestCache extends ForestRun {
  operation(query: DocumentNode, variables = {}) {
    return resolveOperationDescriptor(this.env, this.store, query, variables);
  }
  execution(query: DocumentNode, variables = {}) {
    return this.store.incrementalExecutions.get(
      this.operation(query, variables),
    );
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
  it("scopes previews to the execution root and batches watches at transaction completion", () => {
    const cache = new ForestRun({
      typePolicies: {
        Message: {
          fields: {
            text: {
              read(value) {
                return value?.toUpperCase();
              },
            },
          },
        },
      },
    });
    const query = gql`
      query {
        __typename
        text
        ... on Message @defer {
          name
        }
      }
    `;
    const watch = jest.fn(),
      otherRoot = jest.fn();
    const data = { __typename: "Message", text: "one" };
    cache.watch({
      query,
      rootId: "Message:2",
      optimistic: false,
      callback: otherRoot,
    });
    cache.batch({
      optimistic: false,
      update() {
        expect(
          cache.writeExecutionResult({
            query,
            dataId: "Message:1",
            execution: { data, hasNext: true },
          }),
        ).toEqual({ __ref: "Message:1" });
        cache.watch({
          query,
          rootId: "Message:1",
          optimistic: false,
          callback: watch,
        });
        expect(watch).not.toHaveBeenCalled();
      },
    });
    expect(watch.mock.calls[0][0]).toMatchObject({
      complete: false,
      result: { ...data, text: "ONE" },
    });
    expect(otherRoot).not.toHaveBeenCalled();
    expect(cache.extract()).toEqual({});
    cache.writeExecutionResult({
      query,
      dataId: "Message:1",
      execution: {
        incremental: [{ path: [], data: { name: "done" } }],
        hasNext: false,
      },
    });
    expect(watch.mock.calls[1][0]).toMatchObject({
      complete: true,
      result: { ...data, text: "ONE", name: "done" },
    });
  });

  it("shows previews only to matching watches, including watches attached mid-execution", () => {
    const cache = new ForestRun();
    // Distinct executions share one ordinary cache tree through keyVars.
    const query = gql`
      query Page($limit: Int!) @cache(keyVars: []) {
        messages(limit: $limit) {
          id
          text
          ... @defer {
            name
          }
        }
      }
    `;
    const variables = { limit: 1 };
    const other = gql`
      query Other {
        messages(limit: 1) {
          id
          text
          name
        }
      }
    `;
    const fragment = gql`
      fragment Contents on Message {
        text
        name
      }
    `;
    const committed = { messages: [message("1", "stored")] };
    cache.writeQuery({ query, variables, data: committed });
    cache.writeQuery({ query: other, data: committed });
    const matching = jest.fn(),
      differentVars = jest.fn(),
      differentDoc = jest.fn();
    cache.watch({ query, variables, optimistic: false, callback: matching });
    cache.watch({
      query,
      variables: { limit: 2 },
      optimistic: false,
      callback: differentVars,
    });
    cache.watch({ query: other, optimistic: true, callback: differentDoc });
    const before = cache.extract();

    const pending = execute(cache, query, { variables });
    const incoming = { ...message("1"), text: "streaming" };
    pending.initial({ messages: [incoming] });
    const late = jest.fn();
    cache.watch({
      query,
      variables,
      optimistic: true,
      immediate: true,
      callback: late,
    });
    for (const callback of [matching, late]) {
      expect(callback.mock.calls[0][0]).toMatchObject({
        complete: false,
        result: { messages: [incoming] },
      });
    }
    pending.subsequent([{ path: ["messages", 0], data: { name: "preview" } }], {
      hasNext: true,
    });
    for (const callback of [matching, late])
      expect(callback).toHaveBeenCalledTimes(2);
    expect(differentVars).not.toHaveBeenCalled();
    expect(differentDoc).not.toHaveBeenCalled();
    expect(cache.extract()).toEqual(before);
    expect(cache.diff({ query, variables, optimistic: true }).result).toEqual(
      committed,
    );
    expect(cache.readFragment({ fragment, id: "Message:1" })).toMatchObject({
      name: "stored",
    });

    // A normal broadcast may reach all these watches. Neither matching watch falls back to base.
    cache.writeQuery({
      query: other,
      data: { messages: [message("1", "edited")] },
    });
    for (const callback of [matching, late])
      expect(callback).toHaveBeenCalledTimes(2);
    expect(differentDoc.mock.calls[0][0].result.messages[0].name).toBe(
      "edited",
    );

    pending.subsequent([{ path: ["messages", 0], data: { name: "final" } }]);
    for (const callback of [matching, late]) {
      expect(callback).toHaveBeenCalledTimes(3);
      expect(callback.mock.calls[2][0].result.messages[0].name).toBe("final");
    }
    expect(cache.readQuery({ query: other })).toEqual({
      messages: [{ ...incoming, name: "final" }],
    });
  });

  it("replays raw data against the latest base, like one delayed ordinary write", () => {
    const createCache = () =>
      new ForestRun({
        typePolicies: {
          Query: {
            fields: {
              messages: {
                merge(existing = [], incoming: readonly unknown[]) {
                  return [...incoming].reverse().concat(existing);
                },
              },
            },
          },
        },
      });
    const cache = createCache(),
      ordinary = createCache();
    const writeBoth = (id: string) => {
      for (const c of [cache, ordinary]) {
        c.writeQuery({
          query: messagesQuery,
          data: { messages: [message(id, id)] },
        });
      }
    };
    writeBoth("base");
    const watch = jest.fn();
    cache.watch({ query: messagesQuery, optimistic: false, callback: watch });
    const pending = execute(cache, messagesQuery);
    const data = { messages: [message("1"), message("2")] };
    pending.initial(data);
    writeBoth("intervening");
    pending.subsequent([{ path: ["messages", 0], data: { name: "one" } }], {
      hasNext: true,
    });
    const lastPreview = watch.mock.calls[watch.mock.calls.length - 1][0];
    expect(lastPreview.result.messages).toEqual([
      message("2"),
      message("1", "one"),
      message("intervening", "intervening"),
      message("base", "base"),
    ]);
    writeBoth("latest");
    pending.subsequent([{ path: ["messages", 1], data: { name: "two" } }]);
    ordinary.writeQuery({
      query: messagesQuery,
      data: { messages: [message("1", "one"), message("2", "two")] },
    });
    expect(cache.extract()).toEqual(ordinary.extract());
    expect(cache.diff({ query: messagesQuery, optimistic: false })).toEqual(
      ordinary.diff({ query: messagesQuery, optimistic: false }),
    );
    expect(data).toEqual({ messages: [message("1"), message("2")] });
  });

  it("honors overwrite and broadcast on a forced finish and ignores late payloads", () => {
    const cache = new ForestRun({
      typePolicies: {
        Query: {
          fields: {
            messages: {
              merge(existing = [], incoming: readonly unknown[]) {
                return [...existing, ...incoming];
              },
            },
          },
        },
      },
    });
    cache.writeQuery({
      query: messagesQuery,
      data: { messages: [message("base", "base")] },
    });
    const watch = jest.fn();
    cache.watch({ query: messagesQuery, optimistic: false, callback: watch });
    const options = { query: messagesQuery, broadcast: false };
    cache.writeExecutionResult({
      ...options,
      overwrite: true,
      execution: {
        key: 1,
        data: { messages: [message("1")] },
        hasNext: true,
      },
    });
    cache.writeExecutionResult({
      ...options,
      execution: {
        key: 1,
        hasNext: true,
        incremental: [
          {
            path: ["messages", 0],
            data: null,
            errors: [{ message: "not delivered" }],
          },
          { path: ["messages"], items: [message("ignored")] },
          { path: ["messages", 99], data: { name: "ignored" } },
        ],
      },
    });
    cache.writeExecutionResult({
      ...options,
      execution: { key: 1, hasNext: false },
    });
    expect(watch).not.toHaveBeenCalled();
    const diff = cache.diff({ query: messagesQuery, optimistic: false });
    expect(diff).toMatchObject({
      complete: false,
      result: { messages: [message("1")] },
    });
    expect(diff.missing?.[0].path).toEqual(["messages", 0, "name"]);
    execute(cache, messagesQuery, { key: 1 }).subsequent([
      { path: ["messages", 0], data: { name: "late" } },
    ]);
    expect(watch).not.toHaveBeenCalled();
    expect(cache.diff({ query: messagesQuery, optimistic: false })).toEqual(
      diff,
    );
  });

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
    expect(cache.extract()).toEqual({});

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

  it("ignores results of a superseded execution", () => {
    const cache = new TestCache();
    const first = execute(cache, messagesQuery, { key: 1 });
    const second = execute(cache, messagesQuery, { key: 2 });
    first.initial({ messages: [message("1")] });
    second.initial({ messages: [message("2")] });

    first.subsequent([{ path: ["messages", 0], data: { name: "first" } }]);
    expect(cache.extract()).toEqual({});
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

    expect(
      cache.diff({ query: messagesQuery, optimistic: false }).result,
    ).toEqual({
      messages: [message("1", "new"), message("2")],
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

    execution.subsequent([{ path: ["messages", 1], data: { name: "two" } }]);

    expect(cache.readQuery({ query: messagesQuery })).toEqual({
      messages: [message("1", "inline"), message("2", "two")],
    });
  });

  it("does not open an execution when all sites are disabled", () => {
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
    expect(
      cache.diff({ query: messagesQuery, optimistic: false }),
    ).toMatchObject({
      complete: false,
      result: { messages: [message("1", "one"), message("2")] },
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
});
