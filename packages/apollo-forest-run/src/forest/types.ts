import {
  DetachedFragmentDescriptor,
  FieldInfo,
  OperationDescriptor,
  OperationFragmentDescriptor,
  OperationId,
  PossibleSelection,
  PossibleSelections,
  RegularOperationDescriptor,
  TypeName,
  VariableValues,
} from "../descriptor/types";
import {
  CompositeListChunk,
  DataMap,
  MissingFieldsSerialized,
  MissingFieldsMap,
  NodeKey,
  NodeMap,
  ObjectChunk,
  ObjectDraft,
  ObjectKey,
  ObjectValue,
  OperationResult,
  ParentLocator,
  SourceCompositeList,
  SourceObject,
  SourceValue,
  TypeMap,
} from "../values/types";
import { TelemetryEvent } from "../telemetry/types";
import { Logger } from "../jsutils/logger";
import { UpdateTreeStats } from "../telemetry/updateStats/types";
import { UpdateLogger } from "../telemetry/updateStats/updateLogger";
import { CircularBuffer } from "../jsutils/circularBuffer";
import type * as DifferenceKind from "../diff/differenceKind";
import {
  CompositeListLayoutChange,
  CompositeListLayoutDifference,
  NodeDifferenceMap,
} from "../diff/types";
import { HistoryConfig } from "../cache/types";

// Note: all tree kinds must have the same set of fields (keeps the same object shape in hot paths)
export type OperationTree = {
  readonly kind: "Operation";
  operation: RegularOperationDescriptor;
  result: OperationResult;
  rootNodeKey: NodeKey;
  nodes: NodeMap;
  typeMap: TypeMap;

  // Inverse map from data to chunks
  //   This is necessary for efficient re-indexing of existing data and chunk recycling
  dataMap: DataMap;

  // Previous state of this tree.
  //   Useful for recycling chunks from multiple tree states, (e.g. with merge policies when final tree
  //   should recycle chunks from both - incoming and existing trees).
  prev: IndexedTree | null;

  // Error states
  incompleteChunks: Set<ObjectChunk | CompositeListChunk>;

  // Tree changes
  history: CircularBuffer<HistoryChange>;

  // ApolloCompat
  danglingReferences?: Set<NodeKey>;
};

export type DetachedFragmentTree = {
  readonly kind: "DetachedFragment";
  operation: DetachedFragmentDescriptor;
  result: OperationResult;
  rootNodeKey: NodeKey;
  nodes: NodeMap;
  typeMap: TypeMap;

  // Inverse map from data to chunks
  //   This is necessary for efficient re-indexing of existing data and chunk recycling
  dataMap: DataMap;

  // Previous state of this tree.
  //   Useful for recycling chunks from multiple tree states, (e.g. with merge policies when final tree
  //   should recycle chunks from both - incoming and existing trees).
  prev: IndexedTree | null;

  // Error states
  incompleteChunks: Set<ObjectChunk | CompositeListChunk>;

  // Tree changes
  history: CircularBuffer<HistoryChange>;

  // ApolloCompat
  danglingReferences?: Set<NodeKey>;
};

// Any tree which can be stored in the forest
export type IndexedTree = OperationTree | DetachedFragmentTree;

// Same fields as IndexedTree, but tree kind and operation kind are not correlated (yet)
export type UncheckedIndexedTree = Omit<IndexedTree, "kind" | "operation"> & {
  kind: IndexedTree["kind"];
  operation: OperationDescriptor;
};

// Transient tree of an operation sub-selection (e.g. a deferred fragment). Never stored in the forest.
export type OperationFragmentTree = {
  readonly kind: "OperationFragment";
  operation: OperationFragmentDescriptor;
  result: OperationResult;
  rootNodeKey: NodeKey;
  nodes: NodeMap;
  typeMap: TypeMap;

  // Inverse map from data to chunks
  //   This is necessary for efficient re-indexing of existing data and chunk recycling
  dataMap: DataMap;

  // Previous state of this tree.
  //   Useful for recycling chunks from multiple tree states, (e.g. with merge policies when final tree
  //   should recycle chunks from both - incoming and existing trees).
  prev: OperationFragmentTree | null;

  // Error states
  incompleteChunks: Set<ObjectChunk | CompositeListChunk>;

  // Tree changes
  history: CircularBuffer<HistoryChange>;

  // ApolloCompat
  danglingReferences?: Set<NodeKey>;
};

// Any tree, including transient trees
export type AnyIndexedTree = IndexedTree | OperationFragmentTree;

export type HistoryFieldChange =
  | FillerChange
  | ReplacementChange
  | CompositeListDifferenceChange;

type HistoryChangeBase = {
  timestamp: number;
  modifyingOperation: {
    name: string;
    variables: VariableValues;
  };
  data?:
    | {
        current: OperationResult;
        incoming: OperationResult | undefined;
        updated?: OperationResult;
      }
    | undefined;
};

export type HistoryChange = (RegularHistoryChange | OptimisticHistoryChange) &
  HistoryChangeBase;

export type OptimisticHistoryChangeSerialized = Omit<
  OptimisticHistoryChange,
  "nodeDiffs"
> & {
  changes: HistoryFieldChange[];
};

type RegularHistoryChangeSerialized = Omit<
  RegularHistoryChange,
  "missingFields"
> & {
  missingFields: MissingFieldsSerialized;
};

export type HistoryChangeSerialized = (
  | RegularHistoryChangeSerialized
  | OptimisticHistoryChangeSerialized
) &
  HistoryChangeBase;

export type RegularHistoryChange = {
  kind: "Regular";
  changes: HistoryFieldChange[];
  missingFields: MissingFieldsMap;
};

export type OptimisticHistoryChange = {
  kind: "Optimistic";
  nodeDiffs: NodeDifferenceMap | undefined;
  updatedNodes: string[];
};

export type IndexedForest = {
  trees: Map<OperationId, IndexedTree>;
  extraRootIds: Map<NodeKey, TypeName>;
  operationsByNodes: Map<NodeKey, Set<OperationId>>; // May contain false positives
  operationsWithErrors: Set<OperationDescriptor>; // May contain false positives
  operationsByName: Map<string, Set<OperationId>>; // operationName → operation IDs
  operationsByCoveredName: Map<string, Set<OperationId>>; // coveredName → IDs of ops whose covers list includes it
  operationsByPartitions: Map<string, Set<OperationId>>; // partition key => operation IDs
  deletedNodes: Set<NodeKey>;
};

export type Source = Readonly<SourceObject | SourceCompositeList>;
export type Draft = SourceObject | SourceCompositeList;

export type UpdateForestStats = (UpdateTreeStats | null)[];

export type FillerEntry = {
  kind: typeof DifferenceKind.Filler;
  fieldInfo: FieldInfo;
  newValue: SourceValue | undefined;
};

export type ReplacementEntry = {
  kind: typeof DifferenceKind.Replacement;
  fieldInfo: FieldInfo;
  oldValue: SourceValue | undefined;
  newValue: SourceValue | undefined;
};

export type CompositeListDifferenceEntry = {
  kind: typeof DifferenceKind.CompositeListDifference;
  layout: CompositeListLayoutDifference | undefined;
  deletedKeys?: Set<number>;
};

type PathChange = {
  path: (string | number)[];
};

export type FillerChange = Omit<FillerEntry, "fieldInfo"> & PathChange;
export type ReplacementChange = Omit<ReplacementEntry, "fieldInfo"> &
  PathChange;
export type CompositeListDifferenceChange = {
  kind: typeof DifferenceKind.CompositeListDifference;
  itemChanges: CompositeListLayoutChange[];
  previousLength: number;
  currentLength: number;
} & PathChange;

// Changed chunks map only contains chunks with immediate changes (i.e. "Replacement", "Filler" + list layout changes).
//   Does not contain parent chunks which were affected only because some nested chunk has changed.

export type ChangedChunksTuple =
  | [CompositeListChunk, CompositeListDifferenceEntry]
  | [ObjectChunk, (FillerEntry | ReplacementEntry)[]];

export type ChangedChunksMap = Map<
  CompositeListChunk,
  CompositeListDifferenceEntry
> &
  Map<ObjectChunk, (FillerEntry | ReplacementEntry)[]>;
export type UpdateTreeContext = {
  operation: OperationDescriptor;
  drafts: Map<Source, Draft>;
  missingFields: MissingFieldsMap;
  changes: ChangedChunksMap;
  changedNodes: Set<NodeKey>;
  affectedNodes: Set<NodeKey>;
  completeObject: CompleteObjectFn;
  findParent: ParentLocator;
  env: ForestEnv;
  statsLogger?: UpdateLogger;
};

export type UpdateTreeResult<TTree extends AnyIndexedTree = IndexedTree> = {
  updatedTree: TTree;
  changes: ChangedChunksMap;
  changedNodes: Set<NodeKey>; // Directly changed nodes (subset of NodeDifferenceMap keys)
  affectedNodes: Set<NodeKey>; // Parent nodes updated due to a change in a nested node (if node is both - directly updated and affected by another node update, it will be in both: changedNodes and affectedNodes)
  missingFields: MissingFieldsMap;
  stats?: UpdateTreeStats;
};

export type UpdateObjectResult = {
  draft: SourceObject;
  missingFields?: MissingFieldsMap;
};

export type CompleteObjectFn = (
  value: ObjectValue,
  selection: PossibleSelections,
  operation: OperationDescriptor,
) => ObjectDraft;

export type ForestEnv = {
  objectKey: (
    obj: SourceObject,
    fields?: PossibleSelection,
    operation?: OperationDescriptor,
  ) => ObjectKey | false | undefined;

  logger?: Logger;
  notify?: (event: TelemetryEvent) => void;

  // ApolloCompat:
  //   Apollo can track dirty entries in results of read operations even if some "key" fields are missing in selection
  //   by maintaining optimism dependency graph between main store and read results.
  //   ForestRun does indexing and diffing over actual "read results", so if the result selection doesn't contain
  //   key fields - it may be unable to properly identify an object in the result.
  //   To ensure compatibility with Apollo - we have to maintain this keyMap of literal objects to node "keys"
  //   for derived objects (e.g. created via reading selections)
  //   This is mostly needed for compatibility with Apollo tests - real world apps _shouldn't_ be affected
  keyMap?: WeakMap<SourceObject, string | false>;
  apolloCompat_keepOrphanNodes?: boolean;

  // Telemetry feature flags
  logUpdateStats?: boolean;
  logStaleOperations?: boolean;

  // History feature flags
  historyConfig?: HistoryConfig;

  partitionConfig?: {
    partitionKey: (operation: IndexedTree) => string | null;
  };
};

export type DefaultPartition = "__default__";
