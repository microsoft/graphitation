import { FieldNode, OperationDefinitionNode, parse, print } from "graphql";
import type {
  DocumentDescriptor,
  PossibleSelections,
  PossibleTypes,
  PossibleSelection,
  ResultTreeDescriptor,
} from "../types";
import {
  collectSubFields,
  describeResultTree,
  createFieldGroup,
  Context,
} from "../possibleSelection";
import { describeDocument } from "../document";
import { assert } from "../../jsutils/assert";

const commonSelectionKey = null;

describe(describeResultTree, () => {
  it("correctly assigns depth levels to nested selections", () => {
    const possible = testHelper(
      `{
        foo {
          bar {
            ...Bar
          }
        }
      }
      fragment Bar on Bar {
        nested {
          baz
        }
      }`,
    );
    const root = possible.get(null);
    const foo = root?.fields.get("foo")?.[0]?.selection?.get(null);
    const bar = foo?.fields.get("bar")?.[0]?.selection?.get("Bar");
    const nested = bar?.fields.get("nested")?.[0]?.selection?.get(null);

    expect(root?.depth).toEqual(0);
    expect(foo?.depth).toEqual(1);
    expect(bar?.depth).toEqual(2);
    expect(nested?.depth).toEqual(3);
  });

  it("collects fields from nested fragment spreads within field selections", () => {
    const possible = testHelper(
      `{
        foo {
          bar {
            ...BarFragment
          }
        }
      }
      fragment BarFragment on Bar {
        nested
        baz
      }`,
    );
    const foo = possible?.get(null)?.fields.get("foo")?.[0];
    const bar = foo?.selection?.get(null)?.fields.get("bar")?.[0];

    expect(printPossibleSelections(possible)).toEqual({
      null: { fields: ["foo"], fieldsWithSelections: ["foo"] },
    });
    expect(printPossibleSelections(foo?.selection)).toEqual({
      null: { fields: ["bar"], fieldsWithSelections: ["bar"] },
    });
    expect(printPossibleSelections(bar?.selection)).toMatchObject({
      null: { fields: [] },
      Bar: { fields: ["nested", "baz"] },
    });
  });

  it("handles recursive fragment spreads without infinite recursion", () => {
    const possible = testHelper(
      `{ ...Foo1 ...Foo2 }

      fragment Foo1 on Foo {
        bar {
          ...Bar1
        }
      }
      fragment Foo2 on Foo {
        bar {
          baz
          ...Bar2
        }
      }
      fragment Bar1 on Bar {
        __typename
        ...Bar2
      }
      fragment Bar2 on Bar {
        baz
        ...Bar1 @include(if: $variable)
      }
      `,
    );
    expect(printPossibleSelections(possible)).toEqual({
      null: { fields: [] },
      Foo: {
        fields: ["bar"],
        fieldsWithSelections: ["bar"],
        spreads: ["Foo1", "Foo2"],
      },
    });
    expect(printSelectedIn(possible.get("Foo"))).toEqual({
      fields: {
        bar: ["Foo1", "Foo2"],
      },
      spreads: {
        Foo1: [true],
        Foo2: [true],
      },
    });
    const bar = possible.get("Foo")?.fields.get("bar");
    expect(printPossibleSelections(bar?.[0]?.selection)).toEqual({
      null: { fields: ["baz"] },
      Bar: {
        fields: ["__typename", "baz"],
        fieldsToNormalize: ["__typename", "baz"], // TODO: verify if this is correct
        spreads: ["Bar1", "Bar2"],
      },
    });
    expect(printSelectedIn(bar?.[0]?.selection?.get(null))).toEqual({
      fields: {
        baz: ["Foo2"],
      },
      spreads: {}, // spreads do not exist on untyped selection by their nature
    });
    expect(printSelectedIn(bar?.[0]?.selection?.get("Bar"))).toEqual({
      fields: {
        __typename: ["Bar1"],
        baz: ["Bar2", "Foo2"],
      },
      spreads: {
        Bar1: ["Foo1", "Bar2"],
        Bar2: ["Bar1", "Foo2"],
      },
    });
  });

  it("merges overlapping fragments into unified field selections", () => {
    const possible = testHelper(`
      query Query {
        entry(id: "foo") {
          id
          foo { ...Foo }
        }
      }
      fragment Foo on Foo {
        bar {
          ...Bar
          baz {
            id
            fooBarOverflow { leaf }
          }
        }
      }
      fragment Bar on Bar {
        baz { ...Baz }
      }
      fragment Baz on Baz {
        fooBarOverflow {
          id
          exit { __typename }
        }
      }
    `);

    const common = possible.get(commonSelectionKey);
    const entry = common?.fields.get("entry")?.[0];
    const foo = entry?.selection
      ?.get(commonSelectionKey)
      ?.fields.get("foo")?.[0];

    // Sanity check
    expect(printFieldEntries(foo?.selection)).toEqual({
      Foo: {
        bar: ["bar { ...Bar baz { id fooBarOverflow { leaf } } }"],
      },
      null: {},
    });

    const bar = foo?.selection?.get("Foo")?.fields.get("bar")?.[0];
    expect(printFieldEntries(bar?.selection)).toEqual({
      Bar: {
        baz: ["baz { ...Baz }", "baz { id fooBarOverflow { leaf } }"],
      },
      null: {
        baz: ["baz { id fooBarOverflow { leaf } }"],
      },
    });

    const baz = bar?.selection?.get("Bar")?.fields.get("baz")?.[0];
    expect(printFieldEntries(baz?.selection)).toEqual({
      Baz: {
        id: ["id"],
        fooBarOverflow: [
          "fooBarOverflow { id exit { __typename } }", // From Baz fragment
          "fooBarOverflow { leaf }",
        ],
      },
      null: {
        id: ["id"],
        fooBarOverflow: ["fooBarOverflow { leaf }"],
      },
    });
    const fooBarOverflow = baz?.selection
      ?.get("Baz")
      ?.fields.get("fooBarOverflow")?.[0];
    expect(printFieldEntries(fooBarOverflow?.selection)).toEqual({
      null: {
        id: ["id"],
        leaf: ["leaf"],
        exit: ["exit { __typename }"],
      },
    });

    // Ensure fieldsWithSelections are properly merged as well
    expect(printPossibleSelections(possible)).toEqual({
      null: {
        fields: ["entry"],
        fieldsToNormalize: ["entry"],
        fieldsWithSelections: ["entry"],
      },
    });
    expect(printPossibleSelections(entry?.selection)).toEqual({
      null: { fields: ["id", "foo"], fieldsWithSelections: ["foo"] },
    });
    expect(printPossibleSelections(foo?.selection)).toEqual({
      Foo: {
        fields: ["bar"],
        fieldsWithSelections: ["bar"],
        spreads: ["Foo"],
      },
      null: { fields: [] },
    });
    expect(printPossibleSelections(bar?.selection)).toEqual({
      null: { fields: ["baz"], fieldsWithSelections: ["baz"] },
      Bar: {
        fields: ["baz"],
        fieldsWithSelections: ["baz"],
        spreads: ["Bar"],
      },
    });
    expect(printPossibleSelections(baz?.selection)).toEqual({
      null: {
        fields: ["id", "fooBarOverflow"],
        fieldsWithSelections: ["fooBarOverflow"],
      },
      Baz: {
        fields: ["fooBarOverflow", "id"],
        fieldsWithSelections: ["fooBarOverflow"],
        spreads: ["Baz"],
      },
    });
    expect(printPossibleSelections(fooBarOverflow?.selection)).toEqual({
      null: { fields: ["id", "exit", "leaf"], fieldsWithSelections: ["exit"] },
    });
  });

  it("merges nested untyped selections from multiple fragments accurately", () => {
    const query = `
      {
        foo {
          ...Foo1
          bar { ...Bar1 }
        }
      }

      fragment Foo1 on Foo {
        ...Foo2
      }
      fragment Foo2 on Foo {
        bar {
          a
          b { c }
        }
      }
      fragment Bar1 on Bar {
        ...Bar2
      }
      fragment Bar2 on Bar {
        a
        d { e }
      }
    `;

    const possible = testHelper(query);
    const commonSelection = possible?.get(commonSelectionKey);
    const foo = commonSelection?.fields.get("foo")?.[0]?.selection;
    const owningTeam = foo?.get("Foo")?.fields.get("bar")?.[0]?.selection;

    expect(printFieldGroups(owningTeam?.get("Bar"))).toEqual({
      a: ["a", "a"],
      b: ["b { c }"],
      d: ["d { e }"],
    });
  });

  it("tracks where each field is selected", () => {
    const possible = testHelper(`
      {
        foo
        ... on Bar { bar }
        ...Foo1
        ...Bar1
      }
      fragment Foo1 on Foo {
         foo
         ...Foo2
      }
      fragment Foo2 on Foo {
        foo
        baz
        ...Bar1
      }
      fragment Bar1 on Bar {
        bar
      }
    `);
    const common = possible?.get(commonSelectionKey);
    const onFoo = possible?.get("Foo");
    const onBar = possible?.get("Bar");

    expect(possible?.size).toEqual(3);
    expect(printSelectedIn(common)).toEqual({
      fields: {
        foo: [true],
      },
      spreads: {},
    });
    expect(printSelectedIn(onFoo)).toEqual({
      fields: {
        baz: ["Foo2"],
        foo: ["Foo1", "Foo2", true],
      },
      spreads: {
        Foo1: [true],
        Foo2: ["Foo1"],
        // Bar1: ["Foo2"], // fragment "Bar1" is on type "Bar", so it shouldn't be included in selection on type "Foo"
      },
    });
    expect(printSelectedIn(onBar)).toEqual({
      fields: {
        bar: [true, "Bar1"],
        foo: [true],
      },
      spreads: {
        Bar1: ["Foo2", true],
      },
    });
  });

  // TODO: track variable usage for every selection
  it("tracks selection spreads", () => {
    const { possibleSelections: possible } = testHelperV2(
      `{
        foo
        ... on Foo { bar }
        ...Foo1
      }
      fragment Foo1 on Foo {
         foo1: foo(option: $foo1)
         ...Foo2 @include(if: $includeFoo2)
      }
      fragment Foo2 on Foo {
        foo2: foo(option: $foo2)
        ...Foo3 @include(if: $includeFoo3)
        some {
          deep @include(if: $includeDeep) {
            ... on Bar {
              field {
                baz @include(if: $includeBaz)
              }
              ...Bar1
            }
          }
        }
      }
      fragment Foo3 on Foo {
        foo3: foo(option: $foo3)
      }
      fragment Bar1 on Bar {
        bar1: bar(option: $bar1)
      }
        `,
    );
    expect(printPossibleSelections(possible)).toEqual({
      null: {
        fields: ["foo"],
      },
      Foo: {
        fields: ["bar", "foo", "some"],
        fieldsToNormalize: ["foo1", "foo2", "foo3", "some"],
        fieldsWithSelections: ["some"],
        spreads: ["Foo1", "Foo2", "Foo3"],
      },
    });
    // expect(Object.fromEntries(fragments.entries())).toEqual({
    //   Foo3: { name: "Foo3", variables: ["foo3"] },
    //   Foo2: ["foo3", "foo2", "includeFoo3", "includeBaz"],
    //   Foo1: [
    //     "foo3",
    //     "foo2",
    //     "includeFoo3",
    //     "includeBaz",
    //     "includeFoo2",
    //     "foo1",
    //   ],
    // });
  });

  describe("for abstract types", () => {
    it("includes common fields in all possible selections for abstract types", () => {
      const possible = testHelper(
        `{
        commonField1
        commonField2
        ...Foo
        ... on Bar { bar }
        ... on Baz { baz }
      }
      fragment Foo on Foo {
        foo
      }`,
      );
      expect(printPossibleSelections(possible)).toMatchObject({
        null: { fields: ["commonField1", "commonField2"] },
        Foo: {
          fields: ["foo", "commonField1", "commonField2"],
        },
        Bar: { fields: ["bar", "commonField1", "commonField2"] },
        Baz: { fields: ["baz", "commonField1", "commonField2"] },
      });
    });

    it("adds interface fields to selections of implementing types", () => {
      const possibleTypes = {
        MyInterface: ["Foo", "Bar"],
      };
      const possible = testHelper(
        `{
          common
          ...MyIface
          ...Foo
          ... on Bar { bar }
        }
        fragment Foo on Foo {
          foo
        }
        fragment MyIface on MyInterface { iface }`,
        possibleTypes,
      );
      expect(printPossibleSelections(possible)).toEqual({
        null: { fields: ["common"] },
        MyInterface: { fields: ["iface"], spreads: ["MyIface"] },
        Foo: {
          fields: ["foo", "common", "iface"],
          spreads: ["Foo", "MyIface"],
        },
        Bar: {
          fields: ["bar", "common", "iface"],
          spreads: ["MyIface"],
        },
      });
    });

    // TODO: this currently requires proper `possibleTypes` to be passed, which seems unnecessary
    it.skip("propagates __typename to nested selections when present in parent", () => {
      const possible = testHelper(
        `{ ...FragmentOnUnion }

        fragment FragmentOnUnion on UnionType {
          __typename
          ... on UnionMemberType {
            foo
          }
        }`,
      );

      expect(printFieldEntries(possible)).toEqual({
        null: {},
        UnionMemberType: {
          __typename: ["__typename"],
          foo: ["foo"],
        },
        UnionType: {
          __typename: ["__typename"],
        },
      });
    });

    // Note: we cannot rely on inference for abstract type detection because it is possible to spread fragments
    //   of abstract types *into* concrete types (not just the other way around)
    it.skip("infers possible concrete types from abstract parent spreads", () => {
      const possible = testHelper(
        `{
          ...Foo1
          ...Foo2
          ...Foo3
          ...Baz
        }
        fragment Foo1 on Foo {
          __typename
        }
        fragment Foo2 on Foo {
          ... on Bar {
            ... on Baz { baz }
          }
        }
        fragment Foo3 on Foo {
          ... on Bar { bar }
        }
        fragment Baz on Baz {
          another: baz
        }`,
      );

      expect(possible.size).toEqual(4);
      expect(printFieldEntries(possible)).toEqual({
        null: {},
        Foo: {
          __typename: ["__typename"],
        },
        Bar: {
          // __typename: ["__typename"], // Since Bar is inferred as an abstract type, we don't merge other selections into it
          bar: ["bar"],
        },
        Baz: {
          __typename: ["__typename"],
          baz: ["baz"],
          "another: baz": ["another: baz"],
          bar: ["bar"],
        },
      });
    });

    it("includes selections for all possible implementations of an interface, even if not explicitly specified", () => {
      // Note: this is for perf, so that we didn't have to repeatedly search for interface selection by typename at runtime
      const possibleTypes = {
        MyInterface: ["Foo", "Bar"],
      };
      const possible = testHelper(
        `{
          common
          ...MyIface
        }
        fragment MyIface on MyInterface { iface }
        `,
        possibleTypes,
      );

      const common = possible?.get(commonSelectionKey);
      const onMyInterface = possible?.get("MyInterface");
      const onFoo = possible?.get("Foo");
      const onBar = possible?.get("Bar");

      expect(possible?.size).toEqual(4);
      expect(printFieldGroups(common)).toEqual({
        common: ["common"],
      });
      expect(printFieldGroups(onMyInterface)).toEqual({
        iface: ["iface"],
      });
      expect(printFieldGroups(onFoo)).toEqual({
        common: ["common"],
        iface: ["iface"],
      });
      expect(printFieldGroups(onBar)).toEqual({
        common: ["common"],
        iface: ["iface"],
      });

      expect(printPossibleSelections(possible)).toEqual({
        null: { fields: ["common"] },
        MyInterface: { fields: ["iface"], spreads: ["MyIface"] },
        Foo: { fields: ["iface", "common"], spreads: ["MyIface"] },
        Bar: { fields: ["iface", "common"], spreads: ["MyIface"] },
      });
    });

    it("infers possible types for abstract types when possibleTypes is undefined", () => {
      const possible = testHelper(
        `{
          search {
            ... on User {
              id
              name
            }
            ... on Post {
              id
              title
            }
          }
        }`,
      );
      const search = possible
        .get(commonSelectionKey)
        ?.fields.get("search")?.[0];
      expect(printPossibleSelections(search?.selection)).toEqual({
        null: { fields: [] },
        User: { fields: ["id", "name"] },
        Post: { fields: ["id", "title"] },
      });
    });
  });

  function testHelper(
    operation: string,
    possibleTypes?: PossibleTypes,
  ): PossibleSelections {
    return describeResultTree(describeDocument(parse(operation)), possibleTypes)
      .possibleSelections;
  }

  function testHelperV2(
    operation: string,
    possibleTypes?: PossibleTypes,
  ): ResultTreeDescriptor {
    return describeResultTree(
      describeDocument(parse(operation)),
      possibleTypes,
    );
  }
});

describe(collectSubFields, () => {
  it("does not create selections for leaf fields", () => {
    const possibleSelections = testHelper(["test", "test"]);
    expect(possibleSelections).toEqual(undefined);
  });

  it("creates a selection when the field group contains only __typename", () => {
    const possibleSelections = testHelper([
      `test { __typename }`,
      `test { __typename }`,
    ]);
    expect(possibleSelections?.size).toEqual(1);
    expect(printFieldEntries(possibleSelections)).toEqual({
      null: {
        __typename: ["__typename", "__typename"],
      },
    });
  });

  it("collects subfields correctly for a single field selection", () => {
    const possibleSelections = testHelper([`test { id }`, `test { id }`]);

    expect(possibleSelections?.size).toEqual(1);
    expect(printFieldEntries(possibleSelections)).toEqual({
      null: {
        id: ["id", "id"],
      },
    });
  });

  it("collects fields from an inline fragment without a type condition", () => {
    const possibleSelections = testHelper([
      `test { ... { bar } }`,
      `test { ... { bar } }`,
    ]);
    expect(possibleSelections?.size).toEqual(1);
    expect(printFieldEntries(possibleSelections)).toEqual({
      null: { bar: ["bar", "bar"] },
    });
  });

  it("includes fields annotated with @defer in the possible selections", () => {
    // Note: descriptor returns all possible fields
    // (not necessarily all actually present in the result)
    const possibleSelections = testHelper([
      `test { foo @a }`,
      `test { ... @defer { foo @b } }`,
      `test { ... @defer(if: true) { bar } }`,
      `test { ... @defer(if: false) { baz @a } }`,
      `test { ... @defer(if: $variable) { baz @b } }`,
    ]);
    expect(printFieldEntries(possibleSelections)).toEqual({
      null: {
        foo: ["foo @a", "foo @b"],
        bar: ["bar"],
        baz: ["baz @a", "baz @b"],
      },
    });
  });

  it("ignores @defer when `if` argument is falsy", () => {
    const possibleSelections = testHelper([
      `test { foo }`,
      `test { ... @defer(if: false) { foo @a } }`,
      `test { ... @defer(if: $defer) { foo @b } }`,
    ]);
    expect(possibleSelections?.size).toEqual(1);
    expect(printFieldEntries(possibleSelections)).toEqual({
      null: {
        foo: ["foo", "foo @a", "foo @b"],
      },
    });
  });

  it("groups fields by alias and then by name during subfield collection", () => {
    const result = testHelper([
      `test { bar @a }`,
      `test { bar @b }`,
      `test { baz: bar }`,
    ]);
    expect(result?.size).toEqual(1);
    expect(printFieldEntries(result)).toEqual({
      null: {
        bar: ["bar @a", "bar @b"],
        "baz: bar": ["baz: bar"],
      },
    });
  });

  it("merges fields from inline fragments without type conditions into the parent selection", () => {
    const result = testHelper([
      `test { bar @a }`,
      `test { ... { bar @b } }`,
      `test { ... { baz } }`,
    ]);

    expect(result?.size).toEqual(1);
    expect(printFieldEntries(result)).toEqual({
      null: {
        bar: ["bar @a", "bar @b"],
        baz: ["baz"],
      },
    });
  });

  it("creates separate possible selections for each type condition in inline fragments", () => {
    const field = `
      test {
        ... on Bar { bar }
        ... on Baz { baz }
      }
    `;
    const possible = testHelper([field]);
    expect(possible?.size).toEqual(3);
    expect(printFieldEntries(possible)).toEqual({
      null: {},
      Bar: { bar: ["bar"] },
      Baz: { baz: ["baz"] },
    });
  });

  it("merges field selections from fragments, inline fragments, and direct selections", () => {
    const result = testHelper(
      [
        `test { ...Foo }`,
        `test { id bar { leaf } }`,
        `test { ... { __typename } }`,
        `test { ... on Foo { baz { id } } }`,
      ],
      addFragments(
        {},
        `fragment Foo on Foo {
          bar {
            id
            baz { __typename }
          }
        }`,
      ),
    );

    expect(result?.size).toEqual(2);
    expect(printFieldEntries(result)).toEqual({
      null: {
        __typename: ["__typename"],
        bar: ["bar { leaf }"],
        id: ["id"],
      },
      Foo: {
        bar: ["bar { id baz { __typename } }"],
        baz: ["baz { id }"],
      },
    });
  });

  it("excludes fields from abstract parent types in subfield collection", () => {
    // Deviation from spec: fields of abstract types are merged via describeResultTree
    //   here we only collect specific fields by type
    const result = testHelper(
      [
        `test { ...Foo1 }`,
        `test { ...Foo2 }`,
        `test { ...Foo3 }`,
        `test { ...Baz }`,
      ],
      addFragments(
        {},
        `fragment Foo1 on Foo {
          __typename
        }
        fragment Foo2 on Foo {
          ... on Bar {
            ... on Baz { baz }
          }
        }
        fragment Foo3 on Foo {
          ... on Bar { bar }
        }
        fragment Baz on Baz {
          another: baz
        }`,
      ),
    );

    expect(result?.size).toEqual(4);
    expect(printFieldEntries(result)).toEqual({
      null: {},
      Foo: {
        __typename: ["__typename"],
      },
      Bar: {
        // __typename: ["__typename"],
        bar: ["bar"],
      },
      Baz: {
        // __typename: ["__typename"],
        baz: ["baz"],
        "another: baz": ["another: baz"],
        // bar: ["bar"],
      },
    });
  });

  it("includes fields with custom directives in the selections", () => {
    const possible = testHelper([
      `test { items @cache(maxAge: 60) { id, name } }`,
    ]);

    const selection = possible?.get(commonSelectionKey);
    expect(printFieldGroups(selection)).toEqual({
      items: ["items @cache(maxAge: 60) { id name }"],
    });
  });

  it("differentiates between fields queried with different arguments", () => {
    const possible = testHelper([
      `test { items(limit: 5) { id } }`,
      `test { items(limit: 10) { id, name } }`,
    ]);

    expect(possible?.size).toEqual(1);
    const selection = possible?.get(commonSelectionKey);
    expect(printFieldGroups(selection)).toEqual({
      items: ["items(limit: 5) { id }", "items(limit: 10) { id name }"],
    });
  });

  it("handles fields with variable arguments correctly", () => {
    const possible = testHelper([
      `test { items(limit: $limit) { id } }`,
      `test { items(limit: 10) { id, name } }`,
    ]);

    expect(possible?.size).toEqual(1);
    const selection = possible?.get(commonSelectionKey);
    expect(printFieldGroups(selection)).toEqual({
      items: ["items(limit: $limit) { id }", "items(limit: 10) { id name }"],
    });
  });

  it("handles aliased fields with different arguments accurately", () => {
    const possible = testHelper([
      `test { recentItems: items(limit: 5) { id } }`,
      `test { allItems: items { id, name } }`,
    ]);

    expect(possible?.size).toEqual(1);
    const selection = possible?.get(commonSelectionKey);
    expect(printFieldGroups(selection)).toEqual({
      "recentItems: items": ["recentItems: items(limit: 5) { id }"],
      "allItems: items": ["allItems: items { id name }"],
    });
  });

  it("merges overlapping fragments selecting the same field", () => {
    const possible = testHelper(
      [
        "test { ...Fragment1 }",
        "test { ...Fragment2 }",
        "test { ...Fragment3 }",
      ],
      addFragments(
        {},
        `fragment Fragment1 on Test {
            alias: items(limit: 5) { id }
          }
          fragment Fragment2 on Test {
            items(limit: 10) { id, foo }
          }
          fragment Fragment3 on Test {
            items(limit: 10) { id, bar }
          }`,
      ),
    );

    const selection = possible?.get("Test");
    expect(possible?.size).toEqual(2);
    expect(printFieldGroups(selection)).toEqual({
      "alias: items": ["alias: items(limit: 5) { id }"],
      items: ["items(limit: 10) { id foo }", "items(limit: 10) { id bar }"],
    });
  });

  describe("with @include and @skip directives", () => {
    it("omits fields directly skipped by a literal @skip directive", () => {
      const possibleSelections = testHelper([
        "test { foo @skip }",
        "test { bar @skip(if: true) }",
        "test { baz @include(if: false) }",
      ]);
      const selections = possibleSelections?.get(commonSelectionKey);

      expect(possibleSelections?.size).toEqual(1);
      expect(selections?.fields.size).toEqual(0);
    });

    it("omits inline fragments directly skipped by a literal @skip directive", () => {
      const possibleSelections = testHelper([
        "test { ... on Foo @skip { foo } }",
        "test { ... on Foo @skip(if: true) { bar } }",
        "test { ... @include(if: false) { baz } }",
      ]);
      const selections = possibleSelections?.get(commonSelectionKey);

      expect(possibleSelections?.size).toEqual(1);
      expect(selections?.fields.size).toEqual(0);
    });

    it("omits fragment spreads directly skipped by a literal @skip directive", () => {
      const possibleSelections = testHelper(
        [
          "test { ...Foo @skip }",
          "test { ...Foo @skip(if: true) }",
          "test { ...Foo @include(if: false) }",
        ],
        addFragments({}, `fragment Foo on Foo { id }`),
      );
      const selections = possibleSelections?.get(commonSelectionKey);

      expect(possibleSelections?.size).toEqual(1);
      expect(selections?.fields.size).toEqual(0);
    });

    it("excludes fields based on literal @include and @skip directives", () => {
      const possibleSelections = testHelper([
        "test { foo @skip }",
        "test { foo @skip(if: true) }",
        "test { foo @include(if: false) }",
        "test { bar }",
      ]);
      const selection = possibleSelections?.get(commonSelectionKey);

      expect(possibleSelections?.size).toEqual(1);
      expect(printFieldGroups(selection)).toEqual({ bar: ["bar"] });
    });

    it("retains fields with variable @include or @skip directives for runtime evaluation", () => {
      const possibleSelections = testHelper([
        "test { foo @skip(if: $skipVariable) }",
        "test { foo @include(if: $includeVariable) }",
        "test { foo }",
      ]);
      const selection = possibleSelections?.get(commonSelectionKey);

      expect(possibleSelections?.size).toEqual(1);
      expect(printFieldGroups(selection)).toEqual({
        foo: [
          "foo @skip(if: $skipVariable)",
          "foo @include(if: $includeVariable)",
          "foo",
        ],
      });
    });

    it("retains inline fragments with variable @include or @skip directives for runtime evaluation", () => {
      const possibleSelections = testHelper([
        "test { ... on Foo @skip(if: $skipVariable) { foo @a } }",
        "test { ... on Foo @include(if: $includeVariable) { foo @b } }",
        "test { bar }",
      ]);
      const foo = possibleSelections?.get("Foo")?.fields.get("foo");

      expect(possibleSelections?.size).toEqual(2);
      expect(printFieldEntries(possibleSelections)).toEqual({
        null: {
          bar: ["bar"],
        },
        Foo: {
          foo: ["foo @a", "foo @b"],
        },
      });
      expect(foo?.length).toEqual(1);
      // expect(foo?.[0].__refs[0]?.spreadNode).toEqual(1);
    });

    it("retains fragment spreads with variable @include or @skip directives for runtime evaluation", () => {
      const possibleSelections = testHelper(
        [
          "test { ...Foo1 @skip(if: $skipVariable) }",
          "test { ...Foo2 @include(if: $includeVariable) }",
        ],
        addFragments(
          {},
          `fragment Foo1 on Foo { bar @a }
           fragment Foo2 on Foo { bar @b }`,
        ),
      );
      expect(printFieldEntries(possibleSelections)).toEqual({
        null: {},
        Foo: {
          bar: ["bar @a", "bar @b"],
        },
      });
    });
  });

  describe("with experimental fragment aliases", () => {
    it("places non-conflicting fields from aliased fragments into sub-selections", () => {
      const possibleSelections = testHelper(
        ['test { ...Foo1 @alias(as: "foo") }', "test { ...Foo2 }"],
        addFragments(
          {},
          `fragment Foo1 on Foo { foo, bar }
           fragment Foo2 on Foo { baz }`,
        ),
      );
      const fooAlias = possibleSelections
        ?.get("Foo")
        ?.experimentalAliasedFragments?.get("foo");

      expect(possibleSelections?.size).toEqual(2);
      expect(printFieldEntries(possibleSelections)).toEqual({
        null: {},
        Foo: {
          baz: ["baz"],
        },
      });
      expect(printFieldGroups(fooAlias)).toEqual({
        foo: ["foo"],
        bar: ["bar"],
      });
    });

    it("handles conflicting fields by copying them into separate sub-selections for aliased fragments", () => {
      const possibleSelections = testHelper(
        ['test { ...Foo1 @alias(as: "foo") }', "test { ...Foo2 }"],
        addFragments(
          {},
          `fragment Foo1 on Foo { bar @a }
           fragment Foo2 on Foo { bar @b }`,
        ),
      );
      const selection = possibleSelections?.get(commonSelectionKey);
      const byFooTye = possibleSelections?.get("Foo");
      const fooAlias = byFooTye?.experimentalAliasedFragments?.get("foo");

      expect(possibleSelections?.size).toEqual(2);
      expect(printFieldGroups(selection)).toEqual({});
      expect(printFieldGroups(byFooTye)).toEqual({
        bar: ["bar @b"],
      });
      expect(printFieldGroups(fooAlias)).toEqual({
        bar: ["bar @a"],
      });
    });
  });

  type HelperArgs = Partial<DocumentDescriptor> & {
    possibleTypes?: Record<string, string[]>;
  };

  function testHelper(fields: string[], op: HelperArgs = {}) {
    const fieldUsages = fields.map((field) => ({
      node: (parse(`{ ${field} }`).definitions[0] as OperationDefinitionNode)
        .selectionSet.selections[0] as FieldNode,
      ancestors: [],
    }));
    const fieldInfo = createFieldGroup(fieldUsages[0].node);
    fieldInfo.__refs = fieldUsages;

    const context: Context = {
      fragmentMap: op.fragmentMap ?? new Map(),
      possibleTypes: op.possibleTypes,
      inferredPossibleTypes: {},
      fieldsWithArgs: [],
      mergeMemo: new Map(),
      copyOnWrite: new Set(),
      // fragments: new Map(),
    };
    return collectSubFields(context, fieldInfo);
  }

  function addFragments(obj: Partial<DocumentDescriptor>, fragments: string) {
    if (!obj.fragmentMap) {
      obj.fragmentMap = new Map();
    }
    const tmp = parse(fragments);
    for (const fragment of tmp.definitions) {
      if (fragment.kind === "FragmentDefinition") {
        obj.fragmentMap.set(fragment.name.value, fragment);
      }
    }
    return obj;
  }
});

function printPossibleSelections(selection: PossibleSelections | undefined) {
  return selection
    ? Object.fromEntries(
        [...selection.entries()].map(([type, selection]) => [
          String(type),
          // Note: using stringify/parse just to get rid of keys with undefined values
          JSON.parse(
            JSON.stringify({
              fields: [...selection.fields.keys()],
              fieldsWithSelections: selection.fieldsWithSelections,
              fieldsToNormalize: selection.fieldsToNormalize?.map(
                (f) => f.alias ?? f.name,
              ),
              spreads: selection.spreads?.size
                ? [...selection.spreads.keys()]
                : undefined,
            }),
          ),
        ]),
      )
    : {};
}

function printSelectedIn(selection: PossibleSelection | undefined) {
  return {
    fields: printFieldGroups(selection, true),
    spreads: printSpreadGroups(selection, true),
  };
}

function printFieldEntries(selection: PossibleSelections | undefined) {
  return selection
    ? Object.fromEntries(
        [...selection.entries()].map(([type, selection]) => [
          String(type),
          printFieldGroups(selection),
        ]),
      )
    : {};
}

function printFieldGroups(
  selection: PossibleSelection | undefined,
  printSelectedIn = false,
) {
  const fields: Record<string, unknown> = {};
  for (const [fieldName, fieldAliases] of selection?.fields.entries() ?? []) {
    for (const fieldInfo of fieldAliases) {
      assert(fieldInfo.name === fieldName);
      const debugKey = fieldInfo.alias
        ? `${fieldInfo.alias}: ${fieldInfo.name}`
        : fieldInfo.name;

      if (printSelectedIn) {
        fields[debugKey] = fieldInfo.selectedIn;
      } else {
        fields[debugKey] = (fieldInfo?.__refs ?? []).map((usage) =>
          print(usage.node).replace(/[\s\n]+/g, " "),
        );
      }
    }
  }
  return fields;
}

function printSpreadGroups(
  selection: PossibleSelection | undefined,
  printSelectedIn = false,
) {
  const spreads: Record<string, unknown> = {};
  for (const [name, spreadAliases] of selection?.spreads?.entries() ?? []) {
    for (const spreadInfo of spreadAliases) {
      assert(spreadInfo.name === name);
      const debugKey = spreadInfo.alias
        ? `${spreadInfo.alias}: ${spreadInfo.name}`
        : spreadInfo.name;

      if (printSelectedIn) {
        spreads[debugKey] = spreadInfo.selectedIn;
      } else {
        spreads[debugKey] = (spreadInfo?.__refs ?? []).map((usage) =>
          print(usage.node).replace(/[\s\n]+/g, " "),
        );
      }
    }
  }
  return spreads;
}
