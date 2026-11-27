import type {
  DataKey,
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
  CompositeListChunk,
  MissingFieldsMap,
  ObjectChunk,
  SourceObject,
} from "../values/types";
import type {
  CompositeListDifference,
  MissingBaseFieldsError,
  NodeDifferenceMap,
  ObjectDifference,
} from "../diff/types";

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
 * see apollographql/apollo-client#13530). Resolved in the current stored result via `tree.nodes`.
 *
 * Note: list indexes of embedded (unkeyed) lists between the node and the object are not stable.
 */
export type ObjectAddress = {
  nodeKey: NodeKey;
  nodeSelections: PossibleSelections;
  pathFromNode: ReadonlyArray<AddressFieldStep | number>;
  // Type of the object (an object of another type at the address is another object)
  type: TypeName | false;
};

export type AddressFieldStep = {
  parentType: TypeName | false;
  dataKey: DataKey;
  fieldName: FieldName;
};

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
  writes: PayloadWrites;
  missingFields: MissingFieldsMap;
  // Fields of stored objects delivered to other objects (see addMissingBaseFields)
  missingBaseFields: MissingBaseFieldsError[];
  // Initial differences of nodes, restricted to delivered fields and paths to them (see seedDifferences)
  seed: NodeDifferenceMap;
};

// Keyed by copies (unique per location, even for multiple occurrences of one node).
export type PayloadWrites = Map<SourceObject, ObjectWrite>;
export type ObjectWrite = {
  // The concrete location in the stored result.
  chunk: ObjectChunk;
  // Server paths spliced here, empty for objects copied only to reach a target.
  paths: ResponsePath[];
  // A key is present if delivered. Its paths are those that wrote the field whole,
  // not those that spliced into an existing child.
  fields: Map<DataKey, ResponsePath[]>;
  // Deliveries aimed here by position that went to another identity (or no object).
  missed?: SourceObject[];
};

export type SpliceState = {
  tree: IndexedTree;
  // Whether a field of the type has a merge policy (delivered values of such fields are incoming values as is)
  hasMergePolicy: (typeName: TypeName, fieldName: FieldName) => boolean;
  // Key of an object with the selection (identifies server objects)
  objectKey: (
    data: SourceObject,
    selections: PossibleSelections,
  ) => string | false | undefined;
  // Collect by concrete stored chunk; index by copy for consumers of the written result.
  objects: Map<ObjectChunk, ObjectWrite>;
  missingBaseFields: MissingBaseFieldsError[];
  // Objects and lists of the stored result -> copies (sources of a stored result are unique per location)
  copies: Map<Source, Draft>;
  // Missing fields of copied objects (not delivered)
  missingFields: MissingFieldsMap;
  seed: NodeDifferenceMap;
  // Chunks of the stored result on paths to delivered objects -> their (seed) differences
  differences: Map<
    ObjectChunk | CompositeListChunk,
    ObjectDifference | CompositeListDifference
  >;
};
