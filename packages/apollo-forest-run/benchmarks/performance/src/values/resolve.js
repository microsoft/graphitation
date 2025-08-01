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
exports.leafDeletedValue = exports.leafUndefinedValue = void 0;
exports.hasField = hasField;
exports.resolveFieldNames = resolveFieldNames;
exports.resolveFieldAliases = resolveFieldAliases;
exports.resolveFieldValue = resolveFieldValue;
exports.hasFieldEntry = hasFieldEntry;
exports.resolveFieldChunk = resolveFieldChunk;
exports.resolveMatchingFieldAliases = resolveMatchingFieldAliases;
exports.aggregateFieldNames = aggregateFieldNames;
exports.aggregateFieldChunks = aggregateFieldChunks;
exports.aggregateFieldEntries = aggregateFieldEntries;
exports.aggregateFieldValue = aggregateFieldValue;
exports.resolveListItemChunk = resolveListItemChunk;
exports.aggregateListItemValue = aggregateListItemValue;
exports.getFirstSourceValue = getFirstSourceValue;
const Descriptor = __importStar(require("../descriptor/resolvedSelection"));
const CreateValue = __importStar(require("./create"));
const Predicates = __importStar(require("./predicates"));
const assert_1 = require("../jsutils/assert");
const map_1 = require("../jsutils/map");
const types_1 = require("./types");
const EMPTY_ARRAY = Object.freeze([]);
exports.leafUndefinedValue = Object.freeze({
    kind: types_1.ValueKind.LeafUndefined,
    deleted: false,
    data: undefined,
});
exports.leafDeletedValue = Object.freeze({
    kind: types_1.ValueKind.LeafUndefined,
    deleted: true,
    data: undefined,
});
function hasField(chunk, fieldName) {
    return chunk.selection.fields.has(fieldName);
}
function resolveFieldNames(chunk) {
    return chunk.selection.fields.keys();
}
function resolveFieldAliases(chunk, fieldName) {
    return chunk.selection.fields.get(fieldName);
}
function resolveFieldEntries(chunk, fieldName) {
    const aliases = resolveFieldAliases(chunk, fieldName);
    if (!aliases?.length) {
        return undefined;
    }
    return aliases.length === 1
        ? getNormalizedField(chunk, aliases[0])
        : aliases.map((alias) => getNormalizedField(chunk, alias));
}
function getNormalizedField(chunk, field) {
    return chunk.selection.normalizedFields?.get(field) ?? field.name;
}
function resolveFieldValue(chunk, fieldEntry) {
    const aliases = resolveMatchingFieldAliases(chunk, fieldEntry) ?? EMPTY_ARRAY;
    if (!aliases.length) {
        // Returning undefined when there is no matching field in the selection
        // vs. MissingFieldValue when field is defined, but value is missing in the chunk source object
        return undefined;
    }
    if (aliases.length === 1) {
        // Fast path for most cases
        return resolveFieldChunk(chunk, aliases[0]);
    }
    const accumulator = CreateValue.createChunkAccumulator();
    for (const fieldInfo of aliases) {
        const fieldValue = resolveFieldChunk(chunk, fieldInfo);
        if (Predicates.isMissingLeafValue(fieldValue)) {
            // skip/include/defer, etc
            continue;
        }
        if (!CreateValue.shouldAggregateChunks(fieldValue)) {
            return fieldValue;
        }
        CreateValue.accumulateChunks(accumulator, fieldValue);
    }
    const value = CreateValue.createValue(accumulator);
    return value === undefined ? exports.leafUndefinedValue : value;
}
function hasFieldEntry(chunk, field) {
    return resolveMatchingFieldAliases(chunk, field).length > 0;
}
function resolveFieldChunk(chunk, field) {
    // Expecting leaf value
    if (!field.selection) {
        // Need to cast because technically "value" could be anything due to custom scalars, i.e. object/scalar/null
        const value = chunk.data[field.dataKey];
        if (value === undefined) {
            // skip/include/defer, missing data, etc
            return exports.leafUndefinedValue;
        }
        // Deleted data with cache.evict / cache.modify
        if (chunk.missingFields?.size && chunk.missingFields.has(field)) {
            return exports.leafDeletedValue;
        }
        if (Predicates.isSourceScalar(value)) {
            return value;
        }
        if (value === null) {
            // TODO:
            //   const error = resolveError(chunk);
            // return error ? createLeafError(error) : null;
            return value;
        }
        if (Array.isArray(value)) {
            return CreateValue.createLeafList(value);
        }
        return CreateValue.createComplexScalarValue(value);
    }
    let parentInfo = chunk.fieldChunks.get(field.dataKey);
    if (!parentInfo) {
        const data = chunk.data[field.dataKey];
        (0, assert_1.assert)(Predicates.isSourceCompositeValue(data, field));
        const fieldChunk = CreateValue.createCompositeValueChunk(chunk.operation, field.selection, data);
        parentInfo = {
            parent: chunk,
            field,
            value: fieldChunk,
        };
        chunk.fieldChunks.set(field.dataKey, parentInfo);
    }
    return parentInfo.value;
}
function resolveMatchingFieldAliases(chunk, fieldEntry) {
    // Note: this is a hot-path optimized for perf
    const aliases = resolveFieldAliases(chunk, Descriptor.getFieldName(fieldEntry)) ??
        EMPTY_ARRAY;
    let matchingAliases = null;
    for (const fieldInfo of aliases) {
        const normalizedEntry = getNormalizedField(chunk, fieldInfo);
        if (!Descriptor.fieldEntriesAreEqual(normalizedEntry, fieldEntry)) {
            continue;
        }
        if (!matchingAliases) {
            matchingAliases = [];
        }
        matchingAliases.push(fieldInfo);
    }
    return matchingAliases?.length !== aliases?.length
        ? matchingAliases ?? EMPTY_ARRAY
        : aliases;
}
function aggregateFieldNames(object) {
    if (!Predicates.isAggregate(object)) {
        return resolveFieldNames(object);
    }
    if (object.chunks.length === 1 && !object.nullChunks?.length) {
        // Fast-path for 99% of cases
        return resolveFieldNames(object.chunks[0]);
    }
    return aggregateFieldChunks(object).keys();
}
function aggregateFieldChunks(object, dedupe = true) {
    if (object.fieldChunksDeduped) {
        return object.fieldChunksDeduped;
    }
    // Perf optimization for the edge case: skipping duplicate chunks inside a single operation
    //  Chunks may be identical here. e.g. `query { chats { id, user { name } } }`
    //  { chats: [{ id: 1, user: { id: "1" }}, { id: 2, user: { id: "1" }} ]}
    //  multiple chats may contain the same user with the same selection
    let previousSelection;
    let previousSource;
    const fieldChunks = new Map();
    for (let index = 0; index < object.chunks.length; index++) {
        const chunk = object.chunks[index];
        if (dedupe &&
            previousSelection &&
            previousSource &&
            chunk.selection === previousSelection &&
            chunk.operation === previousSource) {
            // TODO: do not dedupe chunks containing fields with errors
            continue;
        }
        previousSelection = chunk.selection;
        previousSource = chunk.operation;
        for (const fieldName of resolveFieldNames(chunk)) {
            (0, map_1.accumulate)(fieldChunks, fieldName, chunk);
        }
    }
    object.fieldChunksDeduped = fieldChunks;
    return fieldChunks;
}
function aggregateFieldEntries(object, fieldName) {
    if (fieldName === "__typename") {
        return fieldName;
    }
    if (!Predicates.isAggregate(object)) {
        return resolveFieldEntries(object, fieldName);
    }
    const parentChunks = object.fieldChunksDeduped?.get(fieldName) ?? object.chunks;
    if (parentChunks.length === 1) {
        return resolveFieldEntries(parentChunks[0], fieldName);
    }
    let fieldEntries;
    for (const chunk of parentChunks) {
        const chunkEntries = resolveFieldEntries(chunk, fieldName);
        if (!chunkEntries || fieldEntries === chunkEntries) {
            continue;
        }
        if (!fieldEntries) {
            fieldEntries = chunkEntries;
            continue;
        }
        if (!Array.isArray(fieldEntries)) {
            fieldEntries = !Array.isArray(chunkEntries)
                ? [fieldEntries, chunkEntries]
                : [fieldEntries, ...chunkEntries];
            continue;
        }
        if (!Array.isArray(chunkEntries)) {
            fieldEntries.push(chunkEntries);
        }
        else {
            fieldEntries.push(...chunkEntries);
        }
    }
    return Array.isArray(fieldEntries)
        ? dedupeFieldEntries(fieldEntries)
        : fieldEntries;
}
function aggregateFieldValue(parent, fieldEntry) {
    // Fast path for the most common cases
    if (!parent.isAggregate) {
        return resolveFieldValue(parent, fieldEntry);
    }
    const fieldName = Descriptor.getFieldName(fieldEntry);
    const parentChunks = parent.fieldChunksDeduped?.get(fieldName) ?? parent.chunks;
    if (parentChunks.length === 1 && !parent.nullChunks?.length) {
        return resolveFieldValue(parentChunks[0], fieldEntry);
    }
    const accumulator = CreateValue.createChunkAccumulator();
    let hasField = false;
    let deleted = false;
    let isNull = false;
    for (const parentObjectChunk of parentChunks) {
        const fieldValue = resolveFieldValue(parentObjectChunk, fieldEntry);
        if (fieldValue === undefined) {
            continue;
        }
        if (fieldValue === null) {
            hasField = true;
            isNull = true;
            continue;
        }
        if (Predicates.isMissingValue(fieldValue)) {
            deleted || (deleted = fieldValue.deleted);
            hasField = true;
            continue;
        }
        if (!CreateValue.shouldAggregateChunks(fieldValue)) {
            return fieldValue;
        }
        CreateValue.accumulateChunks(accumulator, fieldValue);
        hasField = true;
    }
    if (!hasField) {
        return undefined;
    }
    const value = CreateValue.createValue(accumulator);
    if (value !== undefined) {
        return value;
    }
    if (isNull) {
        return null;
    }
    return deleted ? exports.leafDeletedValue : exports.leafUndefinedValue;
}
function dedupeFieldEntries(entries) {
    // TODO
    return entries;
}
function resolveListItemChunk(chunk, index) {
    let parentInfo = chunk.itemChunks[index];
    if (!parentInfo) {
        // The following "assert" currently conflicts with "extract" which mixes data from multiple layers
        //   (so the same logical array may contain chunks of different lengths, which is incorrect)
        // TODO: rework the logic in `extract` and then enable this (and tests)
        //   assert(0 <= index && index < chunk.data.length);
        const chunkValue = CreateValue.createCompositeValueChunk(chunk.operation, chunk.possibleSelections, chunk.data[index]);
        parentInfo = {
            value: chunkValue,
            parent: chunk,
            index,
        };
        chunk.itemChunks[index] = parentInfo;
    }
    return parentInfo.value;
}
function aggregateListItemValue(parent, index) {
    if (!Predicates.isAggregate(parent)) {
        // Fast path for the most common case
        return resolveListItemChunk(parent, index);
    }
    const accumulator = CreateValue.createChunkAccumulator();
    for (const chunk of parent.chunks) {
        const itemChunk = resolveListItemChunk(chunk, index);
        CreateValue.accumulateChunks(accumulator, itemChunk);
    }
    const result = CreateValue.createValue(accumulator);
    (0, assert_1.assert)(Predicates.isCompositeValue(result));
    return result;
}
function getFirstSourceValue(value) {
    if (Predicates.isScalarValue(value)) {
        return value;
    }
    if (Predicates.isLeafNull(value)) {
        return null;
    }
    if (Predicates.isCompositeValue(value) ||
        Predicates.isComplexLeafValue(value)) {
        return value.data;
    }
    (0, assert_1.assertNever)(value);
}
