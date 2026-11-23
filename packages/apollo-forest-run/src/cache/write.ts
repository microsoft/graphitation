import type { Cache } from "@apollo/client";
import type {
  DeferredWrite,
  IndexedTree,
  UpdateTreeResult,
} from "../forest/types";
import type { OperationResult } from "../values/types";
import type {
  CacheEnv,
  DataForest,
  DataTree,
  ModifyResult,
  OptimisticLayer,
  Store,
  Transaction,
  WriteResult,
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
import { replaceTree } from "../forest/addTree";
import { invalidateReadResults } from "./invalidate";
import { IndexedForest } from "../forest/types";

type InitialDelivery = Pick<DeferredWrite, "owner" | "index">;
type IndexedWrite =
  | { kind: "full"; existingResult?: DataTree; delivery?: InitialDelivery }
  | {
      kind: "patch";
      delivery: DeferredWrite;
      diff: (forest: IndexedForest, tree: IndexedTree) => GraphDifference;
    };

export function write(
  env: CacheEnv,
  store: Store,
  activeTransaction: Transaction,
  options: Cache.WriteOptions,
  delivery?: InitialDelivery,
): WriteResult {
  const { objectKey, addTypename, keyMap } = env;
  const targetForest = getActiveForest(store, activeTransaction);

  const writeData =
    typeof options.result === "object" && options.result !== null
      ? options.result
      : {};
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

  const existingResult = getExistingResult(
    env,
    store,
    targetForest,
    operationDescriptor,
  );
  const existingData = existingResult?.result.data;

  // Safeguard: make sure previous state doesn't leak outside write operation
  assert(!existingResult?.prev);

  if (writeData === existingData && existingResult && !delivery) {
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
    undefined,
    existingResult,
    delivery,
  );

  // ApolloCompat: necessary for fragment writes with custom ids
  if (options.dataId && incomingResult.rootNodeKey !== options.dataId) {
    const rootNode = incomingResult.nodes.get(incomingResult.rootNodeKey);
    assert(rootNode);
    incomingResult.nodes.set(options.dataId, rootNode);
    incomingResult.nodes.delete(incomingResult.rootNodeKey);
    incomingResult.rootNodeKey = options.dataId;
  }

  const merged = applyMergePolicies(
    env,
    getEffectiveReadLayers(store, targetForest, false),
    env.mergePolicies,
    incomingResult,
    options.overwrite ?? false,
  );
  const result = writeIndexedTree(env, store, targetForest, options, merged, {
    kind: "full",
    existingResult,
    delivery,
  });
  incomingResult.prev = null;
  return result;
}

export function writeIndexedTree(
  env: CacheEnv,
  store: Store,
  targetForest: DataForest | OptimisticLayer,
  options: Cache.WriteOptions,
  modifiedIncomingResult: IndexedTree,
  context: IndexedWrite,
): WriteResult {
  let existingResult =
    context.kind === "full" ? context.existingResult : undefined;
  const diff =
    context.kind === "patch"
      ? context.diff
      : (forest: IndexedForest, tree: IndexedTree) =>
          diffTree(forest, tree, env);
  const operationDescriptor = modifiedIncomingResult.operation;

  const difference = diff(targetForest, modifiedIncomingResult);

  if (difference.errors.length) {
    processDiffErrors(targetForest, modifiedIncomingResult, difference);
  }

  if (
    existingResult &&
    existingResult.grown &&
    existingResult.incompleteChunks.size > 0
  ) {
    // Remove incomplete placeholder tree (saves unnecessary update)
    if (existingResult.pendingDeferred)
      modifiedIncomingResult.pendingDeferred = existingResult.pendingDeferred;
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
    context.delivery,
  );

  if (
    context.kind === "full" &&
    !existingResult &&
    shouldCache(targetForest, operationDescriptor)
  ) {
    affectedOperations.set(operationDescriptor, difference.nodeDifference);
    // Note: even with existingResult === undefined the tree for this operation may still exist in the cache
    //   (when existingResult is resolved with a different key descriptor due to key variables)
    // TODO: replace with addTree and add a proper check for keyVariables
    replaceTree(env, targetForest, modifiedIncomingResult);
  }

  appendAffectedOperationsFromOtherLayers(
    store,
    affectedOperations,
    targetForest,
    modifiedIncomingResult,
    diff,
  );

  invalidateReadResults(
    env,
    store,
    targetForest,
    difference,
    affectedOperations,
    modifiedIncomingResult,
  );
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
  store: Store,
  affectedForestOperationsMutable: Map<OperationDescriptor, NodeDifferenceMap>,
  targetForest: DataForest | OptimisticLayer,
  incomingResult: IndexedTree,
  diff: (forest: IndexedForest, tree: IndexedTree) => GraphDifference,
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
      diff(layer, incomingResult),
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
  if (isFragmentDocument(operationDescriptor.document)) {
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

const inspect = JSON.stringify.bind(JSON);
const EMPTY_ARRAY = Object.freeze([]);

export function isWrite(op: WriteResult | ModifyResult): op is WriteResult {
  return "incoming" in op; // write has "incoming" tree
}
