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
import { ObjectDifference } from "../diff/types";
import type {
  ExecutionKey,
  ExecutionResult,
  ResultData,
} from "../incremental/types";

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

/**
 * An incremental execution (`@defer`) with pending results.
 *
 * Its results are written to an isolated in-flight layer (a data forest of its own) until the execution completes:
 * only the operation itself and operations it covers (`@cache(covers: [...])`) read through the layer.
 * Nothing else writes to the layer: other writes go to the data forest and are shadowed for readers of the layer.
 * On completion, the received data is written to the data forest as a single result.
 */
export type InFlightExecution = {
  operation: OperationDescriptor;
  key: ExecutionKey | undefined;
  // Starts with trees of the operation and of covered operations in the data forest (shared, immutable)
  forest: DataForest;
  // Data received so far (in the server view)
  data: ResultData;
  // The last result written to the layer (shares unchanged objects with the next one, see write)
  incoming: IndexedTree | null;
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
  // Keyed by result descriptors (at most one execution of an operation at a time)
  inFlightExecutions: Map<OperationDescriptor, InFlightExecution>;
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
  // Operations reading from another forest now (readers of dropped in-flight layers): results are new objects,
  //   so their watches are only notified when results are not deeply equal
  rereadOperations: Set<OperationDescriptor> | null;
};

export type WriteResult = {
  options: WriteOptionsInternal;
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

// Options of ForestRun.writeExecutionResult: the same as of `write`, but with an execution result (instead of `result`)
export type ExecutionWriteOptions = Omit<Cache.WriteOptions, "result"> & {
  execution: ExecutionResult;
};

// Options of the internal `write`: a result, or an execution result (routed to in-flight layers)
export type WriteOptionsInternal = Cache.WriteOptions | ExecutionWriteOptions;
