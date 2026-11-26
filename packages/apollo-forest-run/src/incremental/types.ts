import type {
  DataKey,
  DeferLabel,
  FormattedError,
  NodeKey,
  PossibleSelections,
  ResponsePath,
} from "../descriptor/types";
import type { Draft, IndexedTree, Source } from "../forest/types";
import type { CacheEnv } from "../cache/types";
import type {
  CompositeListChunk,
  MissingFieldsMap,
  ObjectChunk,
  SourceObject,
} from "../values/types";
import type {
  CompositeListDifference,
  NodeDifferenceMap,
  ObjectDifference,
} from "../diff/types";

/**
 * Results of incremental delivery (`@defer`) in two formats:
 *
 * - The 2022-09-17 draft of the `@defer` / `@stream` RFC (deferred fragments addressed by `path` and `label`),
 *   as in Apollo Client 4 `Defer20220917Handler`. Results in this format are written as is.
 * - The current incremental delivery format of the spec proposal (`pending`, `id`, `subPath`, `completed`),
 *   as in Apollo Client 4 `GraphQL17Alpha9Handler`. Converted to the 2022 draft format when written (see format.ts).
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

// The incremental delivery format (`pending`, `id`, `subPath`, `completed`)

// Identifies a pending result within an incremental execution
export type PendingId = string;

export type PendingResult = {
  id: PendingId;
  path: ResponsePath;
  label?: DeferLabel;
};

export type CompletedResult = {
  id: PendingId;
  errors?: ReadonlyArray<FormattedError>;
};

export type IncrementalDeliveryInitialResult = CompleteExecutionResult & {
  pending: ReadonlyArray<PendingResult>;
  hasNext: boolean;
};

export type IncrementalDeliverySubsequentResult = {
  pending?: ReadonlyArray<PendingResult>;
  incremental?: ReadonlyArray<
    IncrementalDeliveryDeferResult | IncrementalDeliveryStreamResult
  >;
  completed?: ReadonlyArray<CompletedResult>;
  hasNext: boolean;
  extensions?: ResultExtensions;
};

export type IncrementalDeliveryDeferResult = {
  id: PendingId;
  subPath?: ResponsePath;
  data: ResultData;
  errors?: ReadonlyArray<FormattedError>;
  extensions?: ResultExtensions;
};

export type IncrementalDeliveryStreamResult = {
  id: PendingId;
  items: ReadonlyArray<unknown>;
  errors?: ReadonlyArray<FormattedError>;
  extensions?: ResultExtensions;
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
  | IncrementalDeliveryInitialResult
  | IncrementalDeliverySubsequentResult
) & { key?: ExecutionKey };

// Results written as a whole (subsequent results are spliced into the stored result first)
export type InitialExecutionResult = (
  | CompleteExecutionResult
  | InitialIncrementalExecutionResult
  | IncrementalDeliveryInitialResult
) & { key?: ExecutionKey };

export type SubsequentExecutionResult = (
  | SubsequentIncrementalExecutionResult
  | IncrementalDeliverySubsequentResult
) & { key?: ExecutionKey };

// State of incremental executions

// Serialized response path (response keys and list indexes joined with ".")
export type ResponsePathKey = string;

export type IncrementalExecution = {
  // Splice base for results that are never retained in the forest (e.g. mutations).
  transientTree?: IndexedTree;
  // A new execution of the operation replaces the previous one (late results of the previous one are ignored)
  key: ExecutionKey | undefined;
  // Server paths of defer sites, and delivered descendants addressable by modern subPath.
  placeholders: Map<ResponsePathKey, ObjectAddress>;
  // Pending results announced by results in the incremental delivery format (see convertIncrementalDeliveryResult)
  pendingResults: Map<PendingId, PendingResult> | undefined;
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
  // Response keys and list indexes from the node to the object
  pathFromNode: ResponsePath;
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
  data: SourceObject;
  deliveredFields: DeliveredFields;
  missingFields: MissingFieldsMap;
  // Initial differences of nodes, restricted to delivered fields and paths to them (see seedDifferences)
  seed: NodeDifferenceMap;
  // Spliced results (locate objects with deferred fragments in delivered data)
  results: SplicedIncrementalResultEntry[];
};

export type SplicedIncrementalResultEntry = DeferredResult & {
  // Path to the object the result was delivered to in the stored result (may differ from the response path)
  localPath: ResponsePath;
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

export type SpliceState = {
  tree: IndexedTree;
  mergePolicies: CacheEnv["mergePolicies"];
  // Objects and lists of the stored result -> copies (sources of a stored result are unique per location)
  copies: Map<Source, Draft>;
  deliveredFields: DeliveredFields;
  // Missing fields of copied objects (not delivered)
  missingFields: MissingFieldsMap;
  seed: NodeDifferenceMap;
  // Chunks of the stored result on paths to delivered objects -> their (seed) differences
  differences: Map<
    ObjectChunk | CompositeListChunk,
    ObjectDifference | CompositeListDifference
  >;
};
