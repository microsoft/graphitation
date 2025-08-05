"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyReadPolicies = applyReadPolicies;
exports.applyMergePolicies = applyMergePolicies;
exports.invokeReadFunctionSafely = invokeReadFunctionSafely;
exports.invokeMergeFunctionSafely = invokeMergeFunctionSafely;
exports.toReference = toReference;
exports.canRead = canRead;
exports.readField = readField;
exports.maybeReturnRef = maybeReturnRef;
exports.getReadPolicyFn = getReadPolicyFn;
exports.getMergePolicyFn = getMergePolicyFn;
const client_1 = require("@apollo/client");
const types_1 = require("../values/types");
const assert_1 = require("../jsutils/assert");
const values_1 = require("../values");
const draftHelpers_1 = require("./draftHelpers");
const resolvedSelection_1 = require("../descriptor/resolvedSelection");
const convert_1 = require("./convert");
const transformTree_1 = require("../forest/transformTree");
const diffObject_1 = require("../diff/diffObject");
const indexTree_1 = require("../forest/indexTree");
const fieldPolicyContext = {
    env: null,
    operation: null,
    fieldContext: null,
    layers: null,
};
const EMPTY_ARRAY = Object.freeze([]);
let options;
function applyReadPolicies(env, layers, readPoliciesMap, tree) {
    const conversionContext = {
        env,
        operation: tree.operation,
        recyclableValues: new Map(),
        danglingReferences: new Set(),
        getChunks: (0, draftHelpers_1.createChunkProvider)(layers),
        matchChunk: (0, draftHelpers_1.createChunkMatcher)(layers),
    };
    const updatedTree = (0, transformTree_1.transformTree)(env, tree, "DESCEND", { types: [...readPoliciesMap.keys()] }, {
        getFieldQueue(chunk, previous) {
            var _a, _b;
            if (previous) {
                // Another chunk of the same logical value, continue previous read
                return previous.fieldQueue;
            }
            return (_b = (_a = readPoliciesMap.get(chunk.type)) === null || _a === void 0 ? void 0 : _a.keys()) !== null && _b !== void 0 ? _b : EMPTY_ARRAY;
        },
        transformField(parent, field, fieldValue, fieldDiff) {
            var _a;
            const readFn = (_a = readPoliciesMap
                .get(parent.type)) === null || _a === void 0 ? void 0 : _a.get(field.name);
            (0, assert_1.assert)(readFn);
            const existing = (0, convert_1.toApolloStoreValue)(conversionContext, fieldValue);
            const transformed = invokeReadFunctionSafely(env, layers, tree.operation, readFn, existing, {
                parentValue: parent.data,
                parentTypeName: parent.type,
                parentSelection: parent.selection,
                parentKey: parent.key,
                field: field,
            });
            if (transformed === existing) {
                return fieldDiff;
            }
            const transformedValue = (0, convert_1.toGraphValue)(conversionContext, fieldValue, transformed);
            return (0, diffObject_1.diffValue)(env, fieldValue, transformedValue, fieldDiff);
        },
    });
    if (conversionContext.danglingReferences.size) {
        updatedTree.danglingReferences = conversionContext.danglingReferences;
    }
    return updatedTree;
}
function applyMergePolicies(env, layers, mergePoliciesMap, incomingTree, overwrite) {
    const findChunkInfo = (value) => {
        var _a, _b;
        if (typeof value !== "object" || value === null) {
            return undefined;
        }
        const tmp = value;
        return (_a = incomingTree.dataMap.get(tmp)) !== null && _a !== void 0 ? _a : (_b = incomingTree.prev) === null || _b === void 0 ? void 0 : _b.dataMap.get(tmp);
    };
    const conversionContext = {
        env: env,
        operation: incomingTree.operation,
        getChunks: function* (ref) {
            var _a, _b, _c;
            if (typeof ref === "string") {
                yield* (_a = incomingTree.nodes.get(ref)) !== null && _a !== void 0 ? _a : EMPTY_ARRAY;
                yield* (_c = (_b = incomingTree.prev) === null || _b === void 0 ? void 0 : _b.nodes.get(ref)) !== null && _c !== void 0 ? _c : EMPTY_ARRAY;
            }
            yield* (0, draftHelpers_1.getObjectChunks)(layers, ref);
        },
        findChunk: (value) => {
            const info = findChunkInfo(value);
            return (info === null || info === void 0 ? void 0 : info.value) &&
                ((0, values_1.isCompositeListValue)(info.value) || (0, values_1.isObjectValue)(info.value))
                ? info.value
                : undefined;
        },
        recyclableValues: new Map(),
        danglingReferences: new Set(),
    };
    const diffEnv = {
        ...env,
        allowMissingFields: true,
    };
    const pathEnv = {
        findParent: (chunk) => {
            const result = findChunkInfo(chunk.data);
            (0, assert_1.assert)(result);
            return result;
        },
    };
    return (0, transformTree_1.transformTree)(env, incomingTree, "ASCEND", { types: [...mergePoliciesMap.keys()] }, {
        getFieldQueue(chunk, diff) {
            var _a, _b;
            if (diff) {
                // Another chunk of the same logical value, continue previous merge
                return diff.fieldQueue;
            }
            return ((_b = (_a = mergePoliciesMap.get(chunk.type)) === null || _a === void 0 ? void 0 : _a.keys()) !== null && _b !== void 0 ? _b : EMPTY_ARRAY);
        },
        transformField(parent, field, fieldValue, fieldDiff) {
            var _a, _b;
            if ((0, values_1.isMissingValue)(fieldValue)) {
                return undefined;
            }
            let existingChunk;
            if (!overwrite) {
                // Resolving "existing" value through parent, because field value may not have metadata, e.g. be a scalar
                const existingParent = (_a = findExistingChunk(pathEnv, incomingTree, parent)) !== null && _a !== void 0 ? _a : findChunk(pathEnv, layers, parent);
                existingChunk = existingParent
                    ? (0, values_1.resolveFieldChunk)(existingParent, field)
                    : materializeFromForest(env, pathEnv, layers, parent, field);
                if (existingChunk !== undefined) {
                    (0, assert_1.assert)((0, values_1.isCompatibleValue)(fieldValue, existingChunk));
                }
            }
            const mergeFn = (_b = mergePoliciesMap
                .get(parent.type)) === null || _b === void 0 ? void 0 : _b.get(field.name);
            (0, assert_1.assert)(mergeFn);
            const incoming = (0, convert_1.toApolloStoreValue)(conversionContext, fieldValue);
            const existing = existingChunk
                ? (0, convert_1.toApolloStoreValue)(conversionContext, existingChunk)
                : undefined;
            const merged = invokeMergeFunctionSafely(env, layers, incomingTree.operation, mergeFn, existing, incoming, {
                parentValue: parent.data,
                parentTypeName: parent.type,
                parentSelection: parent.selection,
                parentKey: parent.key,
                field: field,
            });
            if (incoming === merged) {
                return fieldDiff;
            }
            const value = merged === existing && existingChunk
                ? existingChunk
                : (0, convert_1.toGraphValue)(conversionContext, fieldValue, merged);
            return (0, diffObject_1.diffValue)(diffEnv, fieldValue, value);
        },
    });
}
function materializeFromForest(env, pathEnv, layers, parentChunk, field) {
    const source = {};
    const draft = (0, values_1.hydrateDraft)(env, (0, values_1.createDraft)(parentChunk.operation, parentChunk.possibleSelections, (0, values_1.getGraphValueReference)(pathEnv, parentChunk), parentChunk.type, source, new Map([[source, [field]]])), (0, draftHelpers_1.createChunkProvider)(layers), (0, draftHelpers_1.createChunkMatcher)(layers));
    const object = (0, indexTree_1.indexDraft)(env, draft);
    return object.kind === types_1.ValueKind.Object
        ? (0, values_1.resolveFieldChunk)(object, field)
        : undefined;
}
function invokeReadFunctionSafely(env, layers, operation, readFn, existing, fieldContext) {
    var _a, _b;
    try {
        // fieldPolicyContext.readFieldContext = info;
        fieldPolicyContext.env = env;
        fieldPolicyContext.layers = layers;
        fieldPolicyContext.operation = operation;
        fieldPolicyContext.fieldContext = fieldContext;
        const value = readFn(existing, prepareFieldPolicyOptions.call(fieldPolicyContext));
        assertValidValue(fieldContext, value, existing);
        return value;
    }
    catch (e) {
        (_a = env.notify) === null || _a === void 0 ? void 0 : _a.call(env, {
            kind: "READ_POLICY_ERROR",
            op: operation.debugName,
            type: fieldContext.parentTypeName,
            field: fieldContext.field.name,
        });
        (_b = env.logger) === null || _b === void 0 ? void 0 : _b.error(`Error in read policy ${fieldContext.parentTypeName}.${fieldContext.field.name} (applied to ${operation.debugName}):`, e);
        return existing;
    }
    finally {
        fieldPolicyContext.env = null;
        fieldPolicyContext.layers = null;
        fieldPolicyContext.operation = null;
        fieldPolicyContext.fieldContext = null;
    }
}
function invokeMergeFunctionSafely(env, layers, operation, mergeFn, existing, incoming, fieldContext) {
    var _a, _b;
    try {
        fieldPolicyContext.env = env;
        fieldPolicyContext.layers = layers;
        fieldPolicyContext.operation = operation;
        fieldPolicyContext.fieldContext = fieldContext;
        return mergeFn(existing, incoming, prepareFieldPolicyOptions.call(fieldPolicyContext));
    }
    catch (e) {
        (_a = env.notify) === null || _a === void 0 ? void 0 : _a.call(env, {
            kind: "MERGE_POLICY_ERROR",
            op: operation.debugName,
            type: fieldContext.parentTypeName,
            field: fieldContext.field.name,
        });
        (_b = env.logger) === null || _b === void 0 ? void 0 : _b.error(`Error in merge policy ${fieldContext.parentTypeName}.${fieldContext.field.name} (applied to ${operation.debugName}):`, e);
        return fieldContext.parentValue[fieldContext.field.dataKey];
    }
    finally {
        fieldPolicyContext.env = null;
        fieldPolicyContext.layers = null;
        fieldPolicyContext.operation = null;
        fieldPolicyContext.fieldContext = null;
    }
}
function assertValidValue(fieldContext, userValue, existing) {
    if (userValue === null || userValue === undefined) {
        return;
    }
    if (userValue instanceof Date) {
        // ApolloCompat
        // Special case of converting dates for convenience
        return;
    }
    if (!fieldContext.field.selection) {
        // Could be anything due to custom scalars, so can do little here
        if (existing !== null &&
            existing !== undefined &&
            (typeof existing !== typeof userValue ||
                (Array.isArray(existing) && !Array.isArray(userValue)))) {
            throw new Error(`Read policy has returned a value that has a different type than the existing value. Using old value.\n` +
                `  returned: ${JSON.stringify(userValue)}\n` +
                `  existing: ${JSON.stringify(existing)}`);
        }
        return;
    }
    if (typeof userValue !== "object") {
        throw new Error(`Read policy has returned unexpected non-object value: ${JSON.stringify(userValue)}`);
    }
}
function prepareFieldPolicyOptions() {
    var _a;
    if (!options) {
        options = {
            args: null,
            field: null,
            fieldName: "",
            variables: {},
            isReference: client_1.isReference,
            toReference: toReference.bind(this),
            readField: readField.bind(this),
            canRead: canRead.bind(this),
            mergeObjects: mergeObjects.bind(this),
            get storeFieldName() {
                throw new Error("Not implemented in ForestRun: storage");
            },
            get storage() {
                throw new Error("Not implemented in ForestRun: storage");
            },
            get cache() {
                throw new Error("Not implemented in ForestRun: cache");
            },
            query: null,
        };
    }
    (0, assert_1.assert)(this.env && this.operation && this.fieldContext && this.layers);
    const operation = this.operation;
    const field = this.fieldContext.field;
    const fieldAST = (_a = field.__refs) === null || _a === void 0 ? void 0 : _a[0].node;
    const normalizedField = (0, resolvedSelection_1.resolveNormalizedField)(this.fieldContext.parentSelection, field);
    (0, assert_1.assert)(fieldAST);
    options.query = operation.document;
    options.field = fieldAST;
    options.fieldName = field.name;
    options.variables = operation.variablesWithDefaults;
    options.args =
        typeof normalizedField === "object"
            ? Object.fromEntries(normalizedField.args)
            : null;
    return options;
}
function toReference(objectOrRef, writeToStore = false) {
    if (writeToStore === true) {
        throw new Error("Writing via toReference is not supported by ForestRun");
    }
    if ((0, client_1.isReference)(objectOrRef)) {
        return objectOrRef;
    }
    if (typeof objectOrRef === "string") {
        return { __ref: objectOrRef };
    }
    (0, assert_1.assert)(this.env && objectOrRef);
    const id = this.env.objectKey(objectOrRef);
    return typeof id === "string" ? { __ref: id } : undefined;
}
function canRead(objOrRef) {
    (0, assert_1.assert)(this.layers && this.env);
    if ((0, client_1.isReference)(objOrRef)) {
        for (const layer of this.layers) {
            if (layer.operationsByNodes.has(objOrRef.__ref)) {
                return true;
            }
        }
    }
    return typeof objOrRef === "object";
}
function readField(arg1, arg2) {
    var _a;
    // ApolloCompat:
    //   see issue #8499
    if ((typeof arg1 === "object" &&
        arg1 !== null &&
        Object.prototype.hasOwnProperty.call(arg1, "from") &&
        arg1["from"] === undefined) ||
        (arg2 === undefined && arguments.length === 2)) {
        return undefined;
    }
    let options, fieldName, from;
    if (typeof arg1 === "object") {
        options = arg1;
        fieldName = options.fieldName;
        from = options.from;
    }
    else {
        fieldName = arg1;
        from = arg2;
    }
    const normalizedField = (options === null || options === void 0 ? void 0 : options.args)
        ? { name: fieldName, args: new Map(Object.entries(options.args)) }
        : fieldName;
    if (!from) {
        return ((_a = readFromParentValue(this, normalizedField)) !== null && _a !== void 0 ? _a : readFromOtherNodeChunks(this, normalizedField));
    }
    if ((0, client_1.isReference)(from)) {
        return readFrom(this, from.__ref, normalizedField);
    }
    // FIXME: this will break with aliases (how does it even work in Apollo???)
    //   Probably try to convert to reference? (In case of Apollo this is pretty much impossible)
    return from[fieldName];
}
function readFromParentValue(context, field) {
    (0, assert_1.assert)(context.env && context.fieldContext);
    const { parentValue, parentSelection } = context.fieldContext;
    const fieldAliases = parentSelection.fields.get((0, resolvedSelection_1.getFieldName)(field));
    if (!(fieldAliases === null || fieldAliases === void 0 ? void 0 : fieldAliases.length)) {
        return undefined;
    }
    if (fieldAliases.length !== 1 ||
        fieldAliases[0].args ||
        typeof field !== "string") {
        throw new Error("ForestRun doesn't support reads of complex fields with arguments in field policies");
    }
    const fieldInfo = fieldAliases[0];
    const value = parentValue[fieldInfo.dataKey];
    return fieldInfo.selection ? maybeReturnRef(context.env, value) : value;
}
function readFromOtherNodeChunks(context, field) {
    (0, assert_1.assert)(context.env && context.fieldContext && context.layers);
    const { parentKey } = context.fieldContext;
    (0, assert_1.assert)(parentKey);
    return readFrom(context, parentKey, field);
}
function readFrom(context, ref, field) {
    (0, assert_1.assert)(context.env && context.layers);
    for (const chunk of (0, draftHelpers_1.getObjectChunks)(context.layers, ref)) {
        const value = (0, values_1.resolveFieldValue)(chunk, field);
        if (value === undefined || (0, values_1.isMissingValue)(value)) {
            continue;
        }
        if ((0, values_1.isScalarValue)(value)) {
            return value;
        }
        if ((0, values_1.isComplexScalarValue)(value)) {
            return value.data;
        }
        if ((0, values_1.isObjectValue)(value) || (0, values_1.isCompositeListValue)(value)) {
            return maybeReturnRef(context.env, value.data);
        }
        throw new Error(`ForestRun doesn't support reading ${value === null || value === void 0 ? void 0 : value.kind} in field policies`);
    }
    return undefined;
}
function maybeReturnRef(env, value) {
    if (Array.isArray(value)) {
        return value.map((item) => maybeReturnRef(env, item));
    }
    if ((0, values_1.isSourceObject)(value)) {
        const id = env.objectKey(value);
        return typeof id === "string" ? { __ref: id } : value;
    }
    return value;
}
function mergeObjects(existing, incoming) {
    if (Array.isArray(existing) || Array.isArray(incoming)) {
        throw new Error("Cannot automatically merge arrays");
    }
    if ((0, values_1.isSourceObject)(existing) && (0, values_1.isSourceObject)(incoming)) {
        const eType = existing === null || existing === void 0 ? void 0 : existing.__typename;
        const iType = incoming === null || incoming === void 0 ? void 0 : incoming.__typename;
        const typesDiffer = eType && iType && eType !== iType;
        if (typesDiffer) {
            return incoming;
        }
        if ((0, client_1.isReference)(existing) && storeValueIsStoreObject(incoming)) {
            return existing;
        }
        if (storeValueIsStoreObject(existing) && (0, client_1.isReference)(incoming)) {
            return incoming;
        }
        if (storeValueIsStoreObject(existing) &&
            storeValueIsStoreObject(incoming)) {
            return { ...existing, ...incoming };
        }
    }
    return incoming;
}
function storeValueIsStoreObject(value) {
    return (0, values_1.isSourceObject)(value) && !(0, client_1.isReference)(value) && !Array.isArray(value);
}
function getReadPolicyFn(fieldPolicies, fieldName) {
    if (!fieldPolicies) {
        return undefined;
    }
    const fieldPolicy = fieldPolicies === null || fieldPolicies === void 0 ? void 0 : fieldPolicies[fieldName];
    if (!fieldPolicy) {
        return undefined;
    }
    return typeof fieldPolicy === "function" ? fieldPolicy : fieldPolicy.read;
}
function getMergePolicyFn(fieldPolicies, fieldName) {
    if (!fieldPolicies) {
        return undefined;
    }
    const fieldPolicy = fieldPolicies === null || fieldPolicies === void 0 ? void 0 : fieldPolicies[fieldName];
    if (!fieldPolicy) {
        return undefined;
    }
    return typeof fieldPolicy === "object" &&
        typeof fieldPolicy.merge === "function"
        ? fieldPolicy.merge
        : undefined;
}
function findExistingChunk(pathEnv, incomingTree, referenceChunk) {
    var _a;
    const existingTree = incomingTree.prev;
    if (!existingTree) {
        return undefined;
    }
    (0, assert_1.assert)(existingTree.operation.document === referenceChunk.operation.document);
    const nodeChunk = (0, values_1.findClosestNode)(referenceChunk, pathEnv.findParent);
    // FIXME: it should be enough to compare possibleSelections here,
    //  as we call resolvedSelectionsAreEqual in the end anyways?
    const existingNodeChunk = (_a = existingTree.nodes
        .get(nodeChunk.key)) === null || _a === void 0 ? void 0 : _a.find((chunk) => (0, resolvedSelection_1.resolvedSelectionsAreEqual)(chunk.selection, nodeChunk.selection));
    const existingValue = existingNodeChunk
        ? (0, values_1.retrieveEmbeddedChunk)(pathEnv, existingNodeChunk, referenceChunk)
        : undefined;
    if (existingValue === undefined) {
        return undefined;
    }
    (0, assert_1.assert)((0, values_1.isObjectValue)(existingValue) ||
        (0, values_1.isCompositeNullValue)(existingValue) ||
        (0, values_1.isCompositeUndefinedValue)(existingValue));
    return (0, values_1.isObjectValue)(existingValue) &&
        (0, resolvedSelection_1.resolvedSelectionsAreEqual)(existingValue.selection, referenceChunk.selection)
        ? existingValue
        : undefined;
}
function findChunk(pathEnv, layers, incomingChunk) {
    const nodeChunk = (0, values_1.findClosestNode)(incomingChunk, pathEnv.findParent);
    const ref = (0, values_1.getGraphValueReference)(pathEnv, incomingChunk);
    for (const chunk of (0, draftHelpers_1.getObjectChunks)(layers, ref, false, nodeChunk)) {
        if ((0, resolvedSelection_1.resolvedSelectionsAreEqual)(chunk.selection, incomingChunk.selection)) {
            return chunk;
        }
    }
    return undefined;
}
