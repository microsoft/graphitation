"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROOT_NODES = exports.ROOT_TYPES = void 0;
exports.resolveOperationDescriptor = resolveOperationDescriptor;
exports.transformDocument = transformDocument;
exports.getOriginalDocument = getOriginalDocument;
exports.isFragmentDocument = isFragmentDocument;
exports.getFragmentNode = getFragmentNode;
exports.getDiffDescriptor = getDiffDescriptor;
exports.resolveResultDescriptor = resolveResultDescriptor;
exports.variablesAreEqual = variablesAreEqual;
exports.operationCacheKey = operationCacheKey;
const equality_1 = require("@wry/equality");
const document_1 = require("../descriptor/document");
const operation_1 = require("../descriptor/operation");
const addTypenameToDocument_1 = require("../descriptor/addTypenameToDocument");
const assert_1 = require("../jsutils/assert");
const possibleSelection_1 = require("../descriptor/possibleSelection");
exports.ROOT_TYPES = Object.freeze(["Query", "Mutation", "Subscription"]);
exports.ROOT_NODES = Object.freeze([
    "ROOT_QUERY",
    "ROOT_MUTATION",
    "ROOT_SUBSCRIPTION",
]);
const documentCache = new WeakMap();
const reverseDocumentCache = new WeakMap();
const definitionsCache = new WeakMap();
const resultTreeDescriptors = new WeakMap();
const diffDescriptors = new WeakMap();
function resolveOperationDescriptor(env, { operations, dataForest }, doc, variables, rootNodeKey) {
    var _a;
    const document = env.addTypename ? transformDocument(doc) : doc;
    const documentDescriptor = (0, document_1.describeDocument)(document);
    let variants = operations.get(document);
    if (!variants) {
        variants = new Map();
        operations.set(document, variants);
    }
    const variablesWithDefaultValues = (0, operation_1.applyDefaultValues)(variables !== null && variables !== void 0 ? variables : {}, documentDescriptor.definition.variableDefinitions);
    const variablesKey = (0, operation_1.createVariablesKey)(documentDescriptor.definition.variableDefinitions, variablesWithDefaultValues);
    const cacheKey = createCacheKeyImpl(variablesKey, rootNodeKey);
    let match = variants.get(cacheKey);
    if (!match) {
        let resultTreeDescriptor = resultTreeDescriptors.get(document);
        if (!resultTreeDescriptor) {
            resultTreeDescriptor = (0, possibleSelection_1.describeResultTree)(documentDescriptor, env.possibleTypes);
            resultTreeDescriptors.set(document, resultTreeDescriptor);
        }
        let rootTypeName;
        if (isFragmentDocument(document)) {
            const fragment = getFragmentNode(document);
            rootTypeName = fragment.typeCondition.name.value;
        }
        match = (0, operation_1.describeOperation)(env, documentDescriptor, resultTreeDescriptor, variables !== null && variables !== void 0 ? variables : {}, variablesWithDefaultValues, variablesKey, rootTypeName, rootNodeKey);
        variants.set(cacheKey, match);
    }
    if (typeof rootNodeKey !== "undefined" &&
        !exports.ROOT_NODES.includes(rootNodeKey) &&
        exports.ROOT_TYPES.includes(match.rootType)) {
        match.rootType = (_a = dataForest.extraRootIds.get(rootNodeKey)) !== null && _a !== void 0 ? _a : match.rootType;
    }
    return match;
}
function transformDocument(document) {
    let result = documentCache.get(document);
    if (!result) {
        const definitions = transformDefinitions(document);
        result =
            document.definitions === definitions
                ? document
                : { ...document, definitions };
        documentCache.set(document, result);
        // If someone calls transformDocument and then mistakenly passes the
        // result back into an API that also calls transformDocument, make sure
        // we don't keep creating new query documents.
        documentCache.set(result, result);
        reverseDocumentCache.set(result, document);
    }
    return result;
}
function transformDefinitions(document) {
    let dirty = false;
    const definitions = [];
    for (const definition of document.definitions) {
        let processed = definitionsCache.get(definition);
        if (!processed) {
            processed = (0, addTypenameToDocument_1.addTypenameToDocument)(definition);
            definitionsCache.set(definition, processed);
            definitionsCache.set(processed, processed);
        }
        dirty = dirty || processed !== definition;
        definitions.push(processed);
    }
    return dirty ? definitions : document.definitions;
}
function getOriginalDocument(maybeTransformed) {
    var _a;
    return (_a = reverseDocumentCache.get(maybeTransformed)) !== null && _a !== void 0 ? _a : maybeTransformed;
}
function isFragmentDocument(document) {
    const operationDefinition = document.definitions[0];
    if (operationDefinition.kind !== "OperationDefinition") {
        return false;
    }
    const selections = operationDefinition.selectionSet.selections;
    return selections.length === 1 && selections[0].kind === "FragmentSpread";
}
/**
 * Returns fragment node from a document conforming to Apollo fragment document convention
 *  (i.e. a one which satisfies isFragmentDocument predicate)
 */
function getFragmentNode(document) {
    const operationDefinition = document.definitions[0];
    (0, assert_1.assert)(operationDefinition.kind === "OperationDefinition");
    const fragmentSpreadNode = operationDefinition.selectionSet.selections[0];
    (0, assert_1.assert)(fragmentSpreadNode.kind === "FragmentSpread");
    const fragment = document.definitions.find((def) => def.kind === "FragmentDefinition" &&
        def.name.value === fragmentSpreadNode.name.value);
    if (!fragment) {
        throw new Error(`No fragment named ${fragmentSpreadNode.name.value}.`);
    }
    return fragment;
}
function getDiffDescriptor(env, store, options) {
    var _a;
    // Diff / watch options could be used interchangeably multiple times with the same watch | diff object
    let operationDescriptor = diffDescriptors.get(options);
    if (!operationDescriptor) {
        operationDescriptor = resolveOperationDescriptor(env, store, options.query, options.variables, (_a = options.rootId) !== null && _a !== void 0 ? _a : options.id);
        diffDescriptors.set(options, operationDescriptor);
    }
    return resolveResultDescriptor(env, store, operationDescriptor);
}
/**
 * ApolloCompat: In some cases results of multiple operations may be stored in a single result tree.
 *
 * E.g. when using merge policies for pagination and merging multiple pages into
 * the very first page, all other pages should not be stored separately
 * (otherwise updates become too expensive)
 *
 * This is achieved via `@cache(keyVars: [...])` directive.
 *
 * We still have individual operation descriptors, but only using the very first
 * descriptor with matching keyVariables as a key for result tree.
 */
function resolveResultDescriptor(env, store, operation) {
    if (!operation.keyVariables) {
        return operation;
    }
    const byDocument = store.operations.get(operation.document);
    (0, assert_1.assert)(byDocument === null || byDocument === void 0 ? void 0 : byDocument.size); // at least operation itself is expected to be there
    // Result descriptor is the first registered descriptor with matching key variables
    for (const otherOperation of byDocument.values()) {
        if (otherOperation === operation ||
            variablesAreEqual(operation.variablesWithDefaults, otherOperation.variablesWithDefaults, operation.keyVariables)) {
            return otherOperation;
        }
    }
    (0, assert_1.assert)(false);
}
function variablesAreEqual(a, b, keyVars = null) {
    if (!keyVars) {
        return (0, equality_1.equal)(a, b);
    }
    for (const name of keyVars) {
        if (!(0, equality_1.equal)(a[name], b[name])) {
            return false;
        }
    }
    return true;
}
function operationCacheKey(operation) {
    return createCacheKeyImpl(operation.variablesKey, operation.rootNodeKey);
}
const createCacheKeyImpl = (variablesKey, rootNodeKey) => rootNodeKey === void 0 || exports.ROOT_NODES.includes(rootNodeKey)
    ? variablesKey
    : variablesKey + `{rootNodeKey:${rootNodeKey}}`;
