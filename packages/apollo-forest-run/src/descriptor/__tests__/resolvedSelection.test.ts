import {
  createTestOperation,
  getFieldInfo,
} from "../../__tests__/helpers/descriptor";
import { assert } from "../../jsutils/assert";
import {
  resolveSelection,
  resolvedSelectionsAreEqual,
  fieldEntriesAreEqual,
} from "../resolvedSelection";
import { Key, KeySpecifier, NormalizedFieldEntry } from "../types";

describe(resolveSelection, () => {
  it("keeps original static selection for operations without variables", () => {
    const query = "{ foo }";
    const variables = {};
    const operation = createTestOperation(query, variables);
    const staticSelection = operation.possibleSelections.get(null);

    const resolvedSelection = resolveSelection(
      operation,
      operation.possibleSelections,
      null,
    );

    expect(resolvedSelection).toBe(staticSelection);
  });

  it("normalizes fields for provided variables", () => {
    const query = "query ($arg: String) { foo(arg: $arg) }";
    const variables = { arg: "test" };
    const operation = createTestOperation(query, variables);
    const staticSelection = operation.possibleSelections.get(null);
    const fooField = staticSelection?.fields.get("foo")?.[0];
    assert(fooField); // sanity-check

    const resolvedSelection = resolveSelection(
      operation,
      operation.possibleSelections,
      null,
    );

    expect(resolvedSelection.normalizedFields?.size).toEqual(1);
    expect(resolvedSelection.normalizedFields?.get(fooField)).toEqual({
      name: "foo",
      args: new Map([["arg", "test"]]),
    });
  });

  it("resolves @include directive", () => {
    const query = `
      query ($includeFoo: Boolean!, $includeBar: Boolean!) {
        foo @include(if: $includeFoo)
        bar @include(if: $includeBar)
      }
    `;
    const variables = { includeFoo: false, includeBar: true };
    const operation = createTestOperation(query, variables);
    const staticSelection = operation.possibleSelections.get(null);
    const fooField = staticSelection?.fields.get("foo")?.[0];
    assert(fooField); // sanity-check

    const resolvedSelection = resolveSelection(
      operation,
      operation.possibleSelections,
      null,
    );

    expect(resolvedSelection.skippedFields).toEqual(new Set([fooField]));
  });

  it("resolves @skip directive", () => {
    const query = `
      query ($skipFoo: Boolean!, $skipBar: Boolean!) {
        foo @skip(if: $skipFoo)
        bar @skip(if: $skipBar)
      }
    `;
    const variables = { skipFoo: true, skipBar: false };
    const operation = createTestOperation(query, variables);
    const staticSelection = operation.possibleSelections.get(null);
    const fooField = staticSelection?.fields.get("foo")?.[0];
    assert(fooField); // sanity-check

    const resolvedSelection = resolveSelection(
      operation,
      operation.possibleSelections,
      null,
    );

    expect(resolvedSelection.skippedFields).toEqual(new Set([fooField]));
  });

  it("removes skipped fields from field queue", () => {
    const query = `
      query ($skipBar: Boolean!) {
        foo
        bar @skip(if: $skipBar)
      }
    `;
    const operation = createTestOperation(query, { skipBar: true });
    const staticSelection = operation.possibleSelections.get(null);
    const fooField = staticSelection?.fields.get("foo")?.[0];
    assert(fooField); // sanity-check

    const resolvedSelection = resolveSelection(
      operation,
      operation.possibleSelections,
      null,
    );

    expect(resolvedSelection.fieldQueue).toEqual([fooField]);
  });

  it("keeps fields with @skip(if: false) in field queue", () => {
    const query = `
      query ($skipBar: Boolean!) {
        foo
        bar @skip(if: $skipBar)
      }
    `;
    const operation = createTestOperation(query, { skipBar: false });
    const staticSelection = operation.possibleSelections.get(null);
    assert(staticSelection);

    const resolvedSelection = resolveSelection(
      operation,
      operation.possibleSelections,
      null,
    );

    expect(resolvedSelection.fieldQueue).toBe(staticSelection.fieldQueue);
  });

  it("handles fields with missing nullable variables (sets to null)", () => {
    const query = "query ($arg: String) { foo(arg: $arg) }";
    const variables = {}; // 'arg' is not provided
    const operation = createTestOperation(query, variables);
    const staticSelection = operation.possibleSelections.get(null);
    const fooField = staticSelection?.fields.get("foo")?.[0];
    assert(fooField);

    const resolvedSelection = resolveSelection(
      operation,
      operation.possibleSelections,
      null,
    );

    expect(resolvedSelection.normalizedFields?.size).toEqual(1);
    expect(resolvedSelection.normalizedFields?.get(fooField)).toEqual({
      name: "foo",
      // FIXME: uncomment the following line for spec-compatible behavior
      //  (disabled for Apollo compatibility, which is not spec-compatible)
      // args: new Map([["arg", null]]),
      args: new Map(),
    });
  });

  // TODO: this is currently stricter than Apollo
  it.skip("throws an error when missing a required (non-nullable) variable", () => {
    const query = "query ($arg: String!) { foo(arg: $arg) }";
    const variables = {}; // 'arg' is not provided
    expect(() => {
      createTestOperation(query, variables);
    }).toThrowError(
      'Variable "$arg" of required type "String!" was not provided.',
    );
  });

  it("handles fields with variables set to null", () => {
    const query = "query ($arg: String) { foo(arg: $arg) }";
    const variables = { arg: null };
    const operation = createTestOperation(query, variables);
    const staticSelection = operation.possibleSelections.get(null);
    const fooField = staticSelection?.fields.get("foo")?.[0];
    assert(fooField);

    const resolvedSelection = resolveSelection(
      operation,
      operation.possibleSelections,
      null,
    );

    expect(resolvedSelection.normalizedFields?.size).toEqual(1);
    expect(resolvedSelection.normalizedFields?.get(fooField)).toEqual({
      name: "foo",
      args: new Map([["arg", null]]),
    });
  });

  it("handles operations with multiple variables, some missing", () => {
    const query = `
      query ($includeFoo: Boolean, $arg: String) {
        foo(arg: $arg) @include(if: $includeFoo)
      }
    `;
    const variables = {};
    const operation = createTestOperation(query, variables);
    const staticSelection = operation.possibleSelections.get(null);
    const fooField = staticSelection?.fields.get("foo")?.[0];
    assert(fooField);

    const resolvedSelection = resolveSelection(
      operation,
      operation.possibleSelections,
      null,
    );

    // Undefined variables in @include default to null, which is treated as false
    expect(resolvedSelection.skippedFields?.has(fooField)).toBe(true);
  });

  it("uses default values for variables when not provided", () => {
    const query = 'query ($arg: String = "defaultValue") { foo(arg: $arg) }';
    const variables = {}; // 'arg' is not provided, should use default
    const operation = createTestOperation(query, variables);
    const staticSelection = operation.possibleSelections.get(null);
    const fooField = staticSelection?.fields.get("foo")?.[0];
    assert(fooField);

    const resolvedSelection = resolveSelection(
      operation,
      operation.possibleSelections,
      null,
    );

    expect(resolvedSelection.normalizedFields?.get(fooField)).toEqual({
      name: "foo",
      args: new Map([["arg", "defaultValue"]]),
    });
  });

  it("handles fields with default variable values", () => {
    const query = 'query ($arg: String = "defaultValue") { foo(arg: $arg) }';
    const variables = {}; // 'arg' is not provided, should use default
    const operation = createTestOperation(query, variables);
    const staticSelection = operation.possibleSelections.get(null);
    const fooField = staticSelection?.fields.get("foo")?.[0];
    assert(fooField);

    const resolvedSelection = resolveSelection(
      operation,
      operation.possibleSelections,
      null,
    );

    expect(resolvedSelection.normalizedFields?.size).toEqual(1);
    expect(resolvedSelection.normalizedFields?.get(fooField)).toEqual({
      name: "foo",
      args: new Map([["arg", "defaultValue"]]),
    });
  });

  it("handles fields with variables set to null", () => {
    const query = "query ($arg: String) { foo(arg: $arg) }";
    const variables = { arg: null };
    const operation = createTestOperation(query, variables);
    const staticSelection = operation.possibleSelections.get(null);
    const fooField = staticSelection?.fields.get("foo")?.[0];
    assert(fooField);

    const resolvedSelection = resolveSelection(
      operation,
      operation.possibleSelections,
      null,
    );

    expect(resolvedSelection.normalizedFields?.size).toEqual(1);
    expect(resolvedSelection.normalizedFields?.get(fooField)).toEqual({
      name: "foo",
      args: new Map([["arg", null]]),
    });
  });

  it("handles fields with complex arguments (objects) including variables", () => {
    const query = `
      query ($filter: FilterInput) {
        items(filter: $filter) {
          id
        }
      }
    `;
    const variables = {
      filter: { category: "books", priceRange: { min: 10, max: 50 } },
    };
    const operation = createTestOperation(query, variables);
    const staticSelection = operation.possibleSelections.get(null);
    const itemsField = staticSelection?.fields.get("items")?.[0];
    assert(itemsField);

    const resolvedSelection = resolveSelection(
      operation,
      operation.possibleSelections,
      null,
    );

    expect(resolvedSelection.normalizedFields?.size).toEqual(1);
    expect(resolvedSelection.normalizedFields?.get(itemsField)).toEqual({
      name: "items",
      args: new Map([
        ["filter", { category: "books", priceRange: { min: 10, max: 50 } }],
      ]),
    });
  });

  it("handles fields with aliases", () => {
    const query = "{ myFoo: foo }";
    const variables = {};
    const operation = createTestOperation(query, variables);
    const staticSelection = operation.possibleSelections.get(null);
    const myFooField = staticSelection?.fields.get("foo")?.[0];
    assert(myFooField);

    const resolvedSelection = resolveSelection(
      operation,
      operation.possibleSelections,
      null,
    );

    expect(resolvedSelection.fields.get("foo")).toEqual([myFooField]);
  });

  it("handles fields with custom directives", () => {
    const query = `
      {
        foo @customDirective(arg: "value")
      }
    `;
    const variables = {};
    const operation = createTestOperation(query, variables);
    const staticSelection = operation.possibleSelections.get(null);
    const fooField = staticSelection?.fields.get("foo")?.[0];
    assert(fooField);

    const resolvedSelection = resolveSelection(
      operation,
      operation.possibleSelections,
      null,
    );

    // Custom directives don't affect inclusion unless handled explicitly
    expect(resolvedSelection.fields.get("foo")).toEqual([fooField]);
  });

  it("handles nested selections", () => {
    const query = `
      {
        foo {
          bar {
            baz
          }
        }
      }
    `;
    const variables = {};
    const operation = createTestOperation(query, variables);
    const fooField = operation.possibleSelections
      .get(null)
      ?.fields.get("foo")?.[0];
    assert(fooField);
    const fooSelection = fooField.selection;
    assert(fooSelection);

    const resolvedFooSelection = resolveSelection(
      operation,
      fooSelection,
      null,
    );
    const barField = resolvedFooSelection.fields.get("bar")?.[0];
    assert(barField);
    const barSelection = barField.selection;
    assert(barSelection);

    const resolvedBarSelection = resolveSelection(
      operation,
      barSelection,
      null,
    );
    expect(resolvedBarSelection.fields.has("baz")).toBe(true);
  });

  it("handles inline fragments", () => {
    const query = `
      {
        foo {
          ... on Bar {
            barField
          }
          ... on Baz {
            bazField
          }
        }
      }
    `;
    const variables = {};
    const operation = createTestOperation(query, variables);
    const fooField = operation.possibleSelections
      .get(null)
      ?.fields.get("foo")?.[0];
    assert(fooField);
    const fooSelection = fooField.selection;
    assert(fooSelection);

    const resolvedBarSelection = resolveSelection(
      operation,
      fooSelection,
      "Bar",
    );
    const resolvedBazSelection = resolveSelection(
      operation,
      fooSelection,
      "Baz",
    );

    expect(resolvedBarSelection.fields.has("barField")).toBe(true);
    expect(resolvedBarSelection.fields.has("bazField")).toBe(false);

    expect(resolvedBazSelection.fields.has("bazField")).toBe(true);
    expect(resolvedBazSelection.fields.has("barField")).toBe(false);
  });

  it("handles fields with multiple directives", () => {
    const query = `
      query ($includeFoo: Boolean!, $skipBar: Boolean!) {
        foo @include(if: $includeFoo) @customDeprecated(reason: "old")
        bar @skip(if: $skipBar) @customDirective
      }
    `;
    const variables = { includeFoo: true, skipBar: true };
    const operation = createTestOperation(query, variables);
    const staticSelection = operation.possibleSelections.get(null);
    const fooField = staticSelection?.fields.get("foo")?.[0];
    const barField = staticSelection?.fields.get("bar")?.[0];
    assert(fooField);
    assert(barField);

    const resolvedSelection = resolveSelection(
      operation,
      operation.possibleSelections,
      null,
    );

    expect(resolvedSelection.skippedFields?.has(fooField)).toBe(false);
    expect(resolvedSelection.skippedFields?.has(barField)).toBe(true);
  });

  it("handles operations with multiple variables, some missing", () => {
    const query = `
      query ($includeFoo: Boolean, $arg: String) {
        foo(arg: $arg) @include(if: $includeFoo)
      }
    `;
    const variables = {};
    const operation = createTestOperation(query, variables);
    const staticSelection = operation.possibleSelections.get(null);
    const fooField = staticSelection?.fields.get("foo")?.[0];
    assert(fooField);

    const resolvedSelection = resolveSelection(
      operation,
      operation.possibleSelections,
      null,
    );

    expect(resolvedSelection.skippedFields?.has(fooField)).toBe(true);
  });

  it("handles nested @include/@skip directives", () => {
    const query = `
      query ($includeFoo: Boolean!, $includeBar: Boolean!) {
        foo @include(if: $includeFoo) {
          bar @include(if: $includeBar)
        }
      }
    `;
    const variables = { includeFoo: true, includeBar: false };
    const operation = createTestOperation(query, variables);
    const fooSelection = operation.possibleSelections
      .get(null)
      ?.fields.get("foo")?.[0]?.selection;
    const barField = fooSelection?.get(null)?.fields.get("bar")?.[0];
    assert(fooSelection && barField);

    const resolvedFooSelection = resolveSelection(
      operation,
      fooSelection,
      null,
    );
    expect(resolvedFooSelection.skippedFields?.has(barField)).toBe(true);
  });
});

describe(resolvedSelectionsAreEqual, () => {
  it("returns true for identical selections without variables", () => {
    const query = `
      {
        foo
        bar
      }
    `;
    const operation = createTestOperation(query);
    const resolvedSelectionA = resolveSelection(
      operation,
      operation.possibleSelections,
      null,
    );
    const resolvedSelectionB = resolveSelection(
      operation,
      operation.possibleSelections,
      null,
    );

    expect(
      resolvedSelectionsAreEqual(resolvedSelectionA, resolvedSelectionB),
    ).toBe(true);
  });

  it("returns false for selections with different fields", () => {
    const queryA = `
      {
        foo
        bar
      }
    `;
    const queryB = `
      {
        foo
        baz
      }
    `;
    const operationA = createTestOperation(queryA);
    const operationB = createTestOperation(queryB);
    const resolvedSelectionA = resolveSelection(
      operationA,
      operationA.possibleSelections,
      null,
    );
    const resolvedSelectionB = resolveSelection(
      operationB,
      operationB.possibleSelections,
      null,
    );

    expect(
      resolvedSelectionsAreEqual(resolvedSelectionA, resolvedSelectionB),
    ).toBe(false);
  });

  it("returns false for selections with different directives", () => {
    const queryA = `
      {
        foo @include(if: true)
      }
    `;
    const queryB = `
      {
        foo @include(if: false)
      }
    `;
    const operationA = createTestOperation(queryA);
    const operationB = createTestOperation(queryB);
    const resolvedSelectionA = resolveSelection(
      operationA,
      operationA.possibleSelections,
      null,
    );
    const resolvedSelectionB = resolveSelection(
      operationB,
      operationB.possibleSelections,
      null,
    );

    expect(
      resolvedSelectionsAreEqual(resolvedSelectionA, resolvedSelectionB),
    ).toBe(false);
  });

  it("returns false for selections with variables affecting inclusion", () => {
    const query = `
      query ($includeFoo: Boolean!) {
        foo @include(if: $includeFoo)
      }
    `;
    const operationA = createTestOperation(query, { includeFoo: true });
    const operationB = createTestOperation(query, { includeFoo: false });
    const resolvedSelectionA = resolveSelection(
      operationA,
      operationA.possibleSelections,
      null,
    );
    const resolvedSelectionB = resolveSelection(
      operationB,
      operationB.possibleSelections,
      null,
    );

    expect(
      resolvedSelectionsAreEqual(resolvedSelectionA, resolvedSelectionB),
    ).toBe(false);
  });

  it("returns true for selections with same variables and directives", () => {
    const query = `
      query ($includeFoo: Boolean!) {
        foo @include(if: $includeFoo)
      }
    `;
    const operationA = createTestOperation(query, { includeFoo: true });
    const operationB = createTestOperation(query, { includeFoo: true });
    const resolvedSelectionA = resolveSelection(
      operationA,
      operationA.possibleSelections,
      null,
    );
    const resolvedSelectionB = resolveSelection(
      operationB,
      operationB.possibleSelections,
      null,
    );

    expect(
      resolvedSelectionsAreEqual(resolvedSelectionA, resolvedSelectionB),
    ).toBe(true);
  });

  it("returns false for selections with same fields but different arguments", () => {
    const query = `
      query ($arg: String!) {
        foo(arg: $arg)
      }
    `;
    const operationA = createTestOperation(query, { arg: "value1" });
    const operationB = createTestOperation(query, { arg: "value2" });
    const resolvedSelectionA = resolveSelection(
      operationA,
      operationA.possibleSelections,
      null,
    );
    const resolvedSelectionB = resolveSelection(
      operationB,
      operationB.possibleSelections,
      null,
    );

    expect(
      resolvedSelectionsAreEqual(resolvedSelectionA, resolvedSelectionB),
    ).toBe(false);
  });

  it("returns true for selections with same fields and arguments", () => {
    const query = `
      query ($arg: String!) {
        foo(arg: $arg)
      }
    `;
    const operationA = createTestOperation(query, { arg: "sameValue" });
    const operationB = createTestOperation(query, { arg: "sameValue" });
    const resolvedSelectionA = resolveSelection(
      operationA,
      operationA.possibleSelections,
      null,
    );
    const resolvedSelectionB = resolveSelection(
      operationB,
      operationB.possibleSelections,
      null,
    );

    expect(
      resolvedSelectionsAreEqual(resolvedSelectionA, resolvedSelectionB),
    ).toBe(true);
  });

  it("returns true for nested selections that are equal", () => {
    const query = `
      {
        foo {
          bar
        }
      }
    `;
    const operationA = createTestOperation(query);
    const operationB = createTestOperation(query);
    const resolvedSelectionA = resolveSelection(
      operationA,
      operationA.possibleSelections,
      null,
    );
    const resolvedSelectionB = resolveSelection(
      operationB,
      operationB.possibleSelections,
      null,
    );

    expect(
      resolvedSelectionsAreEqual(resolvedSelectionA, resolvedSelectionB),
    ).toBe(true);
  });

  it("returns false for nested selections that differ", () => {
    const queryA = `
      {
        foo {
          bar
        }
      }
    `;
    const queryB = `
      {
        foo {
          baz
        }
      }
    `;
    const operationA = createTestOperation(queryA);
    const operationB = createTestOperation(queryB);
    const resolvedSelectionA = resolveSelection(
      operationA,
      operationA.possibleSelections,
      null,
    );
    const resolvedSelectionB = resolveSelection(
      operationB,
      operationB.possibleSelections,
      null,
    );

    expect(
      resolvedSelectionsAreEqual(resolvedSelectionA, resolvedSelectionB),
    ).toBe(false);
  });

  it("returns true when comparing a selection to itself", () => {
    const query = `
      {
        foo
      }
    `;
    const operation = createTestOperation(query);
    const resolvedSelection = resolveSelection(
      operation,
      operation.possibleSelections,
      null,
    );

    expect(
      resolvedSelectionsAreEqual(resolvedSelection, resolvedSelection),
    ).toBe(true);
  });

  it("returns false when selections have different skipped fields", () => {
    const query = `
      query ($skipFoo: Boolean!) {
        foo @skip(if: $skipFoo)
        bar
      }
    `;
    const operationA = createTestOperation(query, { skipFoo: true });
    const operationB = createTestOperation(query, { skipFoo: false });
    const resolvedSelectionA = resolveSelection(
      operationA,
      operationA.possibleSelections,
      null,
    );
    const resolvedSelectionB = resolveSelection(
      operationB,
      operationB.possibleSelections,
      null,
    );

    expect(
      resolvedSelectionsAreEqual(resolvedSelectionA, resolvedSelectionB),
    ).toBe(false);
  });

  it("returns true for selections with same alias mapping", () => {
    const query = `
      {
        fooAlias: foo
      }
    `;
    const operationA = createTestOperation(query);
    const operationB = createTestOperation(query);
    const resolvedSelectionA = resolveSelection(
      operationA,
      operationA.possibleSelections,
      null,
    );
    const resolvedSelectionB = resolveSelection(
      operationB,
      operationB.possibleSelections,
      null,
    );

    expect(
      resolvedSelectionsAreEqual(resolvedSelectionA, resolvedSelectionB),
    ).toBe(true);
  });

  it("returns false for selections with different aliases", () => {
    const queryA = `
      {
        fooAlias1: foo
      }
    `;
    const queryB = `
      {
        fooAlias2: foo
      }
    `;
    const operationA = createTestOperation(queryA);
    const operationB = createTestOperation(queryB);
    const resolvedSelectionA = resolveSelection(
      operationA,
      operationA.possibleSelections,
      null,
    );
    const resolvedSelectionB = resolveSelection(
      operationB,
      operationB.possibleSelections,
      null,
    );
    expect(
      resolvedSelectionsAreEqual(resolvedSelectionA, resolvedSelectionB),
    ).toBe(false);
  });

  it("returns true for selections with the same nested fragments", () => {
    const query = `
      {
        ...FooFragment
      }
      fragment FooFragment on Query {
        foo
      }
    `;
    const operationA = createTestOperation(query);
    const operationB = createTestOperation(query);
    const resolvedSelectionA = resolveSelection(
      operationA,
      operationA.possibleSelections,
      null,
    );
    const resolvedSelectionB = resolveSelection(
      operationB,
      operationB.possibleSelections,
      null,
    );

    expect(
      resolvedSelectionsAreEqual(resolvedSelectionA, resolvedSelectionB),
    ).toBe(true);
  });

  it("returns false for selections with different nested fragments", () => {
    const queryA = `
      {
        ...FooFragment
      }
      fragment FooFragment on Query {
        foo
      }
    `;
    const queryB = `
      {
        ...BarFragment
      }
      fragment BarFragment on Query {
        bar
      }
    `;
    const operationA = createTestOperation(queryA);
    const operationB = createTestOperation(queryB);
    const resolvedSelectionA = resolveSelection(
      operationA,
      operationA.possibleSelections,
      null,
    );
    const resolvedSelectionB = resolveSelection(
      operationB,
      operationB.possibleSelections,
      null,
    );

    expect(
      resolvedSelectionsAreEqual(resolvedSelectionA, resolvedSelectionB),
    ).toBe(false);
  });

  it("returns false for selections with same fields but different non-inclusion directives", () => {
    const queryA = `
      {
        foo @customDeprecated(reason: "old")
      }
    `;
    const queryB = `
      {
        foo @customDeprecated(reason: "very old")
      }
    `;
    const operationA = createTestOperation(queryA);
    const operationB = createTestOperation(queryB);
    const resolvedSelectionA = resolveSelection(
      operationA,
      operationA.possibleSelections,
      null,
    );
    const resolvedSelectionB = resolveSelection(
      operationB,
      operationB.possibleSelections,
      null,
    );
    expect(
      resolvedSelectionsAreEqual(resolvedSelectionA, resolvedSelectionB),
    ).toBe(false);
  });

  it("returns false when selections have different arguments due to variables", () => {
    const query = `
      query ($arg: Int!) {
        foo(arg: $arg)
      }
    `;
    const operationA = createTestOperation(query, { arg: 1 });
    const operationB = createTestOperation(query, { arg: 2 });
    const resolvedSelectionA = resolveSelection(
      operationA,
      operationA.possibleSelections,
      null,
    );
    const resolvedSelectionB = resolveSelection(
      operationB,
      operationB.possibleSelections,
      null,
    );

    expect(
      resolvedSelectionsAreEqual(resolvedSelectionA, resolvedSelectionB),
    ).toBe(false);
  });

  it("returns true when selections have the same arguments resolved from variables", () => {
    const query = `
      query ($arg: Int!) {
        foo(arg: $arg)
      }
    `;
    const operationA = createTestOperation(query, { arg: 1 });
    const operationB = createTestOperation(query, { arg: 1 });
    const resolvedSelectionA = resolveSelection(
      operationA,
      operationA.possibleSelections,
      null,
    );
    const resolvedSelectionB = resolveSelection(
      operationB,
      operationB.possibleSelections,
      null,
    );

    expect(
      resolvedSelectionsAreEqual(resolvedSelectionA, resolvedSelectionB),
    ).toBe(true);
  });
  // --- Cross-operation comparisons (different documents, structurally equal) ---

  describe("cross-operation: different documents with identical selections", () => {
    it("returns true for same flat fields from different documents", () => {
      const opA = createTestOperation("query A { foo bar }");
      const opB = createTestOperation("query B { foo bar }");
      const selA = resolveSelection(opA, opA.possibleSelections, null);
      const selB = resolveSelection(opB, opB.possibleSelections, null);

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(true);
    });

    it("returns true for same nested fields from different documents", () => {
      const opA = createTestOperation("query A { foo { bar baz } }");
      const opB = createTestOperation("query B { foo { bar baz } }");
      const selA = resolveSelection(opA, opA.possibleSelections, null);
      const selB = resolveSelection(opB, opB.possibleSelections, null);

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(true);
    });

    it("returns false for different fields from different documents", () => {
      const opA = createTestOperation("query A { foo }");
      const opB = createTestOperation("query B { bar }");
      const selA = resolveSelection(opA, opA.possibleSelections, null);
      const selB = resolveSelection(opB, opB.possibleSelections, null);

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(false);
    });

    it("returns true for fragment-spread vs equivalent inline selection", () => {
      const opA = createTestOperation(`
        query A {
          ...F
        }
        fragment F on Query {
          foo
          bar
        }
      `);
      const opB = createTestOperation("query B { foo bar }");
      const selA = resolveSelection(opA, opA.possibleSelections, null);
      const selB = resolveSelection(opB, opB.possibleSelections, null);

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(true);
    });

    it("returns true for same fields with same args from different documents", () => {
      const opA = createTestOperation("query A($x: Int!) { foo(arg: $x) }", {
        x: 42,
      });
      const opB = createTestOperation("query B($x: Int!) { foo(arg: $x) }", {
        x: 42,
      });
      const selA = resolveSelection(opA, opA.possibleSelections, null);
      const selB = resolveSelection(opB, opB.possibleSelections, null);

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(true);
    });

    it("returns false for same fields with different args from different documents", () => {
      const opA = createTestOperation("query A($x: Int!) { foo(arg: $x) }", {
        x: 1,
      });
      const opB = createTestOperation("query B($x: Int!) { foo(arg: $x) }", {
        x: 2,
      });
      const selA = resolveSelection(opA, opA.possibleSelections, null);
      const selB = resolveSelection(opB, opB.possibleSelections, null);

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(false);
    });

    it("returns false when one document has extra fields", () => {
      const opA = createTestOperation("query A { foo bar }");
      const opB = createTestOperation("query B { foo bar baz }");
      const selA = resolveSelection(opA, opA.possibleSelections, null);
      const selB = resolveSelection(opB, opB.possibleSelections, null);

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(false);
    });

    it("returns false for same top-level fields but different nested selections", () => {
      const opA = createTestOperation("query A { foo { bar } }");
      const opB = createTestOperation("query B { foo { baz } }");
      const selA = resolveSelection(opA, opA.possibleSelections, null);
      const selB = resolveSelection(opB, opB.possibleSelections, null);

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(false);
    });

    it("returns true for deeply nested identical selections from different documents", () => {
      const opA = createTestOperation(
        "query A { foo { bar { baz { id name } } } }",
      );
      const opB = createTestOperation(
        "query B { foo { bar { baz { id name } } } }",
      );
      const selA = resolveSelection(opA, opA.possibleSelections, null);
      const selB = resolveSelection(opB, opB.possibleSelections, null);

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(true);
    });

    it("returns true for same inline fragments from different documents", () => {
      const opA = createTestOperation(`
        query A {
          node {
            ... on User { name email }
            ... on Post { title body }
          }
        }
      `);
      const opB = createTestOperation(`
        query B {
          node {
            ... on User { name email }
            ... on Post { title body }
          }
        }
      `);
      const selA = resolveSelection(opA, opA.possibleSelections, null);
      const selB = resolveSelection(opB, opB.possibleSelections, null);

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(true);
    });

    it("returns false for different inline fragment types", () => {
      const opA = createTestOperation(`
        query A {
          node {
            ... on User { name }
          }
        }
      `);
      const opB = createTestOperation(`
        query B {
          node {
            ... on Post { name }
          }
        }
      `);
      const selA = resolveSelection(opA, opA.possibleSelections, null);
      const selB = resolveSelection(opB, opB.possibleSelections, null);

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(false);
    });

    it("returns true for same aliases from different documents", () => {
      const opA = createTestOperation("query A { myFoo: foo myBar: bar }");
      const opB = createTestOperation("query B { myFoo: foo myBar: bar }");
      const selA = resolveSelection(opA, opA.possibleSelections, null);
      const selB = resolveSelection(opB, opB.possibleSelections, null);

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(true);
    });

    it("returns false for different aliases on same fields from different documents", () => {
      const opA = createTestOperation("query A { a: foo }");
      const opB = createTestOperation("query B { b: foo }");
      const selA = resolveSelection(opA, opA.possibleSelections, null);
      const selB = resolveSelection(opB, opB.possibleSelections, null);

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(false);
    });
  });

  // --- Child selection equality (the FIXME: variables affecting nested levels) ---

  describe("cross-operation: child selection differences via variables", () => {
    it("returns false when variables cause different child @include", () => {
      const query = `
        query($inc: Boolean!) {
          foo {
            bar @include(if: $inc)
            baz
          }
        }
      `;
      const opA = createTestOperation(query, { inc: true });
      const opB = createTestOperation(query, { inc: false });
      const selA = resolveSelection(opA, opA.possibleSelections, null);
      const selB = resolveSelection(opB, opB.possibleSelections, null);

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(false);
    });

    it("returns false when variables cause different child @skip", () => {
      const query = `
        query($skip: Boolean!) {
          foo {
            bar @skip(if: $skip)
            baz
          }
        }
      `;
      const opA = createTestOperation(query, { skip: true });
      const opB = createTestOperation(query, { skip: false });
      const selA = resolveSelection(opA, opA.possibleSelections, null);
      const selB = resolveSelection(opB, opB.possibleSelections, null);

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(false);
    });

    it("returns false when variables cause different child field args", () => {
      const query = `
        query($x: Int!) {
          foo {
            bar(arg: $x)
          }
        }
      `;
      const opA = createTestOperation(query, { x: 1 });
      const opB = createTestOperation(query, { x: 2 });
      const selA = resolveSelection(opA, opA.possibleSelections, null);
      const selB = resolveSelection(opB, opB.possibleSelections, null);

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(false);
    });

    it("returns false when variables cause different deeply nested @include", () => {
      const query = `
        query($inc: Boolean!) {
          a {
            b {
              c @include(if: $inc)
            }
          }
        }
      `;
      const opA = createTestOperation(query, { inc: true });
      const opB = createTestOperation(query, { inc: false });
      const selA = resolveSelection(opA, opA.possibleSelections, null);
      const selB = resolveSelection(opB, opB.possibleSelections, null);

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(false);
    });

    it("returns false when variables cause different deeply nested args", () => {
      const query = `
        query($x: String!) {
          a {
            b {
              c(filter: $x)
            }
          }
        }
      `;
      const opA = createTestOperation(query, { x: "active" });
      const opB = createTestOperation(query, { x: "archived" });
      const selA = resolveSelection(opA, opA.possibleSelections, null);
      const selB = resolveSelection(opB, opB.possibleSelections, null);

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(false);
    });

    it("returns true when variables resolve to same child selections", () => {
      const query = `
        query($inc: Boolean!) {
          foo {
            bar @include(if: $inc)
          }
        }
      `;
      const opA = createTestOperation(query, { inc: true });
      const opB = createTestOperation(query, { inc: true });
      const selA = resolveSelection(opA, opA.possibleSelections, null);
      const selB = resolveSelection(opB, opB.possibleSelections, null);

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(true);
    });

    it("returns false when variables differ only at leaf level of nested inline fragments", () => {
      const query = `
        query($inc: Boolean!) {
          node {
            ... on User {
              posts {
                title @include(if: $inc)
                body
              }
            }
          }
        }
      `;
      const opA = createTestOperation(query, { inc: true });
      const opB = createTestOperation(query, { inc: false });
      const selA = resolveSelection(opA, opA.possibleSelections, null);
      const selB = resolveSelection(opB, opB.possibleSelections, null);

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(false);
    });
  });

  // --- Group A: Typed selection basics ---

  describe("typed selections: basics", () => {
    it("returns false comparing null vs typed selection from same op", () => {
      const query = `{ id ... on User { name } }`;
      const op = createTestOperation(query);
      const selNull = resolveSelection(op, op.possibleSelections, null);
      const selUser = resolveSelection(op, op.possibleSelections, "User");

      expect(resolvedSelectionsAreEqual(selNull, selUser)).toBe(false);
    });

    it("returns true for same typed selection resolved twice from same op", () => {
      const query = `{ id ... on User { name } }`;
      const op = createTestOperation(query);
      const selA = resolveSelection(op, op.possibleSelections, "User");
      const selB = resolveSelection(op, op.possibleSelections, "User");

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(true);
    });

    it("returns false comparing different types from same op", () => {
      const query = `{ id ... on User { name } ... on Post { title } }`;
      const op = createTestOperation(query);
      const selUser = resolveSelection(op, op.possibleSelections, "User");
      const selPost = resolveSelection(op, op.possibleSelections, "Post");

      expect(resolvedSelectionsAreEqual(selUser, selPost)).toBe(false);
    });

    it("returns true when unknown type falls back to null selection", () => {
      const query = `{ id ... on User { name } }`;
      const op = createTestOperation(query);
      const selUnknown = resolveSelection(op, op.possibleSelections, "Unknown");
      const selNull = resolveSelection(op, op.possibleSelections, null);

      expect(resolvedSelectionsAreEqual(selUnknown, selNull)).toBe(true);
    });

    it("returns true for merged same-type inline fragments", () => {
      const query = `{ ... on User { name } ... on User { age } }`;
      const op = createTestOperation(query);
      const sel = resolveSelection(op, op.possibleSelections, "User");

      expect(resolvedSelectionsAreEqual(sel, sel)).toBe(true);
    });
  });

  // --- Group B: Typed selections with variables ---

  describe("typed selections: variables", () => {
    it("returns false for typed @skip with different variables", () => {
      const query = `
        query ($skip: Boolean!) {
          ... on User { name @skip(if: $skip) age }
        }
      `;
      const opA = createTestOperation(query, { skip: false });
      const opB = createTestOperation(query, { skip: true });
      const selA = resolveSelection(opA, opA.possibleSelections, "User");
      const selB = resolveSelection(opB, opB.possibleSelections, "User");

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(false);
    });

    it("returns false for typed @include with different variables", () => {
      const query = `
        query ($inc: Boolean!) {
          ... on User { name @include(if: $inc) age }
        }
      `;
      const opA = createTestOperation(query, { inc: true });
      const opB = createTestOperation(query, { inc: false });
      const selA = resolveSelection(opA, opA.possibleSelections, "User");
      const selB = resolveSelection(opB, opB.possibleSelections, "User");

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(false);
    });

    it("returns false for typed field with different arg variables", () => {
      const query = `
        query ($id: ID!) {
          ... on User { posts(first: $id) { title } }
        }
      `;
      const opA = createTestOperation(query, { id: "10" });
      const opB = createTestOperation(query, { id: "20" });
      const selA = resolveSelection(opA, opA.possibleSelections, "User");
      const selB = resolveSelection(opB, opB.possibleSelections, "User");

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(false);
    });

    it("returns true for typed selection with same variables", () => {
      const query = `
        query ($inc: Boolean!) {
          ... on User { name @include(if: $inc) }
        }
      `;
      const opA = createTestOperation(query, { inc: true });
      const opB = createTestOperation(query, { inc: true });
      const selA = resolveSelection(opA, opA.possibleSelections, "User");
      const selB = resolveSelection(opB, opB.possibleSelections, "User");

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(true);
    });
  });

  // --- Group C: Typed child selection false positives (FIXME) ---

  describe("typed selections: child selection false positives", () => {
    it("returns false when typed child @include differs via variables", () => {
      const query = `
        query ($inc: Boolean!) {
          ... on User { posts { title @include(if: $inc) body } }
        }
      `;
      const opA = createTestOperation(query, { inc: true });
      const opB = createTestOperation(query, { inc: false });
      const selA = resolveSelection(opA, opA.possibleSelections, "User");
      const selB = resolveSelection(opB, opB.possibleSelections, "User");

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(false);
    });

    it("returns false when typed child nested arg differs via variables", () => {
      const query = `
        query ($cursor: String) {
          ... on User { posts { comments(after: $cursor) { text } } }
        }
      `;
      const opA = createTestOperation(query, { cursor: "abc" });
      const opB = createTestOperation(query, { cursor: "xyz" });
      const selA = resolveSelection(opA, opA.possibleSelections, "User");
      const selB = resolveSelection(opB, opB.possibleSelections, "User");

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(false);
    });
  });

  // --- Group D: Cross-document typed selections (false negatives) ---

  describe("cross-document: typed selections", () => {
    it("returns true for structurally identical typed selections from different docs", () => {
      const opA = createTestOperation("query A { ... on User { name age } }");
      const opB = createTestOperation("query B { ... on User { name age } }");
      const selA = resolveSelection(opA, opA.possibleSelections, "User");
      const selB = resolveSelection(opB, opB.possibleSelections, "User");

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(true);
    });

    it("returns true for typed selections with merged common fields from different docs", () => {
      const opA = createTestOperation("query A { id ... on User { name } }");
      const opB = createTestOperation("query B { id ... on User { name } }");
      const selA = resolveSelection(opA, opA.possibleSelections, "User");
      const selB = resolveSelection(opB, opB.possibleSelections, "User");

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(true);
    });

    it("returns true for fragment spread vs inline fragment producing same typed selection", () => {
      const opA = createTestOperation(`
        query A { ...UF }
        fragment UF on User { name }
      `);
      const opB = createTestOperation("query B { ... on User { name } }");
      const selA = resolveSelection(opA, opA.possibleSelections, "User");
      const selB = resolveSelection(opB, opB.possibleSelections, "User");

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(true);
    });
  });

  // --- Group E: Directives on inline fragments and spreads ---

  describe("directives on inline fragments and spreads", () => {
    it("returns false when @include on inline fragment differs via variables", () => {
      const query = `
        query ($inc: Boolean!) {
          ... on User @include(if: $inc) { name }
          id
        }
      `;
      const opA = createTestOperation(query, { inc: true });
      const opB = createTestOperation(query, { inc: false });
      const selA = resolveSelection(opA, opA.possibleSelections, "User");
      const selB = resolveSelection(opB, opB.possibleSelections, "User");

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(false);
    });

    it("returns false when @include on named spread differs via variables", () => {
      const query = `
        query ($inc: Boolean!) {
          ...F @include(if: $inc)
        }
        fragment F on Query { foo bar }
      `;
      const opA = createTestOperation(query, { inc: true });
      const opB = createTestOperation(query, { inc: false });
      const selA = resolveSelection(opA, opA.possibleSelections, null);
      const selB = resolveSelection(opB, opB.possibleSelections, null);

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(false);
    });
  });

  // --- Group F: Nested typed selections via variables (false positives at root) ---

  describe("nested typed selections via variables", () => {
    it("returns false at root when child typed selection differs via @include", () => {
      const query = `
        query ($inc: Boolean!) {
          node {
            ... on User { bio @include(if: $inc) }
            ... on Post { body }
          }
        }
      `;
      const opA = createTestOperation(query, { inc: true });
      const opB = createTestOperation(query, { inc: false });
      const selA = resolveSelection(opA, opA.possibleSelections, null);
      const selB = resolveSelection(opB, opB.possibleSelections, null);

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(false);
    });

    it("returns false at root when deeply nested child typed arg differs", () => {
      const query = `
        query ($x: String!) {
          node {
            ... on User {
              posts {
                ... on BlogPost { comments(after: $x) { text } }
              }
            }
          }
        }
      `;
      const opA = createTestOperation(query, { x: "aaa" });
      const opB = createTestOperation(query, { x: "bbb" });
      const selA = resolveSelection(opA, opA.possibleSelections, null);
      const selB = resolveSelection(opB, opB.possibleSelections, null);

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(false);
    });

    it("returns false when comparing child typed selection directly", () => {
      const query = `
        query ($inc: Boolean!) {
          node {
            ... on User { bio @include(if: $inc) }
            ... on Post { body }
          }
        }
      `;
      const opA = createTestOperation(query, { inc: true });
      const opB = createTestOperation(query, { inc: false });

      const nodeFieldA = getFieldInfo(opA.possibleSelections, ["node"]);
      const nodeFieldB = getFieldInfo(opB.possibleSelections, ["node"]);
      assert(nodeFieldA.selection && nodeFieldB.selection);

      const selA = resolveSelection(opA, nodeFieldA.selection, "User");
      const selB = resolveSelection(opB, nodeFieldB.selection, "User");

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(false);
    });
  });

  // --- Group G: Merged fragments at different depths ---

  describe("merged fragments at different depths", () => {
    it("returns false when variable affects only a deep child of merged fragment", () => {
      const query = `
        query ($inc: Boolean!) {
          ...RootFields
          ...DeepFields
        }
        fragment RootFields on Query { id }
        fragment DeepFields on Query { foo { bar @include(if: $inc) baz } }
      `;
      const opA = createTestOperation(query, { inc: true });
      const opB = createTestOperation(query, { inc: false });
      const selA = resolveSelection(opA, opA.possibleSelections, null);
      const selB = resolveSelection(opB, opB.possibleSelections, null);

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(false);
    });

    it("returns true for structurally identical nested selections from different docs", () => {
      const opA = createTestOperation("query A { foo { bar } baz }");
      const opB = createTestOperation("query B { foo { bar } baz }");
      const selA = resolveSelection(opA, opA.possibleSelections, null);
      const selB = resolveSelection(opB, opB.possibleSelections, null);

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(true);
    });

    it("returns false for same top-level fields but different children from different docs", () => {
      const opA = createTestOperation("query A { foo { bar } }");
      const opB = createTestOperation("query B { foo { qux } }");
      const selA = resolveSelection(opA, opA.possibleSelections, null);
      const selB = resolveSelection(opB, opB.possibleSelections, null);

      expect(resolvedSelectionsAreEqual(selA, selB)).toBe(false);
    });
  });
});

describe(fieldEntriesAreEqual, () => {
  /**
   * Helper function to create NormalizedFieldEntry instances.
   */
  function createNormalizedField(
    name: string,
    args?: [string, any][],
    keyArgs?: Key | KeySpecifier,
  ): NormalizedFieldEntry {
    if (!args && !keyArgs) {
      return name;
    }
    return {
      name,
      args: args ? new Map(args) : new Map(),
      keyArgs,
    };
  }

  it("returns true when comparing identical field names (strings)", () => {
    const fieldA: NormalizedFieldEntry = "foo";
    const fieldB: NormalizedFieldEntry = "foo";

    expect(fieldEntriesAreEqual(fieldA, fieldB)).toBe(true);
  });

  it("returns false when comparing different field names (strings)", () => {
    const fieldA: NormalizedFieldEntry = "foo";
    const fieldB: NormalizedFieldEntry = "bar";

    expect(fieldEntriesAreEqual(fieldA, fieldB)).toBe(false);
  });

  it("returns true when comparing identical fields with same arguments", () => {
    const fieldA = createNormalizedField("foo", [["arg", "value"]]);
    const fieldB = createNormalizedField("foo", [["arg", "value"]]);

    expect(fieldEntriesAreEqual(fieldA, fieldB)).toBe(true);
  });

  it("returns false when comparing fields with different arguments", () => {
    const fieldA = createNormalizedField("foo", [["arg", "value1"]]);
    const fieldB = createNormalizedField("foo", [["arg", "value2"]]);

    expect(fieldEntriesAreEqual(fieldA, fieldB)).toBe(false);
  });

  it("returns true when comparing fields with no arguments and same name", () => {
    const fieldA = createNormalizedField("foo");
    const fieldB = createNormalizedField("foo");

    expect(fieldEntriesAreEqual(fieldA, fieldB)).toBe(true);
  });

  it("returns false when comparing field name (string) and field with arguments", () => {
    const fieldA: NormalizedFieldEntry = "foo";
    const fieldB = createNormalizedField("foo", [["arg", "value"]]);

    expect(fieldEntriesAreEqual(fieldA, fieldB)).toBe(false);
  });

  it("returns true when keyArgs are strings and equal", () => {
    const fieldA = createNormalizedField(
      "foo",
      [["arg", "value"]],
      "customKey",
    );
    const fieldB = createNormalizedField(
      "foo",
      [["arg", "value"]],
      "customKey",
    );

    expect(fieldEntriesAreEqual(fieldA, fieldB)).toBe(true);
  });

  it("returns false when keyArgs are strings and not equal", () => {
    const fieldA = createNormalizedField("foo", [["arg", "value1"]], "key1");
    const fieldB = createNormalizedField("foo", [["arg", "value2"]], "key2");

    expect(fieldEntriesAreEqual(fieldA, fieldB)).toBe(false);
  });

  it("returns true when both fields have undefined keyArgs", () => {
    const fieldA = createNormalizedField("foo");
    const fieldB = createNormalizedField("foo");

    expect(fieldEntriesAreEqual(fieldA, fieldB)).toBe(true);
  });

  it("returns false when one field has keyArgs and the other does not", () => {
    const fieldA = createNormalizedField("foo", [["arg", "value"]], "key1");
    const fieldB = createNormalizedField("foo", [["arg", "value"]]);

    expect(fieldEntriesAreEqual(fieldA, fieldB)).toBe(false);
  });

  it("returns true when comparing field names even if args are empty maps", () => {
    const fieldA = createNormalizedField("foo");
    const fieldB: NormalizedFieldEntry = "foo";

    expect(fieldEntriesAreEqual(fieldA, fieldB)).toBe(true);
  });

  it("returns false when field names differ even if args are the same", () => {
    const fieldA = createNormalizedField("foo", [["arg", "value"]]);
    const fieldB = createNormalizedField("bar", [["arg", "value"]]);

    expect(fieldEntriesAreEqual(fieldA, fieldB)).toBe(false);
  });

  it("returns false when arguments differ in keyArgs", () => {
    const fieldA = createNormalizedField("foo", [["arg", "value1"]]);
    const fieldB = createNormalizedField("foo", [["arg", "value2"]]);

    expect(fieldEntriesAreEqual(fieldA, fieldB)).toBe(false);
  });

  it("returns true when arguments are equal despite keyArgs being undefined", () => {
    const fieldA = createNormalizedField("foo", [["arg", "value"]]);
    const fieldB = createNormalizedField("foo", [["arg", "value"]]);

    expect(fieldEntriesAreEqual(fieldA, fieldB)).toBe(true);
  });

  it("returns false when field names are the same but keyArgs differ", () => {
    const fieldA = createNormalizedField("foo", [["arg", "value"]], "key1");
    const fieldB = createNormalizedField("foo", [["arg", "value"]], "key2");

    expect(fieldEntriesAreEqual(fieldA, fieldB)).toBe(false);
  });
});
