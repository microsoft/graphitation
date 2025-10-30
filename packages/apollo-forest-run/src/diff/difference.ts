import type { NormalizedFieldEntry } from "../descriptor/types";
import type { CompositeValue, FieldName, GraphValue } from "../values/types";
import type {
  CompositeListDifference,
  FieldEntryDifference,
  Filler,
  ObjectDifference,
  Replacement,
  ValueDifference,
} from "./types";
import * as Descriptor from "../descriptor/resolvedSelection";
import { assertNever } from "../jsutils/assert";
import { isCompositeValue } from "../values/predicates";
import { ValueKind } from "../values/types";
import { DifferenceKind } from "./types";

const EMPTY_ARRAY = Object.freeze([]);

export function createObjectDifference(
  fieldQueue: Iterable<FieldName> | null = null,
): ObjectDifference {
  return {
    kind: DifferenceKind.ObjectDifference,
    fieldQueue: new Set(fieldQueue),
    fieldState: new Map(),
    dirtyFields: undefined,
    errors: undefined,
  };
}

export function enqueueField(
  diff: ObjectDifference = createObjectDifference(),
  fieldName: FieldName | NormalizedFieldEntry,
) {
  diff.fieldQueue ??= new Set();
  diff.fieldQueue.add(Descriptor.getFieldName(fieldName));
  return diff;
}

export function dequeueField(
  diff: ObjectDifference,
  fieldName: FieldName | NormalizedFieldEntry,
) {
  if (diff.fieldQueue) {
    diff.fieldQueue.delete(Descriptor.getFieldName(fieldName));
  }
  return diff;
}

export function addDirtyField(
  diff: ObjectDifference,
  fieldName: FieldName | NormalizedFieldEntry,
) {
  diff.dirtyFields ??= new Set();
  diff.dirtyFields.add(Descriptor.getFieldName(fieldName));
}

export function allFieldEntriesComplete(
  diff: ObjectDifference,
  fieldName: string,
): boolean {
  const fieldDiff = diff.fieldState.get(fieldName);
  if (!fieldDiff) {
    // Field is enqueued, but state is not initialized yet
    return false;
  }
  if (!Array.isArray(fieldDiff)) {
    return isComplete(fieldDiff.state);
  }
  return fieldDiff.every((entryDiff) => isComplete(entryDiff.state));
}

export function createCompositeListDifference(): CompositeListDifference {
  return {
    kind: DifferenceKind.CompositeListDifference,
    itemState: new Map(),
    itemQueue: new Set(),
    dirtyItems: undefined,
    layout: undefined,
    itemsChanges: [],
    errors: undefined,
  };
}

export function enqueueListItem(diff: CompositeListDifference, index: number) {
  diff.itemQueue ??= new Set();
  diff.itemQueue.delete(index);
}

export function dequeueListItem(diff: CompositeListDifference, index: number) {
  if (diff.itemQueue) {
    diff.itemQueue.delete(index);
  }
}

export function addDirtyListItem(diff: CompositeListDifference, index: number) {
  diff.dirtyItems ??= new Set();
  diff.dirtyItems.add(index);
}

export function createCompositeValueDifference(
  value: CompositeValue,
): ValueDifference {
  // By default, assuming everything is dirty
  //   only after full diff of a sub-branch we can be sure if it is clean
  switch (value.kind) {
    case ValueKind.Object:
      return createObjectDifference();
    case ValueKind.CompositeList:
      return createCompositeListDifference();
    default:
      throw new Error(
        `InvariantViolation: ${value["kind"]} is not supported value kind`,
      );
  }
}

export function getFieldQueue(
  diff: ObjectDifference | undefined,
): Set<FieldName> | undefined {
  return diff?.fieldQueue;
}

export function getFieldEntryQueue(
  diff: ObjectDifference | undefined,
  fieldName: FieldName,
): NormalizedFieldEntry | NormalizedFieldEntry[] | undefined {
  if (!diff?.fieldState) {
    return;
  }
  const fieldDiff = diff.fieldState.get(fieldName);
  if (!fieldDiff) {
    return;
  }
  if (!Array.isArray(fieldDiff)) {
    return isComplete(fieldDiff.state) ? undefined : fieldDiff.fieldEntry;
  }
  const fieldEntryQueue: NormalizedFieldEntry[] = [];
  for (const entryDiff of fieldDiff) {
    if (!isComplete(entryDiff.state)) {
      fieldEntryQueue.push(entryDiff.fieldEntry);
    }
  }
  return fieldEntryQueue;
}

export function createFieldEntryDifference(
  fieldEntry: NormalizedFieldEntry,
  state: ValueDifference,
): FieldEntryDifference {
  return {
    kind: DifferenceKind.FieldEntryDifference,
    fieldEntry,
    state,
  };
}

export function getFieldDifference(
  diff: ObjectDifference | undefined,
  fieldEntry: NormalizedFieldEntry,
): FieldEntryDifference | undefined {
  if (!diff?.fieldState) {
    return undefined;
  }
  const fieldState = diff.fieldState.get(Descriptor.getFieldName(fieldEntry));
  if (!fieldState) {
    return undefined;
  }
  if (!Array.isArray(fieldState)) {
    return Descriptor.fieldEntriesAreEqual(fieldState.fieldEntry, fieldEntry)
      ? fieldState
      : undefined;
  }
  return fieldState.find((entry) =>
    Descriptor.fieldEntriesAreEqual(entry.fieldEntry, fieldEntry),
  );
}

export function getListItemDifference(
  diff: CompositeListDifference | undefined,
  index: number,
): ValueDifference | undefined {
  return diff?.itemState.get(index);
}

export function addListItemDifference(
  parent: CompositeListDifference,
  position: number,
  itemDifference: ValueDifference,
) {
  parent.itemState ??= new Map();
  parent.itemState.set(position, itemDifference);
  return itemDifference;
}

export function addFieldDifference(
  { fieldState }: ObjectDifference,
  fieldEntry: NormalizedFieldEntry,
  valueDiff: ValueDifference,
): FieldEntryDifference {
  const fieldName = Descriptor.getFieldName(fieldEntry);
  const fieldEntryDiff = createFieldEntryDifference(fieldEntry, valueDiff);
  const existingFieldEntries = fieldState.get(fieldName);

  if (!existingFieldEntries) {
    fieldState.set(fieldName, fieldEntryDiff);
    return fieldEntryDiff;
  }
  if (!Array.isArray(existingFieldEntries)) {
    fieldState.set(fieldName, [existingFieldEntries, fieldEntryDiff]);
    return fieldEntryDiff;
  }
  existingFieldEntries.push(fieldEntryDiff);
  return fieldEntryDiff;
}

export function createReplacement(
  oldValue: GraphValue,
  newValue: GraphValue,
): Replacement {
  // Caveat:
  //   Lists and objects can be safely replaced _only_ if selectionSets of oldValue and newValue fully match
  //   In all other cases additional reading of oldValue's selectionSet from newValue is necessary.
  //   Such "reading" is a complicated process (may return partial results, contain type-specific logic, stateful logic, etc)
  //   So it is **out of scope** of diffing and instead should occur when applying differences

  return {
    kind: DifferenceKind.Replacement,
    oldValue,
    newValue,
  };
}

export function createFiller(newValue: GraphValue): Filler {
  return {
    kind: DifferenceKind.Filler,
    newValue,
  };
}

export function hasDirtyItems(value: CompositeListDifference): boolean {
  return Boolean(value.dirtyItems?.size);
}

export function isObjectDifference(
  state?: ValueDifference,
): state is ObjectDifference {
  return state?.kind === DifferenceKind.ObjectDifference;
}

export function isCompositeListDifference(
  state?: ValueDifference,
): state is CompositeListDifference {
  return state?.kind === DifferenceKind.CompositeListDifference;
}

export function isReplacement(state?: ValueDifference): state is Replacement {
  return state?.kind === DifferenceKind.Replacement;
}

export function isFiller(state?: ValueDifference): state is Filler {
  return state?.kind === DifferenceKind.Filler;
}

export function isDirty(value: ValueDifference): boolean {
  switch (value.kind) {
    case DifferenceKind.Replacement:
      return true;

    case DifferenceKind.Filler:
      return true;

    case DifferenceKind.ObjectDifference:
      return Boolean(value.dirtyFields?.size);

    case DifferenceKind.CompositeListDifference:
      return Boolean(value.dirtyItems?.size) || Boolean(value.layout);

    default:
      assertNever(value);
  }
}

export function isComplete(
  value: ValueDifference | FieldEntryDifference,
): boolean {
  switch (value.kind) {
    case DifferenceKind.Replacement:
      return true;

    case DifferenceKind.Filler:
      return true;

    case DifferenceKind.FieldEntryDifference:
      return isComplete(value.state);

    case DifferenceKind.ObjectDifference:
      return value.fieldQueue.size === 0;

    case DifferenceKind.CompositeListDifference:
      return value.itemQueue.size === 0;

    default:
      assertNever(value);
  }
}

export function hasStructuralChanges(diff?: ValueDifference): boolean {
  if (!diff) {
    return false;
  }
  switch (diff.kind) {
    case DifferenceKind.Filler:
      return true;

    case DifferenceKind.Replacement:
      return isCompositeValue(diff.newValue);

    case DifferenceKind.CompositeListDifference:
      return Boolean(
        diff.layout?.some(
          (item) => typeof item === "object" && item !== null,
        ) ||
          [...(diff.dirtyItems ?? EMPTY_ARRAY)].some((index) =>
            hasStructuralChanges(diff.itemState.get(index)),
          ),
      );
    case DifferenceKind.ObjectDifference:
      return Boolean(
        [...(diff.dirtyFields ?? EMPTY_ARRAY)].some((fieldName) =>
          fieldHasStructuralChanges(diff.fieldState.get(fieldName)),
        ),
      );
    default:
      assertNever(diff);
  }
}

function fieldHasStructuralChanges(
  fieldDiff: FieldEntryDifference | FieldEntryDifference[] | undefined,
) {
  if (!fieldDiff) {
    return false;
  }
  if (!Array.isArray(fieldDiff)) {
    return hasStructuralChanges(fieldDiff.state);
  }
  return fieldDiff.some((entry) => hasStructuralChanges(entry.state));
}
