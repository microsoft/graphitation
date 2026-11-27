import type { Cache } from "@apollo/client";
import type { IndexedTree, UpdateTreeResult } from "../forest/types";
import type { OperationResult } from "../values/types";
import type {
  CacheEnv,
  DataForest,
  ModifyResult,
  OptimisticLayer,
  Store,
  Transaction,
  WriteOptionsInternal,
  WriteResult,
} from "./types";
import type { NodeKey, OperationDescriptor } from "../descriptor/types";
import type {
  InitialExecutionResult,
  SplicedIncrementalResult,
} from "../incremental/types";
import { assert } from "../jsutils/assert";
import {
  resolveOperationDescriptor,
  ROOT_NODES,
  ROOT_TYPES,
} from "./descriptor";
import { applyMergePolicies } from "./policies";
import {
  getActiveForest,
  getEffectiveReadLayers,
  getExistingResult,
  shouldCache,
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
import {
  captureIncrementalExecution,
  addMissingBaseFields,
  createDeliveredFieldFilter,
  isSplicedIncrementalResult,
} from "../incremental/execution";
import { getNodeChunks } from "./draftHelpers";
import { replaceTree } from "../forest/addTree";
import { invalidateReadResults } from "./invalidate";

export function write(
  env: CacheEnv,
  store: Store,
  activeTransaction: Transaction,
  options: WriteOptionsInternal,
): WriteResult {
  const { mergePolicies, objectKey, addTypename, keyMap } = env;
  const targetForest = getActiveForest(store, activeTransaction);

  // An initial result of incremental delivery is written as a regular (partial) result,
  //   subsequent results are spliced into the stored result first (see spliceSubsequentResult)
  let execution: InitialExecutionResult | SplicedIncrementalResult | undefined;
  let result: Cache.WriteOptions["result"];
  if (isExecutionWrite(options)) {
    execution = options.execution;
    result = execution.data;
  } else {
    result = options.result;
  }
  const splicedResult =
    execution && isSplicedIncrementalResult(execution) ? execution : undefined;
  const writeData = typeof result === "object" && result !== null ? result : {};
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
  if (!operationDescriptor.cache) {
    // Results of this operation are never stored, so nothing will ever evict its descriptor.
    // Remember it, so that the outermost transaction can release it on completion.
    // (the set only exists when `env.cleanupNonCacheableOperations` is enabled)
    activeTransaction.nonCacheableOperations?.add(operationDescriptor);
  }
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
    // E.g. a new execution (or a complete result) with data of the stored result
    captureIncrementalExecution(
      env,
      store,
      targetForest,
      operationDescriptor,
      execution,
      existingResult,
      existingResult,
    );
    return {
      options,
      incoming: existingResult,
      affected: [],
      difference: undefined,
      affectedNodes: new Set(),
      updateStats: [],
    };
  }

  if (!ROOT_NODES.includes(operationDescriptor.rootNodeKey)) {
    const typeName = resolveExtraRootNodeType(
      env,
      store,
      operationDescriptor,
      writeData,
    );
    if (addTypename && typeName && !writeData["__typename"]) {
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
    splicedResult?.missingFields,
    existingResult ?? splicedResult?.incremental.transientTree,
  );
  if (splicedResult && !existingResult) {
    // A transient tree is only a source of recycled chunks (existing values are resolved from the forest)
    incomingResult.prev = null;
  }

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
    splicedResult && createDeliveredFieldFilter(splicedResult),
  );

  captureIncrementalExecution(
    env,
    store,
    targetForest,
    operationDescriptor,
    execution,
    incomingResult,
    modifiedIncomingResult,
  );

  const difference = diffTree(
    targetForest,
    modifiedIncomingResult,
    env,
    // A transient tree (not in the forest) is the base of results spliced into it
    splicedResult && splicedResult.tree !== existingResult
      ? splicedResult.tree
      : undefined,
  );

  if (splicedResult && splicedResult.tree === existingResult) {
    addMissingBaseFields(difference, splicedResult);
  }
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

  const allUpdates = updateAffectedTrees(
    env,
    targetForest,
    affectedOperations,
    chunkProvider,
    modifiedIncomingResult,
  );

  if (!existingResult && shouldCache(targetForest, operationDescriptor)) {
    affectedOperations.set(operationDescriptor, difference.nodeDifference);
    // Note: even with existingResult === undefined the tree for this operation may still exist in the cache
    //   (when existingResult is resolved with a different key descriptor due to key variables)
    // TODO: replace with addTree and add a proper check for keyVariables
    replaceTree(env, targetForest, modifiedIncomingResult);
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
    options,
    incoming: modifiedIncomingResult,
    affected: affectedOperations.keys(),
    difference,
    affectedNodes: aggregateAllAffectedNodes(difference, allUpdates),
    updateStats: allUpdates.map((update) => update.stats ?? null),
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
        const tree = forest.trees.get(chunk.operation.id);
        if (!tree) {
          // A base tree which is not in the forest (see diffTree)
          continue;
        }
        chunk.missingFields ??= new Set();
        for (const field of baseChunkError.missingFields) {
          chunk.missingFields.add(field);
        }
        tree.incompleteChunks.add(chunk);
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

function aggregateAllAffectedNodes(
  difference: GraphDifference,
  updates: UpdateTreeResult[],
): Set<NodeKey> {
  const accumulator = new Set<NodeKey>([
    ...difference.newNodes,
    ...difference.nodeDifference.keys(),
  ]);
  for (const { affectedNodes } of updates) {
    for (const nodeKey of affectedNodes) {
      accumulator.add(nodeKey);
    }
  }
  return accumulator;
}

function resolveExtraRootNodeType(
  env: CacheEnv,
  store: Store,
  operationDescriptor: OperationDescriptor,
  data: Record<string, unknown> & { __typename?: string },
): string | undefined {
  if (data["__typename"]) {
    return data["__typename"];
  }
  // Try fragment condition (fragments on abstract types are ignored)
  if (operationDescriptor.kind === "DetachedFragment") {
    const [fragmentDef] = operationDescriptor.fragmentMap.values();
    const typeName = fragmentDef?.typeCondition.name.value;
    if (!env.possibleTypes?.[typeName]) {
      return typeName;
    }
  }
  // Finally, try from store
  const [chunk] = getNodeChunks(
    [store.dataForest, ...store.optimisticLayers],
    operationDescriptor.rootNodeKey,
  );
  if (chunk?.type) {
    return chunk.type;
  }
  return undefined;
}

function isExecutionWrite(
  options: WriteOptionsInternal,
): options is Exclude<WriteOptionsInternal, Cache.WriteOptions> {
  // An explicit nullish `execution` (e.g. untyped options of `write`) is a regular write of `result`
  return "execution" in options && options.execution != null;
}

const inspect = JSON.stringify.bind(JSON);
const EMPTY_ARRAY = Object.freeze([]);

export function isWrite(op: WriteResult | ModifyResult): op is WriteResult {
  return "incoming" in op; // write has "incoming" tree
}
