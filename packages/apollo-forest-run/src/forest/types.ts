import {
  FieldInfo,
  OperationDescriptor,
  OperationId,
  PossibleSelection,
  PossibleSelections,
  TypeName,
} from "../descriptor/types";
import {
  CompositeListChunk,
  DataMap,
  GraphValue,
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
import { HistoryArray } from "../jsutils/historyArray";
import type * as DifferenceKind from "../diff/differenceKind";
import { CompositeListLayoutChange } from "../diff/types";

export type IndexedTree = {
  operation: OperationDescriptor;
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

  // Operation history for debugging
  history: HistoryArray | null;

  // ApolloCompat
  danglingReferences?: Set<NodeKey>;
};

export type HistoryEntry = {
  timestamp: number;
  missingFields: MissingFieldsMap;
  current: {
    result: OperationResult | undefined;
  };
  incoming: {
    result?: OperationResult;
    operation?: OperationDescriptor | undefined;
  };
  updated: {
    changes: any;
    result: OperationResult | undefined;
  };
};

export type IndexedForest = {
  trees: Map<OperationId, IndexedTree>;
  extraRootIds: Map<NodeKey, TypeName>;
  operationsByNodes: Map<NodeKey, Set<OperationId>>; // May contain false positives
  operationsWithErrors: Set<OperationDescriptor>; // May contain false positives
  deletedNodes: Set<NodeKey>;
};

export type Source = Readonly<SourceObject | SourceCompositeList>;
export type Draft = SourceObject | SourceCompositeList;

export type UpdateForestStats = (UpdateTreeStats | null)[];

export type FieldChange = (
  | {
      kind: typeof DifferenceKind.Filler;
      newValue: SourceValue | undefined;
    }
  | {
      kind: typeof DifferenceKind.Replacement;
      oldValue: GraphValue | undefined;
      newValue: SourceValue | undefined;
    }
  | {
      kind: typeof DifferenceKind.CompositeListDifference;
      itemChanges: CompositeListLayoutChange[] | undefined;
    }
) & {
  fieldInfo: FieldInfo;
};

// Changed chunks map only contains chunks with immediate changes (i.e. "Replacement", "Filler" + list layout changes).
//   Does not contain parent chunks which were affected only because some nested chunk has changed.
//   Note: For now dirty list items are not reported, as it is tricky to report together with list layout shifts (and we don't need it anywhere yet).
//         In the future we may need to report layout shifts and "Replacement", "Fillter" changes separately.
export type ChangedChunksMap = Map<ObjectChunk, FieldChange[]> &
  Map<
    CompositeListChunk,
    {
      index: number;
      value: ObjectDraft;
    }[]
  >;

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
  childChanges: any[];
  statsLogger?: UpdateLogger;
};

export type UpdateTreeResult = {
  updatedTree: IndexedTree;
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

  // History configuration
  enableHistory?: boolean;
  enableDataHistory?: boolean;
  defaultHistorySize?: number;
  storeFieldPaths?: boolean; // Store computed field paths in history (more memory, faster summary generation)
};
