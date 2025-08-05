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
exports.modify = modify;
const client_1 = require("@apollo/client");
const utilities_1 = require("@apollo/client/utilities");
const equality_1 = require("@wry/equality");
const Value = __importStar(require("../values"));
const Difference = __importStar(require("../diff/difference"));
const draftHelpers_1 = require("./draftHelpers");
const policies_1 = require("./policies");
const assert_1 = require("../jsutils/assert");
const types_1 = require("../diff/types");
const keys_1 = require("./keys");
const convert_1 = require("./convert");
const store_1 = require("./store");
const updateForest_1 = require("../forest/updateForest");
const invalidate_1 = require("./invalidate");
const resolvedSelection_1 = require("../descriptor/resolvedSelection");
const EMPTY_ARRAY = Object.freeze([]);
const DELETE = Object.freeze(Object.create(null));
const INVALIDATE = Object.freeze(Object.create(null));
function modify(env, store, activeTransaction, options) {
    var _a, _b, _c, _d;
    const id = (_a = options.id) !== null && _a !== void 0 ? _a : "ROOT_QUERY";
    const optimistic = (_c = (_b = activeTransaction.forceOptimistic) !== null && _b !== void 0 ? _b : options.optimistic) !== null && _c !== void 0 ? _c : false;
    const targetForest = (0, store_1.getActiveForest)(store, activeTransaction);
    const layers = (0, store_1.getEffectiveWriteLayers)(store, targetForest, optimistic);
    const layerDifferenceMap = runModifiers(env, layers, id, options.fields);
    if (!layerDifferenceMap.size) {
        return { options, dirty: false, affected: new Set() };
    }
    let deletedFromLayers = 0;
    let deletedFieldsFromLayers = 0;
    let updatedLayers = 0;
    // Applying layers difference first (then we will invalidate read results)
    const affectedOperations = new Map();
    const chunkProvider = (key) => (0, draftHelpers_1.getNodeChunks)((0, store_1.getEffectiveReadLayers)(store, targetForest, false), key);
    for (const [layer, layerDifference] of layerDifferenceMap.entries()) {
        (0, updateForest_1.resolveAffectedOperations)(layer, layerDifference, affectedOperations);
        const updated = (0, updateForest_1.updateAffectedTrees)(env, targetForest, affectedOperations, chunkProvider).length;
        updatedLayers += updated ? 1 : 0;
        if (layerDifference.deletedNodes.length) {
            for (const id of layerDifference.deletedNodes) {
                deleteNode(layer, id);
            }
            deletedFromLayers++;
            continue;
        }
        const nodeDifference = layerDifference.nodeDifference.get(id);
        (0, assert_1.assert)(nodeDifference);
        const deletedFields = nodeDifference.fieldsToDelete;
        if (deletedFields.size) {
            const deleted = deletedNodeFields(store, layer, id, deletedFields);
            if (deleted) {
                deletedFieldsFromLayers++;
            }
        }
    }
    // Invalidate read results
    // allAffectedOps includes all modified + those affected only in read results
    const allAffectedOps = new Set(affectedOperations.keys());
    for (const [layer, layerDifference] of layerDifferenceMap.entries()) {
        const operationIds = layer.operationsByNodes.get(id);
        const nodeDifference = layerDifference.nodeDifference.get(id);
        (0, assert_1.assert)(nodeDifference);
        // Invalidate modified fields in read results
        (0, invalidate_1.invalidateReadResults)(env, store, layer, layerDifference, affectedOperations);
        const dirtyFields = nodeDifference.fieldsToInvalidate;
        // Invalidate deleted / invalidated fields in read results
        for (const operationId of operationIds !== null && operationIds !== void 0 ? operationIds : EMPTY_ARRAY) {
            const operation = (_d = layer.trees.get(operationId)) === null || _d === void 0 ? void 0 : _d.operation;
            if (!operation) {
                continue;
            }
            if (deletedFromLayers || deletedFieldsFromLayers) {
                layer.readResults.delete(operation);
                store.optimisticReadResults.delete(operation);
                allAffectedOps.add(operation);
                continue;
            }
            let affected = false;
            const results = layer.readResults.get(operation);
            const optimisticResults = store.optimisticReadResults.get(operation);
            if (results) {
                const invalidated = addDirtyNodeFields(results, id, dirtyFields);
                affected || (affected = invalidated);
            }
            if (optimisticResults) {
                const invalidated = addDirtyNodeFields(optimisticResults, id, dirtyFields);
                affected || (affected = invalidated);
            }
            if (affected) {
                allAffectedOps.add(operation);
            }
        }
    }
    const dirty = updatedLayers > 0 || deletedFromLayers > 0 || deletedFieldsFromLayers > 0;
    return {
        options,
        dirty,
        affected: allAffectedOps,
        difference: layerDifferenceMap,
    };
}
function runModifiers(env, layers, nodeKey, fields) {
    const layerDifferenceMap = new Map();
    const context = {
        env,
        layers,
    };
    const modifyOptions = {
        fieldName: "",
        storeFieldName: "",
        storage: {},
        DELETE,
        INVALIDATE,
        isReference: client_1.isReference,
        toReference: policies_1.toReference.bind(context),
        canRead: policies_1.canRead.bind(context),
        readField: (fieldNameOrOptions, from) => policies_1.readField.call(context, typeof fieldNameOrOptions === "string"
            ? {
                fieldName: fieldNameOrOptions,
                from: from || (0, client_1.makeReference)(nodeKey),
            }
            : fieldNameOrOptions),
    };
    for (const layer of layers) {
        const chunks = [...(0, draftHelpers_1.getNodeChunks)([layer], nodeKey)];
        if (!chunks.length) {
            continue;
        }
        const node = Value.createObjectAggregate(chunks);
        const fieldNames = Value.aggregateFieldNames(node);
        const nodeDifference = {
            ...Difference.createObjectDifference(),
            fieldsToDelete: new Set(),
            fieldsToInvalidate: new Set(),
            deleteNode: true,
        };
        for (const fieldName of fieldNames) {
            const tmp = Value.aggregateFieldEntries(node, fieldName);
            if (!tmp) {
                continue;
            }
            const fieldEntries = Array.isArray(tmp) ? tmp : [tmp];
            for (const fieldEntry of fieldEntries) {
                modifyOptions.fieldName = fieldName;
                modifyOptions.storeFieldName = (0, keys_1.fieldToStringKey)(fieldEntry);
                modifyOptions.storage = {}; // TODO (?)
                // TODO: use conversion utils instead
                const oldValue = Value.aggregateFieldValue(node, fieldEntry);
                const oldSourceValue = oldValue !== undefined
                    ? (0, policies_1.maybeReturnRef)(env, Value.getFirstSourceValue(oldValue))
                    : undefined;
                if (oldValue === undefined || oldSourceValue === undefined) {
                    // Missing value
                    continue;
                }
                const modify = typeof fields === "function"
                    ? fields
                    : fields[modifyOptions.storeFieldName] || fields[fieldName];
                if (!modify) {
                    nodeDifference.deleteNode = false;
                    continue;
                }
                const newSourceValue = modify((0, utilities_1.maybeDeepFreeze)(oldSourceValue), modifyOptions);
                if (newSourceValue === DELETE) {
                    nodeDifference.fieldsToDelete.add(fieldEntry);
                    continue;
                }
                nodeDifference.deleteNode = false;
                if (newSourceValue === INVALIDATE) {
                    nodeDifference.fieldsToInvalidate.add(fieldEntry);
                    continue;
                }
                if ((0, equality_1.equal)(oldSourceValue, newSourceValue) ||
                    newSourceValue === undefined) {
                    continue;
                }
                const replacement = {
                    kind: types_1.DifferenceKind.Replacement,
                    oldValue,
                    newValue: toGraphValue(env, layer, oldValue, newSourceValue),
                };
                Difference.addFieldDifference(nodeDifference, fieldEntry, replacement);
                Difference.addDirtyField(nodeDifference, fieldEntry);
            }
        }
        if (Difference.isDirty(nodeDifference) ||
            nodeDifference.fieldsToInvalidate.size ||
            nodeDifference.fieldsToDelete.size ||
            nodeDifference.deleteNode) {
            const graphDifference = {
                nodeDifference: new Map([[nodeKey, nodeDifference]]),
                newNodes: EMPTY_ARRAY,
                deletedNodes: nodeDifference.deleteNode
                    ? [nodeKey]
                    : EMPTY_ARRAY,
                errors: EMPTY_ARRAY,
            };
            layerDifferenceMap.set(layer, graphDifference);
        }
    }
    return layerDifferenceMap;
}
function deleteNode(layer, nodeKey) {
    var _a;
    layer.deletedNodes.add(nodeKey);
    // TODO (mayby): instead of mutating trees directly, we should have updateForest() which accepts GraphDifference
    //   and produces a new forest value (with structural sharing). This new value can later fully replace the forest in here.
    //   (this is hard, but allows to rollback on errors in the middle of mutation + have history/log of the whole forest)
    const operations = layer.operationsByNodes.get(nodeKey);
    for (const operation of operations !== null && operations !== void 0 ? operations : EMPTY_ARRAY) {
        const tree = layer.trees.get(operation);
        if (!tree) {
            continue;
        }
        const chunks = tree.nodes.get(nodeKey);
        if (!(chunks === null || chunks === void 0 ? void 0 : chunks.length)) {
            continue;
        }
        const pathEnv = {
            findParent: Value.createParentLocator(tree.dataMap),
        };
        for (const chunk of chunks) {
            const chunkRef = pathEnv.findParent(chunk);
            const { selection } = chunk;
            if (!chunkRef) {
                // Orphan chunk
                continue;
            }
            if (Value.isParentObjectRef(chunkRef)) {
                deleteTreeChunkField(pathEnv, tree, chunkRef.parent, chunkRef.field);
                continue;
            }
            if (Value.isParentListRef(chunkRef)) {
                deleteTreeChunkItem(pathEnv, tree, chunkRef.parent, chunkRef.index);
                continue;
            }
            // When deleting root node - also delete all of its fields
            for (const fieldAliases of selection.fields.values()) {
                for (const fieldAlias of fieldAliases) {
                    if ((_a = selection.skippedFields) === null || _a === void 0 ? void 0 : _a.has(fieldAlias)) {
                        continue;
                    }
                    deleteTreeChunkField(pathEnv, tree, chunk, fieldAlias);
                }
            }
            // TODO: should we differentiate between incomplete/deleted chunks ?
            tree.incompleteChunks.add(chunk);
        }
    }
}
function addDirtyNodeFields({ dirtyNodes, outputTree }, nodeKey, dirtyFields) {
    var _a;
    let currentDirtyFields = dirtyNodes.get(nodeKey);
    if ((currentDirtyFields === null || currentDirtyFields === void 0 ? void 0 : currentDirtyFields.size) === 0) {
        // Going to diff all fields anyways
        return true;
    }
    if (!currentDirtyFields) {
        currentDirtyFields = new Set();
    }
    const chunks = (_a = outputTree.nodes.get(nodeKey)) !== null && _a !== void 0 ? _a : EMPTY_ARRAY;
    for (const dirtyField of dirtyFields) {
        // TODO: do not add field if doesn't actually exist in this operation
        if (chunks.some((chunk) => Value.hasFieldEntry(chunk, dirtyField))) {
            currentDirtyFields.add((0, resolvedSelection_1.getFieldName)(dirtyField));
        }
    }
    if (currentDirtyFields.size) {
        dirtyNodes.set(nodeKey, currentDirtyFields);
        return true;
    }
    return false;
}
function deletedNodeFields(store, layer, nodeKey, deletedFields) {
    let deletedFromOperations = 0;
    const operationIds = layer.operationsByNodes.get(nodeKey);
    for (const operationId of operationIds !== null && operationIds !== void 0 ? operationIds : EMPTY_ARRAY) {
        const tree = layer.trees.get(operationId);
        if (!tree) {
            continue;
        }
        const operation = tree.operation;
        const pathEnv = {
            findParent: Value.createParentLocator(tree.dataMap),
        };
        const deleted = deleteTreeNodeFields(pathEnv, tree, nodeKey, deletedFields);
        if (deleted) {
            deletedFromOperations++;
        }
        const readResult = layer.readResults.get(operation);
        const optimisticReadResult = store.optimisticReadResults.get(operation);
        if (readResult) {
            const outputTree = readResult.outputTree;
            pathEnv.findParent = Value.createParentLocator(outputTree.dataMap);
            deleteTreeNodeFields(pathEnv, outputTree, nodeKey, deletedFields);
        }
        if (optimisticReadResult) {
            const outputTree = optimisticReadResult.outputTree;
            pathEnv.findParent = Value.createParentLocator(outputTree.dataMap);
            deleteTreeNodeFields(pathEnv, outputTree, nodeKey, deletedFields);
        }
    }
    return deletedFromOperations > 0;
}
function deleteTreeNodeFields(env, tree, nodeKey, deletedFields) {
    let deleted = false;
    const chunks = tree.nodes.get(nodeKey);
    for (const chunk of chunks !== null && chunks !== void 0 ? chunks : EMPTY_ARRAY) {
        for (const deletedField of deletedFields) {
            const fieldAliases = Value.resolveMatchingFieldAliases(chunk, deletedField);
            for (const fieldAlias of fieldAliases) {
                const didDelete = deleteTreeChunkField(env, tree, chunk, fieldAlias);
                deleted || (deleted = didDelete);
            }
        }
    }
    return deleted;
}
function deleteTreeChunkField(pathEnv, tree, chunk, field) {
    const didDelete = Value.deleteField(pathEnv, chunk, field);
    if (didDelete) {
        tree.incompleteChunks.add(chunk);
    }
    return didDelete;
}
function deleteTreeChunkItem(pathEnv, tree, chunk, index) {
    const didDelete = Value.deleteListItem(pathEnv, chunk, index);
    if (didDelete) {
        tree.incompleteChunks.add(chunk);
    }
    return didDelete;
}
// TODO: move this to "convert"
function toGraphValue(env, layer, base, newSourceValue) {
    // TODO: invariants here require additional validation of newSourceValue right after modify call
    //   (otherwise they are not invariants because user code may return whatever it wants)
    if (typeof base !== "object" || base === null) {
        (0, assert_1.assert)((typeof newSourceValue !== "object" || newSourceValue === null) &&
            newSourceValue !== undefined);
        (0, assert_1.assert)(typeof base === typeof newSourceValue || newSourceValue === null);
        return newSourceValue;
    }
    if (Value.isCompositeValue(base)) {
        (0, assert_1.assert)(typeof newSourceValue === "object" && newSourceValue !== null);
        // TODO: for base aggregates - return aggregate value too
        const oldChunk = Value.isAggregate(base) ? base.chunks[0] : base;
        const context = {
            env,
            operation: oldChunk.operation,
            recyclableValues: new Map(),
            danglingReferences: new Set(),
            getChunks: (ref) => (0, draftHelpers_1.getObjectChunks)([layer], ref),
        };
        return (0, convert_1.toGraphCompositeChunk)(context, oldChunk.possibleSelections, newSourceValue);
    }
    throw new Error(`ForestRun doesn't support ${base.kind} value in cache.modify() API`);
}
