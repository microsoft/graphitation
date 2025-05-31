import { DocumentNode } from "graphql";
import { ForestRun } from "../ForestRun";
import { gql } from "./helpers/descriptor";

test("fragment read is served from matching query", () => {
  const query = gql`
    query ($id: Int!, $fooKey: Int!) {
      item(id: $id) {
        id
        ...FooFragment
      }
    }
    fragment FooFragment on Foo {
      id
      foo(key: $fooKey)
    }
  `;
  const fragment: DocumentNode = {
    kind: "Document",
    definitions: [query.definitions[1]],
  };
  const cache = new ForestRun();

  const foo1 = { __typename: "Foo", id: 1, foo: 1 };
  const foo2 = { __typename: "Foo", id: 1, foo: 2 };
  const foo3 = { __typename: "Foo", id: 1, foo: 3 };
  const id = cache.identify(foo1); // the same id for all variants

  cache.write({
    query,
    result: { item: foo1 },
    variables: { id: 1, fooKey: 1 },
  });
  cache.write({
    query,
    result: { item: foo2 },
    variables: { id: 1, fooKey: 2 },
  });
  cache.write({
    query,
    result: { item: foo3 },
    variables: { id: 1, fooKey: 3 },
  });

  const result1 = cache.readFragment({
    fragment,
    id,
    optimistic: true,
    variables: { fooKey: 1 },
  });
  const result2 = cache.readFragment({
    fragment,
    id,
    optimistic: true,
    variables: { fooKey: 2 },
  });
  const result3 = cache.readFragment({
    fragment,
    id,
    optimistic: true,
    variables: { fooKey: 3 },
  });
  const result4 = cache.readFragment({
    fragment,
    id,
    optimistic: true,
    variables: { fooKey: -1 },
  });

  expect(result1).toBe(foo1);
  expect(result2).toBe(foo2);
  expect(result3).toBe(foo3);
  expect(result4).toBe(null);
});

test("fragment read respects include/skip directives", () => {
  const query = gql`
    query ($id: Int!, $includedParent: Boolean!, $includedSpread: Boolean!) {
      item(id: $id) {
        id
        foo
        ... @include(if: $includedParent) {
          ...FooFragment @include(if: $includedSpread)
        }
      }
    }
    fragment FooFragment on Foo {
      id
      foo
    }
  `;
  const fragment: DocumentNode = {
    kind: "Document",
    definitions: [query.definitions[1]],
  };
  const cache = new ForestRun();

  const foo1 = { __typename: "Foo", id: 1, foo: 1 };
  const foo2 = { __typename: "Foo", id: 2, foo: 2 };
  const foo3 = { __typename: "Foo", id: 3, foo: 3 };
  const foo4 = { __typename: "Foo", id: 4, foo: 4 };

  cache.write({
    query,
    result: { item: foo1 },
    variables: { id: 1, includedParent: true, includedSpread: true },
  });
  cache.write({
    query,
    result: { item: foo2 },
    variables: { id: 2, includedParent: false, includedSpread: true },
  });
  cache.write({
    query,
    result: { item: foo3 },
    variables: { id: 3, includedParent: true, includedSpread: false },
  });
  cache.write({
    query,
    result: { item: foo4 },
    variables: { id: 4, includedParent: false, includedSpread: false },
  });

  const result1 = cache.readFragment({
    fragment,
    id: cache.identify(foo1),
    optimistic: true,
  });
  const result2 = cache.readFragment({
    fragment,
    id: cache.identify(foo2),
    optimistic: true,
  });
  const result3 = cache.readFragment({
    fragment,
    id: cache.identify(foo3),
    optimistic: true,
  });
  const result4 = cache.readFragment({
    fragment,
    id: cache.identify(foo4),
    optimistic: true,
  });

  expect(result1).toBe(foo1);

  expect(result2).not.toBe(foo2);
  expect(result2).toEqual(foo2); // Can still read fragment fields from main selection

  expect(result3).toEqual(foo3);
  expect(result3).not.toBe(foo3);

  expect(result4).toEqual(foo4);
  expect(result4).not.toBe(foo4);
});

test("fragment watcher is notified when fragment data changes", () => {
  const query = gql`
    query ($id: Int!) {
      item(id: $id) {
        id
        ...FooFragment
      }
    }
    fragment FooFragment on Foo {
      id
      foo
    }
  `;
  const fragment: DocumentNode = {
    kind: "Document",
    definitions: [query.definitions[1]],
  };
  const cache = new ForestRun();

  const foo1 = { __typename: "Foo", id: 1, foo: "before" };
  const foo2 = { __typename: "Foo", id: 2, foo: "before" };

  const calls1: unknown[] = [];
  const calls2: unknown[] = [];

  cache.watch({
    query: cache["getFragmentDoc"](fragment),
    id: cache.identify(foo1),
    callback: (diff, lastDiff) => calls1.push([diff, lastDiff]),
    optimistic: true,
  });
  cache.write({
    query,
    result: { item: foo1 },
    variables: { id: 1 },
  });
  cache.write({
    query,
    result: { item: foo2 },
    variables: { id: 2 },
  });
  cache.watch({
    query: cache["getFragmentDoc"](fragment),
    id: cache.identify(foo2),
    callback: (diff, lastDiff) => calls2.push([diff, lastDiff]),
    optimistic: true,
  });

  const foo1changed = { ...foo1, foo: "changed" };
  const foo2changed = { ...foo2, foo: "changed" };
  cache.write({
    query: gql`
      {
        foo2changed {
          id
          foo
        }
      }
    `,
    result: { foo2changed },
  });
  cache.write({
    query: gql`
      {
        foo1changed {
          id
          foo
        }
      }
    `,
    result: { foo1changed },
  });

  // diff, lastDiff
  expect(calls1).toEqual([
    [{ result: foo1, complete: true }, undefined],
    [{ result: foo1changed, complete: true }, undefined],
  ]);
  expect(calls2).toEqual([
    [{ result: foo2changed, complete: true }, undefined],
  ]);
});

test.todo("fragments data is not evicted prematurely");

test.todo("fragment watches prevent eviction");
