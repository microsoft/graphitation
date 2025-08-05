"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invalidateReadResults = invalidateReadResults;
const predicates_1 = require("../values/predicates");
const assert_1 = require("../jsutils/assert");
const resolvedSelection_1 = require("../descriptor/resolvedSelection");
const resolve_1 = require("../values/resolve");
function invalidateReadResults(env, store, targetForest, difference, affectedOperations, incomingResult) {
    const { dataForest, optimisticLayers, optimisticReadResults, partialReadResults, } = store;
    const layers = [dataForest, ...optimisticLayers];
    for (const layer of layers) {
        for (const [operation, nodeDiffs] of affectedOperations.entries()) {
            const results = layer.readResults.get(operation);
            const optimisticResults = optimisticReadResults.get(operation);
            if (results) {
                markChangedNodesAsDirty(results, nodeDiffs, incomingResult);
            }
            if (optimisticResults) {
                markChangedNodesAsDirty(optimisticResults, nodeDiffs, incomingResult);
            }
        }
        // ApolloCompat: field policies may return dangling references to nodes that do not exist.
        //   When this happens, operations with dangling references must be invalidated when nodes are actually added
        //   (this only affects readResults, right???)
        for (const nodeKey of difference.newNodes) {
            layer.deletedNodes.delete(nodeKey);
            const operationsWithDanglingRefs = layer.operationsWithDanglingRefs.get(nodeKey);
            for (const operation of operationsWithDanglingRefs !== null && operationsWithDanglingRefs !== void 0 ? operationsWithDanglingRefs : EMPTY_ARRAY) {
                const results = layer.readResults.get(operation);
                const optimisticResults = optimisticReadResults.get(operation);
                if (results) {
                    results.dirtyNodes.set(nodeKey, new Set());
                }
                if (optimisticResults) {
                    optimisticResults.dirtyNodes.set(nodeKey, new Set());
                }
            }
        }
        // ApolloCompat
        // Some read results may contain partial nodes produces by "read" policies.
        // Incoming operations can bring missing data for those nodes which might not be reflected in a difference
        //   (because difference is calculated for the "server" or "written" state of the operation,
        //   it doesn't apply to "read" state).
        // Thus, we must additionally mark as dirty any read operations with missing nodes (if they have overlapping fields)
        if (incomingResult) {
            for (const operation of partialReadResults) {
                const results = layer.readResults.get(operation);
                const optimisticResults = optimisticReadResults.get(operation);
                if (results) {
                    markIncompleteNodesAsDirty(results, incomingResult);
                }
                if (optimisticResults) {
                    markIncompleteNodesAsDirty(optimisticResults, incomingResult);
                }
            }
        }
    }
}
function markIncompleteNodesAsDirty(readResult, incomingResult) {
    var _a;
    const { outputTree, dirtyNodes } = readResult;
    for (const incompleteChunk of outputTree.incompleteChunks) {
        if (!(0, predicates_1.isNodeValue)(incompleteChunk)) {
            continue;
        }
        const chunks = incomingResult.nodes.get(incompleteChunk.key);
        if (!(chunks === null || chunks === void 0 ? void 0 : chunks.length)) {
            continue;
        }
        let dirtyFields = dirtyNodes.get(incompleteChunk.key);
        for (const missingField of (_a = incompleteChunk.missingFields) !== null && _a !== void 0 ? _a : EMPTY_ARRAY) {
            const normalizedField = (0, resolvedSelection_1.resolveNormalizedField)(incompleteChunk.selection, missingField);
            if (chunks.some((chunk) => (0, resolve_1.hasFieldEntry)(chunk, normalizedField))) {
                dirtyFields !== null && dirtyFields !== void 0 ? dirtyFields : (dirtyFields = new Set());
                dirtyFields.add(missingField.name);
            }
        }
        if (dirtyFields === null || dirtyFields === void 0 ? void 0 : dirtyFields.size) {
            dirtyNodes.set(incompleteChunk.key, dirtyFields);
        }
    }
}
function markChangedNodesAsDirty(readResult, nodeDifference, incomingResult) {
    var _a, _b;
    const { outputTree, dirtyNodes } = readResult;
    const nodeMap = outputTree.nodes;
    for (const [nodeKey, diff] of nodeDifference.entries()) {
        let currentDirtyFields = dirtyNodes.get(nodeKey);
        if ((currentDirtyFields === null || currentDirtyFields === void 0 ? void 0 : currentDirtyFields.size) === 0) {
            continue; // Must run full diff of all fields
        }
        if (!currentDirtyFields) {
            currentDirtyFields = new Set();
        }
        const nodes = nodeMap.get(nodeKey);
        for (const node of nodes !== null && nodes !== void 0 ? nodes : EMPTY_ARRAY) {
            // TODO: more granular invalidation of fields with read policies
            if (node.hasNestedReadPolicies) {
                currentDirtyFields.clear(); // run full diff of all fields
                dirtyNodes.set(nodeKey, currentDirtyFields);
                continue;
            }
            for (const dirtyField of (_a = diff === null || diff === void 0 ? void 0 : diff.dirtyFields) !== null && _a !== void 0 ? _a : EMPTY_ARRAY) {
                if (node.selection.fields.has(dirtyField)) {
                    currentDirtyFields.add(dirtyField);
                }
            }
        }
        if (currentDirtyFields.size > 0) {
            dirtyNodes.set(nodeKey, currentDirtyFields);
        }
    }
    // readResults may contain nodes that do not exist in the main operation (via Apollo cache redirects or optimistic updates).
    //   We keep track of those additional "read" dependencies via forest.operationsByNodes, so they will be properly invalidated
    //   when those nodes change. However, when readResults contain missing fields and incoming operation simply brings
    //   new data for those nodes (but not changes per se) - those nodes won't be invalidated without the code below.
    const incompleteChunks = outputTree.incompleteChunks;
    for (const chunk of incompleteChunks) {
        if (!(0, predicates_1.isObjectValue)(chunk) || typeof chunk.key !== "string") {
            continue;
        }
        if (incomingResult && !incomingResult.nodes.has(chunk.key)) {
            continue;
        }
        (0, assert_1.assert)((_b = chunk.missingFields) === null || _b === void 0 ? void 0 : _b.size);
        let currentDirtyFields = dirtyNodes.get(chunk.key);
        if (!currentDirtyFields) {
            currentDirtyFields = new Set();
            dirtyNodes.set(chunk.key, currentDirtyFields);
        }
        for (const field of chunk.missingFields) {
            currentDirtyFields.add(field.name);
        }
    }
}
const EMPTY_ARRAY = Object.freeze([]);
