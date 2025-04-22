import type {
  GraphValue,
  ObjectChunk,
  GraphChunk,
  LeafUndefinedValue,
  CompositeListChunk,
  CompositeListValue,
  CompositeValue,
  CompositeValueChunk,
  ObjectAggregate,
  ObjectValue,
  SourceLeafValue,
  SourceNull,
  SourceValue,
  LeafErrorValue,
} from "./types";
import type {
  FieldInfo,
  FieldName,
  NormalizedFieldEntry,
} from "../descriptor/types";
import * as Descriptor from "../descriptor/resolvedSelection";
import * as CreateValue from "./create";
import * as Predicates from "./predicates";
import { assert, assertNever } from "../jsutils/assert";
import { accumulate } from "../jsutils/map";
import { ValueKind } from "./types";

const EMPTY_ARRAY = Object.freeze([]);

export const leafUndefinedValue: LeafUndefinedValue = Object.freeze({
  kind: ValueKind.LeafUndefined,
  deleted: false,
  data: undefined,
});

export const leafDeletedValue: LeafUndefinedValue = Object.freeze({
  kind: ValueKind.LeafUndefined,
  deleted: true,
  data: undefined,
});

export function hasField(chunk: ObjectChunk, fieldName: string): boolean {
  return chunk.selection.fields.has(fieldName);
}

export function resolveFieldNames(chunk: ObjectChunk): Iterable<FieldName> {
  return chunk.selection.fields.keys();
}

export function resolveFieldAliases(
  chunk: ObjectChunk,
  fieldName: FieldName,
): FieldInfo[] | undefined {
  return chunk.selection.fields.get(fieldName);
}

function resolveFieldEntries(
  chunk: ObjectChunk,
  fieldName: FieldName,
): NormalizedFieldEntry | NormalizedFieldEntry[] | undefined {
  const aliases = resolveFieldAliases(chunk, fieldName);
  if (!aliases?.length) {
    return undefined;
  }
  return aliases.length === 1
    ? getNormalizedField(chunk, aliases[0])
    : aliases.map((alias) => getNormalizedField(chunk, alias));
}

function getNormalizedField(
  chunk: ObjectChunk,
  field: FieldInfo,
): NormalizedFieldEntry {
  return chunk.selection.normalizedFields?.get(field) ?? field.name;
}

export function resolveFieldValue(
  chunk: ObjectChunk,
  fieldEntry: NormalizedFieldEntry,
): GraphValue | undefined {
  const aliases = resolveMatchingFieldAliases(chunk, fieldEntry) ?? EMPTY_ARRAY;

  if (!aliases.length) {
    // Returning undefined when there is no matching field in the selection
    // vs. MissingFieldValue when field is defined, but value is missing in the chunk source object
    return undefined;
  }
  if (aliases.length === 1) {
    // Fast path for most cases
    return resolveFieldChunk(chunk, aliases[0]);
  }
  const accumulator = CreateValue.createChunkAccumulator();

  for (const fieldInfo of aliases) {
    const fieldValue = resolveFieldChunk(chunk, fieldInfo);
    if (Predicates.isMissingLeafValue(fieldValue)) {
      // skip/include/defer, etc
      continue;
    }
    if (!CreateValue.shouldAggregateChunks(fieldValue)) {
      return fieldValue;
    }
    CreateValue.accumulateChunks(accumulator, fieldValue);
  }
  const value = CreateValue.createValue(accumulator);
  return value === undefined ? leafUndefinedValue : value;
}

export function hasFieldEntry(
  chunk: ObjectChunk,
  field: NormalizedFieldEntry,
): boolean {
  return resolveMatchingFieldAliases(chunk, field).length > 0;
}

export function resolveFieldChunk(
  chunk: ObjectChunk,
  field: FieldInfo,
): GraphChunk {
  // Expecting leaf value
  if (!field.selection) {
    // Need to cast because technically "value" could be anything due to custom scalars, i.e. object/scalar/null
    const value = chunk.data[field.dataKey] as SourceLeafValue;

    if (value === undefined) {
      // skip/include/defer, missing data, etc
      return leafUndefinedValue;
    }
    // Deleted data with cache.evict / cache.modify
    if (chunk.missingFields?.size && chunk.missingFields.has(field)) {
      return leafDeletedValue;
    }
    if (Predicates.isSourceScalar(value)) {
      return value;
    }
    if (value === null) {
      // TODO:
      //   const error = resolveError(chunk);
      // return error ? createLeafError(error) : null;
      return value;
    }
    if (Array.isArray(value)) {
      return CreateValue.createLeafList(value);
    }
    return CreateValue.createComplexScalarValue(value);
  }

  let parentInfo = chunk.fieldChunks.get(field.dataKey);
  if (!parentInfo) {
    const data = chunk.data[field.dataKey];
    assert(Predicates.isSourceCompositeValue(data, field));
    const fieldChunk = CreateValue.createCompositeValueChunk(
      chunk.operation,
      field.selection,
      data,
    );
    parentInfo = {
      parent: chunk,
      field,
      value: fieldChunk,
    };
    chunk.fieldChunks.set(field.dataKey, parentInfo);
  }
  return parentInfo.value;
}

export function resolveMatchingFieldAliases(
  chunk: ObjectChunk,
  fieldEntry: NormalizedFieldEntry,
): readonly FieldInfo[] {
  // Note: this is a hot-path optimized for perf
  const aliases =
    resolveFieldAliases(chunk, Descriptor.getFieldName(fieldEntry)) ??
    EMPTY_ARRAY;

  let matchingAliases = null;
  for (const fieldInfo of aliases) {
    const normalizedEntry = getNormalizedField(chunk, fieldInfo);
    if (!Descriptor.fieldEntriesAreEqual(normalizedEntry, fieldEntry)) {
      continue;
    }
    if (!matchingAliases) {
      matchingAliases = [];
    }
    matchingAliases.push(fieldInfo);
  }
  return matchingAliases?.length !== aliases?.length
    ? matchingAliases ?? EMPTY_ARRAY
    : aliases;
}

export function aggregateFieldNames(object: ObjectValue): Iterable<FieldName> {
  if (!Predicates.isAggregate(object)) {
    return resolveFieldNames(object);
  }
  if (object.chunks.length === 1 && !object.nullChunks?.length) {
    // Fast-path for 99% of cases
    return resolveFieldNames(object.chunks[0]);
  }
  return aggregateFieldChunks(object).keys();
}

export function aggregateFieldChunks(
  object: ObjectAggregate,
  dedupe = true,
): Map<FieldName, ObjectChunk[]> {
  if (object.fieldChunksDeduped) {
    return object.fieldChunksDeduped;
  }
  // Perf optimization for the edge case: skipping duplicate chunks inside a single operation
  //  Chunks may be identical here. e.g. `query { chats { id, user { name } } }`
  //  { chats: [{ id: 1, user: { id: "1" }}, { id: 2, user: { id: "1" }} ]}
  //  multiple chats may contain the same user with the same selection
  let previousSelection;
  let previousSource;

  const fieldChunks: Map<FieldName, ObjectChunk[]> = new Map();
  for (let index = 0; index < object.chunks.length; index++) {
    const chunk = object.chunks[index];
    if (
      dedupe &&
      previousSelection &&
      previousSource &&
      chunk.selection === previousSelection &&
      chunk.operation === previousSource
    ) {
      // TODO: do not dedupe chunks containing fields with errors
      continue;
    }
    previousSelection = chunk.selection;
    previousSource = chunk.operation;

    for (const fieldName of resolveFieldNames(chunk)) {
      accumulate(fieldChunks, fieldName, chunk);
    }
  }
  object.fieldChunksDeduped = fieldChunks;
  return fieldChunks;
}

export function aggregateFieldEntries(
  object: ObjectValue,
  fieldName: FieldName,
): NormalizedFieldEntry | NormalizedFieldEntry[] | undefined {
  if (fieldName === "__typename") {
    return fieldName;
  }
  if (!Predicates.isAggregate(object)) {
    return resolveFieldEntries(object, fieldName);
  }
  const parentChunks =
    object.fieldChunksDeduped?.get(fieldName) ?? object.chunks;

  if (parentChunks.length === 1) {
    return resolveFieldEntries(parentChunks[0], fieldName);
  }

  let fieldEntries: NormalizedFieldEntry | NormalizedFieldEntry[] | undefined;

  for (const chunk of parentChunks) {
    const chunkEntries = resolveFieldEntries(chunk, fieldName);
    if (!chunkEntries || fieldEntries === chunkEntries) {
      continue;
    }
    if (!fieldEntries) {
      fieldEntries = chunkEntries;
      continue;
    }
    if (!Array.isArray(fieldEntries)) {
      fieldEntries = !Array.isArray(chunkEntries)
        ? [fieldEntries, chunkEntries]
        : [fieldEntries, ...chunkEntries];
      continue;
    }
    if (!Array.isArray(chunkEntries)) {
      fieldEntries.push(chunkEntries);
    } else {
      fieldEntries.push(...chunkEntries);
    }
  }
  return Array.isArray(fieldEntries)
    ? dedupeFieldEntries(fieldEntries)
    : fieldEntries;
}

export function aggregateFieldValue(
  parent: ObjectValue,
  fieldEntry: NormalizedFieldEntry,
): GraphValue | LeafUndefinedValue | undefined {
  // Fast path for the most common cases
  if (!parent.isAggregate) {
    return resolveFieldValue(parent, fieldEntry);
  }
  const fieldName = Descriptor.getFieldName(fieldEntry);
  const parentChunks =
    parent.fieldChunksDeduped?.get(fieldName) ?? parent.chunks;

  if (parentChunks.length === 1 && !parent.nullChunks?.length) {
    return resolveFieldValue(parentChunks[0], fieldEntry);
  }

  let fieldChunks: (LeafErrorValue | CompositeValue)[] | undefined;

  let hasField = false;
  let deleted = false;
  let isNull = false;

  // ApolloCompat: mimic last-write wins approach where the last chunk actually has precedence over all others
  for (let index = parentChunks.length - 1; index >= 0; index--) {
    const parentObjectChunk = parentChunks[index];
    const fieldValue = resolveFieldValue(parentObjectChunk, fieldEntry);

    if (fieldValue === undefined) {
      continue;
    }
    if (fieldValue === null) {
      hasField = true;
      isNull = true;
      continue;
    }
    if (Predicates.isMissingValue(fieldValue)) {
      deleted ||= fieldValue.deleted;
      hasField = true;
      continue;
    }
    if (!CreateValue.shouldAggregateChunks(fieldValue)) {
      return fieldValue;
    }
    hasField = true;
    fieldChunks ??= [];
    fieldChunks.push(fieldValue);
  }
  if (!hasField) {
    return undefined;
  }
  // Undo chunk reversal that was done for Apollo compatibility (chunk aggregation MUST NOT be reversed)
  const accumulator = CreateValue.createChunkAccumulator();
  if (fieldChunks?.length) {
    for (let index = fieldChunks.length - 1; index >= 0; index--) {
      const fieldValue = fieldChunks[index];
      CreateValue.accumulateChunks(accumulator, fieldValue);
    }
  }
  const value = CreateValue.createValue(accumulator);
  if (value !== undefined) {
    return value;
  }
  if (isNull) {
    return null;
  }
  return deleted ? leafDeletedValue : leafUndefinedValue;
}

function dedupeFieldEntries(
  entries: NormalizedFieldEntry[],
): NormalizedFieldEntry | NormalizedFieldEntry[] {
  // TODO
  return entries;
}

export function resolveListItemChunk(
  chunk: CompositeListChunk,
  index: number,
): CompositeValueChunk {
  let parentInfo = chunk.itemChunks[index];
  if (!parentInfo) {
    // The following "assert" currently conflicts with "extract" which mixes data from multiple layers
    //   (so the same logical array may contain chunks of different lengths, which is incorrect)
    // TODO: rework the logic in `extract` and then enable this (and tests)
    //   assert(0 <= index && index < chunk.data.length);
    const chunkValue = CreateValue.createCompositeValueChunk(
      chunk.operation,
      chunk.possibleSelections,
      chunk.data[index],
    );
    parentInfo = {
      value: chunkValue,
      parent: chunk,
      index,
    };
    chunk.itemChunks[index] = parentInfo;
  }
  return parentInfo.value;
}

export function aggregateListItemValue(
  parent: CompositeListValue,
  index: number,
): CompositeValue {
  if (!Predicates.isAggregate(parent)) {
    // Fast path for the most common case
    return resolveListItemChunk(parent, index);
  }
  const accumulator = CreateValue.createChunkAccumulator();
  for (const chunk of parent.chunks) {
    const itemChunk = resolveListItemChunk(chunk, index);
    CreateValue.accumulateChunks(accumulator, itemChunk);
  }
  const result = CreateValue.createValue(accumulator);
  assert(Predicates.isCompositeValue(result));

  return result;
}

export function getFirstSourceValue(
  value: GraphValue,
): SourceValue | undefined {
  if (Predicates.isScalarValue(value)) {
    return value;
  }
  if (Predicates.isLeafNull(value)) {
    return null as SourceNull;
  }
  if (
    Predicates.isCompositeValue(value) ||
    Predicates.isComplexLeafValue(value)
  ) {
    return value.data;
  }
  assertNever(value);
}
