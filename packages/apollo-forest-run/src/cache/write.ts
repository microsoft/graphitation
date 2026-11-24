import type { Cache } from "@apollo/client";
import type { IndexedTree, UpdateTreeResult } from "../forest/types";
import type {
  ObjectChunk,
  OperationResult,
  SourceObject,
} from "../values/types";
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
import { diffNodes, diffTree, GraphDifference } from "../diff/diffTree";
import { diffObject } from "../diff/diffObject";
import * as Difference from "../diff/difference";
import {
  resolveAffectedOperations,
  updateAffectedTrees,
} from "../forest/updateForest";
import {
  DeferIndexing,
  EmbeddedDeferTarget,
  indexTree,
} from "../forest/indexTree";
import type { DeferIndex } from "../forest/deferIndex";
import { resolveObjectAddress } from "../forest/deferIndex";
import { addDirtyChunkDifference } from "../forest/transformTree";
import {
  createParentLocator,
  isObjectValue,
  markAsPartial,
  TraverseEnv,
} from "../values";
import { NodeDifferenceMap } from "../forest/updateTree";
import { getNodeChunks } from "./draftHelpers";
import { replaceTree } from "../forest/addTree";
import { invalidateReadResults } from "./invalidate";
import { IndexedForest } from "../forest/types";

export type WriteOperationOptions = {
  // Whether to store the result tree of the written operation (defaults to `operation.cache`)
  retain?: boolean;
  // Key of the written object (when it differs from the root node key of the operation)
  rootNodeKey?: NodeKey;
  deferIndexing?: DeferIndexing;
  // Identity of an incremental execution started by this write (its targets are collected via `deferIndexing`)
  newExecution?: object;
  // Object without a key of its own to write the data to (data is written to the closest node)
  embeddedTarget?: { tree: IndexedTree; chunk: ObjectChunk };
};

export function write(
  env: CacheEnv,
  store: Store,
  activeTransaction: Transaction,
  options: Cache.WriteOptions,
  incremental?: { execution: object; deferIndexing: DeferIndexing },
): WriteResult {
  const { objectKey, keyMap } = env;

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

  if (
    !ROOT_TYPES.includes(operationDescriptor.rootType) &&
    rootNodeKey === undefined
  ) {
    throw new Error(`Could not identify object ${inspect(writeData)}`);
  }
  return writeOperation(
    env,
    store,
    activeTransaction,
    operationDescriptor,
    writeData,
    options,
    {
      deferIndexing: incremental?.deferIndexing,
      newExecution: incremental?.execution,
    },
  );
}

/**
 * Writes data of a resolved operation descriptor (also used for derived descriptors,
 * which are not registered in the store).
 */
export function writeOperation(
  env: CacheEnv,
  store: Store,
  activeTransaction: Transaction,
  operationDescriptor: OperationDescriptor,
  writeData: SourceObject,
  options: Cache.WriteOptions,
  {
    retain,
    rootNodeKey,
    deferIndexing,
    newExecution,
    embeddedTarget,
  }: WriteOperationOptions = {},
): WriteResult {
  const { mergePolicies, addTypename } = env;
  const targetForest = getActiveForest(store, activeTransaction);
  const operationResult: OperationResult = { data: writeData };

  let existingResult = getExistingResult(
    env,
    store,
    targetForest,
    operationDescriptor,
  );
  const existingData = existingResult?.result.data;

  // Safeguard: make sure previous state doesn't leak outside write operation
  assert(!existingResult?.prev);

  if (writeData === existingData && existingResult && !deferIndexing) {
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
    deferIndexing,
    rootNodeKey,
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
    embeddedTarget?.chunk,
  );
  if (
    deferIndexing?.index &&
    deferIndexing.embeddedTargets?.length &&
    modifiedIncomingResult !== incomingResult
  ) {
    relocateEmbeddedTargets(
      deferIndexing.index,
      deferIndexing.embeddedTargets,
      modifiedIncomingResult,
      deferIndexing.anchor,
    );
  }

  const diff = embeddedTarget
    ? (forest: IndexedForest) =>
        diffEmbeddedTarget(env, forest, modifiedIncomingResult, embeddedTarget)
    : (forest: IndexedForest) => diffTree(forest, modifiedIncomingResult, env);

  const difference = diff(targetForest);

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

  if (
    !existingResult &&
    (retain ?? shouldCache(targetForest, operationDescriptor))
  ) {
    affectedOperations.set(operationDescriptor, difference.nodeDifference);
    // Note: even with existingResult === undefined the tree for this operation may still exist in the cache
    //   (when existingResult is resolved with a different key descriptor due to key variables)
    // TODO: replace with addTree and add a proper check for keyVariables
    replaceTree(env, targetForest, modifiedIncomingResult);
  }
  if (newExecution && deferIndexing?.index) {
    // Targets are owned by the result tree; without one (e.g. a mutation) - by the execution itself
    const resultTree = targetForest.trees.get(
      resolveResultDescriptor(env, store, operationDescriptor).id,
    );
    if (resultTree) {
      (resultTree.deferIndexes ??= new WeakMap()).set(
        newExecution,
        deferIndexing.index,
      );
    } else {
      store.deferIndexes.set(newExecution, deferIndexing.index);
    }
  }

  appendAffectedOperationsFromOtherLayers(
    store,
    affectedOperations,
    targetForest,
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
  store: Store,
  affectedForestOperationsMutable: Map<OperationDescriptor, NodeDifferenceMap>,
  targetForest: DataForest | OptimisticLayer,
  diff: (forest: IndexedForest) => GraphDifference,
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
      diff(layer),
      affectedForestOperationsMutable,
    );
  }
}

/**
 * Embedded objects have no node of their own: diffs the incoming object against the target
 * and records the difference on its closest node (nested nodes are diffed as usual).
 */
function diffEmbeddedTarget(
  env: CacheEnv,
  forest: IndexedForest,
  incoming: IndexedTree,
  target: { tree: IndexedTree; chunk: ObjectChunk },
): GraphDifference {
  const [root] = incoming.nodes.get(incoming.rootNodeKey) ?? EMPTY_ARRAY;
  assert(root);
  const nodes = new Map(incoming.nodes);
  nodes.delete(incoming.rootNodeKey);

  const graphDifference = diffNodes(forest, nodes, env);
  const { difference } = diffObject(target.chunk, root, env);
  if (difference && Difference.isDirty(difference)) {
    addDirtyChunkDifference(
      {
        findParent: createParentLocator(target.tree.dataMap),
        nodeDifference: graphDifference.nodeDifference,
      },
      target.chunk,
      difference,
    );
  }
  return graphDifference;
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

/**
 * Merge policies may rearrange the incoming result (e.g. append a page to existing list items),
 * so positional addresses of embedded targets are resolved again in the final result.
 * Targets whose objects did not survive the merge are dropped.
 */
function relocateEmbeddedTargets(
  index: DeferIndex,
  targets: EmbeddedDeferTarget[],
  tree: IndexedTree,
  anchor: DeferIndexing["anchor"],
) {
  for (const { key, target, source } of targets) {
    const chunk = tree.dataMap.get(source)?.value;
    const address =
      chunk && isObjectValue(chunk)
        ? resolveObjectAddress(tree, chunk, anchor)
        : undefined;
    if (address) {
      target.nodeKey = address.nodeKey;
      target.path = address.path;
    } else if (index.get(key) === target) {
      index.delete(key);
    }
  }
}

export function isWrite(op: WriteResult | ModifyResult): op is WriteResult {
  return "incoming" in op; // write has "incoming" tree
}
