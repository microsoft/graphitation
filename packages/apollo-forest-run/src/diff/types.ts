import {
  GraphValue,
  ObjectChunk,
  FieldName,
  CompositeListValue,
  ObjectValue,
  SourceObject,
  SourceCompositeList,
} from "../values/types";
import { FieldInfo, NormalizedFieldEntry } from "../descriptor/types";

export type DiffEnv = {
  allowMissingFields?: boolean;

  listItemKey?: (
    item: SourceObject | SourceCompositeList,
    index: number,
    // TODO:
    //   parentType: TypeName
    //   parentFieldName: string
  ) => string | number;
};

export type DiffContext = {
  env: DiffEnv;
  errors: DiffError[] | undefined;
};

export type ObjectDiffState = {
  difference?: ObjectDifference;
  errors?: DiffError[];
  allowMissingFields?: boolean;
};

export type DiffState = {
  difference?: ValueDifference;
  errors?: (DiffError | MissingModelError)[];
  allowMissingFields?: boolean;
};

export const enum DiffErrorKind {
  MissingModelValue,
  MissingModelFields,
  MissingBaseFields,
}

export type MissingModelError = {
  kind: DiffErrorKind.MissingModelValue;
};

export type MissingModelFieldsError = {
  kind: DiffErrorKind.MissingModelFields;
  chunk: ObjectChunk;
  missingFields: FieldInfo[];
};

export type MissingBaseFieldsError = {
  kind: DiffErrorKind.MissingBaseFields;
  chunk: ObjectChunk;
  missingFields: FieldInfo[];
};

export type DiffFieldError = MissingModelFieldsError | MissingBaseFieldsError;

export type DiffError =
  | MissingModelError
  | MissingModelFieldsError
  | MissingBaseFieldsError;

/**
 * Contains current diffing state.
 *
 * Since diff is executed against multiple object chunks, we may end up comparing the same field multiple times.
 * Information about diffing against previous chunks helps us skip unnecessary work and makes diffing more efficient.
 *
 * This state is supposed to be short-lived: usually within one event loop tick, while we are diffing a single
 * model object against all other base objects.
 *
 * State is an implementation detail of diffing algorithm and should not be relied upon by consumers: it can change at any time
 */
export const enum DifferenceKind {
  Replacement,
  Filler,
  ObjectDifference,
  CompositeListDifference,
  FieldEntryDifference,
}

export type ObjectDifference = {
  readonly kind: DifferenceKind.ObjectDifference;
  // readonly allFields: Iterable<FieldName>;

  fieldQueue: Set<FieldName>;
  fieldState: Map<FieldName, FieldEntryDifference | FieldEntryDifference[]>;
  dirtyFields?: Set<FieldName>;
  errors?: DiffError[];
};

export type FieldEntryDifference = {
  readonly kind: DifferenceKind.FieldEntryDifference;
  fieldEntry: NormalizedFieldEntry;
  state: ValueDifference;
};

export type CompositeListDifference = {
  readonly kind: DifferenceKind.CompositeListDifference;
  itemQueue: Set<number>;
  itemState: Map<number, ValueDifference>;
  dirtyItems?: Set<number>;
  layout?: CompositeListLayoutDifference;
  deletedKeys?: string[];
  errors?: DiffError[];
};

type AddedValue = CompositeListValue | ObjectValue;
export type CompositeListLayoutDifference = (number | null | AddedValue)[];

export type Replacement = {
  readonly kind: DifferenceKind.Replacement;
  oldValue: GraphValue;
  newValue: GraphValue;
};

export type Filler = {
  readonly kind: DifferenceKind.Filler;
  readonly newValue: GraphValue;
};

export type ValueDifference =
  | ObjectDifference
  | CompositeListDifference
  | Replacement
  | Filler;

export type NodeDifferenceMap = Map<string, ObjectDifference>;
