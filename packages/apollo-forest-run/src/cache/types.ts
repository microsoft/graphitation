import type { Cache, InMemoryCacheConfig, TypePolicies } from "@apollo/client";
import type {
  IndexedForest,
  IndexedTree,
  UpdateForestStats,
} from "../forest/types";
import type {
  NodeKey,
  FieldName,
  OperationDescriptor,
  PossibleTypes,
  PossibleSelection,
  ArgumentValues,
  Directives,
  TypeName,
  OperationId,
  NormalizedFieldEntry,
  VariableValues,
  DeferLabel,
  FormattedError,
  PossibleSelections,
  ResponsePath,
} from "../descriptor/types";
import type { DocumentNode, OperationDefinitionNode } from "graphql";
import type {
  Key,
  KeySpecifier,
  ObjectKey,
  SourceCompositeList,
  SourceObject,
} from "../values/types";
import type {
  FieldMergeFunction,
  FieldReadFunction,
} from "@apollo/client/cache/inmemory/policies";
import type { TelemetryEvent } from "../telemetry/types";
import { ExtendedLogger, Logger } from "../jsutils/logger";
import { GraphDifference, GraphDiffError } from "../diff/diffTree";
import { NodeDifferenceMap, ObjectDifference } from "../diff/types";

export type PartitionOptions = {
  maxOperationCount: number;
  autoEvict?: boolean;
};

export type PartitionConfig = {
  partitions: {
    [key: string]: PartitionOptions;
  };
  partitionKey: (operation: IndexedTree) => string | null;
};

export type ResolvedPartitionOptions = {
  maxOperationCount: number;
  autoEvict: boolean;
};

export type ResolvedPartition = {
  partition: string;
  options: ResolvedPartitionOptions;
};

export type ResolvedPartitionConfig = {
  partitions: {
    __default__: ResolvedPartitionOptions;
    [key: string]: ResolvedPartitionOptions | undefined;
  };
  partitionKey: (operation: IndexedTree) => string | null;
};

export type HistoryPartitions = Record<string, number>;

export type HistoryConfig<
  TPartitions extends HistoryPartitions = HistoryPartitions,
> = {
  overwrittenHistorySize?: number;
  enableRichHistory?: boolean;
  partitions?: TPartitions;
  partitionKey?: (
    operation: OperationDefinitionNode,
    variables: VariableValues,
  ) => Extract<keyof TPartitions, string> | null;
};

export type DataTree = IndexedTree & {
  grown?: boolean;
};
export type ResultTree = DataTree & {
  danglingReferences?: Set<string>; // ApolloCompat
};

export type DirtyNodeMap = Map<NodeKey, Set<FieldName>>;

export type TransformedResult = {
  outputTree: ResultTree;
  dirtyNodes: DirtyNodeMap;
};

export type ExtendedForest = IndexedForest & {
  // Derived trees resulted from applying read policies
  readResults: Map<OperationDescriptor, TransformedResult>;
  mutations: Set<OperationDescriptor>;

  // ApolloCompat:
  operationsWithDanglingRefs: Map<NodeKey, Set<OperationDescriptor>>;
};
export type DataForest = ExtendedForest & {
  layerTag: null;
  replay?: undefined;
};
export type OptimisticLayer = ExtendedForest & {
  layerTag: string;
  replay: <T>(cache: T) => any; // ApolloCompat
};

export type CacheKey = string;

export type Store = {
  operations: Map<DocumentNode, Map<CacheKey, OperationDescriptor>>;
  dataForest: DataForest;
  optimisticLayers: OptimisticLayer[];
  // Derived trees resulted after applying optimistic layers and read policies
  optimisticReadResults: Map<OperationDescriptor, TransformedResult>;
  partialReadResults: Set<OperationDescriptor>; // FIXME: this should be per layer for proper cleanup
  watches: Map<OperationDescriptor, Array<Cache.WatchOptions>>;
  fragmentWatches: Map<NodeKey, Array<Cache.WatchOptions>>;
  // Last access time of operation
  //   Used for LRU eviction
  atime: Map<OperationId, number>;
  // Precomputed eviction partition per tree
  partitions: WeakMap<IndexedTree, ResolvedPartition>;
  // Pending scheduled auto-eviction
  pendingEviction: ScheduledEvictionHandle | null;
  // The latest incremental execution (`@defer`) of an operation, while it has pending results
  incrementalExecutions: WeakMap<OperationDescriptor, IncrementalExecution>;
};

export type Transaction = {
  optimisticLayer: OptimisticLayer | null;
  affectedOperations: Set<OperationDescriptor> | null;
  affectedNodes: Set<NodeKey> | null;
  watchesToNotify: Set<Cache.WatchOptions> | null;
  forceOptimistic: boolean | null;
  changelog: (WriteResult | ModifyResult)[];
  // Descriptors of operations whose results are not cached (mutations without `@cache`).
  // Only populated when `env.cleanupNonCacheableOperations` is enabled.
  // Owned by the outermost transaction: nested transactions share the same set by reference
  // and the outermost one releases everything at once when it completes.
  nonCacheableOperations: Set<OperationDescriptor> | null;
};

export type WriteResult = {
  options: WriteOptions;
  incoming: DataTree;
  affected: Iterable<OperationDescriptor>;
  affectedNodes: Set<NodeKey>; // contains directly updated nodes + parent nodes indirectly affected by nested node update
  difference?: GraphDifference;
  updateStats?: UpdateForestStats;
};

export type ModifiedNodeDifference = ObjectDifference & {
  fieldsToInvalidate: Set<NormalizedFieldEntry>;
  fieldsToDelete: Set<NormalizedFieldEntry>;
  deleteNode: boolean;
};
export type ModifiedGraphDifference = {
  nodeDifference: Map<NodeKey, ModifiedNodeDifference>;
  newNodes: NodeKey[];
  deletedNodes: NodeKey[];
  errors: GraphDiffError[];
};
export type LayerDifferenceMap = Map<
  DataForest | OptimisticLayer,
  ModifiedGraphDifference
>;
export type ModifyResult = {
  options: Cache.ModifyOptions;
  dirty: boolean;
  affected: Set<OperationDescriptor>;
  difference?: LayerDifferenceMap;
};

export type ScheduledEvictionHandle = { cancel: () => void };

export type ScheduleEviction = (
  run: () => void,
) => ScheduledEvictionHandle | null;

export type ForestRunAdditionalConfig<
  TPartitions extends HistoryPartitions = any,
> = {
  autoEvict?: boolean;
  maxOperationCount?: number;
  nonEvictableQueries?: Set<string>;
  partitionConfig?: PartitionConfig;
  scheduleAutoEviction?: ScheduleEviction;
  apolloCompat_keepOrphanNodes?: boolean;
  logger?: Logger;
  notify?: (event: TelemetryEvent) => void;

  // Feature flags
  logUpdateStats?: boolean;
  logStaleOperations?: boolean;
  optimizeFragmentReads?: boolean;
  /**
   * When enabled, incoming results invalidate incomplete (partial) read results only when they actually provide
   * some of the missing fields (instead of any incoming data for the same node). Read results with read policies
   * keep conservative invalidation.
   *
   * Avoids re-hydrating pending partial watches on every sibling response for a shared node.
   */
  optimizeIncompleteChunkInvalidation?: boolean;
  /**
   * Build operation descriptors from an explicit object literal (instead of spreading document and result tree
   * descriptors), which keeps all descriptor properties in-object with a single stable shape.
   *
   * Enabled by default.
   */
  optimizeDescriptorShape?: boolean;
  cleanupNonCacheableOperations?: boolean;
  reconcileDivergentChunks?: boolean;
  /**
   * Honor literal `keyFields: false` instead of falling back to ID generation.
   * Disabled by default to preserve existing entity identities.
   */
  honorKeyFieldsFalse?: boolean;

  historyConfig?: HistoryConfig<TPartitions>;
};

export type CacheConfig<TPartitions extends HistoryPartitions = any> =
  InMemoryCacheConfig & ForestRunAdditionalConfig<TPartitions>;

export type CacheEnv<TPartitions extends HistoryPartitions = any> = {
  addTypename?: boolean; // ApolloCompat
  apolloCompat_keepOrphanNodes?: boolean;

  rootTypes?: {
    query: string;
    mutation: string;
    subscription: string;
  };

  possibleTypes?: PossibleTypes;

  now(): number;
  genId: () => number;

  // TODO: use keyFields instead of objectKey function
  //  (reason being - we can understand when some list contains items with "ids" even when the list is empty or currently contains nulls only)
  //  + possible to warn when some query doesn't include keyFields
  objectKey: (
    obj: object,
    fields?: PossibleSelection,
    operation?: OperationDescriptor,
  ) => ObjectKey | false | undefined;

  listItemKey?: (
    item: SourceObject | SourceCompositeList,
    index: number,
    // TODO:
    //   parentType: TypeName
    //   parentFieldName: string
  ) => string | number;

  // TODO: rename to fieldConfig
  keyArgs?: (
    typeName: string,
    fieldName: string,
    args?: ArgumentValues,
    directives?: Directives,
    source?: OperationDescriptor | undefined,
  ) => Key | KeySpecifier | undefined;

  notify?: (event: TelemetryEvent) => void;
  logger?: ExtendedLogger;

  // ApolloCompat:
  //   Apollo can track dirty entries in results of read operations even if some "key" fields are missing in selection
  //   by maintaining optimism dependency graph between main store and read results.
  //   ForestRun does indexing and diffing over actual "read results", so if the result selection doesn't contain
  //   key fields - it may be unable to properly identify an object in the result.
  //   To ensure compatibility with Apollo - we have to maintain this keyMap of literal objects to node "keys"
  //   for derived objects (e.g. created via reading selections)
  //   This is mostly needed for compatibility with Apollo tests - real world apps _shouldn't_ be affected
  keyMap?: WeakMap<SourceObject, string | false>;

  typePolicies: TypePolicies;
  dataIdFromObject?: any;

  mergePolicies: Map<TypeName, Map<FieldName, FieldMergeFunction>>;
  readPolicies: Map<TypeName, Map<FieldName, FieldReadFunction>>;
  nonEvictableQueries: Set<string>;
  partitionConfig: ResolvedPartitionConfig;
  scheduleAutoEviction: ScheduleEviction;

  // Feature flags
  logUpdateStats: boolean;
  logStaleOperations: boolean;
  optimizeFragmentReads: boolean;
  /**
   * When enabled, incoming results mark missing fields of incomplete read result chunks as dirty only when
   * incoming chunks for the same node actually provide those fields (matched by normalized field entry,
   * i.e. arguments-aware and alias-independent). Otherwise, all missing fields of such chunks are marked as dirty
   * whenever incoming result contains the same node.
   *
   * Chunks with read policies (own or nested) keep conservative invalidation, as well as invalidation
   * without incoming result (e.g. cache.modify). Also, existing "full diff" dirty entries are never downgraded
   * to specific fields.
   *
   * Disabled by default.
   */
  optimizeIncompleteChunkInvalidation: boolean;
  /**
   * When enabled, operation descriptors are created from an explicit object literal (all properties in-object,
   * single stable shape for all descriptor kinds). When disabled, legacy spread-based construction is used.
   *
   * Enabled by default.
   */
  optimizeDescriptorShape: boolean;
  /**
   * When enabled, operation descriptors of non-cacheable operations (i.e. mutations without
   * the `@cache` directive) are released as soon as nothing references them anymore.
   *
   * Such operations never produce a data tree, so they are invisible to LRU eviction
   * (which only iterates tree-backed operations) and would otherwise accumulate in
   * `store.operations` for the lifetime of the cache.
   */
  cleanupNonCacheableOperations: boolean;
  /**
   * When enabled, object and list differences carry their model value, so updates can
   * reconcile chunks of the same node that diverged into `null` or missing values
   * (instead of failing update invariants and leaving stale chunks behind).
   *
   * Disabled by default: it adds work on the common diffing path.
   */
  reconcileDivergentChunks: boolean;
  honorKeyFieldsFalse: boolean;
  historyConfig?: HistoryConfig<TPartitions>;
};

export type SerializedOperationKey = string;
export type SerializedOperationInfo = {
  data: SourceObject | null;
  optimisticData: SourceObject | null;
  variables: Record<string, unknown>;
  hasHistory: boolean;
};
export type SerializedCache = Record<
  SerializedOperationKey,
  SerializedOperationInfo
>;

// Identifies an incremental execution (e.g. a request id), compared by equality.
//   Only needed to ignore late results of a superseded execution of the same operation (with the same variables)
export type ExecutionKey = string | number | object;

// Identifies a pending result within an incremental execution (the latest format)
export type PendingId = string;

export type IncrementalExecution = {
  // A new execution of the operation replaces the previous one (late results of the previous one are ignored)
  key: ExecutionKey | undefined;
  // Objects pending results are delivered to
  pending: Map<PendingId, DeferPlaceholder>;
};

/**
 * Placeholder of a pending result: address of the object its data is delivered to.
 *
 * The object is addressed by its closest node and the path from that node (not by the response path),
 * so the address stays valid when other writes replace the stored result in the meantime
 * (e.g. items are prepended to a list, see apollographql/apollo-client#13530).
 */
export type DeferPlaceholder = {
  // Response path of the pending result (as announced), locates pending results nested in its data
  path: ResponsePath;
  nodeKey: NodeKey;
  nodeSelections: PossibleSelections;
  // Response keys and list indexes from the node to the object
  pathFromNode: ResponsePath;
};

/**
 * Subsequent results of incremental delivery applied to the stored result of the operation (see updateTree).
 *
 * The difference fills (or replaces) delivered fields of objects data is delivered to (nested under their closest nodes).
 * It also restricts merge policies to delivered fields and seeds diffing of the updated result (see diffTree).
 */
export type IncrementalUpdate = {
  incremental: IncrementalExecution;
  // Pending results announced by the payload (e.g. nested `@defer`)
  pending: ReadonlyArray<PendingResult>;
  tree: IndexedTree;
  difference: NodeDifferenceMap;
  anchors: PendingAnchor[];
};

// An object data is delivered to (locates pending results nested in its data)
export type PendingAnchor = {
  // Response path of the object (as announced)
  responsePath: ResponsePath;
  // Path to the object in the stored result
  path: ResponsePath;
};

export type DeferredResultEntry = PendingAnchor & {
  data: ResultData;
};

export type ResultData = Record<string, unknown>;
export type ResultExtensions = Record<string, unknown>;

// Results of incremental delivery: GraphQL incremental delivery format (`pending`, `id`, `subPath`, `completed`)
//   and the earlier 2022 draft (deferred fragments addressed by `path` and `label`).
export type PendingResult = {
  id: PendingId;
  path: ResponsePath;
  label?: DeferLabel;
};

export type IncrementalDeferResult = {
  data?: ResultData | null;
  errors?: ReadonlyArray<FormattedError>;
  extensions?: ResultExtensions;
  // Latest format
  id?: PendingId;
  subPath?: ResponsePath;
  // Earlier draft
  path?: ResponsePath;
  label?: DeferLabel;
};

export type IncrementalStreamResult = {
  items?: ReadonlyArray<unknown> | null;
  errors?: ReadonlyArray<FormattedError>;
  extensions?: ResultExtensions;
  // Latest format
  id?: PendingId;
  subPath?: ResponsePath;
  // Earlier draft
  path?: ResponsePath;
  label?: DeferLabel;
};

export type CompletedResult = {
  id: PendingId;
  errors?: ReadonlyArray<FormattedError>;
};

export type CompleteExecutionResult = {
  data: ResultData;
  errors?: ReadonlyArray<FormattedError>;
  extensions?: ResultExtensions;
};

export type InitialIncrementalExecutionResult = CompleteExecutionResult & {
  pending?: ReadonlyArray<PendingResult>;
  hasNext: boolean;
};

export type SubsequentIncrementalExecutionResult = {
  pending?: ReadonlyArray<PendingResult>;
  incremental?: ReadonlyArray<IncrementalDeferResult | IncrementalStreamResult>;
  completed?: ReadonlyArray<CompletedResult>;
  hasNext: boolean;
  extensions?: ResultExtensions;
};

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

export type WriteOptions = Omit<Cache.WriteOptions, "result"> & {
  /** @deprecated Use `execution` (the result data is written as a complete result) */
  result?: Cache.WriteOptions["result"];
  execution?: ExecutionResult;
};
