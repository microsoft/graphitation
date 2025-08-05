"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAsPartial = markAsPartial;
exports.deleteField = deleteField;
exports.deleteListItem = deleteListItem;
exports.hasDeletedField = hasDeletedField;
const assert_1 = require("../jsutils/assert");
const predicates_1 = require("./predicates");
const create_1 = require("./create");
const resolve_1 = require("./resolve");
function markAsPartial(env, ref) {
    var _a, _b, _c, _d;
    if (!ref || (0, predicates_1.isRootRef)(ref)) {
        return;
    }
    if ((0, predicates_1.isParentObjectRef)(ref)) {
        const { parent, field } = ref;
        if ((_a = parent.partialFields) === null || _a === void 0 ? void 0 : _a.has(field)) {
            return;
        }
        (_b = parent.partialFields) !== null && _b !== void 0 ? _b : (parent.partialFields = new Set());
        parent.partialFields.add(field);
        const parentRef = env.findParent(parent);
        markAsPartial(env, parentRef || null);
        return;
    }
    if ((0, predicates_1.isParentListRef)(ref)) {
        const { parent, index } = ref;
        if ((_c = parent.partialItems) === null || _c === void 0 ? void 0 : _c.has(index)) {
            return;
        }
        (_d = parent.partialItems) !== null && _d !== void 0 ? _d : (parent.partialItems = new Set());
        parent.partialItems.add(index);
        const parentRef = env.findParent(parent);
        markAsPartial(env, parentRef || null);
        return;
    }
    (0, assert_1.assertNever)(ref);
}
function deleteField(env, chunk, fieldInfo) {
    var _a, _b, _c;
    const chunkRef = env.findParent(chunk);
    const hasField = (_a = chunk.selection.fields
        .get(fieldInfo.name)) === null || _a === void 0 ? void 0 : _a.some((field) => field === fieldInfo);
    if (!hasField || ((_b = chunk.missingFields) === null || _b === void 0 ? void 0 : _b.has(fieldInfo))) {
        return false;
    }
    // ApolloCompat: cache.modify allows to "delete" field values
    // TODO: remove DELETE support for cache modify and the whole "missing fields" / "missing items" notion
    //   instead we should always have all fields in place, but some of them should be marked as "stale" to
    //   indicate that they shouldn't be used for diffing and should be re-fetched from the server when possible
    (_c = chunk.missingFields) !== null && _c !== void 0 ? _c : (chunk.missingFields = new Set());
    chunk.missingFields.add(fieldInfo);
    if (fieldInfo.selection) {
        const parentInfo = {
            value: (0, create_1.createCompositeUndefinedChunk)(chunk.operation, fieldInfo.selection, true),
            parent: chunk,
            field: fieldInfo,
        };
        chunk.fieldChunks.set(fieldInfo.dataKey, parentInfo);
    }
    markAsPartial(env, chunkRef);
    // Note: not mutating the source value on purpose, because it could be used by product code,
    //   instead just marking this value as "missing"
    // chunk.source[fieldInfo.dataKey] = undefined;
    return true;
}
function deleteListItem(env, chunk, index) {
    var _a, _b;
    if (index >= chunk.data.length || ((_a = chunk.missingItems) === null || _a === void 0 ? void 0 : _a.has(index))) {
        return false;
    }
    const chunkRef = env.findParent(chunk);
    (_b = chunk.missingItems) !== null && _b !== void 0 ? _b : (chunk.missingItems = new Set());
    chunk.missingItems.add(index);
    chunk.itemChunks[index] = {
        value: (0, create_1.createCompositeUndefinedChunk)(chunk.operation, chunk.possibleSelections, true),
        parent: chunk,
        index,
    };
    markAsPartial(env, chunkRef);
    // Note: not mutating the source value on purpose, because it could be used by product code,
    //   instead just marking this value as "missing"
    // chunk.source[index] = undefined;
    return true;
}
function hasDeletedField(chunk) {
    var _a;
    if (!((_a = chunk.missingFields) === null || _a === void 0 ? void 0 : _a.size)) {
        return false;
    }
    for (const field of chunk.missingFields) {
        const fieldValue = (0, resolve_1.resolveFieldChunk)(chunk, field);
        if ((0, predicates_1.isDeletedValue)(fieldValue)) {
            return true;
        }
    }
    return false;
}
