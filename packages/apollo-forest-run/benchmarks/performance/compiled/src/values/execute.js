"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SKIP = void 0;
exports.completeValue = completeValue;
exports.execute = execute;
const assert_1 = require("../jsutils/assert");
const addTypenameToDocument_1 = require("../descriptor/addTypenameToDocument");
const resolvedSelection_1 = require("../descriptor/resolvedSelection");
const predicates_1 = require("./predicates");
exports.SKIP = {};
const EMPTY_ARRAY = Object.freeze([]);
const valueContainer = { value: EMPTY_ARRAY };
const ROOT_TYPES = ["Query", "Subscription", "Mutation"];
const isAdded = (ref) => addTypenameToDocument_1.addTypenameToDocument.added(ref.node);
function completeValue(value) {
    (0, assert_1.assert)(valueContainer.value === EMPTY_ARRAY);
    valueContainer.value = value;
    return valueContainer;
}
function execute(operation, possibleSelections, rootModel, state, resolver) {
    var _a;
    const context = {
        operation,
        resolver,
        incompleteValues: (_a = state === null || state === void 0 ? void 0 : state.incompleteValues) !== null && _a !== void 0 ? _a : new Map(),
        // If incompleteValues is not passed - assuming all objects and lists are incomplete,
        //   except for "leaf" object fields defined on the source object.
        //   This will re-traverse every field, but won't overwrite existing leaf values.
        amend: Boolean(state.data && !state.incompleteValues),
        visited: new Map(),
    };
    const { result } = executeObjectSelection(context, possibleSelections, rootModel, state.data);
    state.data = result;
    state.incompleteValues = context.incompleteValues;
    return state;
}
function executeSelection(context, selections, value, draft) {
    if (draft && isVisited(context, draft, value)) {
        return { result: draft, complete: false };
    }
    if (isIterable(value)) {
        (0, assert_1.assert)(!draft || Array.isArray(draft));
        return executeCompositeListSelection(context, selections, value, draft);
    }
    (0, assert_1.assert)(!draft || !Array.isArray(draft));
    return executeObjectSelection(context, selections, value, draft);
}
function executeObjectSelection(context, possibleSelections, model, draft) {
    var _a, _b, _c;
    const { amend, resolver, incompleteValues } = context;
    const typeName = resolver.resolveType(model);
    const selection = (0, resolvedSelection_1.resolveSelection)(context.operation, possibleSelections, typeName || null);
    const firstEnter = draft === undefined;
    const source = draft !== null && draft !== void 0 ? draft : {};
    const info = resolver.enterObject(model, selection, firstEnter, source);
    if (isCompleteValue(info)) {
        const result = getCompleteValue(info);
        (0, assert_1.assert)(firstEnter && !Array.isArray(result));
        return { result, complete: true };
    }
    let incompleteFields;
    if (firstEnter) {
        incompleteFields = resolveFieldQueue(selection, typeName);
    }
    else if (amend) {
        incompleteFields =
            (_a = incompleteValues.get(source)) !== null && _a !== void 0 ? _a : resolveFieldQueue(selection, typeName);
    }
    else {
        incompleteFields = incompleteValues.get(source);
    }
    if (!(incompleteFields === null || incompleteFields === void 0 ? void 0 : incompleteFields.length)) {
        return { result: source, complete: true };
    }
    const chunks = info;
    if (!chunks) {
        incompleteFields = executeObjectChunkSelection(context, selection, model, source, typeName || null, incompleteFields);
    }
    else {
        (_b = chunks.update) === null || _b === void 0 ? void 0 : _b.call(chunks, incompleteFields);
        for (const chunk of chunks) {
            (0, assert_1.assert)(incompleteFields === null || incompleteFields === void 0 ? void 0 : incompleteFields.length);
            incompleteFields = executeObjectChunkSelection(context, selection, chunk, source, typeName || null, incompleteFields);
            if (!incompleteFields.length) {
                break;
            }
            (_c = chunks.update) === null || _c === void 0 ? void 0 : _c.call(chunks, incompleteFields);
        }
    }
    if (incompleteFields.length) {
        incompleteValues.set(source, incompleteFields);
    }
    else {
        incompleteValues.delete(source);
    }
    return { result: source, complete: !incompleteFields.length };
}
function executeObjectChunkSelection(context, selection, chunk, draft, typeName, incompleteFields) {
    var _a, _b;
    if (isVisited(context, draft, chunk)) {
        return incompleteFields;
    }
    registerVisit(context, draft, chunk);
    const { amend, resolver } = context;
    let nextIncompleteFields = undefined;
    for (const fieldInfo of incompleteFields) {
        if (amend &&
            !fieldInfo.selection &&
            draft[fieldInfo.dataKey] !== undefined) {
            continue;
        }
        const value = resolver.resolveField(chunk, fieldInfo, selection, draft);
        if (value === undefined) {
            // ApolloCompat, see
            //   src/cache/inmemory/readFromStore.ts:321
            //   src/cache/inmemory/readFromStore.ts:355
            if (fieldInfo.name === "__typename" &&
                typeName &&
                !ROOT_TYPES.includes(typeName)) {
                draft.__typename = typeName;
                continue;
            }
            if (((_a = selection.skippedFields) === null || _a === void 0 ? void 0 : _a.has(fieldInfo)) ||
                ((_b = fieldInfo.__refs) === null || _b === void 0 ? void 0 : _b.every(isAdded))) {
                continue;
            }
            nextIncompleteFields !== null && nextIncompleteFields !== void 0 ? nextIncompleteFields : (nextIncompleteFields = []);
            nextIncompleteFields.push(fieldInfo);
            continue;
        }
        if (value === exports.SKIP) {
            continue;
        }
        const dataKey = fieldInfo.dataKey;
        if (!fieldInfo.selection || value === null) {
            draft[dataKey] = value;
            continue;
        }
        const currentFieldDraft = draft[dataKey];
        (0, assert_1.assert)(fieldInfo.selection &&
            (0, predicates_1.isSourceCompositeValue)(currentFieldDraft, fieldInfo));
        const { result, complete } = executeSelection(context, fieldInfo.selection, value, currentFieldDraft);
        if (!complete) {
            nextIncompleteFields !== null && nextIncompleteFields !== void 0 ? nextIncompleteFields : (nextIncompleteFields = []);
            nextIncompleteFields.push(fieldInfo);
        }
        if (result !== currentFieldDraft) {
            draft[dataKey] = result;
        }
    }
    return nextIncompleteFields !== null && nextIncompleteFields !== void 0 ? nextIncompleteFields : EMPTY_ARRAY;
}
function executeCompositeListSelection(context, possibleSelections, list, draft) {
    const { resolver, incompleteValues } = context;
    const firstEnter = draft === undefined;
    const lenOrValue = resolver.enterList(list, possibleSelections, firstEnter);
    if (isCompleteValue(lenOrValue)) {
        const result = getCompleteValue(lenOrValue);
        (0, assert_1.assert)(firstEnter && Array.isArray(result));
        return { result, complete: true };
    }
    let incompleteItems;
    if (draft) {
        incompleteItems = incompleteValues.get(draft);
        if (!(incompleteItems === null || incompleteItems === void 0 ? void 0 : incompleteItems.size)) {
            return { result: draft, complete: true };
        }
    }
    if (!draft) {
        draft = new Array(lenOrValue);
    }
    registerVisit(context, draft, list);
    let index = 0;
    (0, assert_1.assert)(isIterable(list));
    for (const tmp of list) {
        const item = tmp;
        if (!firstEnter && incompleteItems && !incompleteItems.has(index)) {
            index++;
            continue;
        }
        if (item === null) {
            draft[index++] = null;
            continue;
        }
        const currentValue = firstEnter ? undefined : draft[index];
        const { result, complete } = executeSelection(context, possibleSelections, item, currentValue);
        if (complete && incompleteItems) {
            incompleteItems.delete(index);
        }
        if (!complete) {
            incompleteItems !== null && incompleteItems !== void 0 ? incompleteItems : (incompleteItems = new Set());
            incompleteItems.add(index);
        }
        if (currentValue !== result) {
            draft[index] = result;
        }
        index++;
    }
    if (incompleteItems === null || incompleteItems === void 0 ? void 0 : incompleteItems.size) {
        incompleteValues.set(draft, incompleteItems);
    }
    else {
        incompleteValues.delete(draft);
    }
    return { result: draft, complete: !(incompleteItems === null || incompleteItems === void 0 ? void 0 : incompleteItems.size) };
}
function resolveFieldQueue(selection, typeName) {
    // ApolloCompat
    const fieldQueue = selection.fieldQueue;
    if (!typeName || !ROOT_TYPES.includes(typeName)) {
        return fieldQueue;
    }
    const typeNameField = selection.fields.get("__typename");
    const wasAutoAdded = typeNameField === null || typeNameField === void 0 ? void 0 : typeNameField.every((node) => { var _a; return (_a = node.__refs) === null || _a === void 0 ? void 0 : _a.every(isAdded); });
    return wasAutoAdded
        ? fieldQueue.filter((field) => field.name !== "__typename")
        : fieldQueue;
}
function isVisited(context, draft, model) {
    var _a;
    return (_a = context.visited.get(draft)) === null || _a === void 0 ? void 0 : _a.has(model);
}
/**
 * Keep records about all visited models per `SourceObject` to not enter the same model twice
 *   (this is possible when re-entering the same object via multiple parent chunks)
 */
function registerVisit(context, draft, model) {
    let visitedModels = context.visited.get(draft);
    if (!visitedModels) {
        visitedModels = new Set();
        context.visited.set(draft, visitedModels);
    }
    visitedModels.add(model);
}
function isIterable(value) {
    return (typeof value === "object" &&
        value !== null &&
        Object.prototype.hasOwnProperty.call(value, Symbol.iterator));
}
function isCompleteValue(value) {
    return value === valueContainer;
}
function getCompleteValue(container) {
    (0, assert_1.assert)(container.value !== EMPTY_ARRAY);
    const value = container.value;
    container.value = EMPTY_ARRAY;
    return value;
}
