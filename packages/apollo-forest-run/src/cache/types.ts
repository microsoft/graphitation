import type { Cache, InMemoryCacheConfig, TypePolicies } from "@apollo/client";
import type { IndexedForest, IndexedTree } from "../forest/types";
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

export type DataTree = IndexedTree & {
  grown?: boolean;
};
export type ResultTree = DataTree & {
  danglingReferences?: Set<string>; // ApolloCompat
};

export type TransformedResult = {
  outputTree: ResultTree;
  dirtyNodes: Map<NodeKey, Set<FieldName>>;
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

export type Store = {
  operations: Map<DocumentNode, Set<OperationDescriptor>>;
  dataForest: DataForest;
  optimisticLayers: OptimisticLayer[];
  // Derived trees resulted after applying optimistic layers and read policies
  optimisticReadResults: Map<OperationDescriptor, TransformedResult>;
  partialReadResults: Set<OperationDescriptor>; // FIXME: this should be per layer for proper cleanup
  watches: Map<OperationDescriptor, Array<Cache.WatchOptions>>;
  // Last access time of operation
  //   Used for LRU eviction
  atime: Map<OperationId, number>;
};

export type Transaction = {
  optimisticLayer: OptimisticLayer | null;
  affectedOperations: Set<OperationDescriptor> | null;
  watchesToNotify: Set<Cache.WatchOptions> | null;
  forceOptimistic: boolean | null;
  writes: {
    options: Cache.WriteOptions;
    tree: IndexedTree;
  }[];
};

export type CacheConfig = InMemoryCacheConfig & {
  maxOperationCount?: number;
  nonEvictableQueries?: Set<string>;
  apolloCompat_keepOrphanNodes?: boolean;
};

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
  nonEvictableQueries?: Set<string>;
  maxOperationCount?: number;
};
