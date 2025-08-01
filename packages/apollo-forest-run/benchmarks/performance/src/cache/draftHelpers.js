"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createChunkProvider = exports.createChunkMatcher = exports.createParentLocator = void 0;
exports.getObjectChunks = getObjectChunks;
exports.getNodeChunks = getNodeChunks;
exports.findRecyclableChunk = findRecyclableChunk;
const assert_1 = require("../jsutils/assert");
const values_1 = require("../values");
const resolvedSelection_1 = require("../descriptor/resolvedSelection");
const EMPTY_ARRAY = Object.freeze([]);
/**
 * Loads chunks from provided layers that match given reference chunk (either by key, or by path from the closest node).
 * Chunks from earlier layers have priority.
 */
function getObjectChunks(layers, ref, includeDeleted = false, parentNode) {
    if (typeof ref === "string") {
        return getNodeChunks(layers, ref, includeDeleted);
    }
    const [chunkParentInfo, findParent] = ref;
    const value = (0, values_1.resolveGraphValueReference)(chunkParentInfo);
    if ((0, values_1.isNodeValue)(value)) {
        return getNodeChunks(layers, value.key, includeDeleted);
    }
    (0, assert_1.assert)((0, values_1.isObjectValue)(value) || (0, values_1.isCompositeListValue)(value));
    parentNode ?? (parentNode = (0, values_1.findClosestNode)(value, findParent));
    return getEmbeddedObjectChunks({ findParent: (0, exports.createParentLocator)(layers) }, getNodeChunks(layers, parentNode.key, includeDeleted), ref);
}
function* getEmbeddedObjectChunks(pathEnv, nodeChunks, ref) {
    for (const chunk of nodeChunks) {
        const value = (0, values_1.retrieveEmbeddedValue)(pathEnv, chunk, ref);
        if (value === undefined || (0, values_1.isMissingValue)(value)) {
            continue;
        }
        (0, assert_1.assert)((0, values_1.isObjectValue)(value) && value.key === false);
        if (value.isAggregate) {
            for (const embeddedChunk of value.chunks) {
                yield embeddedChunk;
            }
        }
        else {
            yield value;
        }
    }
}
function* getNodeChunks(layers, key, includeDeleted = false) {
    for (const layer of layers) {
        if (!includeDeleted && layer.deletedNodes.has(key)) {
            // When a node is deleted in some layer - it is treated as deleted from lower layers too
            break;
        }
        const operations = layer.operationsByNodes.get(key);
        for (const operation of operations ?? EMPTY_ARRAY) {
            const tree = layer.trees.get(operation);
            if (!tree) {
                continue;
            }
            const chunks = tree.nodes.get(key) ?? EMPTY_ARRAY;
            for (const chunk of chunks) {
                yield chunk;
            }
        }
    }
}
function findRecyclableChunk(layers, operation, ref, selection, includeDeleted = false, dirtyNodes) {
    if (typeof ref !== "string") {
        return undefined; // TODO?
    }
    if (dirtyNodes && isDirtyNode(ref, selection, dirtyNodes)) {
        return undefined;
    }
    for (const layer of layers) {
        if (!includeDeleted && layer.deletedNodes.has(ref)) {
            // When a node is deleted in some layer - it is treated as deleted from lower layers too
            return undefined;
        }
        const totalTreesWithNode = layer.operationsByNodes.get(ref)?.size ?? 0;
        if (totalTreesWithNode === 0) {
            // Can safely move to lower level
            continue;
        }
        const tree = layer.trees.get(operation.id);
        for (const chunk of tree?.nodes.get(ref) ?? EMPTY_ARRAY) {
            if ((0, resolvedSelection_1.resolvedSelectionsAreEqual)(chunk.selection, selection)) {
                return chunk;
            }
        }
        if (tree?.incompleteChunks.size) {
            // Cannot recycle chunks from lower layers when there is missing data in this layer.
            //   This "missing data" may be present in this layer in sibling chunks.
            //   If we move to lower layers - we may accidentally skip the actual data in this layer.
            return undefined;
        }
        if (totalTreesWithNode - (tree ? 1 : 0) > 0) {
            // Cannot recycle chunks from lower layers if there is another partially matching chunks in this layer
            //   which may contain data having precedence over lower layers.
            return undefined;
        }
    }
    return undefined;
}
function findParentInfo(layers, chunk) {
    for (const layer of layers) {
        const tree = layer.trees.get(chunk.operation.id);
        const parentInfo = tree?.dataMap.get(chunk.data);
        if (parentInfo) {
            return parentInfo;
        }
    }
    (0, assert_1.assert)(false);
}
function isDirtyNode(nodeKey, selection, dirtyNodes) {
    const dirtyFields = dirtyNodes.get(nodeKey);
    if (!dirtyFields) {
        return false;
    }
    if (dirtyFields.size === 0) {
        return true;
    }
    for (const fieldName of dirtyFields) {
        const aliases = selection.fields.get(fieldName);
        if (aliases?.length &&
            aliases.some((alias) => !selection.skippedFields?.has(alias))) {
            return true;
        }
    }
    return false;
}
const createParentLocator = (layers) => (chunk) => findParentInfo(layers, chunk);
exports.createParentLocator = createParentLocator;
const createChunkMatcher = (layers, includeDeleted = false, dirtyNodes) => (ref, operation, selection) => findRecyclableChunk(layers, operation, ref, selection, includeDeleted, dirtyNodes);
exports.createChunkMatcher = createChunkMatcher;
const createChunkProvider = (layers, includeDeleted = false) => (ref) => getObjectChunks(layers, ref, includeDeleted);
exports.createChunkProvider = createChunkProvider;
