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
} from "./types";
import type { NodeKey, OperationDescriptor } from "../descriptor/types";
import { assert } from "../jsutils/assert";
import {
  isFragmentDocument,
  resolveResultDescriptor,
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

type WriteResult = {
  affected?: Iterable<OperationDescriptor>;
  incoming: DataTree;
};

export function write(
  env: CacheEnv,
  store: Store,
  activeTransaction: Transaction,
  options: Cache.WriteOptions,
): WriteResult {
  const { mergePolicies, objectKey, addTypename, keyMap } = env;
  const targetForest = getActiveForest(store, activeTransaction);

  const writeData = options.result ?? {};
  const rootNodeKey = options.dataId ?? objectKey(writeData);
  assert(rootNodeKey !== false);

  // ApolloCompat (apollo allows writing fragments without proper id in the data)
  if (rootNodeKey !== undefined && options.dataId) {
    keyMap?.set(writeData, rootNodeKey);
  }
  const operationDescriptor = resolveOperationDescriptor(
    env,
    store,
    options.query,
    options.variables,
    rootNodeKey,
  );
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
    return { incoming: existingResult };
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

  const incomingResult = indexTree(
    env,
    operationDescriptor,
    operationResult,
    undefined,
    existingResult,
  );

  // ApolloCompat: necessary for fragment writes with custom ids
  if (options.dataId && incomingResult.rootNodeKey !== options.dataId) {
    const rootNode = incomingResult.nodes.get(incomingResult.rootNodeKey);
    assert(rootNode);
    incomingResult.nodes.set(options.dataId, rootNode);
    incomingResult.nodes.delete(incomingResult.rootNodeKey);
    incomingResult.rootNodeKey = options.dataId;
  }

  const modifiedIncomingResult = applyMergePolicies(
    env,
    getEffectiveReadLayers(store, targetForest, false),
    mergePolicies,
    incomingResult,
    options.overwrite ?? false,
  );

  const difference = diffTree(targetForest, modifiedIncomingResult, env);

  if (difference.errors.length) {
    processDiffErrors(targetForest, modifiedIncomingResult, difference);
  }

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
  const affectedOperations = resolveAffectedOperations(
    targetForest,
    difference,
  );

  const chunkProvider = (key: NodeKey) =>
    getNodeChunks(getEffectiveReadLayers(store, targetForest, false), key);

  updateAffectedTrees(env, targetForest, affectedOperations, chunkProvider);

  if (!existingResult && shouldCache(targetForest, operationDescriptor)) {
    affectedOperations.set(operationDescriptor, difference.nodeDifference);
    addTree(targetForest, modifiedIncomingResult);
  }

  appendAffectedOperationsFromOtherLayers(
    env,
    store,
    affectedOperations,
    targetForest,
    modifiedIncomingResult,
  );

  invalidateReadResults(
    env,
    store,
    targetForest,
    difference,
    affectedOperations,
    modifiedIncomingResult,
  );
  incomingResult.prev = null;
  modifiedIncomingResult.prev = null;

  return {
    incoming: modifiedIncomingResult,
    affected: affectedOperations.keys(),
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
  const op = resolveResultDescriptor(env, store, operation);
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

const inspect = JSON.stringify.bind(JSON);
const EMPTY_ARRAY = Object.freeze([]);
