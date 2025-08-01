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
exports.createSourceObject = void 0;
exports.shouldAggregateChunks = shouldAggregateChunks;
exports.createChunkAccumulator = createChunkAccumulator;
exports.accumulateChunks = accumulateChunks;
exports.createValue = createValue;
exports.createLeafError = createLeafError;
exports.createLeafList = createLeafList;
exports.createObjectChunk = createObjectChunk;
exports.createCompositeListChunk = createCompositeListChunk;
exports.createCompositeNullChunk = createCompositeNullChunk;
exports.createCompositeUndefinedChunk = createCompositeUndefinedChunk;
exports.createCompositeValueChunk = createCompositeValueChunk;
exports.createObjectAggregate = createObjectAggregate;
exports.createCompositeListAggregate = createCompositeListAggregate;
exports.createCompositeNullAggregate = createCompositeNullAggregate;
exports.createCompositeUndefinedAggregate = createCompositeUndefinedAggregate;
exports.createComplexScalarValue = createComplexScalarValue;
const types_1 = require("./types");
const Predicates = __importStar(require("./predicates"));
const assert_1 = require("../jsutils/assert");
const resolvedSelection_1 = require("../descriptor/resolvedSelection");
function shouldAggregateChunks(value) {
    return (Predicates.isCompositeValue(value) || Predicates.isLeafErrorValue(value));
}
function createChunkAccumulator() {
    return {
        obj: undefined,
        list: undefined,
        nll: undefined,
        undef: undefined,
        err: undefined,
    };
}
function accumulateChunks(accumulator, value) {
    // Taking into account the following case
    //   (first "foo" value is null because of error bubbling, but the second is actually OK)
    // ```graphql
    // {
    //     a: foo { bar }
    //     b: foo { baz }
    // }
    // ```
    //
    // ```js
    // const data = {
    //     "a": null,
    //     "b": [{ baz: "baz" }]
    // }
    // ```
    if (value === null) {
        return;
    }
    switch (value.kind) {
        case types_1.ValueKind.Object:
            return accumulateObjectChunks(accumulator, value);
        case types_1.ValueKind.CompositeList:
            return accumulateListChunks(accumulator, value);
        case types_1.ValueKind.CompositeNull:
            return accumulateNullChunks(accumulator, value);
        case types_1.ValueKind.CompositeUndefined:
            return accumulateUndefinedChunks(accumulator, value);
        case types_1.ValueKind.LeafError: {
            accumulator.err = value;
            return;
        }
        default:
            (0, assert_1.assertNever)(value);
    }
}
function createValue(accumulator) {
    const { err, list, obj, nll, undef } = accumulator;
    if (obj) {
        (0, assert_1.assert)(!list && !err);
        return obj.length === 1 && !nll && !undef
            ? obj[0]
            : createObjectAggregate(obj, nll, undef);
    }
    if (list) {
        (0, assert_1.assert)(!obj && !err);
        return list.length === 1 && !nll
            ? list[0]
            : createCompositeListAggregate(list, nll);
    }
    if (nll) {
        (0, assert_1.assert)(!err);
        return nll.length === 1 ? nll[0] : createCompositeNullAggregate(nll);
    }
    if (undef) {
        (0, assert_1.assert)(!err);
        return undef.length === 1
            ? undef[0]
            : createCompositeUndefinedAggregate(undef);
    }
    if (err) {
        return err;
    }
    return undefined;
}
function accumulateObjectChunks(accumulator, value) {
    accumulator.obj ?? (accumulator.obj = []);
    if (!Predicates.isAggregate(value)) {
        accumulator.obj.push(value);
        return;
    }
    accumulator.obj.push(...value.chunks);
    if (value.nullChunks?.length) {
        accumulator.nll ?? (accumulator.nll = []);
        accumulator.nll.push(...value.nullChunks);
    }
}
function accumulateListChunks(accumulator, value) {
    accumulator.list ?? (accumulator.list = []);
    if (!Predicates.isAggregate(value)) {
        accumulator.list.push(value);
        return;
    }
    accumulator.list.push(...value.chunks);
    if (value.nullChunks?.length) {
        accumulator.nll ?? (accumulator.nll = []);
        accumulator.nll.push(...value.nullChunks);
    }
}
function accumulateNullChunks(accumulator, value) {
    accumulator.nll ?? (accumulator.nll = []);
    if (Predicates.isAggregate(value)) {
        accumulator.nll.push(...value.chunks);
    }
    else {
        accumulator.nll.push(value);
    }
}
function accumulateUndefinedChunks(accumulator, value) {
    accumulator.undef ?? (accumulator.undef = []);
    if (Predicates.isAggregate(value)) {
        accumulator.undef.push(...value.chunks);
    }
    else {
        accumulator.undef.push(value);
    }
}
function createLeafError(error) {
    return {
        kind: types_1.ValueKind.LeafError,
        data: null,
        error,
    };
}
function createLeafList(source) {
    return {
        kind: types_1.ValueKind.LeafList,
        data: source,
    };
}
function createObjectChunk(operation, possibleSelections, source, key, missingFields = null) {
    let typeName = source.__typename;
    if (!typeName && key !== false && key === operation.rootNodeKey) {
        typeName = operation.rootType;
    }
    return {
        kind: types_1.ValueKind.Object,
        isAggregate: false,
        operation,
        data: source,
        possibleSelections,
        // TODO: resolveSelection should be passed here instead
        selection: (0, resolvedSelection_1.resolveSelection)(operation, possibleSelections, typeName || null),
        fieldChunks: new Map(),
        type: typeName ?? false,
        key,
        missingFields,
        partialFields: null,
        hasNestedReadPolicies: false,
    };
}
function createCompositeListChunk(operation, possibleSelections, source) {
    return {
        kind: types_1.ValueKind.CompositeList,
        isAggregate: false,
        operation,
        data: source,
        possibleSelections,
        itemChunks: new Array(source.length),
        hasNestedReadPolicies: false,
        missingItems: null,
        partialItems: null,
    };
}
function createCompositeNullChunk(operation, possibleSelections) {
    return {
        kind: types_1.ValueKind.CompositeNull,
        isAggregate: false,
        data: null,
        operation,
        possibleSelections,
    };
}
function createCompositeUndefinedChunk(operation, possibleSelections, deleted = false) {
    return {
        kind: types_1.ValueKind.CompositeUndefined,
        isAggregate: false,
        data: undefined,
        deleted,
        operation,
        possibleSelections,
    };
}
function createCompositeValueChunk(operation, possibleSelections, value, key) {
    if (value === null) {
        return createCompositeNullChunk(operation, possibleSelections);
    }
    if (value === undefined) {
        return createCompositeUndefinedChunk(operation, possibleSelections);
    }
    if (Array.isArray(value)) {
        return createCompositeListChunk(operation, possibleSelections, value);
    }
    if (key === undefined) {
        key = operation.env.objectKey?.(value) ?? false;
    }
    return createObjectChunk(operation, possibleSelections, value, key);
}
function createObjectAggregate(chunks, nullChunks, undefinedChunks) {
    if (!chunks.length) {
        throw new Error("Object chunks are empty");
    }
    const chunk = chunks[0];
    return {
        kind: types_1.ValueKind.Object,
        isAggregate: true,
        data: chunk.data,
        key: chunk.key,
        type: chunk.type ||
            (chunks.find((chunk) => chunk.type !== false)?.type ?? false),
        chunks,
        nullChunks,
        undefinedChunks,
    };
}
function createCompositeListAggregate(chunks, nullChunks) {
    if (!chunks.length) {
        throw new Error("List chunks are empty");
    }
    return {
        kind: types_1.ValueKind.CompositeList,
        isAggregate: true,
        data: chunks[0].data,
        chunks,
        nullChunks,
    };
}
function createCompositeNullAggregate(chunks) {
    if (!chunks.length) {
        throw new Error("List chunks are empty");
    }
    return {
        kind: types_1.ValueKind.CompositeNull,
        isAggregate: true,
        data: null,
        chunks,
    };
}
function createCompositeUndefinedAggregate(chunks) {
    if (!chunks.length) {
        throw new Error("List chunks are empty");
    }
    return {
        kind: types_1.ValueKind.CompositeUndefined,
        isAggregate: true,
        data: undefined,
        deleted: chunks[0].deleted, // assuming _all_ deleted chunks are marked as deleted, so relying on a single chunk
        chunks,
    };
}
function createComplexScalarValue(source) {
    return {
        kind: types_1.ValueKind.ComplexScalar,
        data: source,
    };
}
const createSourceObject = (typename) => typeof typename === "object"
    ? typename
    : {
        __typename: typename,
    };
exports.createSourceObject = createSourceObject;
