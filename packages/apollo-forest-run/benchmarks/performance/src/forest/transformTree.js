"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformTree = transformTree;
const Difference = __importStar(require("../diff/difference"));
const resolvedSelection_1 = require("../descriptor/resolvedSelection");
const updateTree_1 = require("./updateTree");
const values_1 = require("../values");
const assert_1 = require("../jsutils/assert");
const EMPTY_ARRAY = Object.freeze([]);
/**
 * Transforms a tree using custom transformers. Returns the same (===) tree when there were no actual changes,
 * returns updated tree otherwise. Doesn't mutate the original tree.
 *
 * Breadth-first algorithm where transformers are applied level by level with two possible modes:
 *
 *   "DESCEND" mode:
 *      Starts from the root level chunk and applies transforms to nested chunks level-by-level.
 *      Output of the preceding transformation becomes input to the nested transformations.
 *      In case of conflict deeper transformation wins.
 *      (edit on ENTER)
 *   "ASCEND" mode:
 *      Starts from the bottom level and moves upwards. In case of conflict parent transformation wins.
 *      (edit on LEAVE)
 *
 * Notes:
 * - This function exploits indexed nature of the tree and doesn't actually traverse all nodes.
 * - In "DESCEND" mode tree may undergo multiple updates if transformation affects tree structure
 *   (add/remove list items, change union type members, change field values to null, etc.)
 */
function transformTree(env, tree, direction, chunkFilter, transformer) {
    const treeState = {
        dirty: 0 /* DirtyState.Clean */,
        nodeDifference: new Map(),
        intermediateTree: tree,
        findParent: (0, values_1.createParentLocator)(tree.dataMap),
    };
    let level = 0; // For "DESCEND" mode level 0 points to root chunk. For "ASCEND" mode - to the deepest chunks
    let chunks = collectChunks(tree, direction, chunkFilter);
    let chunkQueue = resolveLevelChunks(chunks, level);
    while (chunkQueue.length) {
        // First, apply object-level transforms
        if (transformer.transform) {
            for (const chunk of chunkQueue) {
                transformChunk(env, treeState, chunk, transformer);
            }
            if (treeState.dirty === 2 /* DirtyState.StructureChanged */ &&
                direction === "DESCEND") {
                const newTree = updateTreeStructure(env, treeState);
                chunks = collectChunks(newTree, direction, chunkFilter);
                chunkQueue = resolveLevelChunks(chunks, level); // enter new chunks at the same level for field transforms
            }
            if (!chunkQueue.length) {
                break;
            }
        }
        // Next, apply field transforms
        for (const chunk of chunkQueue) {
            transformChunkFields(env, treeState, chunk, transformer);
        }
        if (treeState.dirty === 2 /* DirtyState.StructureChanged */ &&
            direction === "DESCEND") {
            const newTree = updateTreeStructure(env, treeState);
            chunks = collectChunks(newTree, direction, chunkFilter);
        }
        level = chunkQueue[0].selection.depth + 1;
        chunkQueue = resolveLevelChunks(chunks, level);
    }
    return treeState.dirty !== 0 /* DirtyState.Clean */
        ? (0, updateTree_1.updateTree)(env, treeState.intermediateTree, treeState.nodeDifference)
            .updatedTree
        : treeState.intermediateTree;
}
function transformChunk(env, treeState, chunk, transformer) {
    (0, assert_1.assert)(transformer.transform);
    const parentNode = (0, values_1.findClosestNode)(chunk, treeState.findParent);
    const difference = transformer.transform(chunk, getDifference(treeState, parentNode, chunk));
    if (!difference) {
        return;
    }
    addDifference(treeState, parentNode, chunk, difference);
    markTreeDirty(treeState, difference);
}
function transformChunkFields(env, treeState, chunk, transformer) {
    const parentNode = (0, values_1.findClosestNode)(chunk, treeState.findParent);
    let chunkDiff = getDifference(treeState, parentNode, chunk);
    const fieldQueue = transformer.getFieldQueue(chunk, chunkDiff);
    for (const fieldName of fieldQueue) {
        const aliases = (0, values_1.resolveFieldAliases)(chunk, fieldName);
        for (const fieldInfo of aliases ?? EMPTY_ARRAY) {
            const normalizedField = (0, resolvedSelection_1.resolveNormalizedField)(chunk.selection, fieldInfo);
            const fieldDifference = Difference.getFieldDifference(chunkDiff, normalizedField);
            const valueDifference = transformer.transformField(chunk, fieldInfo, (0, values_1.resolveFieldChunk)(chunk, fieldInfo), fieldDifference?.state);
            if (valueDifference && Difference.isDirty(valueDifference)) {
                chunkDiff ?? (chunkDiff = addDifference(treeState, parentNode, chunk, Difference.createObjectDifference()));
                if (!fieldDifference) {
                    Difference.addFieldDifference(chunkDiff, normalizedField, valueDifference);
                }
                Difference.addDirtyField(chunkDiff, normalizedField);
                markParentNodeDirty(treeState, parentNode, chunk);
                markTreeDirty(treeState, valueDifference);
            }
        }
    }
}
function markTreeDirty(state, difference) {
    if (Difference.hasStructuralChanges(difference)) {
        state.dirty = 2 /* DirtyState.StructureChanged */;
    }
    else if (difference && Difference.isDirty(difference)) {
        state.dirty = 1 /* DirtyState.Dirty */;
    }
}
function updateTreeStructure(env, state) {
    // Intermediate update of the tree structure
    //   We can skip intermediate updates in ASCEND mode because output of transformation doesn't change
    //   which chunks are visited during transformation.
    //   This is the same logic as returning changed values in visitor on "ENTER" vs. "LEAVE".
    const { updatedTree } = (0, updateTree_1.updateTree)(env, state.intermediateTree, state.nodeDifference);
    state.intermediateTree = updatedTree;
    state.dirty = 0 /* DirtyState.Clean */;
    state.nodeDifference.clear();
    state.findParent = (0, values_1.createParentLocator)(updatedTree.dataMap);
    return updatedTree;
}
function collectChunks(tree, direction, filter) {
    if (!filter.types && !filter.nodes) {
        const chunks = [];
        for (const nodeChunks of tree.nodes.values()) {
            chunks.push(...nodeChunks);
        }
        return chunks;
    }
    const typeSet = new Set(filter.types);
    const chunks = [];
    for (const typeName of typeSet) {
        chunks.push(...(tree.typeMap.get(typeName) ?? EMPTY_ARRAY));
    }
    const nodes = filter.nodes ?? tree.nodes.keys();
    for (const nodeKey of nodes) {
        for (const chunk of tree.nodes.get(nodeKey) ?? EMPTY_ARRAY) {
            if (!typeSet.has(chunk.type)) {
                // Chunks for this type were already added
                chunks.push(chunk);
            }
        }
    }
    return direction === "ASCEND"
        ? chunks.sort((a, b) => b.selection.depth - a.selection.depth)
        : chunks.sort((a, b) => a.selection.depth - b.selection.depth);
}
function resolveLevelChunks(chunksSortedByLevel, level) {
    const chunkQueue = [];
    let stopDepth = -1;
    for (const chunk of chunksSortedByLevel) {
        const depth = chunk.selection.depth;
        if (depth < level) {
            continue;
        }
        if (stopDepth === -1) {
            stopDepth = depth;
        }
        if (depth > stopDepth) {
            break;
        }
        chunkQueue.push(chunk);
    }
    return chunkQueue;
}
function getDifference(treeState, parentNode, chunk) {
    const nodeDiff = treeState.nodeDifference.get(parentNode.key);
    return chunk === parentNode
        ? nodeDiff
        : getEmbeddedChunkDifference(treeState, chunk, parentNode, nodeDiff);
}
function addDifference(treeState, parentNode, chunk, chunkDifference) {
    const { nodeDifference } = treeState;
    let nodeDiff = nodeDifference.get(parentNode.key);
    if (chunk === parentNode) {
        (0, assert_1.assert)(!nodeDiff || nodeDiff === chunkDifference);
        nodeDifference.set(parentNode.key, chunkDifference);
        return chunkDifference;
    }
    if (!nodeDiff) {
        nodeDiff = Difference.createObjectDifference();
        nodeDifference.set(parentNode.key, nodeDiff);
    }
    addEmbeddedChunkDifference(treeState, parentNode, nodeDiff, chunk, chunkDifference);
    return chunkDifference;
}
function getEmbeddedChunkDifference(treeState, chunk, parentNode, parentNodeDifference) {
    if (!parentNodeDifference) {
        return undefined;
    }
    let parentDifference = parentNodeDifference;
    let valueDifference = parentDifference;
    (0, values_1.descendToChunk)(treeState, parentNode, chunk, (value, parent, step) => {
        if (!parentDifference) {
            return;
        }
        if ((0, values_1.isObjectValue)(parent)) {
            (0, assert_1.assert)(typeof step !== "number" &&
                Difference.isObjectDifference(parentDifference));
            const field = (0, resolvedSelection_1.resolveNormalizedField)(parent.selection, step);
            const fieldDifference = Difference.getFieldDifference(parentDifference, field);
            valueDifference = fieldDifference?.state;
        }
        else {
            (0, assert_1.assert)(typeof step === "number" &&
                Difference.isCompositeListDifference(parentDifference));
            valueDifference = Difference.getListItemDifference(parentDifference, step);
        }
        if (valueDifference === undefined) {
            parentDifference = undefined;
            return;
        }
        (0, assert_1.assert)(Difference.isObjectDifference(valueDifference) ||
            Difference.isCompositeListDifference(valueDifference));
        parentDifference = valueDifference;
    });
    return valueDifference;
}
function addEmbeddedChunkDifference(treeState, parentNode, parentNodeDifference, chunk, chunkDifference) {
    let parentDiff = parentNodeDifference;
    let valueDifference = parentDiff;
    (0, values_1.descendToChunk)(treeState, parentNode, chunk, (value, parent, step) => {
        (0, assert_1.assert)((0, values_1.isCompositeListValue)(value) || (0, values_1.isObjectValue)(value));
        if ((0, values_1.isObjectValue)(parent)) {
            (0, assert_1.assert)(typeof step !== "number" && Difference.isObjectDifference(parentDiff));
            const field = (0, resolvedSelection_1.resolveNormalizedField)(parent.selection, step);
            const fieldDifference = Difference.getFieldDifference(parentDiff, field) ??
                Difference.addFieldDifference(parentDiff, field, value === chunk ? chunkDifference : createValueDifference(value));
            valueDifference = fieldDifference.state;
        }
        else {
            (0, assert_1.assert)(typeof step === "number" &&
                Difference.isCompositeListDifference(parentDiff));
            valueDifference =
                Difference.getListItemDifference(parentDiff, step) ??
                    Difference.addListItemDifference(parentDiff, step, value === chunk ? chunkDifference : createValueDifference(value));
        }
        (0, assert_1.assert)(Difference.isObjectDifference(valueDifference) ||
            Difference.isCompositeListDifference(valueDifference));
        parentDiff = valueDifference;
    });
    (0, assert_1.assert)(valueDifference === chunkDifference);
    return valueDifference;
}
function markParentNodeDirty(treeState, parentNode, chunk) {
    const parentNodeDifference = treeState.nodeDifference.get(parentNode.key);
    (0, assert_1.assert)(parentNodeDifference);
    let parentDifference = parentNodeDifference;
    (0, values_1.descendToChunk)(treeState, parentNode, chunk, (value, parent, step) => {
        if ((0, values_1.isObjectValue)(parent)) {
            (0, assert_1.assert)(typeof step !== "number" &&
                Difference.isObjectDifference(parentDifference));
            const field = (0, resolvedSelection_1.resolveNormalizedField)(parent.selection, step);
            Difference.addDirtyField(parentDifference, field);
            parentDifference = Difference.getFieldDifference(parentDifference, field)?.state;
        }
        else {
            (0, assert_1.assert)(typeof step === "number" &&
                Difference.isCompositeListDifference(parentDifference));
            Difference.addDirtyListItem(parentDifference, step);
            parentDifference = Difference.getListItemDifference(parentDifference, step);
        }
    });
}
function createValueDifference(chunk) {
    if ((0, values_1.isObjectValue)(chunk)) {
        return Difference.createObjectDifference();
    }
    if ((0, values_1.isCompositeListValue)(chunk)) {
        return Difference.createCompositeListDifference();
    }
    (0, assert_1.assertNever)(chunk);
}
