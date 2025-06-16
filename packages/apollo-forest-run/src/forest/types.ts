import {
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
import { UpdateTreeStats } from "../telemetry/updateStats/types";
import { UpdateLogger } from "../telemetry/updateStats/updateLogger";

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

export type UpdateForestStats = (UpdateTreeStats | null)[];

export type UpdateState = {
  drafts: Map<Source, Draft>;
  missingFields: MissingFieldsMap;
  indexedTree: IndexedTree;
  statsLogger?: UpdateLogger;
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
};
