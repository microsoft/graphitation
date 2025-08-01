"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.indexTree = indexTree;
exports.indexObject = indexObject;
exports.indexDraft = indexDraft;
const types_1 = require("../values/types");
const resolvedSelection_1 = require("../descriptor/resolvedSelection");
const map_1 = require("../jsutils/map");
const assert_1 = require("../jsutils/assert");
const values_1 = require("../values");
const EMPTY_ARRAY = Object.freeze([]);
function indexTree(env, operation, result, knownMissingFields, previousTreeState = null) {
    let rootNodeKey;
    try {
        rootNodeKey =
            env.objectKey(result.data, (0, resolvedSelection_1.resolveSelection)(operation, operation.possibleSelections, operation.rootType), operation) || operation.rootNodeKey;
    }
    catch (e) {
        rootNodeKey = operation.rootNodeKey;
    }
    const dataMap = new Map();
    const context = {
        env: env,
        operation,
        result,
        knownMissingFields,
        nodes: new Map(),
        typeMap: new Map(),
        dataMap,
        incompleteChunks: new Set(),
        rootNodeKey,
        recycleTree: previousTreeState,
        findParent: (0, values_1.createParentLocator)(dataMap),
    };
    const rootRef = {
        value: null,
        parent: null,
        detached: false,
    };
    rootRef.value = indexSourceObject(context, result.data, operation.possibleSelections, rootRef);
    return {
        operation,
        result,
        rootNodeKey,
        nodes: context.nodes,
        typeMap: context.typeMap,
        dataMap: context.dataMap,
        incompleteChunks: context.incompleteChunks,
        prev: previousTreeState,
    };
}
function indexObject(env, operation, source, selection, knownMissingFields, dataMap = new Map()) {
    const isRoot = operation.possibleSelections === selection;
    const rootNodeKey = env.objectKey(source, (0, resolvedSelection_1.resolveSelection)(operation, operation.possibleSelections, source.__typename || null)) || (isRoot ? operation.rootNodeKey : "");
    const context = {
        env: env,
        operation,
        knownMissingFields,
        result: { data: source },
        nodes: new Map(),
        typeMap: new Map(),
        dataMap,
        incompleteChunks: new Set(),
        rootNodeKey,
        recycleTree: null,
        findParent: (0, values_1.createParentLocator)(dataMap),
    };
    const result = {
        value: null,
        parent: null,
        detached: !isRoot,
        nodes: context.nodes,
        dataMap: context.dataMap,
    };
    result.value = indexSourceObject(context, source, selection, result);
    return result;
}
function indexDraft(env, { data, dangling, operation, possibleSelections, missingFields }) {
    if (!data || dangling) {
        return (0, values_1.createCompositeUndefinedChunk)(operation, possibleSelections);
    }
    // Note: using indexObject vs createObjectChunk for convenience:
    //  indexing properly handles missing fields in nested objects
    return indexObject(env, operation, data, possibleSelections, missingFields)
        .value;
}
function indexSourceObject(context, source, possibleSelections, parent) {
    const recycleTree = context.recycleTree;
    const recyclable = recycleTree?.dataMap.get(source) ?? recycleTree?.prev?.dataMap.get(source);
    if (recyclable) {
        return reIndexObject(context, recyclable.value, parent);
    }
    const { env, nodes, typeMap, operation: op, knownMissingFields, dataMap, } = context;
    const isRoot = (0, values_1.isRootRef)(parent) && !parent.detached;
    const typeName = isRoot
        ? source.__typename ?? op.rootType
        : source.__typename;
    const selection = (0, resolvedSelection_1.resolveSelection)(op, possibleSelections, typeName || null);
    const objectKeyResult = isRoot
        ? context.rootNodeKey
        : env.objectKey(source, selection, context.operation);
    const key = typeof objectKeyResult === "string" ? objectKeyResult : false;
    const missingFields = knownMissingFields?.get(source);
    const chunk = (0, values_1.createObjectChunk)(op, possibleSelections, source, key, missingFields);
    if (parent) {
        dataMap.set(source, parent);
    }
    if (missingFields?.size) {
        (0, values_1.markAsPartial)(context, parent);
        context.incompleteChunks.add(chunk);
    }
    if (key !== false) {
        (0, map_1.accumulate)(nodes, key, chunk);
    }
    if (typeName !== undefined) {
        (0, map_1.accumulate)(typeMap, typeName, chunk);
    }
    if (!selection.fieldsWithSelections?.length) {
        if (isRoot && selection.fieldQueue.length) {
            // Special case: detect "empty" trees for operations without selections, e.g. query `{ foo }` and result `{}`
            //   (such trees are not uncommon - they are created as placeholders for watchQueries that are in flight)
            const field = selection.fieldQueue[0];
            if (source[field.dataKey] === undefined) {
                chunk.missingFields ?? (chunk.missingFields = new Set());
                chunk.missingFields.add(field);
                context.incompleteChunks.add(chunk);
            }
        }
        return chunk;
    }
    for (const fieldName of selection.fieldsWithSelections) {
        const aliases = selection.fields.get(fieldName) ?? EMPTY_ARRAY;
        for (const fieldInfo of aliases) {
            const value = source[fieldInfo.dataKey];
            const entryParentInfo = {
                value: null,
                parent: chunk,
                field: fieldInfo,
            };
            (0, assert_1.assert)(fieldInfo.selection && (0, values_1.isSourceCompositeValue)(value, fieldInfo));
            let fieldValue;
            if (Array.isArray(value)) {
                fieldValue = indexSourceList(context, value, fieldInfo.selection, entryParentInfo);
            }
            else if ((0, values_1.isSourceObject)(value)) {
                fieldValue = indexSourceObject(context, value, fieldInfo.selection, entryParentInfo);
            }
            else if (value === null) {
                fieldValue = (0, values_1.createCompositeNullChunk)(context.operation, fieldInfo.selection);
            }
            else if (value === undefined &&
                !selection.skippedFields?.has(fieldInfo)) {
                fieldValue = (0, values_1.createCompositeUndefinedChunk)(context.operation, fieldInfo.selection);
                // Missing field
                chunk.missingFields ?? (chunk.missingFields = new Set());
                chunk.missingFields.add(fieldInfo);
                (0, values_1.markAsPartial)(context, parent);
                context.incompleteChunks.add(chunk);
            }
            else {
                continue;
            }
            entryParentInfo.value = fieldValue;
            chunk.fieldChunks.set(fieldInfo.dataKey, entryParentInfo);
        }
    }
    return chunk;
}
function indexSourceList(context, list, selection, parent) {
    const recycleTree = context.recycleTree;
    const recyclable = recycleTree?.dataMap.get(list) ?? recycleTree?.prev?.dataMap.get(list);
    if (recyclable) {
        return reIndexList(context, recyclable.value, parent);
    }
    const { operation, dataMap } = context;
    dataMap.set(list, parent);
    const chunk = (0, values_1.createCompositeListChunk)(operation, selection, list);
    for (const [index, value] of list.entries()) {
        const itemParent = {
            value: null,
            parent: chunk,
            index,
        };
        let item;
        if (Array.isArray(value)) {
            item = indexSourceList(context, value, selection, itemParent);
        }
        else if ((0, values_1.isSourceObject)(value)) {
            item = indexSourceObject(context, value, selection, itemParent);
        }
        else if (value === null) {
            item = (0, values_1.createCompositeNullChunk)(operation, selection);
        }
        else {
            // ApolloCompat: unexpected values are converted to empty objects 🤷‍♂️
            // FIXME: remove this garbage in the next major
            const fixedValue = Object.create(null);
            if (!Object.isFrozen(list)) {
                list[index] = fixedValue;
            }
            item = indexSourceObject(context, fixedValue, selection, itemParent);
            item.missingFields = new Set([...item.selection.fields.values()].flat());
            (0, values_1.markAsPartial)(context, itemParent);
            context.incompleteChunks.add(item);
        }
        itemParent.value = item;
        chunk.itemChunks[index] = itemParent;
    }
    return chunk;
}
function reIndexObject(context, recyclable, parent) {
    const { dataMap, nodes, typeMap } = context;
    dataMap.set(recyclable.data, parent);
    if (recyclable.type) {
        (0, map_1.accumulate)(typeMap, recyclable.type, recyclable);
    }
    if (recyclable.key !== false) {
        (0, map_1.accumulate)(nodes, recyclable.key, recyclable);
    }
    for (const fieldRef of recyclable.fieldChunks.values()) {
        const fieldChunk = fieldRef.value;
        if (fieldChunk?.kind === types_1.ValueKind.Object ||
            fieldChunk?.kind === types_1.ValueKind.CompositeList) {
            if (fieldChunk.kind === types_1.ValueKind.Object) {
                reIndexObject(context, fieldChunk, fieldRef);
            }
            else {
                reIndexList(context, fieldChunk, fieldRef);
            }
        }
    }
    return recyclable;
}
function reIndexList(context, recyclable, parent) {
    const { dataMap } = context;
    dataMap.set(recyclable.data, parent);
    for (const itemRef of recyclable.itemChunks.values()) {
        const itemChunk = itemRef.value;
        if (itemChunk?.kind === types_1.ValueKind.Object ||
            itemChunk?.kind === types_1.ValueKind.CompositeList) {
            if (itemChunk.kind === types_1.ValueKind.Object) {
                reIndexObject(context, itemChunk, itemRef);
            }
            else {
                reIndexList(context, itemChunk, itemRef);
            }
        }
    }
    return recyclable;
}
