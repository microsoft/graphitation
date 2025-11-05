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
} from "../descriptor/types";
import type { DocumentNode } from "graphql";
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

export type PartitionConfig = {
  partitions: {
    [key: string]: {
      maxOperationCount: number;
    };
  };
  partitionKey: (operation: IndexedTree) => string | null;
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
};

export type Transaction = {
  optimisticLayer: OptimisticLayer | null;
  affectedOperations: Set<OperationDescriptor> | null;
  affectedNodes: Set<NodeKey> | null;
  watchesToNotify: Set<Cache.WatchOptions> | null;
  forceOptimistic: boolean | null;
  changelog: (WriteResult | ModifyResult)[];
};

export type WriteResult = {
  options: Cache.WriteOptions;
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

export type ForestRunAdditionalConfig = {
  autoEvict?: boolean;
  maxOperationCount?: number;
  nonEvictableQueries?: Set<string>;
  unstable_partitionConfig?: PartitionConfig;
  apolloCompat_keepOrphanNodes?: boolean;
  logger?: Logger;
  notify?: (event: TelemetryEvent) => void;

  // Feature flags
  logUpdateStats?: boolean;
  logStaleOperations?: boolean;
  optimizeFragmentReads?: boolean;

  // History configuration
  enableHistory?: boolean;
  enableRichHistory?: boolean;
  defaultHistorySize?: number;
};

export type CacheConfig = InMemoryCacheConfig & ForestRunAdditionalConfig;

export type CacheEnv = {
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
  autoEvict: boolean;
  nonEvictableQueries: Set<string>;
  maxOperationCount: number;
  partitionConfig?: PartitionConfig;

  // Feature flags
  logUpdateStats: boolean;
  logStaleOperations: boolean;
  optimizeFragmentReads: boolean;

  // History configuration
  enableHistory: boolean;
  enableRichHistory: boolean;
  defaultHistorySize: number;
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
