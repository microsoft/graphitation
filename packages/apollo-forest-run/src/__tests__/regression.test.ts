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
  // @ts-expect-error NoImplicitAny is fine here
  expect(foo1Diff.missing?.[0]?.path?.["foo1"]?.["foo"]).toBeDefined();
  expect(foo2Diff.result).toEqual({ foo2: partialFoo });
  expect(foo2Diff.complete).toEqual(false);
  // @ts-expect-error NoImplicitAny is fine here
  expect(foo2Diff.missing?.[0]?.path?.["foo2"]?.["foo"]).toBeDefined();

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
        path: {
          fooConnection: {
            pageInfo: {
              startCursor:
                "Can't find field 'startCursor' on object {\n  \"hasNextPage\": true\n}",
            },
          },
        },
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
