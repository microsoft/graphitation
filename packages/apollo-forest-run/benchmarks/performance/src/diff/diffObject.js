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
exports.diffObject = diffObject;
exports.diffValue = diffValue;
/* eslint-disable */
const lodash_1 = require("lodash");
const assert_1 = require("../jsutils/assert");
const Value = __importStar(require("../values"));
const Difference = __importStar(require("./difference"));
const types_1 = require("./types");
const types_2 = require("../values/types");
/**
 * Compares base object version with model version and returns a normalized Difference object,
 * describing how to update base object to the same state as a model.
 *
 * The same normalized difference could be used to update different representations of the same graph node,
 * existing in different operations.
 */
function diffObject(base, model, env, state = { difference: undefined }) {
    let { errors, difference } = state;
    const context = createDiffContext(env);
    difference = diffPlainObjectValue(context, base, model, difference);
    if (context.errors?.length) {
        if (!errors?.length) {
            errors = context.errors;
        }
        else {
            errors.push(...context.errors);
        }
    }
    state.errors = errors;
    state.difference = difference;
    return state;
}
function diffValue(env, base, model, state) {
    const context = createDiffContext(env);
    const difference = Value.isMissingValue(base) || Value.isMissingValue(model)
        ? diffMissingValue(context, base, model, state)
        : diffValueInternal(context, base, model, state);
    if (Difference.isObjectDifference(difference) ||
        Difference.isCompositeListDifference(difference)) {
        difference.errors = Value.isMissingValue(model)
            ? [{ kind: types_1.DiffErrorKind.MissingModelValue }, ...(context.errors ?? [])]
            : context.errors;
    }
    return difference;
}
function diffObjectValue(context, base, model, diff) {
    if (base.data.__typename !== model.data.__typename) {
        return Difference.createReplacement(base, model);
    }
    return model.key !== false
        ? diffCustomObjectValue(context, base, model, diff)
        : diffPlainObjectValue(context, base, model, diff);
}
function diffCustomObjectValue(context, base, model, diff) {
    // Think edges, connections, nodes, etc
    // Assuming base and model contain object of the same type and same key
    const modelKey = model.key;
    const baseKey = base.key;
    if (modelKey !== baseKey) {
        return Difference.createReplacement(base, model);
    }
    return diff;
}
function diffPlainObjectValue(context, base, model, diff) {
    if (Value.isAggregate(base)) {
        // Diffing individual chunks using state is faster than diffing aggregated value for the majority of scenarios
        for (const chunk of base.chunks) {
            if (diff && Difference.isComplete(diff)) {
                break;
            }
            diff = diffObjectChunk(context, chunk, model, diff);
        }
    }
    else if (!diff || !Difference.isComplete(diff)) {
        diff = diffObjectChunk(context, base, model, diff);
    }
    return diff && (Difference.isDirty(diff) || !Difference.isComplete(diff))
        ? diff
        : undefined;
}
function diffObjectChunk(context, base, model, diff) {
    if (base.data === model.data &&
        (!Value.isAggregate(model) || model.chunks.length === 1)) {
        return diff;
    }
    const fieldQueue = Difference.getFieldQueue(diff) ?? Value.aggregateFieldNames(model);
    for (const fieldName of fieldQueue) {
        if (!Value.hasField(base, fieldName)) {
            diff = Difference.enqueueField(diff, fieldName);
            continue;
        }
        // Note: there could be multiple entries of the same field name with different arguments (and different aliases)
        const fieldEntries = Difference.getFieldEntryQueue(diff, fieldName) ??
            Value.aggregateFieldEntries(model, fieldName);
        (0, assert_1.assert)(fieldEntries);
        if (!Array.isArray(fieldEntries)) {
            diff = diffFieldEntry(context, base, model, fieldEntries, diff);
        }
        else {
            for (const fieldEntry of fieldEntries) {
                diff = diffFieldEntry(context, base, model, fieldEntry, diff);
            }
        }
        if (!diff) {
            continue;
        }
        if (Difference.allFieldEntriesComplete(diff, fieldName)) {
            Difference.dequeueField(diff, fieldName);
        }
        else {
            Difference.enqueueField(diff, fieldName);
        }
    }
    return diff;
}
function diffFieldEntry(context, base, model, fieldEntry, parentObjectDiff) {
    const baseValue = Value.resolveFieldValue(base, fieldEntry);
    if (baseValue === undefined) {
        // There is no such field entry in base chunk's selection (legit miss)
        return Difference.enqueueField(parentObjectDiff, fieldEntry);
    }
    const currentDiff = Difference.getFieldDifference(parentObjectDiff, fieldEntry);
    if (currentDiff && Difference.isComplete(currentDiff)) {
        return parentObjectDiff;
    }
    const modelValue = Value.aggregateFieldValue(model, fieldEntry);
    if (modelValue === baseValue) {
        return parentObjectDiff;
    }
    // Special case for non-compliant GraphQL servers, which return `null` for @skip
    if ((modelValue === null ||
        (typeof modelValue === "object" &&
            modelValue.kind === types_2.ValueKind.CompositeNull)) &&
        shouldSkipObjectField(model, fieldEntry)) {
        return parentObjectDiff;
    }
    (0, assert_1.assert)(modelValue !== undefined);
    const valueDifference = Value.isMissingValue(baseValue) || Value.isMissingValue(modelValue)
        ? diffMissingFieldValues(context, base, model, fieldEntry, baseValue, modelValue, parentObjectDiff, currentDiff?.state)
        : diffValueInternal(context, baseValue, modelValue, currentDiff?.state);
    if (!valueDifference) {
        return parentObjectDiff;
    }
    parentObjectDiff = parentObjectDiff ?? Difference.createObjectDifference();
    if (!Difference.isComplete(valueDifference)) {
        Difference.enqueueField(parentObjectDiff, fieldEntry);
    }
    if (Difference.isDirty(valueDifference)) {
        Difference.addDirtyField(parentObjectDiff, fieldEntry);
    }
    if (!currentDiff) {
        Difference.addFieldDifference(parentObjectDiff, fieldEntry, valueDifference);
    }
    return parentObjectDiff;
}
function diffMissingFieldValues(context, baseParent, modelParent, fieldEntry, base, model, parentObjectDiff, fieldDiff) {
    let baseMissing = Value.isMissingValue(base);
    let modelMissing = Value.isMissingValue(model);
    if (baseMissing && shouldSkipChunkField(baseParent, fieldEntry)) {
        // Expected miss: try other chunks
        Difference.enqueueField(parentObjectDiff, fieldEntry);
        baseMissing = false;
    }
    if (modelMissing && shouldSkipObjectField(modelParent, fieldEntry)) {
        // Expected miss
        modelMissing = false;
    }
    // Process "real" unexpected misses
    if (baseMissing) {
        addMissingBaseFieldError(context, baseParent, fieldEntry);
    }
    if (modelMissing) {
        addMissingModelFieldError(context, modelParent, fieldEntry);
    }
    return diffMissingValue(context, base, model, fieldDiff);
}
function diffMissingValue(context, base, model, currentDiff) {
    const baseMissing = Value.isMissingValue(base);
    const modelMissing = Value.isMissingValue(model);
    if (baseMissing && !modelMissing) {
        return Difference.createFiller(model);
    }
    if (!baseMissing && modelMissing) {
        return context.env.allowMissingFields
            ? Difference.createReplacement(base, model)
            : currentDiff;
    }
    // Same undefined value
    return currentDiff;
}
function diffValueInternal(context, base, model, currentDiff) {
    if (model === base) {
        return;
    }
    if (Value.isScalarValue(base)) {
        (0, assert_1.assert)(!currentDiff);
        (0, assert_1.assert)(Value.isScalarValue(model) ||
            Value.isComplexScalarValue(model) ||
            Value.isLeafNull(model));
        return model === base
            ? undefined
            : Difference.createReplacement(base, model);
    }
    if (Value.isLeafNull(base) || Value.isLeafErrorValue(base)) {
        (0, assert_1.assert)(!currentDiff);
        (0, assert_1.assert)(Value.isScalarValue(model) ||
            Value.isLeafNull(model) ||
            Value.isLeafListValue(model) ||
            Value.isLeafErrorValue(model) ||
            Value.isComplexScalarValue(model));
        return model === base
            ? undefined
            : Difference.createReplacement(base, model);
    }
    switch (base.kind) {
        case types_2.ValueKind.CompositeNull: {
            (0, assert_1.assert)(!currentDiff);
            (0, assert_1.assert)(Value.isCompositeValue(model));
            return Value.isCompositeNullValue(model)
                ? undefined
                : Difference.createReplacement(base, model);
        }
        case types_2.ValueKind.Object: {
            (0, assert_1.assert)(!currentDiff || Difference.isObjectDifference(currentDiff));
            (0, assert_1.assert)(Value.isObjectValue(model) || Value.isCompositeNullValue(model));
            return Value.isCompositeNullValue(model)
                ? Difference.createReplacement(base, model)
                : diffObjectValue(context, base, model, currentDiff);
        }
        case types_2.ValueKind.LeafList: {
            (0, assert_1.assert)(!currentDiff);
            (0, assert_1.assert)(Value.isLeafListValue(model) || Value.isLeafNull(model));
            return Value.isLeafNull(model)
                ? Difference.createReplacement(base, model)
                : diffLeafListValue(context, base, model);
        }
        case types_2.ValueKind.CompositeList: {
            (0, assert_1.assert)(!currentDiff || Difference.isCompositeListDifference(currentDiff));
            (0, assert_1.assert)(Value.isCompositeListValue(model) || Value.isCompositeNullValue(model));
            return Value.isCompositeNullValue(model)
                ? Difference.createReplacement(base, model)
                : diffCompositeListValue(context, base, model, currentDiff);
        }
        case types_2.ValueKind.ComplexScalar: {
            (0, assert_1.assert)(!currentDiff);
            (0, assert_1.assert)(Value.isComplexScalarValue(model) ||
                Value.isScalarValue(model) ||
                Value.isLeafNull(model));
            if (Value.isLeafNull(model) ||
                Value.isScalarValue(model) ||
                (Value.isComplexScalarValue(model) && !(0, lodash_1.isEqual)(base.data, model.data))) {
                return Difference.createReplacement(base, model);
            }
            return undefined;
        }
        default: {
            // Missing values are diffed separately
            (0, assert_1.assert)(!Value.isMissingValue(base) &&
                !Value.isMissingValue(model) &&
                !Value.isLeafValue(model) &&
                !Value.isLeafListValue(model) &&
                !Value.isCompositeValue(model));
            (0, assert_1.assertNever)(base, model);
        }
    }
}
function diffLeafListValue(context, base, model) {
    if (model.data.length !== base.data.length ||
        model.data.some((item, index) => !(0, lodash_1.isEqual)(item, base.data[index]))) {
        return Difference.createReplacement(base, model);
    }
}
function diffCompositeListValue(context, base, model, diff) {
    if (model.data.length === 0 && base.data.length === 0) {
        return undefined;
    }
    const layoutDiffResult = diff?.layout ?? diffCompositeListLayout(context, base, model);
    if (layoutDiffResult === "BREAK") {
        // Fast-path, no further diffing necessary
        return;
    }
    const itemQueue = diff?.itemQueue ?? model.data.keys();
    if (layoutDiffResult) {
        diff = diff ?? Difference.createCompositeListDifference();
        diff.layout = layoutDiffResult;
    }
    for (const index of itemQueue) {
        const baseItemIndex = layoutDiffResult ? layoutDiffResult[index] : index;
        const baseItemValue = typeof baseItemIndex === "number"
            ? Value.aggregateListItemValue(base, baseItemIndex)
            : undefined;
        if (!baseItemValue) {
            continue;
        }
        const modelItemValue = Value.aggregateListItemValue(model, index);
        (0, assert_1.assert)(modelItemValue);
        (0, assert_1.assert)(baseItemValue);
        const itemDiff = diffValueInternal(context, baseItemValue, modelItemValue, diff?.itemState?.get(index));
        if (itemDiff) {
            diff = diff ?? Difference.createCompositeListDifference();
            if (!Difference.isComplete(itemDiff)) {
                Difference.enqueueListItem(diff, index);
            }
            if (Difference.isDirty(itemDiff)) {
                Difference.addDirtyListItem(diff, index);
            }
            Difference.addListItemDifference(diff, index, itemDiff);
        }
        if ((!itemDiff || Difference.isComplete(itemDiff)) && diff) {
            Difference.dequeueListItem(diff, index);
        }
    }
    return diff && (Difference.isDirty(diff) || !Difference.isComplete(diff))
        ? diff
        : undefined;
}
function diffCompositeListLayout(context, base, model) {
    // What constitutes layout change?
    // - Change of "keyed object" position in the list
    // - Change of list length
    const env = context.env;
    const baseLen = base.data.length;
    const modelLen = model.data.length;
    const baseChunk = Value.isAggregate(base) ? base.chunks[0] : base;
    const modelChunk = Value.isAggregate(model) ? model.chunks[0] : model;
    let itemDiffRequired = false;
    let firstDirtyIndex = -1;
    for (let i = 0; i < modelLen; i++) {
        if (i >= baseLen) {
            firstDirtyIndex = i;
            break;
        }
        const baseKey = resolveItemKey(env, baseChunk, i);
        const modelKey = resolveItemKey(env, modelChunk, i);
        if (modelKey === false && modelChunk.data[i] !== null) {
            itemDiffRequired = true;
        }
        if (baseKey !== modelKey) {
            firstDirtyIndex = i;
            break;
        }
    }
    // Fast-path: no layout difference found
    if (firstDirtyIndex === -1) {
        if (baseLen > modelLen) {
            const layout = [];
            for (let i = 0; i < modelLen; i++) {
                layout.push(i);
            }
            return layout;
        }
        return !itemDiffRequired ? "BREAK" : undefined;
    }
    // TODO: lastDirtyIndex to isolate changed segment (prepend case)
    const layout = [];
    for (let i = 0; i < firstDirtyIndex; i++) {
        layout.push(i);
    }
    let plainObjectLookupStartIndex = firstDirtyIndex;
    for (let i = firstDirtyIndex; i < modelLen; i++) {
        if (modelChunk.data[i] === null) {
            layout.push(null);
            continue;
        }
        const modelKey = resolveItemKey(env, modelChunk, i);
        const lookupStartIndex = modelKey === false ? plainObjectLookupStartIndex : 0; // TODO: should be firstDirtyIndex; (0 is necessary only for cases when array contains duplicates - we should detect such arrays when indexing and special-case it instead)
        const baseIndex = findKeyIndex(env, baseChunk, modelKey, lookupStartIndex);
        if (baseIndex !== -1) {
            layout.push(baseIndex);
        }
        else {
            const value = Value.aggregateListItemValue(model, i);
            if (Value.isCompositeNullValue(value)) {
                layout.push(null);
            }
            else if (Value.isCompositeListValue(value) ||
                Value.isObjectValue(value)) {
                layout.push(value);
            }
            else {
                throw new Error(`Unexpected list item value at index #${i}\n` +
                    `  original list: ${JSON.stringify(model.data)}`);
            }
        }
    }
    return layout;
}
function resolveItemKey(env, listChunk, index) {
    const listItemChunk = Value.resolveListItemChunk(listChunk, index);
    let key;
    if (Value.isObjectValue(listItemChunk)) {
        key = listItemChunk.key;
        if (key === false && env.listItemKey) {
            key = env.listItemKey(listItemChunk.data, index);
        }
    }
    return key ?? false;
}
function findKeyIndex(env, listChunk, key, startIndex = 0, stopIndex = listChunk.data.length) {
    for (let i = startIndex; i < stopIndex; i++) {
        const itemKey = resolveItemKey(env, listChunk, i);
        if (itemKey === key) {
            return i;
        }
    }
    return -1;
}
function createDiffContext(env) {
    return { env, errors: undefined };
}
function shouldSkipObjectField(base, fieldEntry) {
    return Value.isAggregate(base)
        ? base.chunks.every((chunk) => shouldSkipChunkField(chunk, fieldEntry))
        : shouldSkipChunkField(base, fieldEntry);
}
function shouldSkipChunkField(base, fieldEntry) {
    const matchingEntries = Value.resolveMatchingFieldAliases(base, fieldEntry);
    return matchingEntries?.every((field) => base.selection.skippedFields?.has(field));
}
function addMissingChunkFieldError(context, chunk, field, isModelChunk) {
    const fieldInfo = Value.resolveMatchingFieldAliases(chunk, field);
    const kind = isModelChunk
        ? types_1.DiffErrorKind.MissingModelFields
        : types_1.DiffErrorKind.MissingBaseFields;
    context.errors || (context.errors = []);
    const existing = context.errors.find((e) => e.kind === kind && e.chunk === chunk);
    const error = existing ?? { kind, chunk, missingFields: [] };
    if (!existing) {
        context.errors.push(error);
    }
    for (const field of fieldInfo) {
        error.missingFields.push(field);
    }
}
function addMissingBaseFieldError(context, chunk, field) {
    return addMissingChunkFieldError(context, chunk, field, false);
}
function addMissingModelFieldError(context, model, field) {
    if (!Value.isAggregate(model)) {
        addMissingChunkFieldError(context, model, field, true);
        return;
    }
    for (const chunk of model.chunks) {
        addMissingChunkFieldError(context, chunk, field, true);
    }
}
