"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStore = createStore;
exports.touchOperation = touchOperation;
exports.maybeEvictOldData = maybeEvictOldData;
exports.evictOldData = evictOldData;
exports.createOptimisticLayer = createOptimisticLayer;
exports.removeOptimisticLayers = removeOptimisticLayers;
exports.getActiveForest = getActiveForest;
exports.getEffectiveReadLayers = getEffectiveReadLayers;
exports.getEffectiveWriteLayers = getEffectiveWriteLayers;
exports.resetStore = resetStore;
const assert_1 = require("../jsutils/assert");
const descriptor_1 = require("./descriptor");
const EMPTY_ARRAY = Object.freeze([]);
function createStore(_) {
    const dataForest = {
        trees: new Map(),
        operationsByNodes: new Map(),
        operationsWithErrors: new Set(),
        extraRootIds: new Map(),
        layerTag: null, // not an optimistic layer
        readResults: new Map(),
        mutations: new Set(),
        operationsWithDanglingRefs: new Map(),
        deletedNodes: new Set(),
    };
    const optimisticReadResults = new Map();
    const partialReadResults = new Set();
    const optimisticLayers = [];
    const store = {
        operations: new Map(),
        dataForest,
        optimisticLayers,
        optimisticReadResults,
        partialReadResults,
        watches: new Map(),
        fragmentWatches: new Map(),
        atime: new Map(),
    };
    return store;
}
function touchOperation(env, store, operation) {
    store.atime.set(operation.id, env.now());
}
function maybeEvictOldData(env, store) {
    if (!env.autoEvict ||
        !env.maxOperationCount ||
        store.dataForest.trees.size <= env.maxOperationCount * 2) {
        return [];
    }
    return evictOldData(env, store);
}
function evictOldData(env, store) {
    (0, assert_1.assert)(env.maxOperationCount);
    const { dataForest, atime } = store;
    const partitionsOps = new Map();
    const partitionKey = env.partitionConfig?.partitionKey;
    const configuredPartitionKeys = new Set(Object.keys(env.partitionConfig?.partitions ?? {}));
    const DEFAULT_PARTITION = "__default__";
    for (const tree of dataForest.trees.values()) {
        if (!canEvict(env, store, tree)) {
            continue; // Skip non-evictable operations entirely
        }
        let partition = partitionKey?.(tree);
        if (partition == null) {
            partition = DEFAULT_PARTITION; // Default partition if not specified or not configured
        }
        else if (!configuredPartitionKeys.has(partition)) {
            env.logger?.warnOnce("partition_not_configured", `Partition "${partition}" is not configured in partitionConfig. Using default partition instead.`);
            partition = DEFAULT_PARTITION; // Default partition if not specified or not configured
        }
        let partitionOps = partitionsOps.get(partition);
        if (!partitionOps) {
            partitionOps = [];
            partitionsOps.set(partition, partitionOps);
        }
        partitionOps.push(tree.operation.id);
    }
    const toEvict = [];
    // Process each partition
    for (const [partition, evictableOperationIds] of partitionsOps) {
        const maxCount = env.partitionConfig?.partitions[partition]?.maxOperationCount ??
            env.maxOperationCount;
        if (evictableOperationIds.length <= maxCount) {
            continue; // No eviction needed for this partition
        }
        // Sort by access time (LRU) and determine how many to evict
        evictableOperationIds.sort((a, b) => (atime.get(a) ?? 0) - (atime.get(b) ?? 0));
        const evictCount = Math.max(0, evictableOperationIds.length - maxCount);
        // Keep only the ones to evict without array copying w/ slice
        evictableOperationIds.length = evictCount;
        toEvict.push(...evictableOperationIds);
    }
    // Remove evicted operations
    for (const opId of toEvict) {
        const tree = store.dataForest.trees.get(opId);
        (0, assert_1.assert)(tree);
        removeDataTree(store, tree);
    }
    return toEvict;
}
function canEvict(env, store, resultTree) {
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
function createOptimisticLayer(layerTag, replay) {
    return {
        layerTag,
        trees: new Map(),
        operationsByNodes: new Map(),
        operationsWithErrors: new Set(),
        extraRootIds: new Map(),
        readResults: new Map(),
        mutations: new Set(),
        operationsWithDanglingRefs: new Map(),
        deletedNodes: new Set(),
        replay,
    };
}
function removeOptimisticLayers(cache, env, store, layerTag) {
    const { optimisticLayers } = store;
    const deletedLayers = optimisticLayers.filter((f) => f.layerTag === layerTag);
    if (!deletedLayers.length) {
        // ApolloCompat: this is a no-op in Apollo
        return;
    }
    const [affectedNodes, affectedOps] = resolveLayerImpact(store, layerTag);
    env.logger?.debug(`Removing optimistic layer ${layerTag}. Affected nodes: ${affectedNodes.length}; ` +
        `affected operations: ${affectedOps.length}`);
    const affectedOperationSet = new Set();
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
            }
            else {
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
function getActiveForest(store, transaction) {
    return transaction?.optimisticLayer ?? store.dataForest;
}
function getEffectiveReadLayers({ optimisticLayers, dataForest }, activeForest, optimistic) {
    const appliedOptimisticLayers = optimistic
        ? optimisticLayers.length - 1 // All layers
        : optimisticLayers.indexOf(activeForest); // Up to current one
    const layers = [];
    for (let i = appliedOptimisticLayers; i >= 0; i--) {
        layers.push(optimisticLayers[i]);
    }
    layers.push(dataForest);
    return layers;
}
function getEffectiveWriteLayers({ dataForest, optimisticLayers }, activeForest, optimistic) {
    if (!optimistic) {
        // FIXME: plus all layers beneath this one?
        return [activeForest];
    }
    if (activeForest === dataForest) {
        return [dataForest, ...optimisticLayers];
    }
    const forestIndex = optimisticLayers.indexOf(activeForest);
    return forestIndex === 0
        ? optimisticLayers
        : optimisticLayers.slice(forestIndex);
}
function resolveLayerImpact({ dataForest, optimisticLayers }, layerTag) {
    const layers = optimisticLayers.filter((l) => l.layerTag === layerTag);
    const affectedNodes = [];
    for (const layer of layers) {
        affectedNodes.push(...layer.operationsByNodes.keys());
    }
    const affectedOperations = [];
    for (const nodeKey of affectedNodes) {
        affectedOperations.push(...(dataForest.operationsByNodes.get(nodeKey) ?? EMPTY_ARRAY));
    }
    for (const layer of optimisticLayers) {
        if (layers.includes(layer)) {
            continue;
        }
        for (const nodeKey of affectedNodes) {
            affectedOperations.push(...(layer.operationsByNodes.get(nodeKey) ?? EMPTY_ARRAY));
        }
    }
    return [affectedNodes, affectedOperations];
}
function removeDataTree({ dataForest, optimisticReadResults, partialReadResults, operations, watches, atime, }, { operation }) {
    (0, assert_1.assert)(!watches.has(operation));
    dataForest.trees.delete(operation.id);
    dataForest.readResults.delete(operation);
    dataForest.operationsWithErrors.delete(operation);
    optimisticReadResults.delete(operation);
    partialReadResults.delete(operation);
    operations.get(operation.document)?.delete((0, descriptor_1.operationCacheKey)(operation));
    atime.delete(operation.id);
    // Notes:
    // - Not deleting from optimistic layers because they are meant to be short-lived anyway
    // - Not removing operation from operationsByNodes because it is expensive to do during LRU eviction.
    //   TODO: separate step to cleanup stale values from operationsByNodes
}
function resetStore(store) {
    const { dataForest, optimisticReadResults, optimisticLayers, operations } = store;
    dataForest.trees.clear();
    dataForest.extraRootIds.clear();
    dataForest.operationsByNodes.clear();
    dataForest.operationsWithErrors.clear();
    dataForest.operationsWithDanglingRefs.clear();
    dataForest.readResults.clear();
    operations.clear();
    optimisticReadResults.clear();
    optimisticLayers.length = 0;
}
const getRootNode = (result) => result.nodes.get(result.rootNodeKey)?.[0];
