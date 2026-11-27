import {
  CacheEnv,
  DataForest,
  DataTree,
  DirtyNodeMap,
  InFlightExecution,
  OptimisticLayer,
  ResultTree,
  Store,
  Transaction,
  TransformedResult,
} from "./types";
import type { ExecutionKey, ResultData } from "../incremental/types";
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
import { addTree, replaceTree } from "../forest/addTree";

const EMPTY_ARRAY = Object.freeze([]);
const DEFAULT_PARTITION: DefaultPartition = "__default__";

export function createStore(_: CacheEnv): Store {
  const dataForest = createDataForest();

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
    inFlightExecutions: new Map(),
  };
  return store;
}

function createDataForest(): DataForest {
  return {
    trees: new Map(),
    operationsByNodes: new Map<NodeKey, Set<OperationId>>(),
    operationsByName: new Map(),
    operationsByCoveredName: new Map(),
    operationsByPartitions: new Map(),
    operationsWithErrors: new Set<OperationDescriptor>(),
    extraRootIds: new Map<NodeKey, TypeName>(),
    layerTag: null, // not an optimistic layer
    readResults: new Map(),
    mutations: new Set<OperationDescriptor>(),
    operationsWithDanglingRefs: new Map(),
    deletedNodes: new Set(),
  };
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
    evictOldData(env, store, true);
  });
}

export function cancelPendingEviction(store: Store): void {
  store.pendingEviction?.cancel();
  store.pendingEviction = null;
}

export function evictOldData(
  env: CacheEnv,
  store: Store,
  isAutoEvict?: boolean,
): OperationId[] {
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

    if (isAutoEvict && !partitionConfig.autoEvict) {
      continue;
    }

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

/**
 * Operation descriptors are memoized in `store.operations` for the whole lifetime of the cache.
 * They are normally released by `removeDataTree` during LRU eviction — but eviction only ever
 * sees operations that produced a data tree.
 *
 * Non-cacheable operations (mutations without the `@cache` directive) never produce one:
 * `shouldCache` discards their result right after indexing it. So without an explicit release
 * their descriptors — and the `variablesKey` strings used as their cache keys — accumulate
 * forever, one per distinct set of variables.
 *
 * This returns true when nothing references the descriptor anymore, so that dropping it from
 * the memo cannot cause two live descriptors to exist for the same operation.
 */
export function canReleaseOperationDescriptor(
  store: Store,
  operation: OperationDescriptor,
): boolean {
  if (operation.cache) {
    // Results are cached, so the descriptor is owned by its data tree and released by eviction
    return false;
  }
  if (
    store.watches.has(operation) ||
    store.inFlightExecutions.has(operation) ||
    store.optimisticReadResults.has(operation) ||
    store.partialReadResults.has(operation)
  ) {
    return false;
  }
  if (isReferencedByForest(store.dataForest, operation)) {
    return false;
  }
  for (const layer of store.optimisticLayers) {
    if (isReferencedByForest(layer, operation)) {
      return false;
    }
  }
  for (const { forest } of store.inFlightExecutions.values()) {
    if (isReferencedByForest(forest, operation)) {
      return false;
    }
  }
  return true;
}

function isReferencedByForest(
  forest: DataForest | OptimisticLayer,
  operation: OperationDescriptor,
): boolean {
  return (
    forest.trees.has(operation.id) ||
    forest.readResults.has(operation) ||
    forest.operationsWithErrors.has(operation)
  );
}

/**
 * Removes an operation descriptor from the memo in `store.operations`.
 *
 * Note: this only drops the memoized entry. Any object still holding a reference to the
 * descriptor keeps working — callers must ensure nothing does (see canReleaseOperationDescriptor),
 * otherwise a subsequent lookup would mint a second descriptor for the same operation.
 */
export function releaseOperationDescriptor(
  store: Store,
  operation: OperationDescriptor,
): boolean {
  const variants = store.operations.get(operation.document);
  const cacheKey = operationCacheKey(operation);
  if (variants?.get(cacheKey) !== operation) {
    // Already released, or superseded by a different descriptor
    return false;
  }
  variants.delete(cacheKey);
  if (!variants.size) {
    store.operations.delete(operation.document);
  }
  store.atime.delete(operation.id);
  return true;
}

export function releaseNonCacheableOperations(
  env: CacheEnv,
  store: Store,
  operations: Iterable<OperationDescriptor> | null | undefined,
): number {
  if (!env.cleanupNonCacheableOperations || !operations) {
    return 0;
  }
  let released = 0;
  for (const operation of operations) {
    if (
      canReleaseOperationDescriptor(store, operation) &&
      releaseOperationDescriptor(store, operation)
    ) {
      released++;
    }
  }
  return released;
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
    operationsByCoveredName: new Map(),
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

  // Optimistic layers do store results of non-cacheable operations (e.g. optimistic mutation
  // responses), which kept their descriptors alive. Now that the layers are gone, retry.
  if (env.cleanupNonCacheableOperations) {
    const candidates: OperationDescriptor[] = [];
    for (const layer of deletedLayers) {
      for (const tree of layer.trees.values()) {
        if (!tree.operation.cache) {
          candidates.push(tree.operation);
        }
      }
    }
    releaseNonCacheableOperations(env, store, candidates);
  }
  return affectedOperationSet;
}

export function getActiveForest(
  store: Store,
  transaction: Transaction | undefined,
): DataForest | OptimisticLayer {
  return transaction?.optimisticLayer ?? store.dataForest;
}

/**
 * Layers to read from, in priority order: optimistic layers, in-flight layers, the data forest.
 *
 * `activeForest` may be an in-flight layer (when writing to it). `inFlightLayers` are in-flight layers
 * an operation reads through (see getInFlightLayers).
 */
export function getEffectiveReadLayers(
  store: Store,
  activeForest: DataForest | OptimisticLayer,
  optimistic: boolean,
  inFlightLayers: readonly DataForest[] = EMPTY_ARRAY,
): (DataForest | OptimisticLayer)[] {
  const { optimisticLayers, dataForest } = store;
  const appliedOptimisticLayers = optimistic
    ? optimisticLayers.length - 1 // All layers
    : optimisticLayers.indexOf(activeForest as OptimisticLayer); // Up to current one

  const layers: (DataForest | OptimisticLayer)[] = [];
  for (let i = appliedOptimisticLayers; i >= 0; i--) {
    layers.push(optimisticLayers[i]);
  }
  if (isInFlightForest(store, activeForest)) {
    layers.push(activeForest);
  }
  for (const layer of inFlightLayers) {
    if (layer !== activeForest) {
      layers.push(layer);
    }
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
  for (const coveredName of operation.covers) {
    dataForest.operationsByCoveredName.get(coveredName)?.delete(operation.id);
  }
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
  dataForest.operationsByCoveredName.clear();
  dataForest.operationsWithDanglingRefs.clear();
  dataForest.readResults.clear();
  operations.clear();
  optimisticReadResults.clear();
  optimisticLayers.length = 0;
  store.inFlightExecutions.clear();
}

const getRootNode = (result: IndexedTree): NodeChunk | undefined =>
  result.nodes.get(result.rootNodeKey)?.[0];

// In-flight layers

export function isInFlightForest(
  store: Store,
  forest: DataForest | OptimisticLayer,
): forest is DataForest {
  return forest.layerTag === null && forest !== store.dataForest;
}

/**
 * Only the executed operation and operations it covers (by name, with any variables) read through in-flight layers.
 */
export function getInFlightLayers(
  store: Store,
  operation: OperationDescriptor,
): readonly DataForest[] {
  if (!store.inFlightExecutions.size) {
    return EMPTY_ARRAY;
  }
  let layers: DataForest[] | undefined;
  for (const execution of store.inFlightExecutions.values()) {
    if (readsThroughInFlightLayer(execution, operation)) {
      layers ??= [];
      layers.push(execution.forest);
    }
  }
  return layers ?? EMPTY_ARRAY;
}

export function getInFlightForests(store: Store): DataForest[] {
  const forests: DataForest[] = [];
  for (const { forest } of store.inFlightExecutions.values()) {
    forests.push(forest);
  }
  return forests;
}

function readsThroughInFlightLayer(
  execution: InFlightExecution,
  operation: OperationDescriptor,
): boolean {
  return (
    execution.operation === operation ||
    (operation.name !== undefined &&
      execution.operation.covers.includes(operation.name))
  );
}

/**
 * Creates an in-flight layer with the current trees (and read results) of the operation and of operations it covers
 * in the data forest. Trees are shared: updates of the layer replace them (copy-on-write).
 */
export function addInFlightExecution(
  env: CacheEnv,
  store: Store,
  operation: OperationDescriptor,
  key: ExecutionKey | undefined,
  data: ResultData,
): InFlightExecution {
  assert(!store.inFlightExecutions.has(operation));
  const { dataForest } = store;
  const forest = createDataForest();
  const execution: InFlightExecution = { operation, key, forest, data };

  const seed = (id: OperationId) => {
    const tree = dataForest.trees.get(id);
    if (!tree || forest.trees.has(id)) {
      return;
    }
    addTree(env, forest, tree);
    const readResult = dataForest.readResults.get(tree.operation);
    if (readResult) {
      // Same data until the layer changes: keeps results (and their identity) of watches
      forest.readResults.set(tree.operation, {
        outputTree: readResult.outputTree,
        dirtyNodes: copyDirtyNodes(readResult.dirtyNodes),
      });
    }
  };
  seed(operation.id);
  for (const coveredName of operation.covers) {
    for (const id of dataForest.operationsByName.get(coveredName) ??
      EMPTY_ARRAY) {
      seed(id);
    }
  }
  store.inFlightExecutions.set(operation, execution);
  deleteOptimisticReadResults(store, execution);
  return execution;
}

/**
 * Drops the in-flight layer, returns operations which read through it (now reading from the data forest)
 */
export function removeInFlightExecution(
  store: Store,
  execution: InFlightExecution,
): Set<OperationDescriptor> {
  assert(store.inFlightExecutions.get(execution.operation) === execution);
  store.inFlightExecutions.delete(execution.operation);
  deleteOptimisticReadResults(store, execution);

  const { forest } = execution;
  const readers = new Set<OperationDescriptor>([execution.operation]);
  for (const tree of forest.trees.values()) {
    readers.add(tree.operation);
  }
  for (const operation of forest.readResults.keys()) {
    readers.add(operation);
  }
  return readers;
}

/**
 * When a covered operation gets its own result (in the data forest), it replaces its tree in in-flight layers too
 */
export function updateCoveredInFlightTrees(
  env: CacheEnv,
  store: Store,
  tree: DataTree,
) {
  const { operation } = tree;
  if (!store.inFlightExecutions.size || operation.name === undefined) {
    return;
  }
  for (const execution of store.inFlightExecutions.values()) {
    if (
      execution.operation === operation ||
      !execution.operation.covers.includes(operation.name)
    ) {
      continue;
    }
    replaceTree(env, execution.forest, tree);
    execution.forest.readResults.delete(operation);
    store.optimisticReadResults.delete(operation);
  }
}

// Read results of readers of an in-flight layer, which are not stored in the layer itself
function deleteOptimisticReadResults(
  store: Store,
  execution: InFlightExecution,
) {
  for (const operation of store.optimisticReadResults.keys()) {
    if (readsThroughInFlightLayer(execution, operation)) {
      store.optimisticReadResults.delete(operation);
    }
  }
  for (const layer of store.optimisticLayers) {
    for (const operation of layer.readResults.keys()) {
      if (readsThroughInFlightLayer(execution, operation)) {
        layer.readResults.delete(operation);
      }
    }
  }
}

function copyDirtyNodes(dirtyNodes: DirtyNodeMap): DirtyNodeMap {
  const copy: DirtyNodeMap = new Map();
  for (const [nodeKey, fields] of dirtyNodes) {
    copy.set(nodeKey, new Set(fields));
  }
  return copy;
}
