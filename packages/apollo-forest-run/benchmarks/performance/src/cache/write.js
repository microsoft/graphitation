"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.write = write;
exports.isWrite = isWrite;
const assert_1 = require("../jsutils/assert");
const descriptor_1 = require("./descriptor");
const policies_1 = require("./policies");
const store_1 = require("./store");
const diffTree_1 = require("../diff/diffTree");
const updateForest_1 = require("../forest/updateForest");
const indexTree_1 = require("../forest/indexTree");
const values_1 = require("../values");
const draftHelpers_1 = require("./draftHelpers");
const addTree_1 = require("../forest/addTree");
const invalidate_1 = require("./invalidate");
function write(env, store, activeTransaction, options) {
    const { mergePolicies, objectKey, addTypename, keyMap } = env;
    const targetForest = (0, store_1.getActiveForest)(store, activeTransaction);
    const writeData = typeof options.result === "object" && options.result !== null
        ? options.result
        : {};
    const rootNodeKey = options.dataId ?? objectKey(writeData);
    (0, assert_1.assert)(rootNodeKey !== false);
    // ApolloCompat (apollo allows writing fragments without proper id in the data)
    if (rootNodeKey !== undefined && options.dataId) {
        keyMap?.set(writeData, rootNodeKey);
    }
    const operationDescriptor = (0, descriptor_1.resolveOperationDescriptor)(env, store, options.query, options.variables, rootNodeKey);
    (0, store_1.touchOperation)(env, store, operationDescriptor);
    const operationResult = { data: writeData };
    if (!descriptor_1.ROOT_TYPES.includes(operationDescriptor.rootType) &&
        rootNodeKey === undefined) {
        throw new Error(`Could not identify object ${inspect(writeData)}`);
    }
    let existingResult = getExistingResult(env, store, targetForest, operationDescriptor);
    const existingData = existingResult?.result.data;
    // Safeguard: make sure previous state doesn't leak outside write operation
    (0, assert_1.assert)(!existingResult?.prev);
    if (writeData === existingData && existingResult) {
        return {
            options,
            incoming: existingResult,
            affected: [],
            difference: undefined,
            affectedNodes: new Set(),
            updateStats: [],
        };
    }
    if (!descriptor_1.ROOT_NODES.includes(operationDescriptor.rootNodeKey)) {
        const typeName = resolveExtraRootNodeType(env, store, operationDescriptor, writeData);
        if (addTypename && typeName && !writeData["__typename"]) {
            writeData["__typename"] = typeName;
        }
        targetForest.extraRootIds.set(operationDescriptor.rootNodeKey, typeName ?? "");
        operationDescriptor.rootType = typeName ?? "";
    }
    const incomingResult = (0, indexTree_1.indexTree)(env, operationDescriptor, operationResult, undefined, existingResult);
    // ApolloCompat: necessary for fragment writes with custom ids
    if (options.dataId && incomingResult.rootNodeKey !== options.dataId) {
        const rootNode = incomingResult.nodes.get(incomingResult.rootNodeKey);
        (0, assert_1.assert)(rootNode);
        incomingResult.nodes.set(options.dataId, rootNode);
        incomingResult.nodes.delete(incomingResult.rootNodeKey);
        incomingResult.rootNodeKey = options.dataId;
    }
    const modifiedIncomingResult = (0, policies_1.applyMergePolicies)(env, (0, store_1.getEffectiveReadLayers)(store, targetForest, false), mergePolicies, incomingResult, options.overwrite ?? false);
    const difference = (0, diffTree_1.diffTree)(targetForest, modifiedIncomingResult, env);
    if (difference.errors.length) {
        processDiffErrors(targetForest, modifiedIncomingResult, difference);
    }
    if (existingResult &&
        existingResult.grown &&
        existingResult.incompleteChunks.size > 0) {
        // Remove incomplete placeholder tree (saves unnecessary update)
        targetForest.trees.delete(operationDescriptor.id);
        existingResult = undefined;
    }
    // This function returns exhaustive list of affected operations. It may contain false-positives,
    // because operationsWithNodes also reflects nodes from optimistic updates and read policy results
    // (which may not exist in the main forest trees)
    const affectedOperations = (0, updateForest_1.resolveAffectedOperations)(targetForest, difference);
    const chunkProvider = (key) => (0, draftHelpers_1.getNodeChunks)((0, store_1.getEffectiveReadLayers)(store, targetForest, false), key);
    const allUpdates = (0, updateForest_1.updateAffectedTrees)(env, targetForest, affectedOperations, chunkProvider);
    if (!existingResult && shouldCache(targetForest, operationDescriptor)) {
        affectedOperations.set(operationDescriptor, difference.nodeDifference);
        // Note: even with existingResult === undefined the tree for this operation may still exist in the cache
        //   (when existingResult is resolved with a different key descriptor due to key variables)
        // TODO: replace with addTree and add a proper check for keyVariables
        (0, addTree_1.replaceTree)(targetForest, modifiedIncomingResult);
    }
    appendAffectedOperationsFromOtherLayers(env, store, affectedOperations, targetForest, modifiedIncomingResult);
    (0, invalidate_1.invalidateReadResults)(env, store, targetForest, difference, affectedOperations, modifiedIncomingResult);
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
function appendAffectedOperationsFromOtherLayers(env, store, affectedForestOperationsMutable, targetForest, incomingResult) {
    // Optimistic reads go through all existing layers
    //  And those layers may be affected by incoming results too, so we actually need to diff all other layers too
    //  TODO: just write to all effective layers?
    for (const layer of (0, store_1.getEffectiveReadLayers)(store, targetForest, true)) {
        if (layer === targetForest) {
            continue;
        }
        (0, updateForest_1.resolveAffectedOperations)(layer, (0, diffTree_1.diffTree)(layer, incomingResult, env), affectedForestOperationsMutable);
    }
}
function processDiffErrors(forest, model, difference) {
    const pathEnv = {
        findParent: (chunk) => {
            const tree = forest.trees.get(chunk.operation.id);
            const parentInfo = tree?.dataMap.get(chunk.data);
            (0, assert_1.assert)(parentInfo);
            return parentInfo;
        },
    };
    for (const diffError of difference.errors) {
        if (diffError.kind === "MissingFields") {
            for (const baseChunkError of diffError.base ?? EMPTY_ARRAY) {
                // Missing chunks
                const chunk = baseChunkError.chunk;
                chunk.missingFields ?? (chunk.missingFields = new Set());
                for (const field of baseChunkError.missingFields) {
                    chunk.missingFields.add(field);
                }
                const tree = forest.trees.get(chunk.operation.id);
                if (tree) {
                    tree.incompleteChunks.add(chunk);
                }
                const parentInfo = pathEnv.findParent(chunk);
                (0, values_1.markAsPartial)(pathEnv, parentInfo);
            }
            pathEnv.findParent = (0, values_1.createParentLocator)(model.dataMap);
            for (const modelChunkError of diffError.model ?? EMPTY_ARRAY) {
                // Missing chunks
                const chunk = modelChunkError.chunk;
                chunk.missingFields ?? (chunk.missingFields = new Set());
                for (const field of modelChunkError.missingFields) {
                    chunk.missingFields.add(field);
                }
                const parentInfo = pathEnv.findParent(chunk);
                (0, values_1.markAsPartial)(pathEnv, parentInfo);
                model.incompleteChunks.add(chunk);
            }
        }
    }
}
function getExistingResult(env, store, targetForest, operation) {
    const op = (0, descriptor_1.resolveResultDescriptor)(env, store, operation);
    return targetForest.trees.get(op.id);
}
function shouldCache(targetForest, operation) {
    // Always cache results for optimistic layers (even if operation is not cacheable, e.g. it is a mutation)
    if (targetForest.layerTag !== null) {
        return true;
    }
    return operation.cache;
}
function aggregateAllAffectedNodes(difference, updates) {
    const accumulator = new Set([
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
function resolveExtraRootNodeType(env, store, operationDescriptor, data) {
    if (data["__typename"]) {
        return data["__typename"];
    }
    // Try fragment condition (fragments on abstract types are ignored)
    if ((0, descriptor_1.isFragmentDocument)(operationDescriptor.document)) {
        const [fragmentDef] = operationDescriptor.fragmentMap.values();
        const typeName = fragmentDef?.typeCondition.name.value;
        if (!env.possibleTypes?.[typeName]) {
            return typeName;
        }
    }
    // Finally, try from store
    const [chunk] = (0, draftHelpers_1.getNodeChunks)([store.dataForest, ...store.optimisticLayers], operationDescriptor.rootNodeKey);
    if (chunk?.type) {
        return chunk.type;
    }
    return undefined;
}
const inspect = JSON.stringify.bind(JSON);
const EMPTY_ARRAY = Object.freeze([]);
function isWrite(op) {
    return "incoming" in op; // write has "incoming" tree
}
