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
    dataId: "ROOT_QUERY",
    query,
    result: { item: foo1 },
    variables: { id: 1, fooKey: 1 },
  });
  cache.write({
    dataId: "ROOT_QUERY",
    query,
    result: { item: foo2 },
    variables: { id: 1, fooKey: 2 },
  });
  cache.write({
    dataId: "ROOT_QUERY",
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
    dataId: "ROOT_QUERY",
    query,
    result: { item: foo1 },
    variables: { id: 1, includedParent: true, includedSpread: true },
  });
  cache.write({
    dataId: "ROOT_QUERY",
    query,
    result: { item: foo2 },
    variables: { id: 2, includedParent: false, includedSpread: true },
  });
  cache.write({
    dataId: "ROOT_QUERY",
    query,
    result: { item: foo3 },
    variables: { id: 3, includedParent: true, includedSpread: false },
  });
  cache.write({
    dataId: "ROOT_QUERY",
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

describe("fragment watching", () => {
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
      dataId: "ROOT_QUERY",
      query,
      result: { item: foo1 },
      variables: { id: 1 },
    });
    cache.write({
      dataId: "ROOT_QUERY",
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
      [
        { result: foo1changed, complete: true },
        { result: foo1, complete: true },
      ],
    ]);
    expect(calls2).toEqual([
      [{ result: foo2changed, complete: true }, undefined],
    ]);
  });

  test("notifies parent and child fragment for child field change when no @nonreactive", () => {
    const doc: DocumentNode = gql`
      query ($id: ID!) {
        item(id: $id) {
          id
          ...AFrag
        }
      }
      fragment AFrag on Item {
        id
        aField
        ...BFrag
      }
      fragment BFrag on Item {
        id
        bField
      }
    `;
    const fragmentsDoc: DocumentNode = {
      kind: "Document",
      definitions: doc.definitions.filter(
        (d) => d.kind === "FragmentDefinition",
      ),
    };
    const cache = new ForestRun();
    const callsA: Array<[any, any]> = [];
    const callsB: Array<[any, any]> = [];
    const item1 = {
      __typename: "Item",
      id: "1",
      aField: "A0",
      bField: "B0",
    };
    const item1b = {
      __typename: "Item",
      id: "1",
      aField: "A0",
      bField: "B1",
    };
    const id = cache.identify(item1);
    cache.watch({
      query: cache["getFragmentDoc"](fragmentsDoc, "AFrag"),
      id,
      callback: (diff, lastDiff) => callsA.push([diff, lastDiff]),
      optimistic: true,
    });
    cache.watch({
      query: cache["getFragmentDoc"](fragmentsDoc, "BFrag"),
      id,
      callback: (diff, lastDiff) => callsB.push([diff, lastDiff]),
      optimistic: true,
    });
    cache.write({
      dataId: "ROOT_QUERY",
      query: doc,
      result: { item: item1 },
      variables: { id: "1" },
    });
    cache.write({
      dataId: "ROOT_QUERY",
      query: doc,
      result: { item: item1b },
      variables: { id: "1" },
    });
    expect(callsA.length).toBe(2);
    expect(callsB.length).toBe(2);
    expect(callsA[1][0].result.bField).toBe("B1");
    expect(callsB[1][0].result.bField).toBe("B1");
  });

  // TODO:
  test.skip("only notifies child when parent spread is marked @nonreactive", () => {
    const doc: DocumentNode = gql`
      query ($id: ID!) {
        item(id: $id) {
          id
          ...AFrag
        }
      }
      fragment AFrag on Item {
        id
        aField
        ...BFrag @nonreactive
      }
      fragment BFrag on Item {
        id
        bField
      }
    `;
    const fragmentsDoc: DocumentNode = {
      kind: "Document",
      definitions: doc.definitions.filter(
        (d) => d.kind === "FragmentDefinition",
      ),
    };
    const cache = new ForestRun();
    const callsA: Array<[any, any]> = [];
    const callsB: Array<[any, any]> = [];
    const item1 = {
      __typename: "Item",
      id: "1",
      aField: "A0",
      bField: "B0",
    };
    const item1b = {
      __typename: "Item",
      id: "1",
      aField: "A0",
      bField: "B1",
    };
    const id = cache.identify(item1);
    if (!id) throw new Error("Missing id");
    cache.watch({
      query: cache["getFragmentDoc"](fragmentsDoc, "AFrag"),
      id,
      callback: (diff, lastDiff) => callsA.push([diff, lastDiff]),
      optimistic: true,
    });
    cache.watch({
      query: cache["getFragmentDoc"](fragmentsDoc, "BFrag"),
      id,
      callback: (diff, lastDiff) => callsB.push([diff, lastDiff]),
      optimistic: true,
    });
    cache.write({
      query: doc,
      result: { item: item1 },
      variables: { id: "1" },
    });
    cache.write({
      query: doc,
      result: { item: item1b },
      variables: { id: "1" },
    });
    expect(callsA.length).toBe(1);
    expect(callsB.length).toBe(2);
    expect(callsB[1][0].result.bField).toBe("B1");
  });

  // list field updates
  test("notifies fragment watch on list field add/remove", () => {
    const doc: DocumentNode = gql`
      query ($id: ID!) {
        parent(id: $id) {
          ...ItemsFrag
        }
      }
      fragment ItemsFrag on Item {
        id
        items
      }
    `;
    const fragmentsDoc: DocumentNode = {
      kind: "Document",
      definitions: doc.definitions.filter(
        (d) => d.kind === "FragmentDefinition",
      ),
    };
    const cache = new ForestRun();
    const calls: Array<[any, any]> = [];
    const parent1 = { __typename: "Item", id: "1", items: ["a", "b"] };
    const parent2 = { __typename: "Item", id: "1", items: ["a", "b", "c"] };
    const parent3 = { __typename: "Item", id: "1", items: ["a"] };
    const id = cache.identify(parent1);

    cache.watch({
      query: cache["getFragmentDoc"](fragmentsDoc, "ItemsFrag"),
      id,
      callback: (diff, lastDiff) => calls.push([diff, lastDiff]),
      optimistic: true,
    });
    cache.write({
      dataId: "ROOT_QUERY",
      query: doc,
      result: { parent: parent1 },
      variables: { id: "1" },
    });
    cache.write({
      dataId: "ROOT_QUERY",
      query: doc,
      result: { parent: parent2 },
      variables: { id: "1" },
    });
    cache.write({
      dataId: "ROOT_QUERY",
      query: doc,
      result: { parent: parent3 },
      variables: { id: "1" },
    });
    expect(calls.length).toBe(3);
    expect(calls[1][0].result.items).toEqual(["a", "b", "c"]);
    expect(calls[2][0].result.items).toEqual(["a"]);
  });

  // overlapping fragments both fire
  test("notifies both overlapping fragments when a shared field changes", () => {
    const doc: DocumentNode = gql`
      query ($id: ID!) {
        item(id: $id) {
          ...AFrag
          ...BFrag
        }
      }
      fragment AFrag on Foo {
        id
        foo
      }
      fragment BFrag on Foo {
        foo
      }
    `;
    const fragmentsDoc: DocumentNode = {
      kind: "Document",
      definitions: doc.definitions.filter(
        (d) => d.kind === "FragmentDefinition",
      ),
    };
    const cache = new ForestRun();
    const callsA: Array<[any, any]> = [];
    const callsB: Array<[any, any]> = [];
    const foo1 = { __typename: "Foo", id: "1", foo: "first" };
    const foo2 = { __typename: "Foo", id: "1", foo: "second" };
    const id = cache.identify(foo1);

    cache.watch({
      query: cache["getFragmentDoc"](fragmentsDoc, "AFrag"),
      id,
      callback: (diff, lastDiff) => callsA.push([diff, lastDiff]),
      optimistic: true,
    });
    cache.watch({
      query: cache["getFragmentDoc"](fragmentsDoc, "BFrag"),
      id,
      callback: (diff, lastDiff) => callsB.push([diff, lastDiff]),
      optimistic: true,
    });
    cache.write({
      dataId: "ROOT_QUERY",
      query: doc,
      result: { item: foo1 },
      variables: { id: "1" },
    });
    cache.write({
      dataId: "ROOT_QUERY",
      query: doc,
      result: { item: foo2 },
      variables: { id: "1" },
    });
    expect(callsA.length).toBe(2);
    expect(callsB.length).toBe(2);
    expect(callsA[1][0].result.foo).toBe("second");
    expect(callsB[1][0].result.foo).toBe("second");
  });

  // alias/argument fragment watches
  test("treats fragments with different arguments or aliases as distinct watches", () => {
    const doc: DocumentNode = gql`
      query ($id: ID!, $fooKey: Int!) {
        item(id: $id) {
          ...Frag
        }
      }
      fragment Frag on Foo {
        foo(key: $fooKey)
      }
    `;
    const fragmentDoc: DocumentNode = {
      kind: "Document",
      definitions: doc.definitions.filter(
        (d) => d.kind === "FragmentDefinition",
      ),
    };
    const cache = new ForestRun();
    const calls1: Array<[any, any]> = [];
    const calls2: Array<[any, any]> = [];
    const foo1 = { __typename: "Foo", id: "1", foo: "one" };
    const foo2 = { __typename: "Foo", id: "1", foo: "two" };
    const id = cache.identify(foo1);

    cache.watch({
      query: cache["getFragmentDoc"](fragmentDoc, "Frag"),
      id,
      variables: { fooKey: 1 },
      callback: (diff, lastDiff) => calls1.push([diff, lastDiff]),
      optimistic: true,
    });
    cache.watch({
      query: cache["getFragmentDoc"](fragmentDoc, "Frag"),
      id,
      variables: { fooKey: 2 },
      callback: (diff, lastDiff) => calls2.push([diff, lastDiff]),
      optimistic: true,
    });
    cache.write({
      dataId: "ROOT_QUERY",
      query: doc,
      result: { item: foo1 },
      variables: { id: "1", fooKey: 1 },
    });
    cache.write({
      dataId: "ROOT_QUERY",
      query: doc,
      result: { item: foo2 },
      variables: { id: "1", fooKey: 2 },
    });
    expect(calls1.length).toBe(1);
    expect(calls2.length).toBe(2); // First - with partial data
    expect(calls1[0][0].result.foo).toBe("one");

    expect(calls2[0][0].complete).toBe(false);
    expect(calls2[1][0].result.foo).toBe("two");
  });

  // parent fragment on A with nested child fragment on B should fire when child changes
  test("notifies parent fragment when nested child fragment changes on a different type", () => {
    const doc: DocumentNode = gql`
      query ($aId: ID!) {
        aNode(id: $aId) {
          ...AFrag
        }
      }
      fragment AFrag on A {
        id
        bNode {
          id
          ...BFrag
        }
      }
      fragment BFrag on B {
        value
      }
    `;
    const fragmentsDoc: DocumentNode = {
      kind: "Document",
      definitions: doc.definitions.filter(
        (d) => d.kind === "FragmentDefinition",
      ),
    };
    const cache = new ForestRun();
    const calls: Array<[any, any]> = [];
    const a1 = {
      __typename: "A",
      id: "1",
      bNode: {
        __typename: "B",
        id: "2",
        value: "v1",
      },
    };
    const b2 = {
      __typename: "B",
      id: "2",
      value: "v2",
    };
    const idA = cache.identify(a1);
    if (!idA) throw new Error("Missing id");
    cache.watch({
      query: cache["getFragmentDoc"](fragmentsDoc, "AFrag"),
      id: idA,
      callback: (diff, lastDiff) => calls.push([diff, lastDiff]),
      optimistic: true,
    });
    cache.write({
      dataId: "ROOT_QUERY",
      query: doc,
      result: { aNode: a1 },
      variables: { aId: "1" },
    });
    cache.write({
      dataId: "ROOT_QUERY",
      query: gql`
        query ($bId: ID!) {
          bNode(id: $bId) {
            id
            value
          }
        }
      `,
      result: { bNode: b2 },
      variables: { bId: "2" },
    });
    expect(calls.length).toBe(2);
    expect((calls[1][0] as any).result.bNode.value).toBe("v2");
  });
});
