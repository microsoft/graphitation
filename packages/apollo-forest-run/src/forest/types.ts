import {
  FieldInfo,
  OperationDescriptor,
  OperationId,
  PossibleSelection,
  PossibleSelections,
  TypeName,
  VariableValues,
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
import { CompositeListLayoutChange, NodeDifferenceMap } from "../diff/types";

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
  history: HistoryArray;

  // ApolloCompat
  danglingReferences?: Set<NodeKey>;
};

export type HistoryChange = Omit<FieldChange, "fieldInfo"> & {
  path: (string | number)[];
};

type HistoryEntryBase = {
  timestamp: number;
  modifyingOperation: {
    name: string;
    variables: VariableValues;
  };
  data:
    | {
        current?: OperationResult;
        incoming?: OperationResult;
        updated?: OperationResult;
      }
    | undefined;
};

export type RegularHistoryEntry = {
  kind: "Regular";
  changes: HistoryChange[];
  missingFields: MissingFieldsMap;
};

export type OptimisticHistoryEntry = {
  kind: "Optimistic";
  nodeDiffs: NodeDifferenceMap | undefined;
  updatedNodes: string[];
};

export type HistoryEntry = (RegularHistoryEntry | OptimisticHistoryEntry) &
  HistoryEntryBase;

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
export type ChangedChunksMap = Map<
  ObjectChunk | CompositeListChunk,
  FieldChange[]
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
  childChanges: CompositeListLayoutChange[];
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

  // History feature flags
  enableHistory?: boolean; // Enable operation history tracking (minimal overhead when enabled)
  enableRichHistory?: boolean; // Store full data snapshots in history (high memory overhead)
  defaultHistorySize?: number; // Maximum number of history entries to store
};
