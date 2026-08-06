import { gql } from "../__tests__/helpers/descriptor";
import { ForestRun } from "../ForestRun";

test("properly invalidates nodes added via cache redirects", () => {
  const partialFooQuery = gql`
    {
      partialFoo {
        __typename
        id
      }
    }
  `;
  const foo1Query = gql`
    {
      foo1 {
        __typename
        id
        foo
      }
    }
  `;
  const foo2Query = gql`
    {
      foo2 {
        __typename
        id
        foo
      }
    }
  `;
  const cache = new ForestRun({
    typePolicies: {
      Query: {
        fields: {
          // Cache redirects:
          foo1: (_, { toReference }) => toReference(partialFoo),
          foo2: (_, { toReference }) => toReference(partialFoo),
        },
      },
    },
  });
  const partialFoo = { __typename: "Foo", id: "1" };
  cache.write({ query: partialFooQuery, result: { partialFoo } });

  const foo1Diff = cache.diff({ query: foo1Query, optimistic: true });
  const foo2Diff = cache.diff({ query: foo2Query, optimistic: true });

  // cache.write({ query: partialFooQuery, result: { partialFoo } });

  const fullFoo = { __typename: "Foo", id: "1", foo: "foo" };
  cache.write({ query: foo1Query, result: { foo1: fullFoo } });

  const foo1DiffAfter = cache.diff({ query: foo1Query, optimistic: true });
  const foo2DiffAfter = cache.diff({ query: foo2Query, optimistic: true });

  // Sanity-checks
  expect(foo1Diff.result).toEqual({ foo1: partialFoo });
  expect(foo1Diff.complete).toEqual(false);
  expect(foo1Diff.missing?.[0]?.path).toEqual(["foo1", "foo"]);
  expect(foo2Diff.result).toEqual({ foo2: partialFoo });
  expect(foo2Diff.complete).toEqual(false);
  expect(foo2Diff.missing?.[0]?.path).toEqual(["foo2", "foo"]);

  // Actual seen failures
  expect(foo1DiffAfter.result).toEqual({ foo1: fullFoo });
  expect(foo1DiffAfter.complete).toEqual(true);
  expect(foo2DiffAfter.result).toEqual({ foo2: fullFoo });
  expect(foo2DiffAfter.complete).toEqual(true);
});

test("properly updates fields of sibling operation", () => {
  const foo1Query = gql`
    {
      foo1 {
        __typename
        id
        foo
      }
    }
  `;
  const foo2Query = gql`
    {
      foo2 {
        __typename
        id
        foo
      }
    }
  `;
  const foo = { __typename: "Foo", id: "1", foo: "foo" };
  const fooUpdated = { __typename: "Foo", id: "1", foo: "fooUpdated" };

  const cache = new ForestRun();
  cache.diff({ query: foo1Query, optimistic: true });

  cache.write({ query: foo2Query, result: { foo2: foo } });
  cache.write({ query: foo1Query, result: { foo1: fooUpdated } });

  const { result, complete } = cache.diff({
    query: foo2Query,
    optimistic: true,
  });
  expect(complete).toBe(true);
  expect(result).toEqual({ foo2: fooUpdated });
});

test("properly updates field of sibling operation in presence of another operation with the same node removed", () => {
  const fooOrBar = gql`
    {
      fooOrBar {
        __typename
        ... on Foo {
          id
          foo
        }
        ... on Bar {
          id
          bar
        }
      }
    }
  `;
  const foo1Query = gql`
    {
      foo1 {
        __typename
        id
        foo
      }
    }
  `;
  const foo2Query = gql`
    {
      foo2 {
        __typename
        id
        foo
      }
    }
  `;
  const foo = { __typename: "Foo", id: "1", foo: "foo" };
  const bar = { __typename: "Bar", id: "1", foo: "bar" };
  const fooUpdated = { __typename: "Foo", id: "1", foo: "fooUpdated" };

  const cache = new ForestRun();
  // cache.diff({ query: foo1Query, optimistic: true });

  cache.write({ query: fooOrBar, result: { fooOrBar: foo } });
  cache.write({ query: fooOrBar, result: { fooOrBar: bar } });

  cache.write({ query: foo1Query, result: { foo1: foo } });
  cache.write({ query: foo2Query, result: { foo2: fooUpdated } });

  const { result, complete } = cache.diff({
    query: foo1Query,
    optimistic: true,
  });
  expect(complete).toBe(true);
  expect(result).toEqual({ foo1: fooUpdated });
});

test("does not fail on missing fields in aggregate", () => {
  const query = gql`
    query ($arg: String) {
      foo1 {
        id
        foo
      }
      foo2 {
        id
        foo
        foo2: foo(arg: $arg)
      }
    }
  `;
  const foo = { __typename: "Foo", id: "1", foo: "foo", foo2: "foo2" };
  const fooBadChunk = { __typename: "Foo", id: "1", foo: "foo" }; // missing "foo2" field

  const base = { foo1: foo, foo2: foo };
  const model = { foo1: foo, foo2: fooBadChunk };

  const cache = new ForestRun();
  cache.diff({ query: query, optimistic: true });

  cache.write({
    query,
    variables: { arg: "1" },
    result: base,
  });
  const shouldNotThrow = () =>
    cache.write({
      query,
      variables: { arg: "1" },
      result: model,
    });
  expect(shouldNotThrow).not.toThrow();
});

test("merge policies properly update multiple queries", () => {
  const cache = new ForestRun({
    typePolicies: {
      Query: {
        fields: {
          foo: {
            keyArgs: ["filter"],
            merge: (existing = [], incoming) => {
              return [...existing, ...incoming];
            },
          },
        },
      },
    },
  });
  const query1 = gql`
    query ($filter: [String!]! = []) {
      foo(filter: $filter) {
        id
        bar
      }
    }
  `;
  const query2 = gql`
    query ($filter: [String!]! = []) {
      foo(filter: $filter) {
        id
        baz: bar
      }
    }
  `;
  const data1 = {
    foo: [{ id: "1", bar: "bar1" }],
  };
  const data2 = {
    foo: [{ id: "2", baz: "bar2" }],
  };
  cache.write({
    query: query1,
    result: data1,
  });
  cache.write({
    query: query2,
    result: data2,
  });

  const result1 = cache.read({ query: query1, optimistic: true });
  const result2 = cache.read({ query: query2, optimistic: true });

  expect(result1).toEqual({
    foo: [
      { id: "1", bar: "bar1" },
      { id: "2", bar: "bar2" },
    ],
  });
  expect(result2).toEqual({
    foo: [
      { id: "1", baz: "bar1" },
      { id: "2", baz: "bar2" },
    ],
  });
});

test("calls field policies defined on abstract types", () => {
  const cache = new ForestRun({
    possibleTypes: {
      Node: ["Foo"],
    },
    typePolicies: {
      Node: {
        fields: {
          __fragments: {
            read: () => {
              return [];
            },
          },
        },
      },
      Foo: {
        fields: {
          notcalled: () => null,
        },
      },
    },
  });
  const query = gql`
    {
      foo {
        __fragments @client
        __typename
        id
      }
    }
  `;
  cache.write({
    query,
    result: { foo: { __typename: "Foo", id: "1" } },
  });
  const result = cache.read({ query, optimistic: true });

  expect(result).toEqual({
    foo: {
      __fragments: [],
      __typename: "Foo",
      id: "1",
    },
  });
});

test("field policies do not mutate original result", () => {
  const cache = new ForestRun({
    typePolicies: {
      Query: {
        fields: {
          test: {
            merge: () => [],
          },
        },
      },
    },
  });
  const query = gql`
    {
      test
    }
  `;

  const result = { test: ["1"] };
  cache.write({ query, result });

  expect(result).toEqual({ test: ["1"] });
});

test("should properly report missing field error on incorrect merge policy", () => {
  const query = gql`
    {
      fooConnection {
        edges {
          __typename
        }
        pageInfo {
          startCursor
          hasNextPage
        }
      }
    }
  `;
  const forestRun = new ForestRun({
    typePolicies: {
      Query: {
        fields: {
          fooConnection: {
            merge: (_, incoming) => ({
              ...incoming,
              edges: incoming.edges,
              pageInfo: {
                ...incoming?.pageInfo,
                startCursor: undefined,
              },
            }),
          },
        },
      },
    },
  });

  forestRun.write({
    query: { ...query },
    result: {
      fooConnection: {
        edges: [],
        pageInfo: {
          hasNextPage: true,
          startCursor: "1",
        },
      },
    },
  });
  const result = forestRun.diff({ query, optimistic: true });
  expect(result).toMatchObject({
    complete: false,
    missing: [
      {
        path: ["fooConnection", "pageInfo", "startCursor"],
      },
    ],
  });
});

test("completes partial written results", () => {
  const query = gql`
    {
      foo
      bar
    }
  `;
  const fullResult = {
    foo: "foo",
    bar: "bar",
  };
  const partialResult = {
    foo: "foo",
  };
  const cache = new ForestRun();
  cache.write({ query: { ...query }, result: fullResult });
  cache.write({ query, result: partialResult });
  const result = cache.diff({ query, optimistic: false });

  expect(result).toEqual({
    complete: true,
    result: {
      bar: "bar",
      foo: "foo",
    },
  });
});

test("properly replaces objects containing nested composite lists", () => {
  const query1 = gql`
    {
      foo {
        id
        bars {
          bar
        }
      }
    }
  `;
  const query2 = gql`
    {
      foo {
        id
        bars {
          bar
        }
      }
    }
  `;
  const result1 = {
    foo: {
      __typename: "Foo",
      id: "1",
      bars: [{ bar: "1" }],
    },
  };
  const result2 = {
    foo: {
      __typename: "Foo",
      id: "2",
      bars: [],
    },
  };
  const cache = new ForestRun();
  cache.write({ query: query1, result: result1 });
  cache.write({ query: query2, result: result2 });

  const { complete, result } = cache.diff({ query: query1, optimistic: true });

  expect(complete).toEqual(true);
  expect(result).toEqual({
    foo: {
      __typename: "Foo",
      id: "2",
      bars: [],
    },
  });
});

// Regression coverage for `TypeError: Cannot read properties of undefined (reading 'value')`
// thrown by reIndexList (src/forest/indexTree.ts). Everything below goes through
// the public cache API only.
//
// The crash needed a four way conjunction:
//  1. The same node (Thread:1) is selected twice in one operation with two
//     *different* selections. aggregateFieldChunks only dedupes chunks sharing
//     both selection and operation, so here the node value stays an aggregate.
//  2. The two selections carry lists of different lengths (14 vs 3) and the
//     aggregate iterates the longer one.
//  3. The longer list starts with nulls. diffCompositeListLayout pushes `null`
//     into the layout for them and diffCompositeListValue skips those indices
//     (`baseItemIndex` is not a number), so index 4 is the *first* index
//     resolved against the aggregate.
//  4. aggregateListItemValue -> resolveListItemChunk assigns `itemChunks[4]` on
//     the 3 item chunk with no bounds check. The array grows past its data
//     length and index 3 is left unresolved.
//
// Steps 1+2 are the actual defect in the payload, but nothing reads the hole it
// leaves until a *later* write recycles that chunk - which is why the stack trace
// blames a write that is entirely innocent. reIndexList now detects the hole
// instead of dereferencing it, and reports what is known about the damaged list.
const seedQuery = gql`
  query MessageListSeed {
    thread {
      __typename
      id
      messages {
        __typename
        id
        text
      }
    }
  }
`;

const messageListQuery = gql`
  query MessageList {
    conversation {
      __typename
      id
      thread {
        __typename
        id
        messages {
          __typename
          id
          text
        }
      }
    }
    pinned {
      __typename
      id
      thread {
        __typename
        id
        title
        messages {
          __typename
          id
          text
          author {
            __typename
            id
          }
        }
      }
    }
  }
`;

const messageIds = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const message = (id: string) => ({ __typename: "Message", id, text: id });
const pinnedMessage = (id: string) => ({
  ...message(id),
  author: { __typename: "User", id: "1" },
});
const conversation = (messages: unknown[]) => ({
  __typename: "Conversation",
  id: "1",
  thread: { __typename: "Thread", id: "1", messages },
});
const createPinned = (ids: string[] = ["1", "2", "3"]) => ({
  __typename: "Pinned",
  id: "1",
  thread: {
    __typename: "Thread",
    id: "1",
    title: "Pinned",
    messages: ids.map(pinnedMessage),
  },
});

const seedThread = (cache: ForestRun) =>
  cache.write({
    query: seedQuery,
    result: {
      thread: {
        __typename: "Thread",
        id: "1",
        messages: messageIds.map(message),
      },
    },
  });

// Without the leading nulls the same payload grows the 3 item chunk densely and
// leaves no hole behind, so this exact shape is what the check can see.
const conversationMessages = [
  null,
  null,
  null,
  null,
  ...messageIds.map(message),
];

test("reports an unresolved list item instead of dereferencing it", () => {
  const cache = new ForestRun();
  seedThread(cache);

  // Thread:1 appears twice: 14 messages under `conversation`, 3 under `pinned`.
  // This write punches the hole and is accepted - nothing reads it yet.
  const pinned = createPinned();
  cache.write({
    query: messageListQuery,
    result: { conversation: conversation(conversationMessages), pinned },
  });

  // Reusing the same source objects makes indexTree recycle the damaged subtree
  // instead of indexing it again, and recycling walks every item reference.
  let error: Error | undefined;
  try {
    cache.write({
      query: messageListQuery,
      result: { conversation: conversation(conversationMessages), pinned },
    });
  } catch (e) {
    error = e as Error;
  }

  expect(error?.message).toMatch(
    /^Invariant violation: Detected malformed payload written to the cache/,
  );
  // This phrase is the first thing a human reads in a telemetry dashboard, so keep it
  // stable across rewordings of the rest.
  expect(error?.message).toContain(
    'a "Thread" node occurs multiple times in a single write with a different ' +
      'number of items in the "messages" list',
  );
  // The write being recycled is the one that produced the malformed payload. Recycling is
  // always same-operation, so there is no second operation to name.
  expect(error?.message).toContain("Operation:  query MessageList");
  expect(error?.message).toContain("Node type:  Thread");
  // Both occurrences are the same entity - that is what makes the divergence a conflict -
  // but the id itself must not leak, so the message states the fact without printing it.
  expect(error?.message).toContain(
    "Node id:    same in both occurrences (not shown)",
  );
  expect(error?.message).toContain("Field:      messages");
  // Both conflicting occurrences, reconstructed from the tree being recycled.
  expect(error?.message).toContain(
    "Occurrence 1: 14 items at data.conversation.thread.messages",
  );
  expect(error?.message).toContain(
    "Occurrence 2: 3 items at data.pinned.thread.messages",
  );
  expect(error?.message).not.toContain("Thread:1");
});

test("accepts a payload repeating a node with lists of equal length", () => {
  const cache = new ForestRun();
  seedThread(cache);

  // Thread:1 still appears twice under two different selections (`pinned` also
  // selects `title` and `author`), which is legal as long as the shared list
  // field resolves to the same items. Guards the check against over rejecting.
  const pinned = createPinned(messageIds);

  cache.write({
    query: messageListQuery,
    result: {
      conversation: conversation(messageIds.map(message)),
      pinned,
    },
  });

  // Reusing the same `pinned` source object makes indexTree recycle that subtree
  // instead of indexing it again: reIndexObject -> reIndexObject -> reIndexList,
  // which walks every item reference of the list. Both lists keep the same
  // length, only the message text changes.
  expect(() =>
    cache.write({
      query: messageListQuery,
      result: {
        conversation: conversation(
          messageIds.map((id) => ({ ...message(id), text: `${id} edited` })),
        ),
        pinned,
      },
    }),
  ).not.toThrow();
});

// The same defect one level deeper: the repeated node is a list *item* rather than
// a field of the root, and the divergent list hangs off it. Both occurrences carry
// a list index, which is the shape a duplicate-insertion bug produces upstream.
//
// Note the two occurrences still need *different* selections. aggregateFieldChunks
// dedupes adjacent chunks sharing selection and operation, and two items of one
// list necessarily share both - so inserting the same node twice into a single
// list is collapsed before any list is aggregated and cannot punch a hole.
const fileNode = (id: string) => ({ __typename: "File", id });
const messageWithFiles = (id: string, files: unknown[]) => ({
  __typename: "Message",
  id,
  files,
});

const attachmentSeedQuery = gql`
  query AttachmentSeed {
    message {
      __typename
      id
      files {
        __typename
        id
      }
    }
  }
`;

const attachmentQuery = gql`
  query Attachments {
    inbox {
      __typename
      id
      messages {
        __typename
        id
        files {
          __typename
          id
        }
      }
    }
    starred {
      __typename
      id
      messages {
        __typename
        id
        subject
        files {
          __typename
          id
        }
      }
    }
  }
`;

test("reports list indices when the repeated node is itself a list item", () => {
  const cache = new ForestRun();
  cache.write({
    query: attachmentSeedQuery,
    result: {
      message: messageWithFiles("7", [fileNode("a"), fileNode("b")]),
    },
  });

  // Message:7 is at index 2 of `inbox.messages` with 4 files and at index 1 of
  // `starred.messages` with 1. Only the subtree holding the shorter list keeps
  // its identity, so it is the one recycled by the second write.
  const starred = {
    __typename: "Starred",
    id: "1",
    messages: [
      { ...messageWithFiles("3", []), subject: "s" },
      { ...messageWithFiles("7", [fileNode("a")]), subject: "s" },
    ],
  };
  const inbox = () => ({
    __typename: "Inbox",
    id: "1",
    messages: [
      messageWithFiles("1", []),
      messageWithFiles("2", []),
      messageWithFiles("7", [null, null, fileNode("a"), fileNode("b")]),
    ],
  });

  cache.write({
    query: attachmentQuery,
    result: { inbox: inbox(), starred },
  });

  let error: Error | undefined;
  try {
    cache.write({
      query: attachmentQuery,
      result: { inbox: inbox(), starred },
    });
  } catch (e) {
    error = e as Error;
  }

  expect(error?.message).toContain(
    'a "Message" node occurs multiple times in a single write with a different ' +
      'number of items in the "files" list',
  );
  expect(error?.message).toContain("Node type:  Message");
  expect(error?.message).toContain("Field:      files");
  // Each occurrence is addressed by its index in the enclosing list, and a single
  // item reads as "1 item" rather than "1 items".
  expect(error?.message).toContain(
    "Occurrence 1: 4 items at data.inbox.messages.2.files",
  );
  expect(error?.message).toContain(
    "Occurrence 2: 1 item at data.starred.messages.1.files",
  );
  expect(error?.message).not.toContain("Message:7");
});

// The same defect, benign symptom: when every out of bounds index is resolved in
// order the shorter chunk densifies instead of growing a hole, so there is
// nothing for reIndexList to trip over even though the cache state is just as
// wrong. Catching that needs the payload itself to be validated while it is
// indexed, which is a follow up.
test.todo("rejects repeated nodes with divergent list lengths at index time");

test("properly reads plain objects from nested lists", () => {
  const query1 = gql`
    {
      foo {
        bar
      }
    }
  `;
  const query2 = gql`
    {
      foo {
        bar
        baz
      }
    }
  `;
  const query3 = gql`
    {
      foo {
        bar
        baz
      }
    }
  `;
  const result1 = { foo: [{ bar: "1" }] };
  const result2 = { foo: [{ bar: "1", baz: "1" }] };
  const cache = new ForestRun();

  cache.write({ query: query1, result: result1 });
  cache.write({ query: query2, result: result2 });

  const { complete, result } = cache.diff({ query: query3, optimistic: true });

  expect(result).toEqual(result2);
  expect(complete).toEqual(true);
});

test("properly compares complex arguments in @connection directive", () => {
  const query1 = gql`
    {
      foo(filter: { a: "1", b: "2" })
        @connection(key: "a", filter: ["filter"]) {
        edges {
          cursor
        }
      }
    }
  `;
  const query2 = gql`
    {
      foo(filter: { b: "2", a: "1" })
        @connection(key: "a", filter: ["filter"]) {
        edges {
          cursor
        }
      }
    }
  `;
  const result1 = { foo: { edges: [{ cursor: "1" }] } };
  const cache = new ForestRun();
  cache.write({ query: query1, result: result1 });

  const { result, complete } = cache.diff({ query: query2, optimistic: true });

  expect(result).toEqual(result1);
  expect(complete).toEqual(true);
});

test("@connection directive with relay-style 'filters' separates results by filtered arg values", () => {
  // "limit" arg differs between queries but is NOT in filters, so it should be ignored for keying.
  // Only "orderBy" (which IS in filters) should distinguish the two connection results.
  const query1 = gql`
    {
      foo(orderBy: "name", limit: 10)
        @connection(key: "foo", filters: ["orderBy"]) {
        edges {
          cursor
        }
      }
    }
  `;
  const query2 = gql`
    {
      foo(orderBy: "name", limit: 20)
        @connection(key: "foo", filters: ["orderBy"]) {
        edges {
          cursor
        }
      }
    }
  `;
  const query3 = gql`
    {
      foo(orderBy: "date", limit: 10)
        @connection(key: "foo", filters: ["orderBy"]) {
        edges {
          cursor
        }
      }
    }
  `;
  const result1 = { foo: { edges: [{ cursor: "byName" }] } };
  const result2 = { foo: { edges: [{ cursor: "byNamePage2" }] } };
  const result3 = { foo: { edges: [{ cursor: "byDate" }] } };
  const cache = new ForestRun();

  cache.write({ query: query1, result: result1 });
  cache.write({ query: query2, result: result2 });
  cache.write({ query: query3, result: result3 });

  const diff1 = cache.diff({ query: query1, optimistic: true });
  const diff2 = cache.diff({ query: query2, optimistic: true });
  const diff3 = cache.diff({ query: query3, optimistic: true });

  // query1 and query2 share the same orderBy so they should resolve to the same (latest) result.
  // query3 has a different orderBy so it gets its own result.
  expect(diff1.result).toEqual(result2);
  expect(diff1.complete).toEqual(true);
  expect(diff2.result).toEqual(result2);
  expect(diff2.complete).toEqual(true);
  expect(diff3.result).toEqual(result3);
  expect(diff3.complete).toEqual(true);
});

test("should not notify immediately canceled watches", () => {
  const query = gql`
    {
      foo
    }
  `;
  const cache = new ForestRun();
  let notifications = 0;
  const watch = {
    query,
    optimistic: true,
    callback: () => {
      notifications++;
    },
  };
  const unsubscribe = cache.watch(watch);
  unsubscribe();

  cache.write({ query, result: { foo: 1 } });

  expect(notifications).toEqual(0);
});

// TODO: this is useful for TMP tests
test.skip("ApolloCompat: should support manual writes with missing __typename", () => {
  const query = gql`
    {
      foo {
        id
        ... on Foo {
          test
        }
      }
    }
  `;
  const result1 = {
    foo: { __typename: "Foo", id: "1", test: "Foo" },
  };
  const result2 = {
    foo: { id: "1", test: "Bar" },
  };
  const cache = new ForestRun();

  cache.write({ query, result: result1 });
  cache.write({ query, result: result2 });

  const diff = cache.diff({ query: { ...query }, optimistic: true });

  expect(diff.result).toEqual({
    foo: { id: "1", test: "Bar" },
  });
  expect(diff.complete).toEqual(true);
});

test("should detect empty operations even without sub-selections", () => {
  const query = gql`
    {
      foo
    }
  `;
  const cache = new ForestRun();

  cache.write({ query, result: {} });
  const { complete, result } = cache.diff({ query, optimistic: true });

  expect(complete).toBe(false);
  expect(result).toEqual({});
});

test("optimistic update affecting list is properly handled", () => {
  const mutation = gql`
    mutation {
      updateItem {
        id
        count
      }
    }
  `;
  const query = gql`
    query {
      list {
        items {
          id
          count
        }
      }
    }
  `;

  const item = { __typename: "Item", id: "1", count: 0 };
  const updatedItem = { ...item, count: 1 };

  const cache = new ForestRun();
  cache.write({
    query,
    result: { list: { items: [item] } },
  });

  const results: any[] = [];
  cache.watch({
    query,
    optimistic: true,
    callback: (diff) => {
      results.push(diff);
    },
  });

  cache.batch({
    optimistic: "1",
    update() {
      cache.write({
        query: mutation,
        result: { updateItem: updatedItem },
      });
    },
  });

  expect(results.length).toEqual(1);
  expect(results[0].result).toEqual({ list: { items: [updatedItem] } });
  expect(results[0].complete).toEqual(true);
});

test("should not trigger merge policies for missing incoming fields", () => {
  const query = gql`
    query {
      foo
    }
  `;

  let calls = 0;
  const cache = new ForestRun({
    typePolicies: {
      Query: {
        fields: {
          foo: {
            merge() {
              calls++;
            },
          },
        },
      },
    },
  });
  cache.write({ query, result: {} });

  expect(calls).toEqual(0);
});

test("should keep a single result for multiple operations with the same key variables", () => {
  const query = gql`
    query ($filter: String, $limit: Int) @cache(keyVars: ["filter"]) {
      list(filter: $filter, limit: $limit)
        @connection(key: "key", filter: ["filter"])
    }
  `;
  const vars1 = { filter: "a", limit: 1 };
  const result1 = { list: ["a"] };

  const vars2 = { filter: "a", limit: 2 };
  const result2 = { list: ["a", "a"] };

  const vars3 = { filter: "b", limit: 1 };
  const result3 = { list: ["b"] };

  const cache = new ForestRun();
  const watch = (variables: any, calls: any) =>
    cache.watch({
      query,
      variables,
      optimistic: true,
      callback: (diff) => {
        calls.push(diff.result);
      },
    });
  const watch1: unknown[] = [];
  const watch3: unknown[] = [];
  watch(vars1, watch1);
  watch(vars3, watch3);

  cache.write({ query, variables: vars1, result: result1 });
  cache.write({ query, variables: vars2, result: result2 });
  cache.write({ query, variables: vars3, result: result3 });

  const stats = cache.getStats();

  const diff = cache.diff({ query, variables: vars2, optimistic: true });
  const statsAfterDiff = cache.getStats();

  // We wrote 3 trees, but because keyVars were set, ForestRun actually stores 2 of them
  //   This is important for pagination using merge policies.
  //   Without this feature every single page gets its own tree, which later must be kept up-to-date with
  //   all other pages due to keyArgs setting for merged list field (or @connection filter argument which does the same)
  expect(stats.treeCount).toBe(2);

  // Sanity-check: watches must see all intermediate results
  expect(watch1).toEqual([result1, result2]);
  expect(watch3).toEqual([{}, result3]);

  // Explicit read with keyVars should not lead to new trees being added
  expect(diff).toEqual({ complete: true, result: result2 });
  expect(statsAfterDiff.treeCount).toBe(2);
});

test("merge policy with keyArgs: watch sees correct edges after paginated writes", () => {
  const cache = new ForestRun({
    typePolicies: {
      Query: {
        fields: {
          search: {
            keyArgs: (args: Record<string, any> | null) => {
              return args?.query?.toLowerCase();
            },
            merge: (existing: any, incoming: any, { args }: any) => {
              const merged = existing ? { ...existing } : {};
              merged.edges = existing?.edges ? existing.edges.slice(0) : [];

              if (args?.after) {
                merged.edges.push(...incoming.edges);
              } else if (args?.before) {
                merged.edges.unshift(...incoming.edges);
              } else {
                merged.edges = incoming.edges;
              }
              merged.totalCount = incoming.totalCount;
              return merged;
            },
          },
        },
      },
    },
  });

  const query = gql`
    query (
      $query: String!
      $after: String
      $first: Int
      $before: String
      $last: Int
    ) {
      search(
        query: $query
        after: $after
        first: $first
        before: $before
        last: $last
      ) {
        edges {
          __typename
          node
        }
        totalCount
      }
    }
  `;

  const notifications: any[] = [];
  const firstVars = { query: "Basquiat", first: 3 };
  cache.watch({
    query,
    variables: firstVars,
    optimistic: true,
    callback: (diff) => notifications.push(diff.result),
  });

  // Write page 1
  cache.write({
    query,
    variables: firstVars,
    result: {
      search: {
        edges: [
          { __typename: "E", node: "A" },
          { __typename: "E", node: "B" },
          { __typename: "E", node: "C" },
        ],
        totalCount: 10,
      },
    },
  });
  expect(notifications.length).toBe(1);
  expect((notifications[0] as any).search.edges.length).toBe(3);

  // Write page 2 (forward)
  cache.write({
    query,
    variables: { query: "Basquiat", after: "curC", first: 3 },
    result: {
      search: {
        edges: [
          { __typename: "E", node: "D" },
          { __typename: "E", node: "E" },
          { __typename: "E", node: "F" },
        ],
        totalCount: 10,
      },
    },
  });
  expect(notifications.length).toBe(2);
  expect((notifications[1] as any).search.edges.length).toBe(6);

  // Write page 3 (backward, lowercase query = same keyArgs)
  cache.write({
    query,
    variables: { query: "basquiat", before: "curD", last: 2 },
    result: {
      search: {
        edges: [
          { __typename: "E", node: "B2" },
          { __typename: "E", node: "C2" },
        ],
        totalCount: 10,
      },
    },
  });

  // Watcher should see merged result: B2, C2 prepended to [A,B,C,D,E,F] = 8 edges
  // Bug: without keyArgs-aware hash, watcher's selection doesn't match the
  // new write's selection (different args hash), so notification uses stale data
  expect(notifications.length).toBe(3);
  expect((notifications[2] as any).search.edges.length).toBe(8);
});

test("bad manual writes shouldn't cause invariant violation", () => {
  const query = gql`
    {
      foo {
        bar
      }
    }
  `;
  const cache = new ForestRun();
  cache.writeQuery({ query, data: { foo: { bar: "bar" } } });

  const data = cache.readQuery({ query });

  // Note: faulty write where nested "foo" object is identified as having ROOT_QUERY key because it was cached
  //   in the keyMap via previous operations where it was indeed a ROOT node
  cache.writeQuery({ query, data: { foo: data } });

  // Sanity-check
  expect(cache.readQuery({ query })).toEqual(null);

  // Actual failing call
  const run = () => cache.writeQuery({ query, data: { foo: { bar: "baz" } } });
  expect(run).not.toThrow();

  // Additional sanity-check
  expect(cache.readQuery({ query })).toEqual({ foo: { bar: "baz" } });
});

test("writes of non-object data should not throw", () => {
  // Note: this is a no-op in Apollo today
  const query = gql`
    mutation {
      foo
    }
  `;
  const cache = new ForestRun();
  const run1 = () =>
    cache.write({ query, result: true, dataId: "ROOT_MUTATION" });
  const run2 = () => cache.write({ query, result: true });
  const run3 = () => cache.write({ query, result: null });

  expect(run1).not.toThrow();
  expect(run2).not.toThrow();
  expect(run3).not.toThrow();
});

test("writes with missing fields should be kept up-to-date", () => {
  const q1 = gql`
    {
      foo
    }
  `;
  const q2 = gql`
    {
      foo
      bar
    }
  `;
  const cache = new ForestRun();
  cache.write({ query: q1, result: { foo: "foo" } });
  cache.write({ query: q2, result: { bar: "bar" } });

  // Sanity-check
  expect(cache.read({ query: q2, optimistic: true })).toEqual({
    foo: "foo",
    bar: "bar",
  });

  cache.write({ query: q2, result: { bar: "barUpdated" } });
  expect(cache.read({ query: q2, optimistic: true })).toEqual({
    foo: "foo",
    bar: "barUpdated",
  });
});

test("treats incorrect list items as empty objects", () => {
  // Note: this is for backwards compatibility with Apollo Client 3.6+ 🤷‍♂️
  const query = gql`
    {
      foo {
        bar
      }
    }
  `;

  const cache = new ForestRun();
  const result = { foo: [{ bar: "test" }, "bad"] };

  cache.write({ query, result, dataId: "ROOT_QUERY" });

  const data = cache.diff({ query, optimistic: true });
  expect(data.result).toEqual({ foo: [{ bar: "test" }, {}] });
  expect(data.complete).toBe(false);
});

test("does not crash when object diff is applied to list field with key collision", () => {
  // Schema (valid):
  // type ParentInfo { id: ID! items: [ChildItem!] note: String }
  // type ChildItem { id: ID! details: ParentInfo }
  // type Query { parentInfo: ParentInfo childItem: ChildItem }
  const listQuery = gql`
    {
      parentInfo {
        id
        items {
          id
        }
      }
    }
  `;
  const objectQuery = gql`
    {
      childItem {
        id
        details {
          # id
          note
        }
      }
    }
  `;

  const cache = new ForestRun({
    dataIdFromObject: (object: any) => object.id,
  });

  cache.write({
    query: listQuery,
    result: {
      parentInfo: {
        __typename: "ParentInfo",
        id: "1",
        items: [
          {
            __typename: "ChildItem",
            id: "1",
          },
        ],
      },
    },
  });

  cache.write({
    query: objectQuery,
    result: {
      childItem: {
        __typename: "ChildItem",
        id: "1",
        details: {
          // id: "2",
          note: "old",
        },
      },
    },
  });

  // This currently throws inside updateObject (assert on non-object base).
  const run = () =>
    cache.write({
      query: objectQuery,
      result: {
        childItem: {
          __typename: "ChildItem",
          id: "1",
          details: {
            // id: "2",
            note: "new",
          },
        },
      },
    });

  expect(run).not.toThrow();
});

const inconsistentEntityQuery = gql`
  {
    objectVariant {
      __typename
      id
      value {
        note
      }
    }
    listVariant {
      __typename
      id
      value {
        note
      }
    }
  }
`;
const objectVariantQuery = gql`
  {
    objectVariant {
      __typename
      id
      value {
        note
      }
    }
  }
`;

const INCOMPATIBLE_OBJECT_DIFF_ERROR =
  'Invariant violation: Failed to update "query {\n' +
  "  objectVariant {...}\n" +
  "  listVariant {...}\n" +
  '}" at path listVariant.value (in Entity): expected CompositeList, got ObjectDifference';

const INCOMPATIBLE_OBJECT_DIFF_ERROR_KEY_COLLISION =
  'Invariant violation: Failed to update "query {\n' +
  "  objectVariant {...}\n" +
  "  listVariant {...}\n" +
  '}" at path listVariant.value (in ListEntity): expected CompositeList, got ObjectDifference';

function expectInvariantViolation(run: () => unknown, message: string) {
  let error: unknown;
  try {
    run();
  } catch (thrown) {
    error = thrown;
  }

  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message.startsWith("Invariant violation")).toBe(true);
  expect((error as Error).message).toBe(message);
}

test("reports an object diff reaching an inconsistent repeated entity", () => {
  const cache = new ForestRun();

  cache.write({
    query: inconsistentEntityQuery,
    result: {
      objectVariant: {
        __typename: "Entity",
        id: "1",
        value: { note: "old" },
      },
      listVariant: {
        __typename: "Entity",
        id: "1",
        value: [{ note: "old" }],
      },
    },
  });

  const run = () =>
    cache.write({
      query: objectVariantQuery,
      result: {
        objectVariant: {
          __typename: "Entity",
          id: "1",
          value: { note: "new" },
        },
      },
    });

  expectInvariantViolation(run, INCOMPATIBLE_OBJECT_DIFF_ERROR);
});

test("reports an object diff reaching a cache key collision", () => {
  const cache = new ForestRun({
    dataIdFromObject: (object: any) => object.id,
  });

  cache.write({
    query: inconsistentEntityQuery,
    result: {
      objectVariant: {
        __typename: "ObjectEntity",
        id: "1",
        value: { note: "old" },
      },
      listVariant: {
        __typename: "ListEntity",
        id: "1",
        value: [{ note: "old" }],
      },
    },
  });

  const run = () =>
    cache.write({
      query: objectVariantQuery,
      result: {
        objectVariant: {
          __typename: "ObjectEntity",
          id: "1",
          value: { note: "new" },
        },
      },
    });

  expectInvariantViolation(run, INCOMPATIBLE_OBJECT_DIFF_ERROR_KEY_COLLISION);
});

test("matches apollo InMemoryCache behavior on incorrect cache overwrites", () => {
  const listQuery = gql`
    query ListQuery {
      container {
        __typename
        id
        entries {
          __typename
          note
        }
      }
    }
  `;
  const objectQuery = gql`
    query ObjectQuery {
      container {
        __typename
        id
        entries {
          __typename
          note
        }
      }
    }
  `;

  const forestRun = new ForestRun();

  const op1 = {
    container: {
      __typename: "Container",
      id: "1",
      entries: [
        {
          __typename: "Entry",
          note: "old",
        },
      ],
    },
  };
  const op2 = {
    container: {
      __typename: "Container",
      id: "1",
      entries: {
        __typename: "Entry",
        note: "old",
      },
    },
  };
  const op3 = {
    container: {
      __typename: "Container",
      id: "1",
      entries: {
        __typename: "Entry",
        note: "new",
      },
    },
  };

  forestRun.write({ query: listQuery, result: op1 });
  forestRun.write({ query: objectQuery, result: op2 });
  forestRun.write({ query: objectQuery, result: op3 });

  const forestList = forestRun.read({ query: listQuery, optimistic: true });
  const forestObj = forestRun.read({ query: objectQuery, optimistic: true });

  // This is what InMemoryCache produces for both queries
  const apolloCompatibleResult = {
    container: {
      __typename: "Container",
      id: "1",
      entries: { __typename: "Entry", note: "new" },
    },
  };

  expect(forestList).toEqual(apolloCompatibleResult);
  expect(forestObj).toEqual(apolloCompatibleResult);
});

test("consistent root-level __typename in optimistic response 1", () => {
  const query = gql`
    {
      __typename
      foo {
        id
        bar
      }
    }
  `;
  const update = gql`
    {
      bar {
        id
        bar
      }
    }
  `;
  const cache = new ForestRun();
  cache.write({
    query,
    result: {
      __typename: "Query",
      foo: { __typename: "Bar", id: "1", bar: "bar" },
    },
  });

  const data = cache.diff({ query, optimistic: true });
  cache.recordOptimisticTransaction(() => {
    cache.write({
      query: update,
      result: {
        bar: { __typename: "Bar", id: "1", bar: "changed" },
      },
    });
    cache.diff({ query, optimistic: true });
  }, "test");
  const optimisticData = cache.diff({ query, optimistic: true });
  cache.removeOptimistic("test");
  const data2 = cache.diff({ query, optimistic: true });

  expect(data.result).toEqual({
    __typename: "Query",
    foo: { __typename: "Bar", id: "1", bar: "bar" },
  });
  expect(optimisticData.result).toEqual({
    __typename: "Query", // <-- This was missing
    foo: { __typename: "Bar", id: "1", bar: "changed" },
  });
  expect(data2.result).toEqual({
    __typename: "Query",
    foo: { __typename: "Bar", id: "1", bar: "bar" },
  });
});

test("consistent root-level __typename in optimistic response 2", () => {
  const query = gql`
    {
      foo {
        id
        bar
      }
    }
  `;
  const update = gql`
    {
      bar {
        id
        bar
      }
    }
  `;
  const cache = new ForestRun();
  cache.write({
    query,
    result: {
      __typename: "Query",
      foo: { __typename: "Bar", id: "1", bar: "bar" },
    },
  });

  const data = cache.diff({ query, optimistic: true });
  cache.recordOptimisticTransaction(() => {
    cache.write({
      query: update,
      result: {
        bar: { __typename: "Bar", id: "1", bar: "changed" },
      },
    });
    cache.diff({ query, optimistic: true });
  }, "test");
  const optimisticData = cache.diff({ query, optimistic: true });
  cache.removeOptimistic("test");
  const data2 = cache.diff({ query, optimistic: true });

  expect(data.result).toEqual({
    foo: { __typename: "Bar", id: "1", bar: "bar" },
  });
  expect(optimisticData.result).toEqual({
    // __typename: "Query", // <-- This shouldn't be here
    foo: { __typename: "Bar", id: "1", bar: "changed" },
  });
  expect(data2.result).toEqual({
    foo: { __typename: "Bar", id: "1", bar: "bar" },
  });
});

test("correctly writes fragment on abstract type", () => {
  const query = gql`
    {
      items {
        id
        name
      }
    }
  `;
  const update = gql`
    fragment Named on INamed {
      name
    }
  `;
  const foo = { __typename: "Foo", id: "1", name: "foo" };
  const bar = { __typename: "Bar", id: "2", name: "bar" };
  const cache = new ForestRun({
    possibleTypes: {
      INamed: ["Foo", "Bar"],
    },
  });
  cache.write({
    query,
    result: {
      __typename: "Query",
      items: [{ ...foo }, { ...bar }],
    },
  });
  const before = cache.diff({ query, optimistic: true });

  cache.writeFragment({
    fragment: update,
    id: cache.identify(foo),
    data: { name: "fooChanged" },
  });

  const after = cache.diff({ query, optimistic: true });

  expect(before.result).toEqual({
    items: [foo, bar],
  });
  expect(after.result).toEqual({
    items: [
      {
        ...foo,
        __typename: "Foo", // <-- Not INamed
        name: "fooChanged",
      },
      bar,
    ],
  });
});

test("correctly handles optimistic fragment write", () => {
  const query = gql`
    {
      items {
        id
        name
      }
    }
  `;
  const update = gql`
    fragment Foo on Foo {
      name
    }
  `;
  const foo = { __typename: "Foo", id: "1", name: "foo" };
  const bar = { __typename: "Bar", id: "2", name: "bar" };
  const cache = new ForestRun();

  cache.write({
    query,
    result: {
      items: [{ ...foo }, { ...bar }],
    },
  });

  const before = cache.diff({ query, optimistic: true });
  cache.recordOptimisticTransaction(() => {
    cache.writeFragment({
      fragment: update,
      id: cache.identify(foo),
      data: { name: "fooChanged" },
    });
  }, "test");
  const optimisticData = cache.diff({ query, optimistic: true });
  cache.removeOptimistic("test");
  const restoredData = cache.diff({ query, optimistic: true });

  expect(before.result).toEqual({
    items: [foo, bar],
  });
  expect(optimisticData.result).toEqual({
    items: [{ ...foo, name: "fooChanged" }, bar],
  });
  expect(restoredData.result).toEqual({
    items: [foo, bar],
  });
});

test("correctly handles optimistic fragment write for deeply nested node", () => {
  const query = gql`
    {
      items {
        id
        nested {
          id
          name
        }
      }
    }
  `;
  const update = gql`
    fragment Foo on Foo {
      name
    }
  `;
  const foo = { __typename: "Foo", id: "1", name: "foo" };
  const bar = { __typename: "Bar", id: "2", name: "bar" };
  const item1 = { __typename: "Item", id: "1", nested: foo };
  const item2 = { __typename: "Item", id: "2", nested: bar };
  const cache = new ForestRun();

  const notifications: any[] = [];
  cache.watch({
    query,
    optimistic: true,
    callback: (diff) => notifications.push(diff.result),
  });

  cache.write({
    query,
    result: {
      items: [item1, item2],
    },
  });

  cache.recordOptimisticTransaction(() => {
    cache.batch({
      update: () => {
        cache.writeFragment({
          fragment: update,
          id: cache.identify(foo),
          data: { name: "fooChanged" },
        });
      },
      optimistic: false,
    });
  }, "test");

  cache.removeOptimistic("test");

  expect(notifications).toEqual([
    { items: [item1, item2] }, // initial write
    { items: [{ ...item1, nested: { ...foo, name: "fooChanged" } }, item2] },
    { items: [item1, item2] },
  ]);
});

test("merge policy on embedded object must not crash when a prior operation wrote null (draftHelpers:72)", () => {
  // A keyless ("embedded") type with a field `merge` policy. If a previous
  // operation wrote that position as an explicit `null`, the merge machinery
  // must not crash resolving the existing parent at write time.
  const cache = new ForestRun({
    typePolicies: {
      Container: {
        keyFields: false,
        fields: {
          items: {
            merge(existing = [], incoming) {
              return [...existing, ...incoming];
            },
          },
        },
      },
    },
  });

  const queryA = gql`
    query A {
      container {
        __typename
        items {
          __typename
          id
          value
        }
      }
    }
  `;
  const queryB = gql`
    query B {
      container {
        __typename
        items {
          __typename
          id
          value
        }
      }
    }
  `;

  // Prior operation commits an explicit null for the embedded field.
  cache.write({ query: queryA, result: { container: null } });

  const writeRealResult = () =>
    cache.write({
      query: queryB,
      result: {
        container: {
          __typename: "Container",
          items: [{ __typename: "Item", id: "1", value: "hi" }],
        },
      },
    });

  expect(writeRealResult).not.toThrow();

  expect(cache.read({ query: queryB, optimistic: true })).toEqual({
    container: {
      __typename: "Container",
      items: [{ __typename: "Item", id: "1", value: "hi" }],
    },
  });
});

test("merge policy on embedded object must not crash when a prior null operation has a broader selection (draftHelpers:72)", () => {
  // As above, but the prior null operation has a broader selection than the
  // later write, which may take a different cross-operation resolution path.
  const cache = new ForestRun({
    typePolicies: {
      Container: {
        keyFields: false,
        fields: {
          items: {
            merge(existing = [], incoming) {
              return [...existing, ...incoming];
            },
          },
        },
      },
    },
  });

  // `extra` makes query A's selection broader than query B's.
  const queryA = gql`
    query A {
      container {
        __typename
        extra
        items {
          __typename
          id
          value
        }
      }
    }
  `;
  const queryB = gql`
    query B {
      container {
        __typename
        items {
          __typename
          id
          value
        }
      }
    }
  `;

  // Prior operation commits an explicit null for the embedded field.
  cache.write({ query: queryA, result: { container: null } });

  const writeRealResult = () =>
    cache.write({
      query: queryB,
      result: {
        container: {
          __typename: "Container",
          items: [{ __typename: "Item", id: "1", value: "hi" }],
        },
      },
    });

  expect(writeRealResult).not.toThrow();

  expect(cache.read({ query: queryB, optimistic: true })).toEqual({
    container: {
      __typename: "Container",
      items: [{ __typename: "Item", id: "1", value: "hi" }],
    },
  });
});

test("updates a node field that is null in one chunk and an object in another", () => {
  const cache = new ForestRun();
  const aliasedQuery = gql`
    query Aliased {
      x: foo {
        __typename
        id
        details {
          __typename
          a
          b
        }
      }
      y: foo {
        __typename
        id
        details {
          __typename
          a
          b
        }
      }
    }
  `;
  const singleQuery = gql`
    query Single {
      foo {
        __typename
        id
        details {
          __typename
          a
          b
        }
      }
    }
  `;

  cache.write({
    query: aliasedQuery,
    result: {
      x: {
        __typename: "Foo",
        id: "1",
        details: { __typename: "Detail", a: 1, b: 1 },
      },
      y: {
        __typename: "Foo",
        id: "1",
        details: null,
      },
    },
  });
  cache.write({
    query: singleQuery,
    result: {
      foo: {
        __typename: "Foo",
        id: "1",
        details: { __typename: "Detail", a: 2, b: 1 },
      },
    },
  });

  const details = { __typename: "Detail", a: 2, b: 1 };
  const aliased = cache.diff({ query: aliasedQuery, optimistic: true });
  const single = cache.diff({ query: singleQuery, optimistic: true });
  expect(aliased.result).toEqual({
    x: { __typename: "Foo", id: "1", details },
    y: { __typename: "Foo", id: "1", details },
  });
  expect(aliased.complete).toBe(true);
  expect(single.result).toEqual({
    foo: { __typename: "Foo", id: "1", details },
  });
  expect(single.complete).toBe(true);
});

test("updates repeated node ids with divergent object and null fields", () => {
  const cache = new ForestRun();
  const listQuery = gql`
    query List {
      foos {
        __typename
        id
        details {
          __typename
          a
          b
        }
      }
    }
  `;
  const singleQuery = gql`
    query Single {
      foo {
        __typename
        id
        details {
          __typename
          a
          b
        }
      }
    }
  `;

  cache.write({
    query: listQuery,
    result: {
      foos: [
        {
          __typename: "Foo",
          id: "1",
          details: { __typename: "Detail", a: 1, b: 1 },
        },
        {
          __typename: "Foo",
          id: "1",
          details: null,
        },
      ],
    },
  });
  cache.write({
    query: singleQuery,
    result: {
      foo: {
        __typename: "Foo",
        id: "1",
        details: { __typename: "Detail", a: 2, b: 1 },
      },
    },
  });

  const details = { __typename: "Detail", a: 2, b: 1 };
  const list = cache.diff({ query: listQuery, optimistic: true });
  const single = cache.diff({ query: singleQuery, optimistic: true });
  expect(list.result).toEqual({
    foos: [
      { __typename: "Foo", id: "1", details },
      { __typename: "Foo", id: "1", details },
    ],
  });
  expect(list.complete).toBe(true);
  expect(single.result).toEqual({
    foo: { __typename: "Foo", id: "1", details },
  });
  expect(single.complete).toBe(true);
});

test("updates a list item that is null in one chunk and an object in another", () => {
  const cache = new ForestRun();
  const aliasedQuery = gql`
    query Aliased {
      x: foo {
        __typename
        id
        items {
          __typename
          value
        }
      }
      y: foo {
        __typename
        id
        items {
          __typename
          value
        }
      }
    }
  `;
  const singleQuery = gql`
    query Single {
      foo {
        __typename
        id
        items {
          __typename
          value
        }
      }
    }
  `;

  cache.write({
    query: aliasedQuery,
    result: {
      x: {
        __typename: "Foo",
        id: "1",
        items: [{ __typename: "Item", value: 1 }],
      },
      y: {
        __typename: "Foo",
        id: "1",
        items: [null],
      },
    },
  });
  cache.write({
    query: singleQuery,
    result: {
      foo: {
        __typename: "Foo",
        id: "1",
        items: [{ __typename: "Item", value: 2 }],
      },
    },
  });

  const items = [{ __typename: "Item", value: 2 }];
  const aliased = cache.diff({ query: aliasedQuery, optimistic: true });
  const single = cache.diff({ query: singleQuery, optimistic: true });
  expect(aliased.result).toEqual({
    x: { __typename: "Foo", id: "1", items },
    y: { __typename: "Foo", id: "1", items },
  });
  expect(aliased.complete).toBe(true);
  expect(single.result).toEqual({
    foo: { __typename: "Foo", id: "1", items },
  });
  expect(single.complete).toBe(true);
});
