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
exports.getGraphValueReference = exports.createParentLocator = void 0;
exports.getDataPathForDebugging = getDataPathForDebugging;
exports.findClosestNode = findClosestNode;
exports.ascendFromChunk = ascendFromChunk;
exports.descendToChunk = descendToChunk;
exports.getChunkReference = getChunkReference;
exports.getChunkFieldReference = getChunkFieldReference;
exports.retrieveEmbeddedChunk = retrieveEmbeddedChunk;
exports.retrieveEmbeddedValue = retrieveEmbeddedValue;
exports.resolveGraphValueReference = resolveGraphValueReference;
exports.resolveObjectKey = resolveObjectKey;
exports.isNodeRef = isNodeRef;
const types_1 = require("./types");
const resolvedSelection_1 = require("../descriptor/resolvedSelection");
const Predicates = __importStar(require("./predicates"));
const ResolveValue = __importStar(require("./resolve"));
const assert_1 = require("../jsutils/assert");
const stack = [];
const normalizedStack = [];
const createParentLocator = (map) => (chunk) => {
    const parent = map.get(chunk.data);
    (0, assert_1.assert)(parent);
    return parent;
};
exports.createParentLocator = createParentLocator;
function getDataPathForDebugging(env, chunk, from) {
    const parentInfo = env.findParent(chunk);
    if (!parentInfo || Predicates.isRootRef(parentInfo) || chunk === from) {
        return [];
    }
    const path = getDataPathForDebugging(env, parentInfo.parent, from);
    if (Predicates.isParentObjectRef(parentInfo)) {
        path.push(parentInfo.field.dataKey);
    }
    else if (Predicates.isParentListRef(parentInfo)) {
        path.push(parentInfo.index);
    }
    return path;
}
function findClosestNode(chunk, findParent) {
    if (Predicates.isNodeValue(chunk)) {
        return chunk;
    }
    const parentInfo = findParent(chunk);
    (0, assert_1.assert)(parentInfo.parent);
    return findClosestNode(parentInfo.parent, findParent);
}
function ascendFromChunk(env, from, visit) {
    let value = from;
    let parentInfo = env.findParent(from);
    while (parentInfo?.parent) {
        const step = Predicates.isParentListRef(parentInfo)
            ? parentInfo.index
            : parentInfo.field;
        if (visit?.(value, parentInfo.parent, step) === false) {
            break;
        }
        value = parentInfo.parent;
        parentInfo = env.findParent(parentInfo.parent);
    }
    return value;
}
function descendToChunk(env, from, to, visit) {
    if (Predicates.isCompositeValue(to) &&
        from.possibleSelections === to.possibleSelections) {
        // This function allows traversing chunks from different operations
        //   as long as they share the same document. This comparison is the easiest way to know it.
        return;
    }
    // Note: this is a hot-path, so have to cut corners type-wise
    stack.length = 0;
    let parentInfo = env.findParent(to);
    while (parentInfo?.parent &&
        parentInfo?.parent.possibleSelections !== from.possibleSelections) {
        stack.push(Predicates.isParentObjectRef(parentInfo)
            ? parentInfo.field
            : parentInfo.index);
        parentInfo = env.findParent(parentInfo.parent);
    }
    // This function allows to traverse a chunk from the different tree with the same operation
    (0, assert_1.assert)(parentInfo &&
        Predicates.isParentObjectRef(parentInfo) &&
        parentInfo.parent.possibleSelections === from.possibleSelections);
    let parent = from;
    let step = parentInfo.field;
    let value;
    while (step !== undefined) {
        if (parent.kind === types_1.ValueKind.Object) {
            (0, assert_1.assert)(typeof step !== "number");
            value = ResolveValue.resolveFieldChunk(parent, step);
        }
        else if (parent.kind === types_1.ValueKind.CompositeList) {
            (0, assert_1.assert)(typeof step === "number");
            value = ResolveValue.resolveListItemChunk(parent, step);
        }
        else {
            (0, assert_1.assertNever)(parent);
        }
        if (visit?.(value, parent, step) === false) {
            break;
        }
        if (!Predicates.isObjectValue(value) &&
            !Predicates.isCompositeListValue(value)) {
            value = undefined;
            break;
        }
        parent = value;
        step = stack.pop();
    }
    stack.length = 0;
    return value;
}
function getChunkReference(env, chunk) {
    return env.findParent(chunk);
}
const getGraphValueReference = (env, chunk) => Predicates.isNodeValue(chunk)
    ? chunk.key
    : [env.findParent(chunk), env.findParent];
exports.getGraphValueReference = getGraphValueReference;
function getChunkFieldReference(env, parent, field, value) {
    if (Predicates.isObjectValue(value) ||
        Predicates.isCompositeListValue(value)) {
        return env.findParent(value);
    }
    return { value, parent, field };
}
function retrieveEmbeddedChunk(env, node, ref) {
    return descendToChunk(env, node, ref, undefined);
}
function retrieveEmbeddedValue(env, source, ref) {
    if (typeof ref === "string") {
        (0, assert_1.assert)(source.key === ref);
        return source;
    }
    // Note: this is a hot-path, so have to cut corners type-wise
    normalizedStack.length = 0;
    const refParentLocator = ref[1];
    let parentRef = ref[0];
    while (parentRef?.parent &&
        parentRef.parent.key !== source.key) {
        normalizedStack.push(Predicates.isParentObjectRef(parentRef)
            ? (0, resolvedSelection_1.resolveNormalizedField)(parentRef.parent.selection, parentRef.field)
            : parentRef.index);
        parentRef = refParentLocator(parentRef.parent);
    }
    (0, assert_1.assert)(parentRef &&
        Predicates.isParentObjectRef(parentRef) &&
        parentRef.parent.key === source.key);
    if (source === resolveGraphValueReference(parentRef)) {
        return resolveGraphValueReference(ref[0]);
    }
    let parent = source;
    let step = (0, resolvedSelection_1.resolveNormalizedField)(parentRef.parent.selection, parentRef.field);
    while (step !== undefined) {
        if (Predicates.isObjectValue(parent)) {
            (0, assert_1.assert)(typeof step !== "number");
            const tmp = ResolveValue.aggregateFieldValue(parent, step);
            if (tmp === undefined) {
                return undefined;
            }
            if (!Predicates.isCompositeValue(tmp)) {
                (0, assert_1.assert)(stack.length === 0);
                return tmp;
            }
            parent = tmp;
        }
        else if (Predicates.isCompositeListValue(parent)) {
            (0, assert_1.assert)(typeof step === "number");
            parent = ResolveValue.aggregateListItemValue(parent, step);
        }
        else if (Predicates.isCompositeNullValue(parent) ||
            Predicates.isCompositeUndefinedValue(parent)) {
            return parent;
        }
        else {
            (0, assert_1.assertNever)(parent);
        }
        step = normalizedStack.pop();
    }
    normalizedStack.length = 0;
    return parent;
}
function resolveGraphValueReference(ref) {
    if (ref.value !== undefined) {
        return ref.value;
    }
    (0, assert_1.assert)(!Predicates.isRootRef(ref));
    return Predicates.isParentObjectRef(ref)
        ? ResolveValue.resolveFieldChunk(ref.parent, ref.field)
        : ResolveValue.resolveListItemChunk(ref.parent, ref.index);
}
function resolveObjectKey(ref) {
    if (typeof ref === "string") {
        return ref;
    }
    if (!ref[0].parent) {
        return false;
    }
    const value = resolveGraphValueReference(ref[0]);
    return Predicates.isObjectValue(value) ? value.key : undefined;
}
function isNodeRef(ref) {
    if (typeof ref === "string" || Predicates.isRootRef(ref[0])) {
        return true;
    }
    const value = resolveGraphValueReference(ref[0]);
    return Predicates.isNodeValue(value);
}
