import type {
  CompositeListChunk,
  CompositeListValue,
  CompositeNullChunk,
  CompositeUndefinedChunk,
  GraphChunk,
  GraphValue,
  NestedList,
  ObjectChunk,
  ObjectDraft,
  ObjectValue,
  ParentLocator,
  SourceCompositeList,
  SourceLeafValue,
  SourceNull,
  SourceObject,
  SourceValue,
} from "../values/types";
import type {
  CompositeListDifference,
  ObjectDifference,
  ValueDifference,
} from "../diff/types";
import type { FieldInfo, PossibleSelections } from "../descriptor/types";
import type {
  Draft,
  FillerEntry,
  ReplacementEntry,
  Source,
  UpdateObjectResult,
  UpdateTreeContext,
} from "./types";
import * as Difference from "../diff/difference";
import * as Value from "../values";
import { ValueKind } from "../values/types";
import { DifferenceKind } from "../diff/types";
import { assert, assertNever } from "../jsutils/assert";
import { resolveNormalizedField } from "../descriptor/resolvedSelection";

const EMPTY_ARRAY = Object.freeze([]);
const inspect = JSON.stringify.bind(JSON);

export function updateObject(
  context: UpdateTreeContext,
  base: ObjectChunk,
  diff: ObjectDifference,
): UpdateObjectResult | undefined {
  const draft = updateObjectValue(context, base, diff);

  return draft && draft !== base.data
    ? {
        draft,
        missingFields: context.missingFields,
      }
    : undefined;
}

function updateObjectValue(
  context: UpdateTreeContext,
  base: ObjectChunk,
  difference: ObjectDifference,
): SourceObject | undefined {
  if (!difference.dirtyFields?.size) {
    return undefined;
  }
  let copy = context.drafts.get(base.data);
  assert(!Array.isArray(copy));
  context.statsLogger?.copyChunkStats(base, copy);
  let dirtyFields: (FillerEntry | ReplacementEntry)[] | undefined;

  for (const fieldName of difference.dirtyFields) {
    const aliases = base.selection.fields.get(fieldName);
    for (const fieldInfo of aliases ?? EMPTY_ARRAY) {
      if (base.selection.skippedFields?.has(fieldInfo)) {
        continue;
      }
      const fieldEntry = resolveNormalizedField(base.selection, fieldInfo);
      const fieldDifference = Difference.getFieldDifference(
        difference,
        fieldEntry,
      );
      if (!fieldDifference) {
        continue;
      }
      const fieldDiff = fieldDifference.state;
      const value = Value.resolveFieldChunk(base, fieldInfo);
      const valueIsMissing = Value.isMissingValue(value);

      if (valueIsMissing && !Difference.isFiller(fieldDiff)) {
        // Inconsistent state - do not update this field
        //   (assuming it will be re-fetched from the server to resolve inconsistency)
        context.env.logger?.debug(
          base.operation.debugName +
            ` is in inconsistent state at path ` +
            Value.getDataPathForDebugging(context, base)
              .concat(fieldName)
              .join("."),
        );
        continue;
      }

      const updated = updateValue(context, value, fieldDiff, {
        kind: "field",
        fieldName: fieldInfo.name,
      });

      if (valueIsMissing && updated !== undefined) {
        context.missingFields.get(base.data)?.delete(fieldInfo);
      }
      if (updated === getSourceValue(value)) {
        continue;
      }
      if (!copy) {
        copy = { ...base.data };
        context.drafts.set(base.data, copy);
      }
      context.statsLogger?.fieldMutation();
      copy[fieldInfo.dataKey] = updated;

      // Record immediately mutated fields (ignore changes caused by nested chunk mutations)
      switch (fieldDiff.kind) {
        case DifferenceKind.Filler:
          dirtyFields ??= [];
          dirtyFields.push({
            kind: fieldDiff.kind,
            fieldInfo,
            newValue: context.env.historyConfig?.enableRichHistory
              ? updated
              : undefined,
          });
          break;
        case DifferenceKind.Replacement:
          dirtyFields ??= [];
          dirtyFields.push({
            kind: fieldDiff.kind,
            fieldInfo,
            oldValue: context.env.historyConfig?.enableRichHistory
              ? getSourceValue(fieldDiff.oldValue)
              : undefined,
            newValue: context.env.historyConfig?.enableRichHistory
              ? updated
              : undefined,
          });
          break;
      }
    }
  }
  if (dirtyFields?.length) {
    context.changes.set(base, dirtyFields);
  }
  return copy ?? base.data;
}

type UpdateValueLocation =
  | { kind: "field"; fieldName: string }
  | { kind: "listItem"; index: number };

function updateValue(
  context: UpdateTreeContext,
  base: GraphChunk,
  difference: ValueDifference,
  location: UpdateValueLocation,
): SourceValue | undefined {
  switch (difference.kind) {
    case DifferenceKind.Replacement:
      return replaceValue(context, base, difference.newValue);

    case DifferenceKind.ObjectDifference: {
      // Note: building the diagnostic message is expensive (path/type lookups), so it is
      //   constructed only on the failure path rather than eagerly passed to assert().
      if (!Value.isObjectValue(base)) {
        assert(
          false,
          incompatibleDifferenceMessage(context, base, difference, location),
        );
      }
      return updateObjectValue(context, base, difference);
    }

    case DifferenceKind.CompositeListDifference: {
      if (!Value.isCompositeListValue(base)) {
        assert(
          false,
          incompatibleDifferenceMessage(context, base, difference, location),
        );
      }
      return updateCompositeListValue(context, base, difference);
    }

    case DifferenceKind.Filler: {
      // defer/missing fields/etc
      const value =
        difference.newValue !== undefined
          ? replaceValue(context, base, difference.newValue)
          : undefined;
      return value;
    }
    default:
      assertNever(difference);
  }
}

function incompatibleDifferenceMessage(
  context: UpdateTreeContext,
  base: GraphChunk,
  difference: ObjectDifference | CompositeListDifference,
  location: UpdateValueLocation,
): string {
  const differenceKind = Difference.isObjectDifference(difference)
    ? "ObjectDifference"
    : "CompositeListDifference";
  const typeClause = incomingTypeClause(differenceTypeName(difference));
  return updateFailureMessage(
    context,
    base,
    `expected ${valueKindName(base)}, got ${differenceKind}${typeClause}`,
    location,
  );
}

function incompatibleReplacementMessage(
  context: UpdateTreeContext,
  base: GraphChunk,
  replacement: GraphValue,
  replacementKind: "Object" | "CompositeList",
): string {
  const typeClause = incomingTypeClause(graphValueTypeName(replacement));
  return updateFailureMessage(
    context,
    base,
    `cannot replace ${valueKindName(
      base,
    )} with ${replacementKind}${typeClause}`,
  );
}

// Best-effort " (of type <TypeName>)" clause naming the __typename of the value being
//   written, for diagnostics. Returns "" when no typename is available (plain embedded
//   objects, lists and scalars carry no __typename).
function incomingTypeClause(typeName: string | undefined): string {
  return typeName ? ` (of type ${typeName})` : "";
}

// __typename of an incoming value, when it is a typed object/node.
//   Defensive: the tree may be inconsistent when an invariant fires, so wrapped in try/catch.
function graphValueTypeName(value: GraphValue): string | undefined {
  try {
    if (Value.isObjectValue(value)) {
      return value.type || undefined;
    }
  } catch {
    // ignore - diagnostics only
  }
  return undefined;
}

// Best-effort __typename of the value an incompatible difference is trying to write,
//   for diagnostics. For object differences it is recovered from a dirty "__typename"
//   field (present only when the typename itself changed); for list differences it is the
//   type of the first typed item being inserted. Defensive and diagnostics-only.
function differenceTypeName(
  difference: ObjectDifference | CompositeListDifference,
): string | undefined {
  try {
    if (difference.kind === DifferenceKind.ObjectDifference) {
      const entry = difference.fieldState?.get("__typename");
      const state = (Array.isArray(entry) ? entry[0] : entry)?.state;
      if (
        state &&
        (state.kind === DifferenceKind.Replacement ||
          state.kind === DifferenceKind.Filler)
      ) {
        return typeof state.newValue === "string" ? state.newValue : undefined;
      }
      return undefined;
    }
    if (difference.kind === DifferenceKind.CompositeListDifference) {
      for (const item of difference.layout ?? EMPTY_ARRAY) {
        if (item && typeof item === "object" && Value.isObjectValue(item)) {
          if (item.type) {
            return item.type;
          }
        }
      }
    }
  } catch {
    // ignore - diagnostics only
  }
  return undefined;
}

function updateFailureMessage(
  context: UpdateTreeContext,
  base: GraphChunk,
  detail: string,
  location?: UpdateValueLocation,
): string {
  const prefix = `Failed to update "${context.operation.debugName}"`;
  const basePath = chunkPath(context, base);
  const pathString = basePath?.length
    ? basePath.join(".")
    : location
    ? describeLocation(location)
    : undefined;
  const nodeClause = nodeTypeClause(context, base);
  return pathString
    ? `${prefix} at path ${pathString}${nodeClause}: ${detail}`
    : `${prefix}${nodeClause}: ${detail}`;
}

function describeLocation(location: UpdateValueLocation): string {
  return location.kind === "field"
    ? location.fieldName
    : String(location.index);
}

// Best-effort " (in <TypeName>)" clause naming the closest enclosing node's __typename.
//   Defensive: the tree may already be inconsistent when an invariant fires, so it is
//   wrapped in try/catch and falls back to an empty clause (and aggregates are skipped,
//   as they are not addressable by the path utils).
function nodeTypeClause(
  env: { findParent: ParentLocator },
  chunk: GraphChunk,
): string {
  if (
    (!Value.isObjectValue(chunk) && !Value.isCompositeListValue(chunk)) ||
    chunk.isAggregate
  ) {
    return "";
  }
  try {
    const node = Value.findClosestNode(chunk, env.findParent);
    return node.type ? ` (in ${node.type})` : "";
  } catch {
    return "";
  }
}

// Path of a chunk within its tree, e.g. ["listContainer", "items", 0, "value"].
//   Returns undefined for values that are not addressable by the path utils (e.g. leaf values).
//   Wrapped in try/catch: this runs while reporting an invariant, so the tree may already
//   be in an inconsistent state and path resolution could throw.
function chunkPath(
  env: { findParent: ParentLocator },
  chunk: GraphChunk,
): (string | number)[] | undefined {
  if (!Value.isObjectValue(chunk) && !Value.isCompositeListValue(chunk)) {
    return undefined;
  }
  try {
    return Value.getDataPathForDebugging(env, chunk);
  } catch {
    return undefined;
  }
}

function valueKindName(value: GraphChunk): string {
  if (Value.isScalarValue(value)) {
    return "Scalar";
  }
  if (Value.isLeafNull(value)) {
    return "LeafNull";
  }
  switch (value.kind) {
    case ValueKind.Object:
      return "Object";
    case ValueKind.CompositeList:
      return "CompositeList";
    case ValueKind.CompositeNull:
      return "CompositeNull";
    case ValueKind.CompositeUndefined:
      return "CompositeUndefined";
    case ValueKind.LeafList:
      return "LeafList";
    case ValueKind.LeafError:
      return "LeafError";
    case ValueKind.LeafUndefined:
      return "LeafUndefined";
    case ValueKind.ComplexScalar:
      return "ComplexScalar";
    default:
      return assertNever(value);
  }
}

function updateCompositeListValue(
  context: UpdateTreeContext,
  base: CompositeListChunk,
  difference: CompositeListDifference,
): NestedList<SourceObject | SourceNull> | undefined {
  if (!Difference.hasDirtyItems(difference) && !difference.layout) {
    return undefined;
  }
  const { drafts, operation, statsLogger } = context;
  const layoutDiff = difference.layout;
  let dirty = false; // Only dirty on self changes - item replacement/filler, layout changes (ignores child changes)
  let copy = drafts.get(base.data);
  assert(Array.isArray(copy) || copy === undefined);
  statsLogger?.copyChunkStats(base, copy);

  // Applying item changes _before_ layout changes (i.e. before item paths change)
  for (const index of difference.dirtyItems ?? EMPTY_ARRAY) {
    const itemDiff = Difference.getListItemDifference(difference, index);
    assert(itemDiff);
    const updatedValue = updateValue(
      context,
      Value.resolveListItemChunk(base, index),
      itemDiff,
      { kind: "listItem", index },
    );
    if (updatedValue === base.data[index]) {
      continue;
    }
    if (!copy) {
      copy = [...base.data] as SourceCompositeList;
      drafts.set(base.data, copy);
    }
    copy[index] = updatedValue as Draft;
    statsLogger?.itemMutation();
    drafts.set(base.data[index] as Source, updatedValue as Draft);
    if (
      itemDiff.kind === DifferenceKind.Replacement ||
      itemDiff.kind === DifferenceKind.Filler
    ) {
      dirty = true;
    }
  }
  if (dirty) {
    context.changes.set(base, {
      kind: difference.kind,
      layout: layoutDiff,
      deletedKeys: difference.deletedKeys,
    });
  }
  if (!layoutDiff) {
    return copy ?? base.data;
  }

  if (!copy) {
    // Placeholder until layout is updated
    copy = [] as SourceCompositeList;
    drafts.set(base.data, copy);
  }

  // Update list layout.
  //   This logic assumes that list layout is updated _after_ any self and child object updates
  //   (because this will change "paths" of any child objects within the modified operation result)
  const length = layoutDiff.length;
  const result: NestedList<SourceObject | SourceNull> = new Array(length);
  for (let i = 0; i < length; i++) {
    const itemRef = layoutDiff[i];
    if (itemRef !== i) {
      dirty = true;
    }
    if (typeof itemRef === "number") {
      result[i] =
        drafts.get(base.data[itemRef] as SourceObject) ?? base.data[itemRef];
      continue;
    }
    if (itemRef === null) {
      result[i] = null as SourceNull;
      continue;
    }
    if (Value.isObjectValue(itemRef)) {
      const newValue = context.completeObject(
        itemRef,
        base.possibleSelections,
        operation,
      );
      assert(newValue.data);
      accumulateMissingFields(context, newValue);
      result[i] = newValue.data;
      continue;
    }
    const op = operation.name;
    context.env.logger?.warn(
      `Unknown list item kind: ${itemRef.kind} at #${i}\n` +
        `  source list: ${inspect(base.data)})` +
        `  operation: ${op}\n`,
    );
    result.length = 0;
    result.push(...(base.data as any));
    break;
  }
  if (copy) {
    for (let i = 0; i < result.length; i++) {
      copy[i] = result[i];
    }
    copy.length = result.length;
  } else {
    drafts.set(base.data, result);
  }
  if (copy.length !== base.data.length) {
    dirty = true;
  }

  if (dirty) {
    context.changes.set(base, {
      kind: difference.kind,
      layout: layoutDiff,
      deletedKeys: difference.deletedKeys,
    });
  }

  return copy ?? base.data;
}

// Exported for unit testing of the invariant message only (defensive guard,
//   not reachable through the public cache API).
export function replaceValue(
  context: UpdateTreeContext,
  base: GraphChunk,
  replacement: GraphValue,
): SourceValue | undefined {
  if (Value.isScalarValue(replacement)) {
    return replacement;
  }
  if (Value.isLeafNull(replacement)) {
    return null as SourceNull;
  }
  switch (replacement.kind) {
    case ValueKind.Object: {
      if (!Value.isCompositeValue(base)) {
        assert(
          false,
          incompatibleReplacementMessage(context, base, replacement, "Object"),
        );
      }
      return replaceObject(context, replacement, base.possibleSelections);
    }
    case ValueKind.CompositeList: {
      if (
        !Value.isCompositeListValue(base) &&
        !Value.isCompositeNullValue(base) &&
        !Value.isCompositeUndefinedValue(base)
      ) {
        assert(
          false,
          incompatibleReplacementMessage(
            context,
            base,
            replacement,
            "CompositeList",
          ),
        );
      }
      return replaceCompositeList(context, base, replacement);
    }

    case ValueKind.CompositeNull:
    case ValueKind.LeafError:
      return null as SourceNull;

    case ValueKind.LeafList: {
      return replacement.data;
    }

    case ValueKind.ComplexScalar:
    case ValueKind.LeafUndefined:
    case ValueKind.CompositeUndefined:
      return replacement.data;

    default:
      assertNever(replacement);
  }
}

function replaceObject(
  context: UpdateTreeContext,
  replacement: ObjectValue,
  possibleSelections: PossibleSelections,
): SourceObject {
  let fullMatch;
  let missingFields: Set<FieldInfo> | null = null;
  if (!replacement.isAggregate) {
    if (replacement.possibleSelections === possibleSelections) {
      fullMatch = replacement.data;
      missingFields = replacement.missingFields;
    }
  } else {
    for (const item of replacement.chunks) {
      if (item.possibleSelections === possibleSelections) {
        fullMatch = item.data;
        missingFields = item.missingFields;
      }
    }
  }
  if (fullMatch) {
    if (missingFields?.size) {
      context.missingFields.set(fullMatch, missingFields);
    }
    return fullMatch;
  }
  const newValue = context.completeObject(
    replacement,
    possibleSelections,
    context.operation,
  );
  assert(newValue.data);
  accumulateMissingFields(context, newValue);
  return newValue.data;
}

function replaceCompositeList(
  context: UpdateTreeContext,
  baseList: CompositeListChunk | CompositeNullChunk | CompositeUndefinedChunk,
  newList: CompositeListValue,
): SourceCompositeList | undefined {
  const len = newList.data.length;
  const result: SourceCompositeList = new Array(len);
  for (let i = 0; i < len; i++) {
    const item = Value.aggregateListItemValue(newList, i);
    if (!Value.isCompositeValue(item) || Value.isMissingValue(item)) {
      context.env.logger?.warn(
        `Failed list item #${i} replacement, returning source list\n` +
          `  new list: ${inspect(newList.data)}\n` +
          `  source list: ${inspect(baseList.data)}\n` +
          `  operation: ${context.operation.name}`,
      );
      return undefined;
    }
    if (Value.isCompositeNullValue(item)) {
      result[i] = item.data;
      continue;
    }
    if (Value.isCompositeListValue(item)) {
      // Note: we mostly care about baseList selection, so it's safe to pass "as is"
      const value = replaceCompositeList(context, baseList, item);
      if (value === undefined) {
        return undefined;
      }
      result[i] = value;
      continue;
    }
    if (Value.isObjectValue(item)) {
      result[i] = replaceObject(context, item, baseList.possibleSelections);
      continue;
    }
    assertNever(item);
  }
  return result;
}

function accumulateMissingFields(
  context: UpdateTreeContext,
  value: ObjectDraft,
) {
  if (value.missingFields?.size) {
    for (const [source, missingFields] of value.missingFields.entries()) {
      context.missingFields.set(source, missingFields);
    }
  }
}

export function getSourceValue(
  chunk: GraphValue | undefined,
): SourceValue | undefined {
  if (typeof chunk !== "object" || chunk == null) {
    return chunk as SourceLeafValue;
  }
  return chunk.data;
}
