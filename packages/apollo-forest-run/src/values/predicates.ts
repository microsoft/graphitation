import type {
  Aggregate,
  ComplexLeafValue,
  ComplexScalarValue,
  CompositeListValue,
  CompositeNullValue,
  CompositeUndefinedValue,
  CompositeValue,
  GraphValue,
  LeafErrorValue,
  LeafListValue,
  LeafUndefinedValue,
  NodeValue,
  ObjectDraft,
  ObjectValue,
  ListItemReference,
  ObjectFieldReference,
  GraphChunkReference,
  RootChunkReference,
  ScalarValue,
  SourceCompositeValue,
  SourceObject,
  SourceScalar,
  SourceValue,
  CompositeListChunk,
} from "./types";
import { ValueKind } from "./types";
import { FieldInfo } from "../descriptor/types";
import { assertNever } from "../jsutils/assert";
import {
  ChangedChunksTuple,
  CompositeListDifferenceEntry,
} from "../forest/types";

export const isSourceObject = (value: unknown): value is SourceObject =>
  typeof value === "object" && value !== null;

export const isSourceScalar = (value: unknown): value is SourceScalar =>
  typeof value === "number" ||
  typeof value === "boolean" ||
  typeof value === "string" ||
  typeof value === "bigint";

export const isSourceCompositeValue = (
  value: SourceValue | undefined,
  field: FieldInfo,
): value is SourceCompositeValue =>
  field.selection
    ? typeof value === "object" || value === undefined // object, null, array, undefined
    : false;

export const isObjectValue = (
  value: GraphValue | ObjectDraft,
): value is ObjectValue =>
  typeof value === "object" &&
  value !== null &&
  value.kind === ValueKind.Object;

export const isNodeValue = (
  value: GraphValue | ObjectDraft,
): value is NodeValue => isObjectValue(value) && typeof value.key === "string";

export const isCompositeListValue = (
  value: GraphValue | ObjectDraft,
): value is CompositeListValue =>
  typeof value === "object" &&
  value !== null &&
  value.kind === ValueKind.CompositeList;

export const isLeafListValue = (
  value: GraphValue | undefined,
): value is LeafListValue =>
  typeof value === "object" &&
  value !== null &&
  value.kind === ValueKind.LeafList;

export const isScalarValue = (value: unknown): value is ScalarValue =>
  isSourceScalar(value);

export const isComplexScalarValue = (
  value: GraphValue,
): value is ComplexScalarValue =>
  typeof value === "object" &&
  value !== null &&
  value.kind === ValueKind.ComplexScalar;

export const isLeafNull = (value: GraphValue): value is null => value === null;

export const isCompositeNullValue = (
  value: GraphValue | ObjectDraft,
): value is CompositeNullValue =>
  typeof value === "object" &&
  value !== null &&
  value.kind === ValueKind.CompositeNull;

export const isCompositeUndefinedValue = (
  value: GraphValue | ObjectDraft,
): value is CompositeUndefinedValue =>
  typeof value === "object" &&
  value !== null &&
  value.kind === ValueKind.CompositeUndefined;

export const isLeafErrorValue = (value: GraphValue): value is LeafErrorValue =>
  typeof value === "object" &&
  value !== null &&
  value.kind === ValueKind.LeafError;

const CompositeValueTypes = [
  ValueKind.Object,
  ValueKind.CompositeList,
  ValueKind.CompositeNull,
  ValueKind.CompositeUndefined,
];

export const isCompositeValue = (
  value: GraphValue | ObjectDraft | undefined,
): value is CompositeValue =>
  typeof value === "object" &&
  value !== null &&
  CompositeValueTypes.includes(value.kind);

const ComplexLeafValueTypes = [
  ValueKind.LeafList,
  ValueKind.LeafError,
  ValueKind.ComplexScalar,
  ValueKind.LeafUndefined,
];

export const isComplexValue = (
  value: GraphValue | ObjectDraft | undefined,
): value is ComplexLeafValue | CompositeValue =>
  isCompositeValue(value) || isComplexLeafValue(value);

export const isComplexLeafValue = (
  value: GraphValue | ObjectDraft | undefined,
): value is ComplexLeafValue =>
  typeof value === "object" &&
  value !== null &&
  ComplexLeafValueTypes.includes(value.kind);

export const isSimpleLeafValue = (
  value: GraphValue,
): value is ScalarValue | null => typeof value !== "object";

export const isLeafValue = (
  value: GraphValue,
): value is ComplexLeafValue | ScalarValue | null =>
  isSimpleLeafValue(value) || isComplexLeafValue(value);

export const isAggregate = (value: CompositeValue): value is Aggregate =>
  value.isAggregate === true;

export const isMissingLeafValue = (
  value: GraphValue,
): value is LeafUndefinedValue =>
  typeof value === "object" &&
  value !== null &&
  value.kind === ValueKind.LeafUndefined;

export function isDeletedValue(
  value: GraphValue,
): value is (LeafUndefinedValue | CompositeUndefinedValue) & { deleted: true } {
  if (isMissingLeafValue(value)) {
    return value.deleted;
  }
  if (!isCompositeUndefinedValue(value)) {
    return false;
  }
  return isAggregate(value)
    ? value.chunks.every((chunk) => chunk.deleted)
    : value.deleted;
}

export const isMissingValue = (
  value: GraphValue,
): value is LeafUndefinedValue | CompositeUndefinedValue =>
  typeof value === "object" && value !== null && value.data === undefined;

export function isCompatibleValue(
  value: GraphValue,
  other: GraphValue,
): boolean {
  if (isSimpleLeafValue(value)) {
    if (isSimpleLeafValue(other)) {
      return typeof value === typeof other || value === null || other === null;
    }
    if (isComplexLeafValue(other)) {
      return other.data == null;
    }
    return false;
  }
  if (isComplexLeafValue(value)) {
    if (isComplexLeafValue(other)) {
      return (
        value.kind === other.kind || value.data == null || other.data == null
      );
    }
    if (isSimpleLeafValue(other)) {
      return value.data == null;
    }
    return false;
  }
  if (isCompositeValue(value)) {
    if (isCompositeValue(other)) {
      return (
        value.kind === other.kind || other.data == null || value.data == null
      );
    }
    return false;
  }
  assertNever(value);
}

export const isCompositeListEntryTuple = (
  entry: ChangedChunksTuple,
): entry is [CompositeListChunk, CompositeListDifferenceEntry] =>
  entry[0].kind === ValueKind.CompositeList;

export const isParentObjectRef = (
  parentRef: GraphChunkReference,
): parentRef is ObjectFieldReference =>
  (parentRef as { field?: FieldInfo }).field !== undefined;

export const isParentListRef = (
  parentRef: GraphChunkReference,
): parentRef is ListItemReference =>
  (parentRef as { index?: number }).index !== undefined;

export const isRootRef = (
  parentRef: GraphChunkReference,
): parentRef is RootChunkReference => parentRef.parent === null;
