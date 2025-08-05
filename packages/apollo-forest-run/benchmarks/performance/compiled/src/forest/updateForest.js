"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROOT_NODES = void 0;
exports.updateAffectedTrees = updateAffectedTrees;
exports.resolveAffectedOperations = resolveAffectedOperations;
const updateTree_1 = require("./updateTree");
const difference_1 = require("../diff/difference");
const resolvedSelection_1 = require("../descriptor/resolvedSelection");
const assert_1 = require("../jsutils/assert");
const addTree_1 = require("./addTree");
exports.ROOT_NODES = Object.freeze([
    "ROOT_QUERY",
    "ROOT_MUTATION",
    "ROOT_SUBSCRIPTION",
]);
const EMPTY_ARRAY = Object.freeze([]);
function updateAffectedTrees(env, forest, affectedOperations, getNodeChunks) {
    // Note: affectedOperations may contain false-positives (updateTree will ignore those)
    const allUpdated = [];
    for (const [operation, difference] of affectedOperations.entries()) {
        const currentTreeState = forest.trees.get(operation.id);
        (0, assert_1.assert)(currentTreeState);
        const result = (0, updateTree_1.updateTree)(env, currentTreeState, difference, getNodeChunks);
        if (result.updatedTree === currentTreeState) {
            // nodeDifference may not be overlapping with selections of this tree.
            //   E.g. difference could be for operation { id: "1", firstName: "Changed" }
            //   but current operation is { id: "1", lastName: "Unchanged" }
            continue;
        }
        allUpdated.push(result);
        // Reset previous tree state on commit
        result.updatedTree.prev = null;
        (0, addTree_1.replaceTree)(forest, result.updatedTree);
    }
    return allUpdated;
}
function resolveAffectedOperations(forest, difference, accumulatorMutable = new Map()) {
    for (const [nodeKey, diff] of difference.nodeDifference.entries()) {
        if ((0, difference_1.isDirty)(diff)) {
            accumulateOperationDiffs(forest, nodeKey, diff, accumulatorMutable);
        }
    }
    return accumulatorMutable;
}
function accumulateOperationDiffs(forest, nodeKey, difference, accumulatorMutable) {
    var _a, _b;
    const operationIds = (_a = forest.operationsByNodes.get(nodeKey)) !== null && _a !== void 0 ? _a : EMPTY_ARRAY;
    const isRootNode = exports.ROOT_NODES.includes(nodeKey);
    for (const operationId of operationIds) {
        const operationDescriptor = (_b = forest.trees.get(operationId)) === null || _b === void 0 ? void 0 : _b.operation;
        if (!operationDescriptor) {
            // operationsByNodes may contain operations with evicted data, which is expected
            continue;
        }
        if (isRootNode && !rootFieldsOverlap(operationDescriptor, difference)) {
            continue;
        }
        let map = accumulatorMutable.get(operationDescriptor);
        if (!map) {
            map = new Map();
            accumulatorMutable.set(operationDescriptor, map);
        }
        map.set(nodeKey, difference);
    }
}
function rootFieldsOverlap(operationDescriptor, difference) {
    const rootSelection = (0, resolvedSelection_1.resolveSelection)(operationDescriptor, operationDescriptor.possibleSelections, operationDescriptor.rootType);
    const dirtyFields = difference.dirtyFields;
    (0, assert_1.assert)(rootSelection && dirtyFields);
    for (const field of dirtyFields) {
        const fieldInfos = rootSelection.fields.get(field);
        if (!fieldInfos) {
            continue;
        }
        const dirtyEntries = difference.fieldState.get(field);
        (0, assert_1.assert)(dirtyEntries);
        // Also check that args are matching
        for (const fieldInfo of fieldInfos) {
            const fieldEntry = (0, resolvedSelection_1.resolveNormalizedField)(rootSelection, fieldInfo);
            const match = Array.isArray(dirtyEntries)
                ? dirtyEntries.some((dirtyEntry) => (0, resolvedSelection_1.fieldEntriesAreEqual)(dirtyEntry.fieldEntry, fieldEntry))
                : (0, resolvedSelection_1.fieldEntriesAreEqual)(dirtyEntries.fieldEntry, fieldEntry);
            if (match) {
                return true;
            }
        }
    }
    return false;
}
