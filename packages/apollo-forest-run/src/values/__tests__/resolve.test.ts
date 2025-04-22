import { createTestOperation } from "../../__tests__/helpers/descriptor";
import {
  FieldInfo,
  Key,
  KeySpecifier,
  NormalizedFieldEntry,
  VariableValues,
} from "../../descriptor/types";
import {
  resolveFieldChunk,
  resolveFieldValue,
  leafUndefinedValue,
  leafDeletedValue,
  aggregateFieldNames,
  resolveListItemChunk,
  aggregateListItemValue,
  aggregateFieldValue,
} from "../resolve";
import {
  createCompositeListAggregate,
  createObjectAggregate,
  createObjectChunk,
} from "../create";
import {
  CompositeListAggregate,
  CompositeListChunk,
  CompositeListValue,
  ObjectChunk,
  ObjectValue,
  SourceObject,
  ValueKind,
} from "../types";
import { assert } from "../../jsutils/assert";
import {
  isAggregate,
  isComplexValue,
  isCompositeListValue,
  isCompositeValue,
  isObjectValue,
} from "../predicates";

describe(resolveFieldChunk, () => {
  it("returns leafUndefinedValue when field value is undefined", () => {
    const chunk = createTestChunk(`query { foo }`, {});
    const fieldInfo = getField(chunk, "foo");

    const result = resolveFieldChunk(chunk, fieldInfo);

    // testing for specific value vs type because it is singleton, and we rely on it in some other places for perf
    expect(result).toBe(leafUndefinedValue);
  });

  it("returns leafDeletedValue when field is missing due to cache eviction", () => {
    const chunk = createTestChunk(`query { foo }`, { foo: "bar" });
    const fieldInfo = getField(chunk, "foo");
    chunk.missingFields = new Set([fieldInfo]);

    const result = resolveFieldChunk(chunk, fieldInfo);

    // testing for specific value vs type because it is singleton, and we rely on it in some other places for perf
    expect(result).toBe(leafDeletedValue);
  });

  it("returns scalar value when field value is a scalar", () => {
    const chunk = createTestChunk(`query { foo }`, { foo: 42 });
    const fieldInfo = getField(chunk, "foo");

    const result = resolveFieldChunk(chunk, fieldInfo);

    expect(result).toBe(42);
  });

  it("returns null when field value is a leaf null", () => {
    const chunk = createTestChunk(`query { foo }`, { foo: null });
    const fieldInfo = getField(chunk, "foo");

    const result = resolveFieldChunk(chunk, fieldInfo);

    expect(result).toBeNull();
  });

  it("returns LeafListValue when field value is an array of scalars", () => {
    const chunk = createTestChunk(`query { foo }`, { foo: [1, 2, 3] });
    const fieldInfo = getField(chunk, "foo");

    const result = resolveFieldChunk(chunk, fieldInfo);

    expect(result).toEqual({
      kind: ValueKind.LeafList,
      data: [1, 2, 3],
    });
  });

  it("returns ComplexScalarValue for field without sub-selection and object values", () => {
    const chunk = createTestChunk(`query { foo }`, {
      foo: { custom: "value" },
    });
    const fieldInfo = getField(chunk, "foo");

    const result = resolveFieldChunk(chunk, fieldInfo);

    expect(result).toEqual({
      kind: ValueKind.ComplexScalar,
      data: { custom: "value" },
    });
  });

  it("returns ObjectChunk for fields with sub-selection and object values", () => {
    const chunk = createTestChunk(`query { foo { bar } }`, {
      foo: { bar: "baz" },
    });
    const fieldInfo = getField(chunk, "foo");

    const result = resolveFieldChunk(chunk, fieldInfo);

    assert(isComplexValue(result));
    expect(result.kind).toBe(ValueKind.Object);
  });

  it("returns exactly the same chunk instance on multiple calls", () => {
    const chunk = createTestChunk(`query { foo { bar } }`, {
      foo: { bar: "baz" },
    });
    const fieldInfo = getField(chunk, "foo");

    const result1 = resolveFieldChunk(chunk, fieldInfo);
    const result2 = resolveFieldChunk(chunk, fieldInfo);

    assert(isComplexValue(result1));
    expect(result1.kind).toBe(ValueKind.Object);
    expect(result1).toBe(result2);
  });

  it("throws an assertion error if data is not a SourceCompositeValue when field has selection", () => {
    const chunk = createTestChunk(`query { foo { bar } }`, { foo: 42 });
    const fieldInfo = getField(chunk, "foo");

    expect(() => {
      resolveFieldChunk(chunk, fieldInfo);
    }).toThrow("Invariant violation");
  });

  it("returns CompositeUndefinedChunk when field value is undefined and field has selection", () => {
    const chunk = createTestChunk(`query { foo { bar } }`, {}); // 'foo' is undefined
    const fieldInfo = getField(chunk, "foo");

    const result = resolveFieldChunk(chunk, fieldInfo);

    assert(isComplexValue(result));
    expect(result.kind).toBe(ValueKind.CompositeUndefined);
  });

  it("returns CompositeNullChunk when field value is null and field has selection", () => {
    const chunk = createTestChunk(`query { foo { bar } }`, { foo: null });
    const fieldInfo = getField(chunk, "foo");

    const result = resolveFieldChunk(chunk, fieldInfo);

    assert(isComplexValue(result));
    expect(result.kind).toBe(ValueKind.CompositeNull);
  });

  it("handles arrays in fields with sub-selection", () => {
    const chunk = createTestChunk(`query { foo { bar } }`, {
      foo: [{ bar: "baz1" }, { bar: "baz2" }],
    });
    const fieldInfo = getField(chunk, "foo");

    const result = resolveFieldChunk(chunk, fieldInfo);

    assert(isComplexValue(result));
    expect(result.kind).toBe(ValueKind.CompositeList);
    expect(result.data).toEqual([{ bar: "baz1" }, { bar: "baz2" }]);
  });

  it("returns LeafListValue when field is an array of scalars and has no selection", () => {
    const chunk = createTestChunk(`query { foo }`, { foo: ["a", "b", "c"] });
    const fieldInfo = getField(chunk, "foo");

    const result = resolveFieldChunk(chunk, fieldInfo);

    assert(isComplexValue(result));
    expect(result.kind).toBe(ValueKind.LeafList);
    expect(result.data).toEqual(["a", "b", "c"]);
  });

  it("handles fields with aliases", () => {
    const chunk = createTestChunk(`query { myFoo: foo }`, { myFoo: "bar" });
    const fieldInfo = getField(chunk, "foo");
    expect(fieldInfo.dataKey).toEqual("myFoo"); // sanity-check

    const result = resolveFieldChunk(chunk, fieldInfo);

    expect(result).toBe("bar");
  });

  it("handles fields with directives that skip the field (field value is undefined)", () => {
    const chunk = createTestChunk(
      [
        `query ($skipFoo: Boolean!) { foo @skip(if: $skipFoo) }`,
        { skipFoo: true },
      ],
      {}, // 'foo' is skipped
    );
    const fieldInfo = getField(chunk, "foo");

    const result = resolveFieldChunk(chunk, fieldInfo);

    expect(result).toBe(leafUndefinedValue);
  });

  it("returns leafDeletedValue when field is explicitly marked as missing, but has data", () => {
    const chunk = createTestChunk(`query { foo }`, { foo: "bar" });
    const fieldInfo = getField(chunk, "foo");

    chunk.missingFields = new Set([fieldInfo]);

    const result = resolveFieldChunk(chunk, fieldInfo);

    expect(result).toBe(leafDeletedValue);
  });

  it("handles custom scalar values", () => {
    const customScalarValue = new Date();

    const chunk = createTestChunk(`query { foo }`, { foo: customScalarValue });
    const fieldInfo = getField(chunk, "foo");

    const result = resolveFieldChunk(chunk, fieldInfo);

    assert(isComplexValue(result));
    expect(result.kind).toBe(ValueKind.ComplexScalar);
    expect(result.data).toBe(customScalarValue);
  });

  it("handles deeply nested fields", () => {
    const chunk = createTestChunk(`query { foo { bar { baz } } }`, {
      foo: {
        bar: {
          baz: "value",
        },
      },
    });
    const fieldInfoFoo = getField(chunk, "foo");

    const fooChunk = resolveFieldChunk(chunk, fieldInfoFoo);
    assert(isObjectValue(fooChunk));

    const fieldInfoBar = getField(fooChunk, "bar");
    const barChunk = resolveFieldChunk(fooChunk, fieldInfoBar);
    assert(isObjectValue(barChunk));

    const fieldInfoBaz = getField(barChunk, "baz");
    const bazValue = resolveFieldChunk(barChunk, fieldInfoBaz);

    expect(bazValue).toBe("value");
  });
});

describe(resolveFieldValue, () => {
  it("returns undefined when field is not present in selection", () => {
    const chunk = createTestChunk(`query { foo }`, { foo: 42 });
    const fieldEntry = "bar"; // Field 'bar' is not in the selection

    const result = resolveFieldValue(chunk, fieldEntry);

    expect(result).toBeUndefined();
  });

  it("returns scalar value when field is present and value is scalar", () => {
    const chunk = createTestChunk(`query { foo }`, { foo: 42 });
    const fieldEntry = getNormalizedFieldEntry(chunk, "foo");

    const result = resolveFieldValue(chunk, fieldEntry);

    expect(result).toBe(42);
  });

  it("returns object chunk when field has selection and value is object", () => {
    const chunk = createTestChunk(`query { foo { bar } }`, {
      foo: { bar: "baz" },
    });
    const fieldEntry = getNormalizedFieldEntry(chunk, "foo");

    const result = resolveFieldValue(chunk, fieldEntry);

    assert(isComplexValue(result));
    expect(result.kind).toBe(ValueKind.Object);
    expect(result.data).toEqual({ bar: "baz" });
  });

  it("aggregates values when field is requested multiple times with different aliases", () => {
    const chunk = createTestChunk(`query { a: foo { bar } b: foo { baz } }`, {
      a: { bar: "bar" },
      b: { baz: "baz" },
    });
    const fieldEntry = getNormalizedFieldEntry(chunk, "foo");

    const result = resolveFieldValue(chunk, fieldEntry);

    // Since we have multiple aliases, the result should be an aggregate
    // Here, we expect the aggregate to contain both 'bar' and 'baz'
    assert(result && isObjectValue(result));
    expect(result.isAggregate).toBe(true);
    const fieldNames = Array.from(aggregateFieldNames(result));
    expect(fieldNames).toEqual(["bar", "baz"]);
  });

  it("returns leafUndefinedValue when all field values are missing", () => {
    const chunk = createTestChunk(`query { foo }`, {});
    const fieldEntry = getNormalizedFieldEntry(chunk, "foo");

    const result = resolveFieldValue(chunk, fieldEntry);

    expect(result).toBe(leafUndefinedValue);
  });

  it("skips missing values when aggregating field values", () => {
    const chunk = createTestChunk(`query { a: foo { bar } b: foo { baz } }`, {
      a: { bar: "bar" },
    });
    const fieldEntry = getNormalizedFieldEntry(chunk, "foo");

    const result = resolveFieldValue(chunk, fieldEntry);

    assert(isComplexValue(result));
    expect(result.kind).toBe(ValueKind.Object);
    expect(result.data).toEqual({ bar: "bar" });
  });

  it("returns leafUndefinedValue when all aliases are missing", () => {
    const chunk = createTestChunk(`query { a: foo b: foo }`, {});
    const fieldEntry = getNormalizedFieldEntry(chunk, "foo");

    const result = resolveFieldValue(chunk, fieldEntry);

    expect(result).toBe(leafUndefinedValue);
  });

  it("returns scalar value when field value is scalar and fieldEntry matches", () => {
    const chunk = createTestChunk(`query { foo }`, { foo: 42 });

    const result = resolveFieldValue(chunk, "foo");

    expect(result).toBe(42);
  });

  it("returns composite value when field value is object and fieldEntry matches", () => {
    const chunk = createTestChunk(`query { foo { bar } }`, {
      foo: { bar: "baz" },
    });

    const result = resolveFieldValue(chunk, "foo");

    expect(result).toBeDefined();
    assert(isComplexValue(result));
    expect(result.kind).toBe(ValueKind.Object);
    expect(result.data).toEqual({ bar: "baz" });
  });

  it("returns undefined when fieldEntry does not match any field", () => {
    const chunk = createTestChunk(`query { foo }`, { foo: 42 });

    const result = resolveFieldValue(chunk, "bar"); // No 'bar' in selection

    expect(result).toBeUndefined();
  });

  it("returns scalar value when field has arguments and matches fieldEntry", () => {
    const chunk = createTestChunk(`query { foo(id: 1) }`, { foo: "value" });
    const fieldEntry = createNormalizedField("foo", [["id", 1]]);

    const result = resolveFieldValue(chunk, fieldEntry);

    expect(result).toBe("value");
  });

  it("returns undefined when field has different arguments than fieldEntry", () => {
    const chunk = createTestChunk(`query { foo(id: 1) }`, { foo: "value" });
    const fieldEntry = createNormalizedField("foo", [["id", 2]]);

    const result = resolveFieldValue(chunk, fieldEntry);

    expect(result).toBeUndefined();
  });

  it("aggregates field values with matching arguments", () => {
    const chunk = createTestChunk(
      `query { a: foo(id: 1) { bar } b: foo(id: 1) { baz } }`,
      { a: { bar: "bar" }, b: { baz: "baz" } },
    );
    const fieldEntry = createNormalizedField("foo", [["id", 1]]);

    const result = resolveFieldValue(chunk, fieldEntry);

    assert(result && isObjectValue(result));
    expect(result.isAggregate).toBe(true);
    const fieldNames = Array.from(aggregateFieldNames(result));
    expect(fieldNames).toEqual(["bar", "baz"]);
  });

  it("does not aggregate field values with different arguments", () => {
    const chunk = createTestChunk(
      `query { a: foo(id: 1) { bar } b: foo(id: 2) { baz } }`,
      { a: { bar: "bar" }, b: { baz: "baz" } },
    );
    const fieldEntry = createNormalizedField("foo", [["id", 1]]);

    const result = resolveFieldValue(chunk, fieldEntry);

    assert(result && isObjectValue(result));
    const fieldNames = Array.from(aggregateFieldNames(result));
    expect(fieldNames).toContain("bar");
    expect(fieldNames).not.toContain("baz");
  });

  it("returns leafUndefinedValue when field is skipped via directives", () => {
    const chunk = createTestChunk(
      [
        `query($includeFoo: Boolean!) { foo @include(if: $includeFoo) }`,
        { includeFoo: false },
      ],
      {},
    );

    const result = resolveFieldValue(chunk, "foo");

    expect(result).toBe(leafUndefinedValue);
  });

  it("returns leafDeletedValue when field is marked as missing", () => {
    const chunk = createTestChunk(`query { foo }`, { foo: "value" });
    const fieldEntry = getNormalizedFieldEntry(chunk, "foo");

    const fieldInfo = getField(chunk, "foo");
    chunk.missingFields = new Set([fieldInfo]);

    const result = resolveFieldValue(chunk, fieldEntry);

    expect(result).toBe(leafDeletedValue);
  });
});

describe("resolveListItemChunk", () => {
  function createTestListChunk(
    query: string | [string, VariableValues],
    data: object,
    listField = "list",
  ): CompositeListChunk {
    const chunk = createTestChunk(query, data);
    const listChunk = resolveFieldValue(chunk, listField);
    assert(
      listChunk && isCompositeListValue(listChunk) && !listChunk.isAggregate,
    );
    return listChunk;
  }

  it("returns the correct item chunk for a valid index", () => {
    const chunk = createTestListChunk(`query { list { bar } }`, {
      list: [{ bar: "baz1" }, { bar: "baz2" }],
    });
    const index = 1;

    const result = resolveListItemChunk(chunk, index);

    assert(isCompositeValue(result));
    expect(result.kind).toBe(ValueKind.Object);
    expect(result.data).toEqual({ bar: "baz2" });
  });

  it("returns the exact same chunk instance on multiple calls", () => {
    const chunk = createTestListChunk(`query { list { bar } }`, {
      list: [{ bar: "baz1" }, { bar: "baz2" }],
    });
    const index = 0;

    const result1 = resolveListItemChunk(chunk, index);
    const result2 = resolveListItemChunk(chunk, index);

    assert(isCompositeValue(result1));
    expect(result1.data).toBe(chunk.data[index]);
    expect(result1).toBe(result2);
  });

  // Disabled for now for ApolloCompat
  it.skip("throws an error when index is out of bounds", () => {
    const chunk = createTestListChunk(`query { list { bar } }`, {
      list: [{ bar: "baz1" }, { bar: "baz2" }],
    });
    const index = 2; // Out of bounds

    expect(() => {
      resolveListItemChunk(chunk, index);
    }).toThrow("Invariant violation");
  });

  it("handles nested lists correctly", () => {
    const chunk = createTestListChunk(`query { list { bar } }`, {
      list: [[{ bar: "baz1" }], [{ bar: "baz2" }, { bar: "baz3" }]],
    });
    const index = 1;

    const result = resolveListItemChunk(chunk, index);

    expect(result).toBeDefined();
    assert(isCompositeValue(result));
    expect(result.kind).toBe(ValueKind.CompositeList);
    expect(result.data).toEqual([{ bar: "baz2" }, { bar: "baz3" }]);
  });

  it("returns CompositeNullChunk when item value is null", () => {
    const chunk = createTestListChunk(`query { list { bar } }`, {
      list: [null, { bar: "baz2" }],
    });
    const index = 0;

    const result = resolveListItemChunk(chunk, index);

    expect(result.kind).toBe(ValueKind.CompositeNull);
    expect(result.data).toBeNull();
  });

  it("returns CompositeUndefinedChunk when item value is undefined", () => {
    const chunk = createTestListChunk(`query { list { bar } }`, {
      list: [{ bar: "baz1" }, undefined],
    });
    const index = 1;

    const result = resolveListItemChunk(chunk, index);

    expect(result.kind).toBe(ValueKind.CompositeUndefined);
    expect(result.data).toBeUndefined();
  });

  // TODO: this should be an assertion. The actual input validation with proper error messages should be done elsewhere
  it.skip("throws an error when item data type does not match expected composite value", () => {
    const chunk = createTestListChunk(`query { list { bar } }`, {
      list: [42, { bar: "baz2" }],
    });
    const index = 0;

    expect(() => {
      resolveListItemChunk(chunk, index);
    }).toThrow("Invariant violation");
  });

  // Disabled for now for ApolloCompat
  it.skip("handles empty list items", () => {
    const chunk = createTestListChunk(`query { list { bar } }`, {
      list: [],
    });
    const index = 0;

    expect(() => {
      resolveListItemChunk(chunk, index);
    }).toThrow("Invariant violation");
  });

  it("correctly resolves nested CompositeListChunks", () => {
    const chunk = createTestListChunk(`query { list { bar } }`, {
      list: [[{ bar: "baz1" }, { bar: "baz2" }], [{ bar: "baz3" }]],
    });
    const index = 0;

    const result = resolveListItemChunk(chunk, index);

    expect(result.kind).toBe(ValueKind.CompositeList);
    expect(result.data).toEqual([{ bar: "baz1" }, { bar: "baz2" }]);
  });
});

describe(aggregateListItemValue, () => {
  it("returns the item chunk when parent is not an aggregate", () => {
    const chunk = createTestListChunk(`query { list { bar } }`, {
      list: [{ bar: "baz1" }, { bar: "baz2" }],
    });
    const index = 1;

    const result = aggregateListItemValue(chunk, index);

    expect(result).toBeDefined();
    assert(isCompositeValue(result));
    expect(result.kind).toBe(ValueKind.Object);
    expect(result.data).toEqual({ bar: "baz2" });
  });

  it("aggregates item values from multiple chunks when parent is an aggregate", () => {
    const aggregateList = createTestAggregateList(`query { list { bar } }`, [
      { list: [{ bar: "baz1" }, { bar: "baz2" }] },
      { list: [{ bar: "baz3" }, { bar: "baz4" }] },
    ]);
    const index = 1;

    const result = aggregateListItemValue(aggregateList, index);

    expect(result.isAggregate).toBe(true);
    expect(result.kind).toEqual(ValueKind.Object);

    const fieldNames = Array.from(aggregateFieldNames(result as ObjectValue));
    expect(fieldNames).toEqual(["bar"]);

    // The data should be aggregated from both chunks
    // However, since both have the same field 'bar', the first one should take precedence
    expect(result.data).toEqual({ bar: "baz2" });
  });

  it("handles missing items in some chunks when aggregating", () => {
    const aggregateList = createTestAggregateList(`query { list { bar } }`, [
      { list: [{ bar: "baz1" }, undefined] },
      { list: [undefined, { bar: "baz4" }] },
    ]);

    const result0 = aggregateListItemValue(aggregateList, 0);
    const result1 = aggregateListItemValue(aggregateList, 1);

    // The first chunk has data at index 0, second chunk has undefined
    expect(result0.kind).toBe(ValueKind.Object);
    expect(result0.data).toEqual({ bar: "baz1" });
    expect(result0.isAggregate).toBe(true);

    expect(result1.kind).toBe(ValueKind.Object);
    expect(result1.data).toEqual({ bar: "baz4" });
    expect(result1.isAggregate).toBe(true);
  });

  it("returns CompositeUndefined when all chunks have undefined at the index", () => {
    const aggregateList = createTestAggregateList(`query { list { foo } }`, [
      { list: [undefined, { foo: 2 }] },
      { list: [undefined, { foo: 4 }] },
    ]);
    const index = 0;

    const result = aggregateListItemValue(aggregateList, index);

    expect(result.kind).toBe(ValueKind.CompositeUndefined);
    expect(result.isAggregate).toBe(true);
  });

  // TODO: re-enable
  it.skip("throws an error when index is out of bounds in all chunks", () => {
    const aggregateList = createTestAggregateList(`query { list { bar } }`, [
      { list: [{ bar: "baz1" }] },
      { list: [{ bar: "baz2" }] },
    ]);
    const index = 1; // Out of bounds in both chunks

    expect(() => {
      aggregateListItemValue(aggregateList, index);
    }).toThrow("Invariant violation");
  });

  it("returns CompositeNullChunk when all chunks have null at the index", () => {
    const aggregateList = createTestAggregateList(`query { list { bar } }`, [
      { list: [null] },
      { list: [null] },
    ]);
    const index = 0;

    const result = aggregateListItemValue(aggregateList, index);

    expect(result.kind).toBe(ValueKind.CompositeNull);
    expect(result.data).toBeNull();
  });

  it("aggregates when some chunks have null or undefined at the index", () => {
    const aggregateList = createTestAggregateList(`query { list { bar } }`, [
      { list: [null, { bar: "baz2" }] },
      { list: [{ bar: "baz1" }, undefined] },
    ]);

    const result0 = aggregateListItemValue(aggregateList, 0);
    const result1 = aggregateListItemValue(aggregateList, 1);

    expect(result0.kind).toBe(ValueKind.Object);
    expect(result0.isAggregate).toBe(true);
    expect(result0.data).toEqual({ bar: "baz1" });
    expect(result1.kind).toBe(ValueKind.Object);
    expect(result1.isAggregate).toBe(true);
    expect(result1.data).toEqual({ bar: "baz2" });
  });

  it("aggregates nested lists correctly", () => {
    const aggregateList = createTestAggregateList(`query { list { bar } }`, [
      { list: [[{ bar: "baz1" }], [{ bar: "baz2" }]] },
      { list: [[{ bar: "baz3" }], [{ bar: "baz4" }]] },
    ]);
    const index = 1;

    const result = aggregateListItemValue(aggregateList, index);

    expect(result.kind).toBe(ValueKind.CompositeList);
    expect(result.isAggregate).toBe(true);
    assert(isAggregate(result));
    expect(result.chunks.length).toBe(2);
    expect(result.chunks[0].kind).toEqual(ValueKind.CompositeList);
    expect(result.chunks[0].data).toEqual([{ bar: "baz2" }]);
    expect(result.chunks[1].kind).toEqual(ValueKind.CompositeList);
    expect(result.chunks[1].data).toEqual([{ bar: "baz4" }]);
  });

  // TODO
  it.skip("throws when parent chunks have different lengths", () => {
    const aggregateList = createTestAggregateList(`query { list { bar } }`, [
      { list: [{ bar: "baz1" }] },
      { list: [{ bar: "baz2" }, { bar: "baz3" }] },
    ]);
    const index = 1;

    expect(() => {
      aggregateListItemValue(aggregateList, index);
    }).toThrow("Invariant violation");
  });

  it("returns the first non-missing value when aggregating", () => {
    const aggregateList = createTestAggregateList(`query { list { foo } }`, [
      { list: [undefined, { foo: 2 }] },
      { list: [{ foo: 3 }, undefined] },
    ]);
    const index = 0;

    const result = aggregateListItemValue(aggregateList, index);

    expect(result.kind).toBe(ValueKind.Object);
    expect(result.isAggregate).toBe(true);
    expect(result.data).toEqual({ foo: 3 });
  });

  it("handles empty aggregate lists gracefully", () => {
    const aggregateList: CompositeListValue = {
      kind: ValueKind.CompositeList,
      isAggregate: true,
      data: [],
      chunks: [],
    };
    const index = 0;

    expect(() => {
      aggregateListItemValue(aggregateList, index);
    }).toThrow("Invariant violation");
  });

  it("throws an error when all chunks have mismatched data types at the index", () => {
    const aggregateList = createTestAggregateList(`query { list { bar } }`, [
      { list: [{ bar: 42 }] },
      { list: [[{ bar: true }]] },
    ]);
    const index = 0;

    expect(() => {
      aggregateListItemValue(aggregateList, index);
    }).toThrow("Invariant violation");
  });
});

describe(aggregateFieldValue, () => {
  it("returns the field value when parent is not an aggregate", () => {
    const chunk = createTestChunk(`query { foo }`, { foo: 42 });
    const result = aggregateFieldValue(chunk, "foo");

    expect(result).toBe(42);
  });

  it("aggregates field values from multiple chunks when parent is an aggregate", () => {
    const aggregateObject = createTestAggregateObject([
      [`query { foo }`, { foo: 42 }],
      [`query { foo }`, { foo: 43 }],
    ]);
    const result = aggregateFieldValue(aggregateObject, "foo");

    // ApolloCompat: last chunk takes precedence
    expect(result).toBe(43);
  });

  it("aggregates object field values when parent is an aggregate", () => {
    const aggregateObject = createTestAggregateObject([
      [`query { foo { bar } }`, { foo: { bar: "baz1" } }],
      [`query { foo { bar } }`, { foo: { bar: "baz2" } }],
    ]);
    const fooValue = aggregateFieldValue(aggregateObject, "foo");
    assert(fooValue && isObjectValue(fooValue));
    expect(fooValue.isAggregate).toBe(true);

    const fieldNames = Array.from(aggregateFieldNames(fooValue as ObjectValue));
    expect(fieldNames).toEqual(["bar"]);

    // The field 'bar' should have been aggregated
    const barValue = aggregateFieldValue(fooValue as ObjectValue, "bar");
    expect(barValue).toBe("baz2"); // ApolloCompat: last chunk takes precedence
  });

  it("handles missing fields in some chunks when aggregating", () => {
    const aggregateObject = createTestAggregateObject([
      [`query { foo }`, {}],
      [`query { foo }`, { foo: 43 }],
    ]);
    const result = aggregateFieldValue(aggregateObject, "foo");

    expect(result).toBe(43);
  });

  it("returns leafUndefinedValue when all chunks are missing the field", () => {
    const aggregateObject = createTestAggregateObject([
      [`query { foo }`, {}],
      [`query { foo }`, {}],
    ]);
    const result = aggregateFieldValue(aggregateObject, "foo");

    expect(result).toBe(leafUndefinedValue);
  });

  it("returns undefined when field is not in selection", () => {
    const aggregateObject = createTestAggregateObject([
      [`query { foo }`, { foo: 42 }],
      [`query { foo }`, { foo: 43 }],
    ]);
    const result = aggregateFieldValue(aggregateObject, "bar");

    expect(result).toBeUndefined();
  });

  it("aggregates fields with sub-selection", () => {
    const aggregateObject = createTestAggregateObject([
      [`query { foo { bar } }`, { foo: { bar: "baz1" } }],
      [`query { foo { baz } }`, { foo: { baz: "qux" } }],
    ]);
    const result = aggregateFieldValue(aggregateObject, "foo");

    assert(result && isObjectValue(result));
    expect(result.isAggregate).toBe(true);

    const fieldNames = Array.from(aggregateFieldNames(result as ObjectValue));
    expect(fieldNames).toEqual(["bar", "baz"]);

    const barValue = aggregateFieldValue(result as ObjectValue, "bar");
    expect(barValue).toBe("baz1");

    const bazValue = aggregateFieldValue(result as ObjectValue, "baz");
    expect(bazValue).toBe("qux");
  });

  it("returns leafUndefinedValue when field is skipped in all chunks due to directives", () => {
    const operation: [Query, VariableValues] = [
      `query($includeFoo: Boolean!) { foo @include(if: $includeFoo) }`,
      { includeFoo: false },
    ];
    const aggregateObject = createTestAggregateObject([
      [operation, {}],
      [operation, {}],
    ]);

    const result = aggregateFieldValue(aggregateObject, "foo");

    expect(result).toBe(leafUndefinedValue);
  });

  it("returns leafDeletedValue when field is marked as missing in all chunks (with existing data)", () => {
    const chunk1 = createTestChunk(`query { foo }`, { foo: 42 });
    const chunk2 = createTestChunk(`query { foo }`, { foo: 43 });

    const fieldInfo1 = getField(chunk1, "foo");
    const fieldInfo2 = getField(chunk2, "foo");

    chunk1.missingFields = new Set([fieldInfo1]);
    chunk2.missingFields = new Set([fieldInfo2]);

    const aggregateObject = createObjectAggregate([chunk1, chunk2]);

    const result = aggregateFieldValue(aggregateObject, "foo");

    expect(result).toBe(leafDeletedValue);
  });

  it("returns the last non-missing field value when aggregating", () => {
    const aggregateObject = createTestAggregateObject([
      [`query { foo }`, {}],
      [`query { foo }`, { foo: 43 }],
      [`query { foo }`, { foo: 44 }],
      [`query { foo }`, {}],
    ]);

    const result = aggregateFieldValue(aggregateObject, "foo");

    expect(result).toBe(44); // ApolloCompat: last non-empty chunk takes precedence
  });

  it("aggregates fields with arguments", () => {
    const aggregateObject = createTestAggregateObject([
      [`query { foo(id: 1) { bar } }`, { foo: { bar: "baz1" } }],
      [`query { foo(id: 2) { baz } }`, { foo: { baz: "qux" } }],
    ]);
    const fieldEntry1 = createNormalizedField("foo", [["id", 1]]);
    const fieldEntry2 = createNormalizedField("foo", [["id", 2]]);

    const result1 = aggregateFieldValue(aggregateObject, fieldEntry1);
    const result2 = aggregateFieldValue(aggregateObject, fieldEntry2);

    assert(isCompositeValue(result1));
    assert(isCompositeValue(result2));

    expect(result1.kind).toBe(ValueKind.Object);
    expect(result1.data).toEqual({ bar: "baz1" });
    expect(result1.isAggregate).toBe(false);
    expect(result2.kind).toBe(ValueKind.Object);
    expect(result2.data).toEqual({ baz: "qux" });
    expect(result2.isAggregate).toBe(false);
  });

  it("does not aggregate fields with different arguments", () => {
    const aggregateObject = createTestAggregateObject([
      [`query { foo(id: 1) { bar } }`, { foo: { bar: "baz1" } }],
      [`query { foo(id: 2) { baz } }`, { foo: { baz: "qux" } }],
    ]);
    const result = aggregateFieldValue(aggregateObject, "foo");

    expect(result).toBeUndefined(); // No field matches 'foo' without arguments
  });

  it("aggregates scalar fields from different chunks", () => {
    const aggregateObject = createTestAggregateObject([
      [`query { foo }`, { foo: 42 }],
      [`query { foo }`, { foo: 43 }],
    ]);

    const result = aggregateFieldValue(aggregateObject, "foo");

    expect(result).toBe(43); // ApolloCompat: last chunk takes precedence
  });

  it("aggregates nested fields recursively", () => {
    const aggregateObject = createTestAggregateObject([
      [`query { foo { bar { baz } } }`, { foo: { bar: { baz: "value1" } } }],
      [`query { foo { bar { qux } } }`, { foo: { bar: { qux: "value2" } } }],
    ]);

    const resultFoo = aggregateFieldValue(aggregateObject, "foo");
    assert(isCompositeValue(resultFoo));
    expect(resultFoo.kind).toBe(ValueKind.Object);
    expect(resultFoo.isAggregate).toBe(true);

    const resultBar = aggregateFieldValue(resultFoo as ObjectValue, "bar");
    assert(isCompositeValue(resultBar));
    expect(resultBar.kind).toBe(ValueKind.Object);
    expect(resultBar.isAggregate).toBe(true);

    const valueBaz = aggregateFieldValue(resultBar as ObjectValue, "baz");
    const valueQux = aggregateFieldValue(resultBar as ObjectValue, "qux");

    expect(valueBaz).toBe("value1");
    expect(valueQux).toBe("value2");
  });

  it("handles fields with aliases", () => {
    const aggregateObject = createTestAggregateObject([
      [`query { a: foo { bar } }`, { a: { bar: "value1" } }],
      [`query { b: foo { baz } }`, { b: { baz: "value2" } }],
    ]);

    const result = aggregateFieldValue(aggregateObject, "foo");

    assert(isCompositeValue(result));
    expect(result.kind).toEqual(ValueKind.Object);
    expect(result.isAggregate).toEqual(true);

    const barValue = aggregateFieldValue(result as ObjectValue, "bar");
    const bazValue = aggregateFieldValue(result as ObjectValue, "baz");

    expect(barValue).toBe("value1");
    expect(bazValue).toBe("value2");
  });

  it("returns undefined when field does not match due to arguments", () => {
    const aggregateObject = createTestAggregateObject([
      [`query { foo(id: 1) }`, { foo: 42 }],
    ]);
    const fieldEntry = createNormalizedField("foo", [["id", 2]]);

    const result = aggregateFieldValue(aggregateObject, fieldEntry);

    expect(result).toBeUndefined();
  });

  it("aggregates field values with same arguments", () => {
    const aggregateObject = createTestAggregateObject([
      [`query { foo(id: 1) }`, { foo: 42 }],
      [`query { foo(id: 1) }`, { foo: 43 }],
    ]);
    const fieldEntry = createNormalizedField("foo", [["id", 1]]);

    const result = aggregateFieldValue(aggregateObject, fieldEntry);

    expect(result).toBe(43); // ApolloCompat: last chunk takes precedence
  });

  it("handles null values in some chunks when aggregating", () => {
    const aggregateObject = createTestAggregateObject([
      [`query { foo }`, { foo: null }],
      [`query { foo }`, { foo: 42 }],
    ]);
    const result = aggregateFieldValue(aggregateObject, "foo");

    expect(result).toBe(42);
  });

  it("aggregates when some chunks have undefined field values", () => {
    const aggregateObject = createTestAggregateObject([
      [`query { foo }`, {}],
      [`query { foo }`, { foo: 42 }],
    ]);
    const result = aggregateFieldValue(aggregateObject, "foo");

    expect(result).toBe(42);
  });

  it("throws an error when field values are of incompatible types", () => {
    const aggregateObject = createTestAggregateObject([
      [`query { foo { bar } }`, { foo: [{ bar: 42 }] }],
      [`query { foo { bar } }`, { foo: { bar: "baz" } }],
    ]);

    expect(() => {
      aggregateFieldValue(aggregateObject, "foo");
    }).toThrow();
  });

  it("returns CompositeNullChunk when all chunks have null for the field", () => {
    const aggregateObject = createTestAggregateObject([
      [`query { foo { bar } }`, { foo: null }],
      [`query { foo { bar } }`, { foo: null }],
    ]);
    const result = aggregateFieldValue(aggregateObject, "foo");
    assert(isCompositeValue(result));

    expect(result.kind).toBe(ValueKind.CompositeNull);
    expect(result.isAggregate).toBe(true);
    expect(result.data).toBeNull();
  });
});

function getField(chunk: ObjectChunk, name: string): FieldInfo {
  const fieldAliases = chunk.possibleSelections.get(null)?.fields.get(name);
  assert(fieldAliases && fieldAliases.length > 0);
  return fieldAliases[0];
}

function getNormalizedFieldEntry(
  chunk: ObjectChunk,
  name: string,
): NormalizedFieldEntry {
  const fieldAliases = chunk.selection.fields.get(name);
  if (!fieldAliases || fieldAliases.length === 0) {
    return name; // Return field name if not found
  }
  const fieldInfo = fieldAliases[0];
  return chunk.selection.normalizedFields?.get(fieldInfo) ?? fieldInfo.name;
}

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

function createTestChunk(
  query: string | [string, VariableValues],
  data: object,
  key: string | false = false,
): ObjectChunk {
  const operation = Array.isArray(query)
    ? createTestOperation(query[0], query[1] ?? {})
    : createTestOperation(query, {});
  const possibleSelections = operation.possibleSelections;
  return createObjectChunk(
    operation,
    possibleSelections,
    data as SourceObject,
    key,
  );
}

function createTestListChunk(
  query: string | [string, VariableValues],
  data: object,
  listField = "list",
): CompositeListChunk {
  const chunk = createTestChunk(query, data);
  const field = getField(chunk, listField);
  const listChunk = resolveFieldChunk(chunk, field);
  assert(isCompositeListValue(listChunk));
  return listChunk;
}

function createTestAggregateList(
  query: string | [string, VariableValues],
  dataArray: object[],
  listField = "list",
): CompositeListAggregate {
  // Create multiple chunks to simulate an aggregate
  const chunks: CompositeListChunk[] = dataArray.map((data) => {
    const chunk = createTestChunk(query, data);
    const field = getField(chunk, listField);
    const listValue = resolveFieldChunk(chunk, field);
    assert(isCompositeListValue(listValue));
    return listValue;
  });
  return createCompositeListAggregate(chunks);
}

type Query = string;

function createTestAggregateObject(
  spec: [
    operation: Query | [Query, VariableValues],
    data: object,
    key?: string,
  ][],
): ObjectValue {
  // Create multiple chunks to simulate an aggregate
  const chunks: ObjectChunk[] = spec.map(([query, data, key]) => {
    const chunk = createTestChunk(query, data, key ?? false);
    assert(isObjectValue(chunk));
    return chunk;
  });
  return createObjectAggregate(chunks);
}
