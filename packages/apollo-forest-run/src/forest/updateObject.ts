import type {
  CompositeListChunk,
  CompositeListValue,
  CompositeNullChunk,
  CompositeUndefinedChunk,
  DataMap,
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
import type {
  FieldInfo,
  OperationDescriptor,
  PossibleSelections,
} from "../descriptor/types";
import type {
  CompleteObjectFn,
  Draft,
  ForestEnv,
  Source,
  UpdateObjectResult,
  UpdateState,
} from "./types";
import * as Difference from "../diff/difference";
import * as Value from "../values";
import { ValueKind } from "../values/types";
import { DifferenceKind } from "../diff/types";
import { assert, assertNever } from "../jsutils/assert";
import { resolveNormalizedField } from "../descriptor/resolvedSelection";
import { createParentLocator } from "../values";
import { UpdateLoggerAbstract } from "../telemetry/updateStats/types";

const EMPTY_ARRAY = Object.freeze([]);
const inspect = JSON.stringify.bind(JSON);

type Context = UpdateState & {
  env: ForestEnv;
  dataMap: DataMap;
  base: ObjectChunk;
  operation: OperationDescriptor;
  completeObjectFn: CompleteObjectFn;
  findParent: ParentLocator;
  statsLogger: UpdateLoggerAbstract;
};

export function updateObject(
  env: ForestEnv,
  dataMap: DataMap,
  base: ObjectChunk,
  diff: ObjectDifference,
  completeObjectFn: CompleteObjectFn,
  state: UpdateState,
): UpdateObjectResult | undefined {
  const { statsLogger } = state;
  const context: Context = {
    env,
    base,
    operation: base.operation,
    drafts: state.drafts,
    missingFields: state.missingFields,
    indexedTree: state.indexedTree,
    dataMap,
    completeObjectFn,
    findParent: createParentLocator(dataMap),
    statsLogger,
  };
  statsLogger.startMutation(base.type, base.selection.depth);
  const draft = updateObjectValue(context, base, diff);
  statsLogger.finishMutation();

  return draft && draft !== base.data
    ? {
        draft,
        missingFields: context.missingFields,
      }
    : undefined;
}
function updateObjectValue(
  context: Context,
  base: ObjectChunk,
  difference: ObjectDifference,
): SourceObject | undefined {
  if (!difference.dirtyFields?.size) {
    return undefined;
  }
  let copy = context.drafts.get(base.data);
  assert(!Array.isArray(copy));

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
      const value = Value.resolveFieldChunk(base, fieldInfo);
      const valueIsMissing = Value.isMissingValue(value);

      if (valueIsMissing && !Difference.isFiller(fieldDifference.state)) {
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

      const updated = updateValue(context, value, fieldDifference.state);

      if (valueIsMissing && updated !== undefined) {
        context.missingFields.get(base.data)?.delete(fieldInfo);
      }
      if (updated === getSourceValue(value)) {
        continue;
      }
      if (!copy) {
        copy = { ...base.data };
        context.statsLogger.copy(base);
        context.drafts.set(base.data, copy);
      }
      context.statsLogger.fieldMutation();
      copy[fieldInfo.dataKey] = updated;
    }
  }
  return copy ?? base.data;
}

function updateValue(
  context: Context,
  base: GraphChunk,
  difference: ValueDifference,
): SourceValue | undefined {
  switch (difference.kind) {
    case DifferenceKind.Replacement:
      return replaceValue(context, base, difference.newValue);

    case DifferenceKind.ObjectDifference: {
      assert(Value.isObjectValue(base));
      return updateObjectValue(context, base, difference);
    }

    case DifferenceKind.CompositeListDifference: {
      assert(Value.isCompositeListValue(base));
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

function updateCompositeListValue(
  context: Context,
  base: CompositeListChunk,
  difference: CompositeListDifference,
): NestedList<SourceObject | SourceNull> | undefined {
  if (!Difference.hasDirtyItems(difference) && !difference.layout) {
    return undefined;
  }
  const { drafts, operation, statsLogger } = context;
  const layoutDiff = difference.layout;
  let copy = drafts.get(base.data);
  assert(Array.isArray(copy) || copy === undefined);

  // Applying item changes _before_ layout changes (i.e. before item paths change)
  for (const index of difference.dirtyItems ?? EMPTY_ARRAY) {
    const itemDiff = Difference.getListItemDifference(difference, index);
    assert(itemDiff);
    const updatedValue = updateValue(
      context,
      Value.resolveListItemChunk(base, index),
      itemDiff,
    );
    if (updatedValue === base.data[index]) {
      continue;
    }
    if (!copy) {
      copy = [...base.data] as SourceCompositeList;
      statsLogger.copy(base);
      drafts.set(base.data, copy);
    }
    copy[index] = updatedValue as Draft;
    statsLogger.itemMutation();
    drafts.set(base.data[index] as Source, updatedValue as Draft);
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
      const newValue = context.completeObjectFn(
        itemRef,
        base.possibleSelections,
        operation,
      );
      assert(newValue.data);
      accumulateMissingFields(context, newValue);
      result[i] = newValue.data;
      continue;
    }
    const op = operation.definition.name?.value;
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

  return copy ?? base.data;
}

function replaceValue(
  context: Context,
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
      assert(Value.isCompositeValue(base));
      return replaceObject(context, replacement, base.possibleSelections);
    }
    case ValueKind.CompositeList: {
      assert(
        Value.isCompositeListValue(base) ||
          Value.isCompositeNullValue(base) ||
          Value.isCompositeUndefinedValue(base),
      );
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
  context: Context,
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
  const newValue = context.completeObjectFn(
    replacement,
    possibleSelections,
    context.operation,
  );
  assert(newValue.data);
  accumulateMissingFields(context, newValue);
  return newValue.data;
}

function replaceCompositeList(
  context: Context,
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
          `  operation: ${context.operation.definition.name?.value}`,
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

function accumulateMissingFields(context: Context, value: ObjectDraft) {
  if (value.missingFields?.size) {
    for (const [source, missingFields] of value.missingFields.entries()) {
      context.missingFields.set(source, missingFields);
    }
  }
}

function getSourceValue(
  chunk: GraphValue | undefined,
): SourceValue | undefined {
  if (typeof chunk !== "object" || chunk == null) {
    return chunk as SourceLeafValue;
  }
  return chunk.data;
}
