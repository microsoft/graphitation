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
  MissingFieldsMap,
  NodeKey,
  NodeMap,
  ObjectChunk,
  ObjectDraft,
  ObjectKey,
  ObjectValue,
  OperationResult,
  SourceCompositeList,
  SourceObject,
  TypeMap,
} from "../values/types";
import { TelemetryEvent } from "../telemetry/types";
import { Logger } from "../jsutils/logger";

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

  // ApolloCompat
  danglingReferences?: Set<NodeKey>;
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

// Changed chunks map only contains chunks with immediate changes (i.e. "Replacement", "Filler" + list layout changes).
//   Does not contain parent chunks which were affected only because some nested chunk has changed.
//   Note: For now dirty list items are not reported, as it is tricky to report together with list layout shifts (and we don't need it anywhere yet).
//         In the future we may need to report layout shifts and "Replacement", "Fillter" changes separately.
export type ChangedChunksMap = Map<ObjectChunk, FieldInfo[]> &
  Map<CompositeListChunk, null>;

export type UpdateObjectState = {
  drafts: Map<Source, Draft>;
  missingFields: MissingFieldsMap;
  changes: ChangedChunksMap;
};

export type UpdateTreeState = {
  drafts: Map<Source, Draft>;
  missingFields: MissingFieldsMap;
  changes: ChangedChunksMap;
  changedNodes: Set<NodeKey>;
  affectedNodes: Set<NodeKey>;
};

export type UpdateTreeResult = {
  updatedTree: IndexedTree;
  changes: ChangedChunksMap;
  changedNodes: Set<NodeKey>; // Directly changed nodes (subset of NodeDifferenceMap keys)
  affectedNodes: Set<NodeKey>; // Parent nodes updated due to a change in a nested node (if node is both - directly updated and affected by another node update, it will be in both: changedNodes and affectedNodes)
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
};
