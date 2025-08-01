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
exports.toApolloStoreValue = toApolloStoreValue;
exports.toGraphValue = toGraphValue;
exports.toGraphLeafValue = toGraphLeafValue;
exports.toGraphCompositeChunk = toGraphCompositeChunk;
const client_1 = require("@apollo/client");
const Value = __importStar(require("../values"));
const types_1 = require("../values/types");
const assert_1 = require("../jsutils/assert");
const indexTree_1 = require("../forest/indexTree");
const resolvedSelection_1 = require("../descriptor/resolvedSelection");
const EMPTY_ARRAY = Object.freeze([]);
function toApolloStoreValue(context, value) {
    if (typeof value !== "object" || value === null) {
        return value;
    }
    return Value.isCompositeValue(value)
        ? convertNodesToApolloReferences(context, value)
        : value.data;
}
function toGraphValue(context, oldValue, newValue) {
    return Value.isCompositeValue(oldValue)
        ? toGraphCompositeChunk(context, oldValue.possibleSelections, newValue)
        : toGraphLeafValue(newValue);
}
function toGraphLeafValue(apolloValue) {
    if (apolloValue === undefined) {
        return Value.leafUndefinedValue;
    }
    if (apolloValue === null) {
        return apolloValue;
    }
    if (typeof apolloValue === "object") {
        return Array.isArray(apolloValue)
            ? Value.createLeafList(apolloValue)
            : Value.createComplexScalarValue(apolloValue);
    }
    return Array.isArray(apolloValue)
        ? Value.createLeafList(apolloValue)
        : apolloValue;
}
function toGraphCompositeChunk(context, selections, apolloValue) {
    const { operation, recyclableValues, findChunk } = context;
    if (apolloValue === undefined) {
        return Value.createCompositeUndefinedChunk(operation, selections);
    }
    if (apolloValue === null) {
        return Value.createCompositeNullChunk(operation, selections);
    }
    (0, assert_1.assert)(typeof apolloValue === "object");
    const value = recyclableValues.get(apolloValue);
    if (value) {
        return value;
    }
    if ((0, client_1.isReference)(apolloValue)) {
        return convertApolloReference(context, selections, apolloValue);
    }
    const recycled = findChunk?.(apolloValue);
    if (recycled) {
        return recycled;
    }
    if (Array.isArray(apolloValue)) {
        const source = new Array(apolloValue.length);
        const chunk = Value.createCompositeListChunk(operation, selections, source);
        const len = apolloValue.length;
        const itemChunks = chunk.itemChunks;
        for (let index = 0; index < len; index++) {
            const itemChunk = toGraphCompositeChunk(context, selections, apolloValue[index]);
            source[index] = itemChunk.data;
            itemChunks[index] = { value: itemChunk, parent: chunk, index };
        }
        return chunk;
    }
    const source = inlineAllApolloReferences(context, selections, apolloValue);
    (0, assert_1.assert)(!Array.isArray(source));
    // Note: technically we can produce incomplete chunk without knowing it, but detecting missing leaf fields
    //   requires a separate pass with draft hydration, which is expensive. So here we expect policies do not
    //   produce objects with missing leaf fields. We will still detect missing fields with sub-selections
    //   (as a part of diffing).
    return Value.createObjectChunk(operation, selections, source, context.env.objectKey(source) ?? false);
}
function convertApolloReference(context, selections, reference, assertExists = false) {
    const { env, operation, danglingReferences, getChunks, matchChunk } = context;
    let typeName;
    for (const chunk of getChunks(reference.__ref)) {
        if (chunk.operation === operation &&
            chunk.possibleSelections === selections) {
            return chunk;
        }
        typeName || (typeName = chunk.type);
    }
    if (assertExists) {
        (0, assert_1.assert)(false);
    }
    if (typeName === undefined) {
        danglingReferences.add(reference.__ref);
        return Value.createCompositeUndefinedChunk(operation, selections, true);
    }
    const draft = Value.hydrateDraft(context.env, Value.createDraft(operation, selections, reference.__ref, typeName), getChunks, matchChunk);
    if (draft.dangling) {
        (0, assert_1.assert)(draft.ref !== false);
        const key = Value.resolveObjectKey(draft.ref);
        (0, assert_1.assert)(key !== false && key !== undefined);
        danglingReferences.add(key);
    }
    return (0, indexTree_1.indexDraft)(env, draft);
}
const isStoreObject = (apolloValue) => typeof apolloValue === "object" && apolloValue !== null;
function inlineAllApolloReferences(context, possibleSelections, apolloValue) {
    if (Array.isArray(apolloValue)) {
        return apolloValue.map((item) => inlineAllApolloReferences(context, possibleSelections, item));
    }
    (0, assert_1.assert)(isStoreObject(apolloValue));
    const selection = (0, resolvedSelection_1.resolveSelection)(context.operation, possibleSelections, apolloValue.__typename ?? null);
    for (const fieldName of selection.fieldsWithSelections ?? EMPTY_ARRAY) {
        const aliases = selection.fields.get(fieldName);
        for (const alias of aliases ?? EMPTY_ARRAY) {
            const fieldValue = apolloValue[alias.dataKey];
            if ((0, client_1.isReference)(fieldValue)) {
                (0, assert_1.assert)(alias.selection);
                const chunk = convertApolloReference(context, alias.selection, fieldValue);
                apolloValue[alias.dataKey] = chunk.data;
            }
        }
    }
    return apolloValue;
}
function convertNodesToApolloReferences(context, value) {
    let result;
    switch (value.kind) {
        case types_1.ValueKind.CompositeList: {
            (0, assert_1.assert)(value.itemChunks.length === value.data.length);
            result = value.itemChunks.map((chunk) => convertNodesToApolloReferences(context, chunk.value));
            break;
        }
        case types_1.ValueKind.Object: {
            // Note: technically we should recurse into object, but this is expensive, and Apollo encourages people to call
            //   "identify" on objects instead of accessing __ref directly. So even source object should suffice
            //   (assuming proper Apollo APIs usage)
            //   TODO: explore if this deoptimizes field/merge policies on connections due to not recycling nested edges chunks
            result = value.key ? { __ref: value.key } : value.data;
            break;
        }
        default:
            result = value.data;
            break;
    }
    if (typeof result === "object" && result !== null) {
        // Improve inverse conversion from ApolloStoreValue back to GraphValue by keeping mapping between produced Apollo
        // values and source chunks.
        context.recyclableValues.set(result, value);
    }
    return result;
}
