import {
  CacheEnv,
  DataForest,
  DataTree,
  OptimisticLayer,
  ResultTree,
  Store,
  Transaction,
  TransformedResult,
} from "./types";
import {
  NodeKey,
  OperationDescriptor,
  OperationId,
  TypeName,
} from "../descriptor/types";
import { assert } from "../jsutils/assert";
import { IndexedTree, DefaultPartition } from "../forest/types";
import { NodeChunk } from "../values/types";
import { operationCacheKey } from "./descriptor";

const EMPTY_ARRAY = Object.freeze([]);
const DEFAULT_PARTITION: DefaultPartition = "__default__";

export function createStore(_: CacheEnv): Store {
  const dataForest: DataForest = {
    trees: new Map(),
    operationsByNodes: new Map<NodeKey, Set<OperationId>>(),
    operationsByName: new Map(),
    operationsByPartitions: new Map(),
    operationsWithErrors: new Set<OperationDescriptor>(),
    extraRootIds: new Map<NodeKey, TypeName>(),
    layerTag: null, // not an optimistic layer
    readResults: new Map(),
    mutations: new Set<OperationDescriptor>(),
    operationsWithDanglingRefs: new Map(),
    deletedNodes: new Set(),
  };

  const optimisticReadResults = new Map<
    OperationDescriptor,
    TransformedResult
  >();

  const partialReadResults = new Set<OperationDescriptor>();
  const optimisticLayers: OptimisticLayer[] = [];
  const store: Store = {
    operations: new Map(),
    dataForest,
    optimisticLayers,
    optimisticReadResults,
    partialReadResults,
    watches: new Map(),
    fragmentWatches: new Map(),
    atime: new Map(),
    partitions: new WeakMap(),
    pendingEviction: null,
  };
  return store;
}

export function touchOperation(
  env: CacheEnv,
  store: Store,
  operation: OperationDescriptor,
) {
  store.atime.set(operation.id, env.now());
}

function shouldAutoEvictAtLeastOnePartition(
  env: CacheEnv,
  store: Store,
): boolean {
  const partitions = env.partitionConfig.partitions;

  for (const [partition, ops] of store.dataForest.operationsByPartitions) {
    const partitionConfig =
      partitions[partition] ?? partitions[DEFAULT_PARTITION];

    assert(partitionConfig);

    if (
      partitionConfig.autoEvict &&
      ops.size >= partitionConfig.maxOperationCount * 2
    ) {
      return true;
    }
  }
  return false;
}

export function maybeEvictOldData(env: CacheEnv, store: Store): void {
  if (store.pendingEviction != null) {
    return;
  }
  if (!shouldAutoEvictAtLeastOnePartition(env, store)) {
    return;
  }
  store.pendingEviction = env.scheduleAutoEviction(() => {
    store.pendingEviction = null;
    evictOldData(env, store);
  });
}

export function cancelPendingEviction(store: Store): void {
  store.pendingEviction?.cancel();
  store.pendingEviction = null;
}

export function evictOldData(env: CacheEnv, store: Store): OperationId[] {
  const { dataForest, atime } = store;

  const evictedIds: OperationId[] = [];
  const partitions = env.partitionConfig?.partitions ?? {};

  // Process each partition
  for (const [partition, ops] of dataForest.operationsByPartitions) {
    if (!partitions[partition]) {
      env.logger?.warnOnce(
        "partition_not_configured",
        `Partition "${partition}" is not configured in partitionConfig. Using default partition instead.`,
      );
    }

    const partitionConfig =
      partitions[partition] ?? partitions[DEFAULT_PARTITION];

    assert(partitionConfig);

    const maxCount = partitionConfig.maxOperationCount;

    if (!maxCount || ops.size <= maxCount) {
      continue; // No eviction needed for this partition
    }

    // Sort by access time (LRU) and determine how many to evict
    const evictableOperationIds = [...ops].sort(
      (a, b) => (atime.get(a) ?? 0) - (atime.get(b) ?? 0),
    );

    const evictCount = Math.max(0, evictableOperationIds.length - maxCount);

    // Keep only the ones to evict without array copying w/ slice
    evictableOperationIds.length = evictCount;

    // Remove evicted operations
    for (const opId of evictableOperationIds) {
      const tree = store.dataForest.trees.get(opId);
      assert(tree);
      if (!canEvict(env, store, tree)) {
        continue; // Skip non-evictable operations entirely
      }
      removeDataTree(store, tree, partition);
    }

    evictedIds.push(...evictableOperationIds);
  }

  return evictedIds;
}

function canEvict(env: CacheEnv, store: Store, resultTree: DataTree) {
  if (store.watches.has(resultTree.operation)) {
    return false;
  }
  if (!env.nonEvictableQueries?.size) {
    return true;
  }
  const rootFields = getRootNode(resultTree)?.selection.fields.keys();
  for (const rootField of rootFields ?? EMPTY_ARRAY) {
    if (env.nonEvictableQueries.has(rootField)) {
      return false;
    }
  }
  return true;
}

export function createOptimisticLayer(
  layerTag: string,
  replay: <T>(cache: T) => any,
): OptimisticLayer {
  return {
    layerTag,
    trees: new Map(),
    operationsByNodes: new Map(),
    operationsWithErrors: new Set(),
    operationsByName: new Map(),
    operationsByPartitions: new Map(),
    extraRootIds: new Map(),
    readResults: new Map(),
    mutations: new Set(),
    operationsWithDanglingRefs: new Map(),
    deletedNodes: new Set(),
    replay,
  };
}

export function removeOptimisticLayers<T>(
  cache: T,
  env: CacheEnv,
  store: Store,
  layerTag: string,
): Set<OperationDescriptor> | undefined {
  const { optimisticLayers } = store;
  const deletedLayers = optimisticLayers.filter((f) => f.layerTag === layerTag);
  if (!deletedLayers.length) {
    // ApolloCompat: this is a no-op in Apollo
    return;
  }
  const [affectedNodes, affectedOps] = resolveLayerImpact(store, layerTag);

  env.logger?.debug(
    `Removing optimistic layer ${layerTag}. Affected nodes: ${affectedNodes.length}; ` +
      `affected operations: ${affectedOps.length}`,
  );

  const affectedOperationSet = new Set<OperationDescriptor>();

  for (const operationId of affectedOps) {
    const operation = store.dataForest.trees.get(operationId)?.operation;
    if (!operation || affectedOperationSet.has(operation)) {
      continue;
    }
    affectedOperationSet.add(operation);
    const readResult = store.optimisticReadResults.get(operation);
    if (!readResult) {
      continue;
    }
    for (const nodeKey of affectedNodes) {
      const dirtyFields = readResult.dirtyNodes.get(nodeKey);
      if (!dirtyFields) {
        readResult.dirtyNodes.set(nodeKey, new Set());
      } else {
        dirtyFields.clear(); // Empty set means we must diff all fields
      }
    }
  }

  // ApolloCompat: replaying layers on removal, same as InMemoryCache
  //
  // Some details:
  //
  // When creating a new optimistic layer InMemoryCache remembers write transaction that initiated the layer.
  // When the layer is removed - Apollo re-creates all layers above the removed layer, by replaying their transactions.
  //
  // The reason for this behavior is that "reads" that were "a part" of the initial layer transaction
  // could have read data from lower layers. And this "optimistic" data could have leaked into higher layers.
  //
  // Therefor when we remove any layer, its data could be still present in any of the layers above it.
  // So to truly wipe out all layer data, Apollo re-runs all the callbacks of all layers above the removed one
  // and essentially re-creates them.

  const lowestUnaffectedLayerIndex = optimisticLayers.indexOf(deletedLayers[0]);
  const oldLayers = [...optimisticLayers];
  optimisticLayers.splice(lowestUnaffectedLayerIndex);

  for (let i = lowestUnaffectedLayerIndex; i < oldLayers.length; i++) {
    const layer = oldLayers[i];
    if (!deletedLayers.includes(layer)) {
      layer.replay(cache);
    }
  }
  return affectedOperationSet;
}

export function getActiveForest(
  store: Store,
  transaction: Transaction | undefined,
): DataForest | OptimisticLayer {
  return transaction?.optimisticLayer ?? store.dataForest;
}

export function getEffectiveReadLayers(
  { optimisticLayers, dataForest }: Store,
  activeForest: DataForest | OptimisticLayer,
  optimistic: boolean,
): (DataForest | OptimisticLayer)[] {
  const appliedOptimisticLayers = optimistic
    ? optimisticLayers.length - 1 // All layers
    : optimisticLayers.indexOf(activeForest as OptimisticLayer); // Up to current one

  const layers: (DataForest | OptimisticLayer)[] = [];
  for (let i = appliedOptimisticLayers; i >= 0; i--) {
    layers.push(optimisticLayers[i]);
  }
  layers.push(dataForest);

  return layers;
}

export function getEffectiveWriteLayers(
  { dataForest, optimisticLayers }: Store,
  activeForest: DataForest | OptimisticLayer,
  optimistic: boolean,
): (DataForest | OptimisticLayer)[] {
  if (!optimistic) {
    // FIXME: plus all layers beneath this one?
    return [activeForest];
  }
  if (activeForest === dataForest) {
    return [dataForest, ...optimisticLayers];
  }
  const forestIndex = optimisticLayers.indexOf(activeForest as OptimisticLayer);
  return forestIndex === 0
    ? optimisticLayers
    : optimisticLayers.slice(forestIndex);
}

function resolveLayerImpact(
  { dataForest, optimisticLayers }: Store,
  layerTag: string,
): [affectedNodes: NodeKey[], affectedOperations: OperationId[]] {
  const layers: OptimisticLayer[] = optimisticLayers.filter(
    (l) => l.layerTag === layerTag,
  );
  const affectedNodes: NodeKey[] = [];
  for (const layer of layers) {
    affectedNodes.push(...layer.operationsByNodes.keys());
  }
  const affectedOperations: OperationId[] = [];
  for (const nodeKey of affectedNodes) {
    affectedOperations.push(
      ...(dataForest.operationsByNodes.get(nodeKey) ?? EMPTY_ARRAY),
    );
  }
  for (const layer of optimisticLayers) {
    if (layers.includes(layer)) {
      continue;
    }
    for (const nodeKey of affectedNodes) {
      affectedOperations.push(
        ...(layer.operationsByNodes.get(nodeKey) ?? EMPTY_ARRAY),
      );
    }
  }
  return [affectedNodes, affectedOperations];
}

function removeDataTree(
  {
    dataForest,
    optimisticReadResults,
    partialReadResults,
    operations,
    watches,
    atime,
  }: Store,
  { operation }: ResultTree,
  partition: string,
) {
  assert(!watches.has(operation));
  dataForest.trees.delete(operation.id);
  dataForest.readResults.delete(operation);
  dataForest.operationsWithErrors.delete(operation);
  dataForest.operationsByName.get(operation.name ?? "")?.delete(operation.id);
  dataForest.operationsByPartitions.get(partition)?.delete(operation.id);
  optimisticReadResults.delete(operation);
  partialReadResults.delete(operation);
  operations.get(operation.document)?.delete(operationCacheKey(operation));
  atime.delete(operation.id);
  // Notes:
  // - Not deleting from optimistic layers because they are meant to be short-lived anyway
  // - Not removing operation from operationsByNodes because it is expensive to do during LRU eviction.
  //   TODO: separate step to cleanup stale values from operationsByNodes
}

export function resetStore(store: Store): void {
  const { dataForest, optimisticReadResults, optimisticLayers, operations } =
    store;
  dataForest.trees.clear();
  dataForest.extraRootIds.clear();
  dataForest.operationsByNodes.clear();
  dataForest.operationsWithErrors.clear();
  dataForest.operationsByName.clear();
  dataForest.operationsWithDanglingRefs.clear();
  dataForest.readResults.clear();
  operations.clear();
  optimisticReadResults.clear();
  optimisticLayers.length = 0;
}

const getRootNode = (result: IndexedTree): NodeChunk | undefined =>
  result.nodes.get(result.rootNodeKey)?.[0];
