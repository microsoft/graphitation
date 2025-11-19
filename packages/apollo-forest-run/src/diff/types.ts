import {
  GraphValue,
  ObjectChunk,
  FieldName,
  CompositeListValue,
  ObjectValue,
  SourceObject,
  SourceCompositeList,
  NestedList,
  MissingFieldsMap,
} from "../values/types";
import { FieldInfo, NormalizedFieldEntry } from "../descriptor/types";
import type { HistoryConfig } from "../cache/types";
import * as DifferenceKind from "./differenceKind";
import * as DiffErrorKind from "./diffErrorKind";
import * as ChangeKind from "./itemChangeKind";

export type DiffEnv = {
  allowMissingFields?: boolean;

  listItemKey?: (
    item: SourceObject | SourceCompositeList,
    index: number,
    // TODO:
    //   parentType: TypeName
    //   parentFieldName: string
  ) => string | number;

  // History configuration
  historyConfig?: HistoryConfig;
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

export type MissingModelError = {
  kind: typeof DiffErrorKind.MissingModelValue;
};

export type MissingModelFieldsError = {
  kind: typeof DiffErrorKind.MissingModelFields;
  chunk: ObjectChunk;
  missingFields: FieldInfo[];
};

export type MissingBaseFieldsError = {
  kind: typeof DiffErrorKind.MissingBaseFields;
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
export type ObjectDifference = {
  readonly kind: typeof DifferenceKind.ObjectDifference;
  // readonly allFields: Iterable<FieldName>;

  fieldQueue: Set<FieldName>;
  fieldState: Map<FieldName, FieldEntryDifference | FieldEntryDifference[]>;
  dirtyFields?: Set<FieldName>;
  errors?: DiffError[];
};

export type FieldEntryDifference = {
  readonly kind: typeof DifferenceKind.FieldEntryDifference;
  fieldEntry: NormalizedFieldEntry;
  state: ValueDifference;
};

export type CompositeListLayoutItemAdded = {
  kind: typeof ChangeKind.ItemAdd;
  index: number;
  missingFields?: MissingFieldsMap | undefined;
  data?: SourceObject | NestedList<SourceObject> | null;
};

export type CompositeListLayoutItemRemoved = {
  kind: typeof ChangeKind.ItemRemove;
  oldIndex: number;
  data?: SourceObject | NestedList<SourceObject>;
};

export type CompositeListLayoutIndexChange = {
  kind: typeof ChangeKind.ItemIndexChange;
  index: number;
  oldIndex: number;
  data?: SourceObject | NestedList<SourceObject>;
};

export type CompositeListLayoutChange =
  | CompositeListLayoutItemRemoved
  | CompositeListLayoutIndexChange
  | CompositeListLayoutItemAdded
  | undefined;

export type CompositeListDifference = {
  readonly kind: typeof DifferenceKind.CompositeListDifference;
  itemQueue: Set<number>;
  itemState: Map<number, ValueDifference>;
  dirtyItems?: Set<number>;
  layout?: CompositeListLayoutDifference;
  deletedKeys?: Set<number>;
  errors?: DiffError[];
};

type AddedValue = CompositeListValue | ObjectValue;
export type CompositeListLayoutDifference = (number | null | AddedValue)[];

export type Replacement = {
  readonly kind: typeof DifferenceKind.Replacement;
  oldValue: GraphValue;
  newValue: GraphValue;
};

export type Filler = {
  readonly kind: typeof DifferenceKind.Filler;
  readonly newValue: GraphValue;
};

export type ValueDifference =
  | ObjectDifference
  | CompositeListDifference
  | Replacement
  | Filler;

export type NodeDifferenceMap = Map<string, ObjectDifference>;
export { DifferenceKind, DiffErrorKind };
