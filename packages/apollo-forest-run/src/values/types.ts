// a: foo(bar:$bar) -> foo(bar:"something")
import { OPERATION_HISTORY_SYMBOL } from "../descriptor/operation";
import {
  FieldInfo,
  OperationDescriptor,
  PossibleSelections,
  TypeName,
  DataKey,
  ResolvedSelection,
  ArgumentValues,
} from "../descriptor/types";
import type { HistoryChangeSerialized } from "../forest/types";
import * as ValueKind from "./valueKind";

declare const OpaqueSymbol: unique symbol;
export type Brand<T, B extends symbol> = T & { [K in typeof OpaqueSymbol]: B };
export type Unbrand<T> = T extends Brand<infer U, any> ? U : never;
export type NestedList<T> = T[] | NestedList<T>[];
export type NestedIterable<T> = Iterable<T> | Iterable<NestedIterable<T>>;

// Raw graphql value types (coming from source JSON.parse)
declare const NullBrand: unique symbol;
declare const ObjectBrand: unique symbol;
declare const ScalarBrand: unique symbol;
declare const CustomScalarBrand: unique symbol;

export type SourceNull = Brand<null, typeof NullBrand>;
export type SourceScalar = Brand<
  number | string | boolean | bigint,
  typeof ScalarBrand
>;
export type SourceCustomScalar = Brand<unknown, typeof CustomScalarBrand>;
export type SourceObject = Brand<
  {
    __typename?: TypeName;
    [OPERATION_HISTORY_SYMBOL]?: HistoryChangeSerialized[];
    [name: string]: SourceValue | undefined;
  }, // There could be cases of missing fields for defer/include/skip and some Apollo quirks with missing fields
  typeof ObjectBrand
>;
export type SourceCompositeList = NestedList<SourceObject | SourceNull>;
export type SourceLeafList = NestedList<
  SourceScalar | SourceCustomScalar | SourceNull
>;

export type SourceValue =
  | TypeName // e.g. query { foo: __typename }
  | SourceObject
  | SourceCompositeList
  | SourceScalar
  | SourceCustomScalar
  | SourceNull
  | SourceLeafList;

// Special type useful for casting source values coming from fields _without_ nested selections
export type SourceLeafValue =
  | SourceScalar
  | SourceCustomScalar
  | SourceNull
  | SourceLeafList
  | undefined;

// Special type useful for casting source values coming from field _with_ nested selections
export type SourceCompositeValue =
  | SourceObject
  | SourceCompositeList
  | SourceNull
  | undefined;

// Raw value wrappers (useful for diffing / updating)
export type FieldName = string;

export type ObjectValue = ObjectChunk | ObjectAggregate;
export type CompositeListValue = CompositeListChunk | CompositeListAggregate;
export type CompositeNullValue = CompositeNullChunk | CompositeNullAggregate;
export type CompositeUndefinedValue =
  | CompositeUndefinedChunk
  | CompositeUndefinedAggregate;

export type ScalarValue = SourceScalar;

export type ComplexLeafValue =
  | ComplexScalarValue
  | LeafListValue
  | LeafErrorValue
  | LeafUndefinedValue;

export type CompositeValueChunk =
  | ObjectChunk
  | CompositeListChunk
  | CompositeNullChunk
  | CompositeUndefinedChunk;

export type RootChunkReference = {
  value: GraphChunk;
  parent: null;
  detached: boolean;
};
export type ObjectFieldReference = {
  value: GraphChunk;
  parent: ObjectChunk;
  field: FieldInfo;
};
export type ListItemReference = {
  value: CompositeValueChunk;
  parent: CompositeListChunk;
  index: number;
};

export type GraphChunkReference =
  | ObjectFieldReference
  | ListItemReference
  | RootChunkReference;

export type ObjectChunkReference = GraphChunkReference & { value: ObjectChunk };
export type NodeChunkReference = GraphChunkReference & { value: NodeChunk };
export type CompositeListValueReference = GraphChunkReference & {
  value: CompositeListChunk;
};
export type CompositeValueChunkReference = GraphChunkReference & {
  value: CompositeValueChunk;
};

export type ObjectChunk = {
  readonly kind: typeof ValueKind.Object;
  readonly isAggregate: false;
  readonly data: SourceObject;
  readonly operation: OperationDescriptor;
  readonly possibleSelections: PossibleSelections;
  readonly selection: ResolvedSelection;
  readonly fieldChunks: Map<
    DataKey,
    ObjectFieldReference & { value: CompositeValueChunk }
  >;
  readonly key: NodeKey | false; // TODO: only string (use empty string for non-nodes + add boolean isNode field for cases when empty string is used as a valid key)
  readonly type: TypeName | false; // TODO: only TypeName (use empty string for unknown typename)

  // ApolloCompat
  hasNestedReadPolicies: boolean;

  // **Own** properties are undefined (does not include fields of nested objects with missing fields)
  missingFields: Set<FieldInfo> | null;

  // **Nested** properties are undefined, does not contain own missingFields
  partialFields: Set<FieldInfo> | null;
};

export type ObjectAggregate = {
  readonly kind: typeof ValueKind.Object;
  readonly isAggregate: true;
  readonly data: SourceObject; // source value from the first chunk
  readonly chunks: ObjectChunk[];
  readonly nullChunks?: CompositeNullChunk[];
  readonly undefinedChunks?: CompositeUndefinedChunk[];
  readonly key: string | false;
  readonly type: TypeName | false;

  // Cached computed values: safe to reset
  fieldChunksDeduped?: Map<FieldName, ObjectChunk[]>;
};

export type CompositeListChunk = {
  readonly kind: typeof ValueKind.CompositeList;
  readonly isAggregate: false;
  readonly data: SourceCompositeList;
  readonly operation: OperationDescriptor;
  readonly possibleSelections: PossibleSelections;
  readonly itemChunks: ListItemReference[];

  // ApolloCompat :/
  hasNestedReadPolicies: boolean; // TODO: move this to resolvedSelection instead

  // **Own** items are undefined (possible when the value is deleted from cache via "cache.modify" or "cache.evict")
  //   Note: the actual "source" value always contains proper value (we do not delete it, because it could be used by product code)
  missingItems: Set<number> | null;

  // **Nested** properties or items are undefined
  partialItems: Set<number> | null;

  layout?: CompositeListLayout;
};

export type CompositeListAggregate = {
  readonly kind: typeof ValueKind.CompositeList;
  readonly isAggregate: true;
  readonly data: SourceCompositeList;
  readonly chunks: CompositeListChunk[];
  readonly nullChunks?: CompositeNullChunk[];
  // TODO:
  // readonly listChunks?: ListOfListsChunk[]
};

export type CompositeListItemKey = string | number;
export type CompositeListLayout = CompositeListItemKey[];

export type CompositeNullChunk = {
  readonly kind: typeof ValueKind.CompositeNull;
  readonly isAggregate: false;
  readonly data: SourceNull;
  readonly operation: OperationDescriptor;
  readonly possibleSelections: PossibleSelections;
  readonly error?: FormattedError;
};

export type CompositeNullAggregate = {
  readonly kind: typeof ValueKind.CompositeNull;
  readonly isAggregate: true;
  readonly data: SourceNull;
  readonly chunks: CompositeNullChunk[];
};

export type CompositeUndefinedChunk = {
  readonly kind: typeof ValueKind.CompositeUndefined;
  readonly isAggregate: false;
  readonly data: undefined;
  readonly deleted: boolean;
  readonly operation: OperationDescriptor;
  readonly possibleSelections: PossibleSelections;
  readonly error?: FormattedError;
};

export type CompositeUndefinedAggregate = {
  readonly kind: typeof ValueKind.CompositeUndefined;
  readonly isAggregate: true;
  readonly data: undefined;
  readonly deleted: boolean;
  readonly chunks: CompositeUndefinedChunk[];
};

// "LeafError" kind represents "scalars" and "list of scalars" returned as "null" due to an error.
//   Regular "null" values (without errors and without sub-selections) are represented as literal "null" values
// Object and Lists of objects replaced with "null" are represented as "CompositeNull" kind
// (with "error" field set if they were nullified due to an error)
export type LeafErrorValue = {
  readonly kind: typeof ValueKind.LeafError;
  readonly data: SourceNull;
  readonly error: FormattedError;
};

export type LeafListValue = {
  readonly kind: typeof ValueKind.LeafList;
  readonly data: SourceLeafList;
};

export type LeafUndefinedValue = {
  kind: typeof ValueKind.LeafUndefined;
  deleted: boolean;
  data: undefined;
};

// Custom scalars expressed as objects (JSON, complex dates, etc)
export type ComplexScalarValue = {
  readonly kind: typeof ValueKind.ComplexScalar;
  readonly data: SourceCustomScalar;
};

export type Aggregate =
  | ObjectAggregate
  | CompositeListAggregate
  | CompositeNullAggregate
  | CompositeUndefinedAggregate;

export type CompositeValue =
  | ObjectValue
  | CompositeListValue
  | CompositeNullValue
  | CompositeUndefinedValue;

export type GraphValue =
  | null
  | ScalarValue
  | ComplexLeafValue
  | ObjectValue
  | CompositeListValue
  | CompositeNullValue
  | CompositeUndefinedValue;

// TODO: rename to ValueChunk
export type GraphChunk =
  | null
  | ScalarValue
  | ComplexLeafValue
  | ObjectChunk
  | CompositeListChunk
  | CompositeNullChunk
  | CompositeUndefinedChunk;

export type ObjectKey = string;

export type KeySpecifier = readonly string[];
export type Key = string;

export type ObjectField = {
  readonly name: FieldName;
  readonly args?: ArgumentValues;
  readonly value: GraphValue;
};

export type FormattedError = {
  readonly message: string;
  readonly path: (string | number)[];
};

export type ObjectDraft = {
  readonly kind: typeof ValueKind.ObjectDraft;
  readonly operation: OperationDescriptor;
  readonly possibleSelections: PossibleSelections;
  readonly selection: ResolvedSelection;
  readonly type: TypeName | false;

  ref: GraphValueReference | false;
  data: SourceObject | undefined;
  incompleteValues: IncompleteValues | undefined;
  missingFields: MissingFieldsMap | undefined;
  dangling: boolean;
};

// -------------------------------------------------------------------------------------------------------------
// ---------------------------------Tree / Forest types below--------------------------------------------------
// -------------------------------------------------------------------------------------------------------------

export type OperationResult = {
  data: SourceObject;
  errors?: FormattedError[];
};

export type MissingFieldsMap = Map<SourceObject, Set<FieldInfo>>;
export type MissingFieldsArray = {
  object: SourceObject;
  fields: FieldInfo[];
}[];

export type IncompleteLists = Map<SourceCompositeList, Set<number>>;
export type IncompleteObjects = Map<SourceObject, FieldInfo[]>;
export type IncompleteValues = IncompleteObjects & IncompleteLists;

export type NodeChunk = ObjectChunk & { key: NodeKey };
export type NodeAggregate = ObjectAggregate & { key: string };
export type NodeValue = NodeChunk | NodeAggregate;

export type NodeKey = string;
export type NodeMap = Map<NodeKey, NodeChunk[]>;
export type TypeMap = Map<TypeName, Array<ObjectChunk>>;
export type DataMap = Map<SourceObject | SourceCompositeList, ParentInfo>;
export type ParentInfo = GraphChunkReference;

export type ChunkProvider = (ref: GraphValueReference) => Iterable<ObjectChunk>;
export type ChunkMatcher = (
  nodeKey: GraphValueReference,
  operation: OperationDescriptor,
  selection: ResolvedSelection,
) => ObjectChunk | undefined;

export type ParentLocator = (
  chunk: ObjectChunk | CompositeListChunk,
) => ParentInfo;

export type GraphValueReference = NodeKey | EmbeddedValueReference;
export type EmbeddedValueReference = [ParentInfo, ParentLocator];
export { ValueKind };
