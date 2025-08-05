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
exports.updateObject = updateObject;
const Difference = __importStar(require("../diff/difference"));
const Value = __importStar(require("../values"));
const types_1 = require("../values/types");
const types_2 = require("../diff/types");
const assert_1 = require("../jsutils/assert");
const resolvedSelection_1 = require("../descriptor/resolvedSelection");
const EMPTY_ARRAY = Object.freeze([]);
const inspect = JSON.stringify.bind(JSON);
function updateObject(context, base, diff) {
    const draft = updateObjectValue(context, base, diff);
    return draft && draft !== base.data
        ? {
            draft,
            missingFields: context.missingFields,
        }
        : undefined;
}
function updateObjectValue(context, base, difference) {
    var _a, _b, _c, _d, _e, _f;
    if (!((_a = difference.dirtyFields) === null || _a === void 0 ? void 0 : _a.size)) {
        return undefined;
    }
    let copy = context.drafts.get(base.data);
    (0, assert_1.assert)(!Array.isArray(copy));
    (_b = context.statsLogger) === null || _b === void 0 ? void 0 : _b.copyChunkStats(base, copy);
    let dirtyFields;
    for (const fieldName of difference.dirtyFields) {
        const aliases = base.selection.fields.get(fieldName);
        for (const fieldInfo of aliases !== null && aliases !== void 0 ? aliases : EMPTY_ARRAY) {
            if ((_c = base.selection.skippedFields) === null || _c === void 0 ? void 0 : _c.has(fieldInfo)) {
                continue;
            }
            const fieldEntry = (0, resolvedSelection_1.resolveNormalizedField)(base.selection, fieldInfo);
            const fieldDifference = Difference.getFieldDifference(difference, fieldEntry);
            if (!fieldDifference) {
                continue;
            }
            const fieldDiff = fieldDifference.state;
            const value = Value.resolveFieldChunk(base, fieldInfo);
            const valueIsMissing = Value.isMissingValue(value);
            if (valueIsMissing && !Difference.isFiller(fieldDiff)) {
                // Inconsistent state - do not update this field
                //   (assuming it will be re-fetched from the server to resolve inconsistency)
                (_d = context.logger) === null || _d === void 0 ? void 0 : _d.debug(base.operation.debugName +
                    ` is in inconsistent state at path ` +
                    Value.getDataPathForDebugging(context, base)
                        .concat(fieldName)
                        .join("."));
                continue;
            }
            const updated = updateValue(context, value, fieldDiff);
            if (valueIsMissing && updated !== undefined) {
                (_e = context.missingFields.get(base.data)) === null || _e === void 0 ? void 0 : _e.delete(fieldInfo);
            }
            if (updated === getSourceValue(value)) {
                continue;
            }
            if (!copy) {
                copy = { ...base.data };
                context.drafts.set(base.data, copy);
            }
            (_f = context.statsLogger) === null || _f === void 0 ? void 0 : _f.fieldMutation();
            copy[fieldInfo.dataKey] = updated;
            // Record immediately mutated fields (ignore changes caused by nested chunk mutations)
            if (fieldDiff.kind === types_2.DifferenceKind.Replacement ||
                fieldDiff.kind === types_2.DifferenceKind.Filler) {
                dirtyFields !== null && dirtyFields !== void 0 ? dirtyFields : (dirtyFields = []);
                dirtyFields.push(fieldInfo);
            }
        }
    }
    if (dirtyFields === null || dirtyFields === void 0 ? void 0 : dirtyFields.length) {
        context.changes.set(base, dirtyFields);
    }
    return copy !== null && copy !== void 0 ? copy : base.data;
}
function updateValue(context, base, difference) {
    switch (difference.kind) {
        case types_2.DifferenceKind.Replacement:
            return replaceValue(context, base, difference.newValue);
        case types_2.DifferenceKind.ObjectDifference: {
            (0, assert_1.assert)(Value.isObjectValue(base));
            return updateObjectValue(context, base, difference);
        }
        case types_2.DifferenceKind.CompositeListDifference: {
            (0, assert_1.assert)(Value.isCompositeListValue(base));
            return updateCompositeListValue(context, base, difference);
        }
        case types_2.DifferenceKind.Filler: {
            // defer/missing fields/etc
            const value = difference.newValue !== undefined
                ? replaceValue(context, base, difference.newValue)
                : undefined;
            return value;
        }
        default:
            (0, assert_1.assertNever)(difference);
    }
}
function updateCompositeListValue(context, base, difference) {
    var _a, _b, _c, _d;
    if (!Difference.hasDirtyItems(difference) && !difference.layout) {
        return undefined;
    }
    const { drafts, operation, statsLogger } = context;
    const layoutDiff = difference.layout;
    let dirty = false; // Only dirty on self changes - item replacement/filler, layout changes (ignores child changes)
    let copy = drafts.get(base.data);
    (0, assert_1.assert)(Array.isArray(copy) || copy === undefined);
    statsLogger === null || statsLogger === void 0 ? void 0 : statsLogger.copyChunkStats(base, copy);
    // Applying item changes _before_ layout changes (i.e. before item paths change)
    for (const index of (_a = difference.dirtyItems) !== null && _a !== void 0 ? _a : EMPTY_ARRAY) {
        const itemDiff = Difference.getListItemDifference(difference, index);
        (0, assert_1.assert)(itemDiff);
        const updatedValue = updateValue(context, Value.resolveListItemChunk(base, index), itemDiff);
        if (updatedValue === base.data[index]) {
            continue;
        }
        if (!copy) {
            copy = [...base.data];
            drafts.set(base.data, copy);
        }
        copy[index] = updatedValue;
        statsLogger === null || statsLogger === void 0 ? void 0 : statsLogger.itemMutation();
        drafts.set(base.data[index], updatedValue);
        if (itemDiff.kind === types_2.DifferenceKind.Replacement ||
            itemDiff.kind === types_2.DifferenceKind.Filler) {
            dirty = true;
        }
    }
    if (dirty) {
        context.changes.set(base, null);
    }
    if (!layoutDiff) {
        return copy !== null && copy !== void 0 ? copy : base.data;
    }
    if (!copy) {
        // Placeholder until layout is updated
        copy = [];
        drafts.set(base.data, copy);
    }
    // Update list layout.
    //   This logic assumes that list layout is updated _after_ any self and child object updates
    //   (because this will change "paths" of any child objects within the modified operation result)
    const length = layoutDiff.length;
    const result = new Array(length);
    for (let i = 0; i < length; i++) {
        const itemRef = layoutDiff[i];
        if (itemRef !== i) {
            dirty = true;
        }
        if (typeof itemRef === "number") {
            result[i] =
                (_b = drafts.get(base.data[itemRef])) !== null && _b !== void 0 ? _b : base.data[itemRef];
            continue;
        }
        if (itemRef === null) {
            result[i] = null;
            continue;
        }
        if (Value.isObjectValue(itemRef)) {
            const newValue = context.completeObject(itemRef, base.possibleSelections, operation);
            (0, assert_1.assert)(newValue.data);
            accumulateMissingFields(context, newValue);
            result[i] = newValue.data;
            continue;
        }
        const op = (_c = operation.definition.name) === null || _c === void 0 ? void 0 : _c.value;
        (_d = context.logger) === null || _d === void 0 ? void 0 : _d.warn(`Unknown list item kind: ${itemRef.kind} at #${i}\n` +
            `  source list: ${inspect(base.data)})` +
            `  operation: ${op}\n`);
        result.length = 0;
        result.push(...base.data);
        break;
    }
    if (copy) {
        for (let i = 0; i < result.length; i++) {
            copy[i] = result[i];
        }
        copy.length = result.length;
    }
    else {
        drafts.set(base.data, result);
    }
    if (copy.length !== base.data.length) {
        dirty = true;
    }
    if (dirty) {
        context.changes.set(base, null);
    }
    return copy !== null && copy !== void 0 ? copy : base.data;
}
function replaceValue(context, base, replacement) {
    if (Value.isScalarValue(replacement)) {
        return replacement;
    }
    if (Value.isLeafNull(replacement)) {
        return null;
    }
    switch (replacement.kind) {
        case types_1.ValueKind.Object: {
            (0, assert_1.assert)(Value.isCompositeValue(base));
            return replaceObject(context, replacement, base.possibleSelections);
        }
        case types_1.ValueKind.CompositeList: {
            (0, assert_1.assert)(Value.isCompositeListValue(base) ||
                Value.isCompositeNullValue(base) ||
                Value.isCompositeUndefinedValue(base));
            return replaceCompositeList(context, base, replacement);
        }
        case types_1.ValueKind.CompositeNull:
        case types_1.ValueKind.LeafError:
            return null;
        case types_1.ValueKind.LeafList: {
            return replacement.data;
        }
        case types_1.ValueKind.ComplexScalar:
        case types_1.ValueKind.LeafUndefined:
        case types_1.ValueKind.CompositeUndefined:
            return replacement.data;
        default:
            (0, assert_1.assertNever)(replacement);
    }
}
function replaceObject(context, replacement, possibleSelections) {
    let fullMatch;
    let missingFields = null;
    if (!replacement.isAggregate) {
        if (replacement.possibleSelections === possibleSelections) {
            fullMatch = replacement.data;
            missingFields = replacement.missingFields;
        }
    }
    else {
        for (const item of replacement.chunks) {
            if (item.possibleSelections === possibleSelections) {
                fullMatch = item.data;
                missingFields = item.missingFields;
            }
        }
    }
    if (fullMatch) {
        if (missingFields === null || missingFields === void 0 ? void 0 : missingFields.size) {
            context.missingFields.set(fullMatch, missingFields);
        }
        return fullMatch;
    }
    const newValue = context.completeObject(replacement, possibleSelections, context.operation);
    (0, assert_1.assert)(newValue.data);
    accumulateMissingFields(context, newValue);
    return newValue.data;
}
function replaceCompositeList(context, baseList, newList) {
    var _a, _b;
    const len = newList.data.length;
    const result = new Array(len);
    for (let i = 0; i < len; i++) {
        const item = Value.aggregateListItemValue(newList, i);
        if (!Value.isCompositeValue(item) || Value.isMissingValue(item)) {
            (_a = context.logger) === null || _a === void 0 ? void 0 : _a.warn(`Failed list item #${i} replacement, returning source list\n` +
                `  new list: ${inspect(newList.data)}\n` +
                `  source list: ${inspect(baseList.data)}\n` +
                `  operation: ${(_b = context.operation.definition.name) === null || _b === void 0 ? void 0 : _b.value}`);
            return undefined;
        }
        if (Value.isCompositeNullValue(item)) {
            result[i] = item.data;
            continue;
        }
        if (Value.isCompositeListValue(item)) {
            // Note: we mostly care about baseList selection, so it's safe to pass "as is"
            const value = replaceCompositeList(context, baseList, item);
            if (value === undefined) {
                return undefined;
            }
            result[i] = value;
            continue;
        }
        if (Value.isObjectValue(item)) {
            result[i] = replaceObject(context, item, baseList.possibleSelections);
            continue;
        }
        (0, assert_1.assertNever)(item);
    }
    return result;
}
function accumulateMissingFields(context, value) {
    var _a;
    if ((_a = value.missingFields) === null || _a === void 0 ? void 0 : _a.size) {
        for (const [source, missingFields] of value.missingFields.entries()) {
            context.missingFields.set(source, missingFields);
        }
    }
}
function getSourceValue(chunk) {
    if (typeof chunk !== "object" || chunk == null) {
        return chunk;
    }
    return chunk.data;
}
