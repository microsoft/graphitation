"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addTree = addTree;
exports.replaceTree = replaceTree;
exports.trackTreeNodes = trackTreeNodes;
const assert_1 = require("../jsutils/assert");
function addTree(forest, tree) {
    const { trees } = forest;
    (0, assert_1.assert)(!trees.has(tree.operation.id));
    trees.set(tree.operation.id, tree);
    trackTreeNodes(forest, tree);
}
function replaceTree(forest, tree) {
    const { trees } = forest;
    trees.set(tree.operation.id, tree);
    trackTreeNodes(forest, tree);
}
function trackTreeNodes(forest, tree) {
    const { operationsByNodes } = forest;
    for (const nodeKey of tree.nodes.keys()) {
        let seenIn = operationsByNodes.get(nodeKey);
        if (!seenIn) {
            seenIn = new Set();
            operationsByNodes.set(nodeKey, seenIn);
        }
        seenIn.add(tree.operation.id);
    }
}
