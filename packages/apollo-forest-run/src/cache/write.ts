import type { Cache } from "@apollo/client";
import type { IndexedTree } from "../forest/types";
import type { OperationResult } from "../values/types";
import type {
  CacheEnv,
  DataForest,
  DataTree,
  OptimisticLayer,
  Store,
  Transaction,
  WriteStats,
} from "./types";
import type { NodeKey, OperationDescriptor } from "../descriptor/types";
import { assert } from "../jsutils/assert";
import {
  isFragmentDocument,
  resolveKeyDescriptor,
  resolveOperationDescriptor,
  ROOT_NODES,
  ROOT_TYPES,
} from "./descriptor";
import { applyMergePolicies } from "./policies";
import {
  getActiveForest,
  getEffectiveReadLayers,
  touchOperation,
} from "./store";
import { diffTree, GraphDifference } from "../diff/diffTree";
import {
  resolveAffectedOperations,
  updateAffectedTrees,
} from "../forest/updateForest";
import { indexTree } from "../forest/indexTree";
import { createParentLocator, markAsPartial, TraverseEnv } from "../values";
import { NodeDifferenceMap } from "../forest/updateTree";
import { getNodeChunks } from "./draftHelpers";
import { addTree } from "../forest/addTree";
import { invalidateReadResults } from "./invalidate";
import { IndexedForest } from "../forest/types";
import { createTimedEvent, markEnd, markStart } from "./stats";

type WriteResult = {
  affected?: Iterable<OperationDescriptor>;
  incoming: DataTree;
  stats: WriteStats;
};

export function write(
  env: CacheEnv,
  store: Store,
  activeTransaction: Transaction,
  options: Cache.WriteOptions,
): WriteResult {
  const { mergePolicies, objectKey, addTypename, keyMap } = env;
  const stats = createStats();
  const steps = stats.steps;
  const targetForest = getActiveForest(store, activeTransaction);

  const writeData = options.result ?? {};
  const rootNodeKey = options.dataId ?? objectKey(writeData);
  assert(rootNodeKey !== false);

  // ApolloCompat (apollo allows writing fragments without proper id in the data)
  if (rootNodeKey !== undefined && options.dataId) {
    keyMap?.set(writeData, rootNodeKey);
  }
  markStart(steps.descriptor);
  const operationDescriptor = resolveOperationDescriptor(
    env,
    store,
    options.query,
    options.variables,
    rootNodeKey,
  );
  stats.op = operationDescriptor.debugName;
  stats.opId = operationDescriptor.id;
  stats.opType = operationDescriptor.operation;
  markEnd(steps.descriptor);

  touchOperation(env, store, operationDescriptor);
  const operationResult: OperationResult = { data: writeData };

  if (
    !ROOT_TYPES.includes(operationDescriptor.rootType) &&
    rootNodeKey === undefined
  ) {
    throw new Error(`Could not identify object ${inspect(writeData)}`);
  }

  let existingResult = getExistingResult(
    env,
    store,
    targetForest,
    operationDescriptor,
  );
  const existingData = existingResult?.result.data;

  // Safeguard: make sure previous state doesn't leak outside write operation
  assert(!existingResult?.prev);

  if (writeData === existingData && existingResult) {
    return { incoming: existingResult, stats: markEnd(stats) };
  }

  if (!ROOT_NODES.includes(operationDescriptor.rootNodeKey)) {
    let typeName = writeData["__typename"];
    if (isFragmentDocument(operationDescriptor)) {
      if (!typeName && addTypename) {
        const [fragmentDef] = operationDescriptor.fragmentMap.values();
        typeName = fragmentDef?.typeCondition.name.value;
      }
      writeData["__typename"] = typeName;
    }
    targetForest.extraRootIds.set(
      operationDescriptor.rootNodeKey,
      typeName ?? "",
    );
    operationDescriptor.rootType = typeName ?? "";
  }

  markStart(steps.indexing);
  const incomingResult = indexTree(
    env,
    operationDescriptor,
    operationResult,
    undefined,
    existingResult,
  );
  steps.indexing.totalNodes = incomingResult.nodes.size;
  markEnd(steps.indexing);

  // ApolloCompat: necessary for fragment writes with custom ids
  if (options.dataId && incomingResult.rootNodeKey !== options.dataId) {
    const rootNode = incomingResult.nodes.get(incomingResult.rootNodeKey);
    assert(rootNode);
    incomingResult.nodes.set(options.dataId, rootNode);
    incomingResult.nodes.delete(incomingResult.rootNodeKey);
    incomingResult.rootNodeKey = options.dataId;
  }

  markStart(steps.mergePolicies);
  const modifiedIncomingResult = applyMergePolicies(
    env,
    getEffectiveReadLayers(store, targetForest, false),
    mergePolicies,
    incomingResult,
    options.overwrite ?? false,
  );
  markEnd(steps.mergePolicies);

  const diffStats = steps.diff;
  markStart(diffStats);
  const difference = diffTree(targetForest, modifiedIncomingResult, env);
  if (difference.errors.length) {
    processDiffErrors(targetForest, modifiedIncomingResult, difference);
  }
  for (const [nodeKey, nodeDiff] of difference.nodeDifference) {
    diffStats.dirtyNodes.push([nodeKey, nodeDiff.dirtyFields ?? EMPTY_SET]);
  }
  diffStats.newNodes = difference.newNodes;
  diffStats.errors = difference.errors.length;
  markEnd(diffStats);

  if (
    existingResult &&
    existingResult.grown &&
    existingResult.incompleteChunks.size > 0
  ) {
    // Remove incomplete placeholder tree (saves unnecessary update)
    targetForest.trees.delete(operationDescriptor.id);
    existingResult = undefined;
  }

  // This function returns exhaustive list of affected operations. It may contain false-positives,
  // because operationsWithNodes also reflects nodes from optimistic updates and read policy results
  // (which may not exist in the main forest trees)
  markStart(steps.affectedOperations);
  const affectedOperations = resolveAffectedOperations(
    targetForest,
    difference,
  );
  steps.affectedOperations.totalCount = affectedOperations.size;
  markEnd(steps.affectedOperations);

  const chunkProvider = (key: NodeKey) =>
    getNodeChunks(getEffectiveReadLayers(store, targetForest, false), key);

  markStart(steps.update);
  steps.update.updated = updateAffectedTrees(
    env,
    targetForest,
    affectedOperations,
    chunkProvider,
  );
  if (!existingResult && shouldCache(targetForest, operationDescriptor)) {
    steps.update.newTreeAdded = true;
    affectedOperations.set(operationDescriptor, difference.nodeDifference);
    addTree(targetForest, modifiedIncomingResult);
  }
  markEnd(steps.update);

  markStart(steps.affectedLayerOperations);
  appendAffectedOperationsFromOtherLayers(
    env,
    store,
    affectedOperations,
    targetForest,
    modifiedIncomingResult,
  );
  markEnd(steps.affectedLayerOperations);

  markStart(steps.invalidateReadResults);
  invalidateReadResults(
    env,
    store,
    targetForest,
    difference,
    affectedOperations,
    modifiedIncomingResult,
  );
  markEnd(steps.invalidateReadResults);

  incomingResult.prev = null;
  modifiedIncomingResult.prev = null;

  return {
    incoming: modifiedIncomingResult,
    affected: affectedOperations.keys(),
    stats: markEnd(stats),
  };
}

function appendAffectedOperationsFromOtherLayers(
  env: CacheEnv,
  store: Store,
  affectedForestOperationsMutable: Map<OperationDescriptor, NodeDifferenceMap>,
  targetForest: DataForest | OptimisticLayer,
  incomingResult: IndexedTree,
) {
  // Optimistic reads go through all existing layers
  //  And those layers may be affected by incoming results too, so we actually need to diff all other layers too
  //  TODO: just write to all effective layers?
  for (const layer of getEffectiveReadLayers(store, targetForest, true)) {
    if (layer === targetForest) {
      continue;
    }
    resolveAffectedOperations(
      layer,
      diffTree(layer, incomingResult, env),
      affectedForestOperationsMutable,
    );
  }
}

function processDiffErrors(
  forest: DataForest | OptimisticLayer,
  model: IndexedTree,
  difference: GraphDifference,
) {
  const pathEnv: TraverseEnv = {
    findParent: (chunk) => {
      const tree = forest.trees.get(chunk.operation.id);
      const parentInfo = tree?.dataMap.get(chunk.data);
      assert(parentInfo);
      return parentInfo;
    },
  };

  for (const diffError of difference.errors) {
    if (diffError.kind === "MissingFields") {
      for (const baseChunkError of diffError.base ?? EMPTY_ARRAY) {
        // Missing chunks
        const chunk = baseChunkError.chunk;
        chunk.missingFields ??= new Set();
        for (const field of baseChunkError.missingFields) {
          chunk.missingFields.add(field);
        }
        const tree = forest.trees.get(chunk.operation.id);
        if (tree) {
          tree.incompleteChunks.add(chunk);
        }
        const parentInfo = pathEnv.findParent(chunk);
        markAsPartial(pathEnv, parentInfo);
      }

      pathEnv.findParent = createParentLocator(model.dataMap);
      for (const modelChunkError of diffError.model ?? EMPTY_ARRAY) {
        // Missing chunks
        const chunk = modelChunkError.chunk;
        chunk.missingFields ??= new Set();
        for (const field of modelChunkError.missingFields) {
          chunk.missingFields.add(field);
        }
        const parentInfo = pathEnv.findParent(chunk);
        markAsPartial(pathEnv, parentInfo);
        model.incompleteChunks.add(chunk);
      }
    }
  }
}

function getExistingResult(
  env: CacheEnv,
  store: Store,
  targetForest: IndexedForest,
  operation: OperationDescriptor,
): DataTree | undefined {
  const op = resolveKeyDescriptor(env, store, operation);
  return targetForest.trees.get(op.id);
}

function shouldCache(
  targetForest: DataForest | OptimisticLayer,
  operation: OperationDescriptor,
) {
  // Always cache results for optimistic layers (even if operation is not cacheable, e.g. it is a mutation)
  if (targetForest.layerTag !== null) {
    return true;
  }
  return operation.cache;
}

const createStats = (): WriteStats => ({
  kind: "Write",
  time: Number.NaN,
  op: "",
  opId: -1, // operation id
  opType: "", // query/mutation/subscription/fragment
  steps: {
    descriptor: createTimedEvent(),
    indexing: {
      time: Number.NaN,
      totalNodes: -1,
      start: Number.NaN,
    },
    mergePolicies: createTimedEvent(),
    diff: {
      time: Number.NaN,
      dirtyNodes: [],
      newNodes: [],
      errors: -1,
      start: Number.NaN,
    },
    affectedOperations: {
      time: Number.NaN,
      start: Number.NaN,
      totalCount: -1,
    },
    update: {
      time: Number.NaN,
      updated: [],
      newTreeAdded: false,
      start: Number.NaN,
    },
    affectedLayerOperations: {
      time: Number.NaN,
      start: Number.NaN,
      totalCount: -1,
    },
    invalidateReadResults: createTimedEvent(),
  },
  start: performance.now(),
});

const inspect = JSON.stringify.bind(JSON);
const EMPTY_ARRAY = Object.freeze([]);
const EMPTY_SET = new Set<any>();
EMPTY_SET["add"] = () => {
  throw new Error("Frozen set");
};
