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
exports.createObjectDifference = createObjectDifference;
exports.enqueueField = enqueueField;
exports.dequeueField = dequeueField;
exports.addDirtyField = addDirtyField;
exports.allFieldEntriesComplete = allFieldEntriesComplete;
exports.createCompositeListDifference = createCompositeListDifference;
exports.enqueueListItem = enqueueListItem;
exports.dequeueListItem = dequeueListItem;
exports.addDirtyListItem = addDirtyListItem;
exports.createCompositeValueDifference = createCompositeValueDifference;
exports.getFieldQueue = getFieldQueue;
exports.getFieldEntryQueue = getFieldEntryQueue;
exports.createFieldEntryDifference = createFieldEntryDifference;
exports.getFieldDifference = getFieldDifference;
exports.getListItemDifference = getListItemDifference;
exports.addListItemDifference = addListItemDifference;
exports.addFieldDifference = addFieldDifference;
exports.createReplacement = createReplacement;
exports.createFiller = createFiller;
exports.hasDirtyItems = hasDirtyItems;
exports.isObjectDifference = isObjectDifference;
exports.isCompositeListDifference = isCompositeListDifference;
exports.isReplacement = isReplacement;
exports.isFiller = isFiller;
exports.isDirty = isDirty;
exports.isComplete = isComplete;
exports.hasStructuralChanges = hasStructuralChanges;
const Descriptor = __importStar(require("../descriptor/resolvedSelection"));
const assert_1 = require("../jsutils/assert");
const predicates_1 = require("../values/predicates");
const types_1 = require("../values/types");
const types_2 = require("./types");
const EMPTY_ARRAY = Object.freeze([]);
function createObjectDifference(fieldQueue = null) {
    return {
        kind: types_2.DifferenceKind.ObjectDifference,
        fieldQueue: new Set(fieldQueue),
        fieldState: new Map(),
        dirtyFields: undefined,
        errors: undefined,
    };
}
function enqueueField(diff = createObjectDifference(), fieldName) {
    diff.fieldQueue ?? (diff.fieldQueue = new Set());
    diff.fieldQueue.add(Descriptor.getFieldName(fieldName));
    return diff;
}
function dequeueField(diff, fieldName) {
    if (diff.fieldQueue) {
        diff.fieldQueue.delete(Descriptor.getFieldName(fieldName));
    }
    return diff;
}
function addDirtyField(diff, fieldName) {
    diff.dirtyFields ?? (diff.dirtyFields = new Set());
    diff.dirtyFields.add(Descriptor.getFieldName(fieldName));
}
function allFieldEntriesComplete(diff, fieldName) {
    const fieldDiff = diff.fieldState.get(fieldName);
    if (!fieldDiff) {
        // Field is enqueued, but state is not initialized yet
        return false;
    }
    if (!Array.isArray(fieldDiff)) {
        return isComplete(fieldDiff.state);
    }
    return fieldDiff.every((entryDiff) => isComplete(entryDiff.state));
}
function createCompositeListDifference() {
    return {
        kind: types_2.DifferenceKind.CompositeListDifference,
        itemState: new Map(),
        itemQueue: new Set(),
        dirtyItems: undefined,
        layout: undefined,
        deletedKeys: undefined,
        errors: undefined,
    };
}
function enqueueListItem(diff, index) {
    diff.itemQueue ?? (diff.itemQueue = new Set());
    diff.itemQueue.delete(index);
}
function dequeueListItem(diff, index) {
    if (diff.itemQueue) {
        diff.itemQueue.delete(index);
    }
}
function addDirtyListItem(diff, index) {
    diff.dirtyItems ?? (diff.dirtyItems = new Set());
    diff.dirtyItems.add(index);
}
function createCompositeValueDifference(value) {
    // By default, assuming everything is dirty
    //   only after full diff of a sub-branch we can be sure if it is clean
    switch (value.kind) {
        case types_1.ValueKind.Object:
            return createObjectDifference();
        case types_1.ValueKind.CompositeList:
            return createCompositeListDifference();
        default:
            throw new Error(`InvariantViolation: ${value["kind"]} is not supported value kind`);
    }
}
function getFieldQueue(diff) {
    return diff?.fieldQueue;
}
function getFieldEntryQueue(diff, fieldName) {
    if (!diff?.fieldState) {
        return;
    }
    const fieldDiff = diff.fieldState.get(fieldName);
    if (!fieldDiff) {
        return;
    }
    if (!Array.isArray(fieldDiff)) {
        return isComplete(fieldDiff.state) ? undefined : fieldDiff.fieldEntry;
    }
    const fieldEntryQueue = [];
    for (const entryDiff of fieldDiff) {
        if (!isComplete(entryDiff.state)) {
            fieldEntryQueue.push(entryDiff.fieldEntry);
        }
    }
    return fieldEntryQueue;
}
function createFieldEntryDifference(fieldEntry, state) {
    return {
        kind: types_2.DifferenceKind.FieldEntryDifference,
        fieldEntry,
        state,
    };
}
function getFieldDifference(diff, fieldEntry) {
    if (!diff?.fieldState) {
        return undefined;
    }
    const fieldState = diff.fieldState.get(Descriptor.getFieldName(fieldEntry));
    if (!fieldState) {
        return undefined;
    }
    if (!Array.isArray(fieldState)) {
        return Descriptor.fieldEntriesAreEqual(fieldState.fieldEntry, fieldEntry)
            ? fieldState
            : undefined;
    }
    return fieldState.find((entry) => Descriptor.fieldEntriesAreEqual(entry.fieldEntry, fieldEntry));
}
function getListItemDifference(diff, index) {
    return diff?.itemState.get(index);
}
function addListItemDifference(parent, position, itemDifference) {
    parent.itemState ?? (parent.itemState = new Map());
    parent.itemState.set(position, itemDifference);
    return itemDifference;
}
function addFieldDifference({ fieldState }, fieldEntry, valueDiff) {
    const fieldName = Descriptor.getFieldName(fieldEntry);
    const fieldEntryDiff = createFieldEntryDifference(fieldEntry, valueDiff);
    const existingFieldEntries = fieldState.get(fieldName);
    if (!existingFieldEntries) {
        fieldState.set(fieldName, fieldEntryDiff);
        return fieldEntryDiff;
    }
    if (!Array.isArray(existingFieldEntries)) {
        fieldState.set(fieldName, [existingFieldEntries, fieldEntryDiff]);
        return fieldEntryDiff;
    }
    existingFieldEntries.push(fieldEntryDiff);
    return fieldEntryDiff;
}
function createReplacement(oldValue, newValue) {
    // Caveat:
    //   Lists and objects can be safely replaced _only_ if selectionSets of oldValue and newValue fully match
    //   In all other cases additional reading of oldValue's selectionSet from newValue is necessary.
    //   Such "reading" is a complicated process (may return partial results, contain type-specific logic, stateful logic, etc)
    //   So it is **out of scope** of diffing and instead should occur when applying differences
    return {
        kind: types_2.DifferenceKind.Replacement,
        oldValue,
        newValue,
    };
}
function createFiller(newValue) {
    return {
        kind: types_2.DifferenceKind.Filler,
        newValue,
    };
}
function hasDirtyItems(value) {
    return Boolean(value.dirtyItems?.size);
}
function isObjectDifference(state) {
    return state?.kind === types_2.DifferenceKind.ObjectDifference;
}
function isCompositeListDifference(state) {
    return state?.kind === types_2.DifferenceKind.CompositeListDifference;
}
function isReplacement(state) {
    return state?.kind === types_2.DifferenceKind.Replacement;
}
function isFiller(state) {
    return state?.kind === types_2.DifferenceKind.Filler;
}
function isDirty(value) {
    switch (value.kind) {
        case types_2.DifferenceKind.Replacement:
            return true;
        case types_2.DifferenceKind.Filler:
            return true;
        case types_2.DifferenceKind.ObjectDifference:
            return Boolean(value.dirtyFields?.size);
        case types_2.DifferenceKind.CompositeListDifference:
            return Boolean(value.dirtyItems?.size) || Boolean(value.layout);
        default:
            (0, assert_1.assertNever)(value);
    }
}
function isComplete(value) {
    switch (value.kind) {
        case types_2.DifferenceKind.Replacement:
            return true;
        case types_2.DifferenceKind.Filler:
            return true;
        case types_2.DifferenceKind.FieldEntryDifference:
            return isComplete(value.state);
        case types_2.DifferenceKind.ObjectDifference:
            return value.fieldQueue.size === 0;
        case types_2.DifferenceKind.CompositeListDifference:
            return value.itemQueue.size === 0;
        default:
            (0, assert_1.assertNever)(value);
    }
}
function hasStructuralChanges(diff) {
    if (!diff) {
        return false;
    }
    switch (diff.kind) {
        case types_2.DifferenceKind.Filler:
            return true;
        case types_2.DifferenceKind.Replacement:
            return (0, predicates_1.isCompositeValue)(diff.newValue);
        case types_2.DifferenceKind.CompositeListDifference:
            return Boolean(diff.layout?.some((item) => typeof item === "object" && item !== null) ||
                [...(diff.dirtyItems ?? EMPTY_ARRAY)].some((index) => hasStructuralChanges(diff.itemState.get(index))));
        case types_2.DifferenceKind.ObjectDifference:
            return Boolean([...(diff.dirtyFields ?? EMPTY_ARRAY)].some((fieldName) => fieldHasStructuralChanges(diff.fieldState.get(fieldName))));
        default:
            (0, assert_1.assertNever)(diff);
    }
}
function fieldHasStructuralChanges(fieldDiff) {
    if (!fieldDiff) {
        return false;
    }
    if (!Array.isArray(fieldDiff)) {
        return hasStructuralChanges(fieldDiff.state);
    }
    return fieldDiff.some((entry) => hasStructuralChanges(entry.state));
}
