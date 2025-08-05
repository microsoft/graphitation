"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.diffTree = diffTree;
exports.diffNodes = diffNodes;
const types_1 = require("./types");
const difference_1 = require("./difference");
const create_1 = require("../values/create");
const diffObject_1 = require("./diffObject");
const assert_1 = require("../jsutils/assert");
const EMPTY_SET = new Set();
EMPTY_SET.add = () => {
    throw new Error("Immutable Empty Set");
};
// Re-using state object for multiple nodes
const nodeDiffState = {
    difference: undefined,
    errors: [],
};
function diffTree(forest, model, env) {
    const context = { env, forest: forest };
    const currentTreeState = forest.trees.get(model.operation.id);
    return diffNodesImpl(context, forest, model.nodes, env, currentTreeState);
}
function diffNodes(forest, nodes, env) {
    const context = { env, forest: forest };
    return diffNodesImpl(context, forest, nodes, env, undefined);
}
function diffNodesImpl(context, forest, nodes, env, currentTreeState) {
    var _a;
    const newNodes = [];
    const nodeDifference = new Map();
    for (const nodeChunks of nodes.values()) {
        (0, assert_1.assert)(nodeChunks.length);
        nodeDiffState.difference = undefined;
        nodeDiffState.errors.length = 0;
        const modelNode = nodeChunks.length === 1
            ? nodeChunks[0]
            : (0, create_1.createObjectAggregate)(nodeChunks);
        (0, assert_1.assert)(modelNode.key);
        if (currentTreeState === null || currentTreeState === void 0 ? void 0 : currentTreeState.nodes.has(modelNode.key)) {
            const difference = diffTreeNode(context, currentTreeState, modelNode, nodeDifference, nodeDiffState);
            // TODO: additionally diff nodes that exist in the incoming state, but are missing in the current state
            //    And keep a list of "removed" / "added" nodes
            if (!difference) {
                continue;
            }
        }
        const operationsWithNode = resolveOperationsWithNode(forest, modelNode);
        for (const operation of operationsWithNode) {
            const treeWithNode = forest.trees.get(operation);
            if (!(treeWithNode === null || treeWithNode === void 0 ? void 0 : treeWithNode.nodes.has(modelNode.key))) {
                // False-positives in operationsWithNode are possible
                // (due to garbage-collection of unused trees/replacement of node in the tree, etc.)
                continue;
            }
            if (treeWithNode === currentTreeState) {
                // Already ran a diff for it above
                continue;
            }
            const difference = diffTreeNode(context, treeWithNode, modelNode, nodeDifference, nodeDiffState);
            if (!difference) {
                break;
            }
        }
        if (!operationsWithNode.size) {
            (0, assert_1.assert)(typeof modelNode.key === "string");
            newNodes.push(modelNode.key);
        }
        if (nodeDiffState.difference && (0, difference_1.isDirty)(nodeDiffState.difference)) {
            (0, assert_1.assert)(modelNode.key);
            nodeDifference.set(modelNode.key, nodeDiffState.difference);
        }
        if ((_a = nodeDiffState.errors) === null || _a === void 0 ? void 0 : _a.length) {
            accumulateDiffErrors(context, modelNode, nodeDiffState.errors);
        }
    }
    return { nodeDifference, errors: getErrors(context), newNodes };
}
function resolveOperationsWithNode(forest, node) {
    var _a;
    if (!node.key) {
        return EMPTY_SET;
    }
    // TODO: additionally filter trees for common nodes (like ROOT_QUERY or ROOT_SUBSCRIPTION)
    //   Using indexes on types
    return ((_a = forest.operationsByNodes.get(node.key)) !== null && _a !== void 0 ? _a : EMPTY_SET);
}
function diffTreeNode(context, baseTree, modelNode, nodeDifferenceMap, nodeDiffState) {
    var _a;
    if (nodeDiffState.difference && (0, difference_1.isComplete)(nodeDiffState.difference)) {
        return nodeDiffState.difference;
    }
    const baseChunks = baseTree.nodes.get(modelNode.key);
    (0, assert_1.assert)(baseChunks === null || baseChunks === void 0 ? void 0 : baseChunks.length);
    const baseNode = baseChunks.length === 1 ? baseChunks[0] : (0, create_1.createObjectAggregate)(baseChunks);
    try {
        const { difference } = (0, diffObject_1.diffObject)(baseNode, modelNode, context.env, nodeDiffState);
        return difference && ((0, difference_1.isDirty)(difference) || !(0, difference_1.isComplete)(difference))
            ? difference
            : undefined;
    }
    catch (e) {
        (0, assert_1.assert)(modelNode.key !== false);
        (_a = context.firstError) !== null && _a !== void 0 ? _a : (context.firstError = {
            kind: "FirstDiffNodeException",
            nodeKey: modelNode.key,
            base: baseNode,
            model: modelNode,
            error: e,
        });
        return undefined;
    }
}
function accumulateDiffErrors(context, modelNode, errors) {
    var _a, _b;
    for (const error of errors) {
        if (error.kind === types_1.DiffErrorKind.MissingModelFields) {
            (_a = context.missingModelFields) !== null && _a !== void 0 ? _a : (context.missingModelFields = []);
            context.missingModelFields.push(error);
            continue;
        }
        if (error.kind === types_1.DiffErrorKind.MissingBaseFields) {
            (_b = context.missingBaseFields) !== null && _b !== void 0 ? _b : (context.missingBaseFields = []);
            context.missingBaseFields.push(error);
            continue;
        }
        (0, assert_1.assert)(error.kind !== types_1.DiffErrorKind.MissingModelValue); // This can only happen with custom value diffing
        (0, assert_1.assertNever)(error);
    }
}
function getErrors(context) {
    const errors = [];
    if (context.firstError) {
        errors.push(context.firstError);
    }
    if (context.missingBaseFields || context.missingModelFields) {
        errors.push({
            kind: "MissingFields",
            base: context.missingBaseFields,
            model: context.missingModelFields,
        });
    }
    return errors;
}
