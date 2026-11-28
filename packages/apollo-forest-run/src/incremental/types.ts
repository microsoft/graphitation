import type {
  DataKey,
  FieldInfo,
  FieldName,
  TypeName,
  DeferLabel,
  FormattedError,
  NodeKey,
  PossibleSelections,
  ResponsePath,
} from "../descriptor/types";
import type { Draft, IndexedTree, Source } from "../forest/types";
import type {
  MissingFieldsMap,
  ObjectChunk,
  SourceObject,
} from "../values/types";
import type { MissingBaseFieldsError } from "../diff/types";

/**
 * Results of incremental delivery (`@defer`) in the 2022-09-17 draft of the `@defer` / `@stream` RFC
 * (deferred fragments addressed by `path` and `label`), as in Apollo Client 4 `Defer20220917Handler`.
 *
 * TODO: support the current incremental delivery format (graphql-js 17: `pending`, `id`, `subPath`, `completed`),
 *   see spliceSubsequentResult
 */

export type ResultData = Record<string, unknown>;
export type ResultExtensions = Record<string, unknown>;

export type CompleteExecutionResult = {
  data: ResultData;
  errors?: ReadonlyArray<FormattedError>;
  extensions?: ResultExtensions;
};

// The 2022-09-17 draft format

export type InitialIncrementalExecutionResult = CompleteExecutionResult & {
  hasNext: boolean;
};

export type SubsequentIncrementalExecutionResult = {
  incremental?: ReadonlyArray<IncrementalDeferResult | IncrementalStreamResult>;
  hasNext: boolean;
  extensions?: ResultExtensions;
};

export type IncrementalDeferResult = {
  data?: ResultData | null;
  errors?: ReadonlyArray<FormattedError>;
  extensions?: ResultExtensions;
  path?: ResponsePath;
  label?: DeferLabel;
};

export type IncrementalStreamResult = {
  items?: ReadonlyArray<unknown> | null;
  errors?: ReadonlyArray<FormattedError>;
  extensions?: ResultExtensions;
  path?: ResponsePath;
  label?: DeferLabel;
};

// Identifies an incremental execution (e.g. a request id), compared by equality.
//   Only needed to ignore late results of a superseded execution of the same operation (with the same variables)
export type ExecutionKey = string | number | object;

/**
 * Anything that can be written to the cache: a complete result, or results of incremental delivery.
 *
 * `key` identifies an incremental execution (defaults to the operation, i.e. a single execution at a time).
 */
export type ExecutionResult = (
  | CompleteExecutionResult
  | InitialIncrementalExecutionResult
  | SubsequentIncrementalExecutionResult
) & { key?: ExecutionKey };

// Results written as a whole (subsequent results are spliced into the stored result first)
export type InitialExecutionResult = (
  | CompleteExecutionResult
  | InitialIncrementalExecutionResult
) & { key?: ExecutionKey };

export type SubsequentExecutionResult = SubsequentIncrementalExecutionResult & {
  key?: ExecutionKey;
};

// State of incremental executions

// Serialized response path (response keys and list indexes joined with ".")
export type ResponsePathKey = string;

export type IncrementalExecution = {
  // A new execution of the operation replaces the previous one (late results of the previous one are ignored)
  key: ExecutionKey | undefined;
  // Addresses of objects with deferred fragments by their (server) response paths
  placeholders: Map<ResponsePathKey, ObjectAddress>;
  // Data received from the server so far (in the server view), at defer sites and below:
  //   identifies delivered objects and data delivered already (see spliceData). Sparse, references (copy-on-write)
  serverData: SourceObject | undefined;
  // The latest result of an operation which is not stored in the forest (e.g. a mutation): results are spliced into it
  transientTree: IndexedTree | undefined;
};

/**
 * Address of an object: its closest node and the path from that node (not the response path),
 * so it stays valid when other writes change the stored result (e.g. items are prepended to a list,
 * see apollographql/apollo-client#13530). Captured in the server view (see capturePlaceholders),
 * resolved in the current stored result via `tree.nodes`.
 *
 * Note: list indexes of embedded (unkeyed) lists between the node and the object are not stable.
 */
export type ObjectAddress = {
  nodeKey: NodeKey;
  nodeSelections: PossibleSelections;
  // Fields and list indexes from the node to the object
  pathFromNode: ReadonlyArray<AddressStep>;
  // Types of the node, of objects fields of the path are resolved on, and of the object (the last one):
  //   an object of another type at the address is another object
  types: ReadonlyArray<TypeName | false>;
};

// A field is a part of the selection of a specific type (unlike a response key, e.g. an alias of other fields)
export type AddressStep = FieldInfo | number;

// Result of a deferred fragment with data
export type DeferredResult = {
  // Response path of the result (in the server view)
  path: ResponsePath;
  data: SourceObject;
};

// Subsequent results of incremental delivery spliced into a copy of the stored result (written as a whole)
export type SplicedIncrementalResult = {
  readonly kind: "SplicedIncrementalResult";
  incremental: IncrementalExecution;
  // The result data was spliced into (stored or transient, see IncrementalExecution.transientTree)
  tree: IndexedTree;
  data: SourceObject;
  deliveredFields: DeliveredFields;
  missingFields: MissingFieldsMap;
  // Fields of stored objects delivered to other objects (see addMissingBaseFields)
  missingBaseFields: MissingBaseFieldsError[];
};

/**
 * Copies of objects of the stored result with incremental results spliced in -> data keys of delivered fields.
 *
 * Merge policies of a spliced result only run for delivered fields (see createDeliveredFieldFilter).
 *
 * Note: keyed by copies, which are unique per location (as sources of a stored result: shared references
 *   are cloned when indexing, see indexTree).
 */
export type DeliveredFields = Map<SourceObject, Set<DataKey>>;

// Key of an object with the selection (identifies server objects)
export type ObjectKeyFn = (
  data: SourceObject,
  selections: PossibleSelections,
) => string | false | undefined;

export type SpliceState = {
  tree: IndexedTree;
  incremental: IncrementalExecution;
  // Whether a field of the type has a merge policy (delivered values of such fields are incoming values as is)
  hasMergePolicy: (typeName: TypeName, fieldName: FieldName) => boolean;
  objectKey: ObjectKeyFn;
  // Local objects data was not delivered to (another object received it, see markSkippedFieldsMissing)
  skipped: { chunk: ObjectChunk; data: SourceObject }[];
  missingBaseFields: MissingBaseFieldsError[];
  // Objects and lists of the stored result -> copies (sources of a stored result are unique per location)
  copies: Map<Source, Draft>;
  deliveredFields: DeliveredFields;
  // Missing fields of copied objects (not delivered)
  missingFields: MissingFieldsMap;
};
