"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.read = read;
const values_1 = require("../values");
const policies_1 = require("./policies");
const indexTree_1 = require("../forest/indexTree");
const draftHelpers_1 = require("./draftHelpers");
const descriptor_1 = require("./descriptor");
const client_1 = require("@apollo/client");
const store_1 = require("./store");
const assert_1 = require("../jsutils/assert");
const addTree_1 = require("../forest/addTree");
function read(env, store, activeTransaction, options) {
    if (env.optimizeFragmentReads && (0, descriptor_1.isFragmentDocument)(options.query)) {
        const chunk = readFragment(env, store, activeTransaction, options);
        if (chunk) {
            return {
                result: chunk.data,
                complete: !chunk.missingFields?.size,
            };
        }
    }
    const { outputTree } = readOperation(env, store, activeTransaction, (0, descriptor_1.getDiffDescriptor)(env, store, options), options);
    // FIXME: this may break with optimistic layers - partialReadResults should be per layer?
    if (outputTree.incompleteChunks.size) {
        store.partialReadResults.add(outputTree.operation);
        return {
            result: outputTree.result.data,
            complete: false,
            missing: [reportFirstMissingField(outputTree)],
            dangling: outputTree.danglingReferences,
        };
    }
    store.partialReadResults.delete(outputTree.operation);
    return {
        result: outputTree.result.data,
        complete: true,
    };
}
function readOperation(env, store, activeTransaction, operationDescriptor, options) {
    const { optimisticLayers, optimisticReadResults } = store;
    const optimistic = activeTransaction?.forceOptimistic ?? options.optimistic;
    // Normally, this is a data forest, but when executed within transaction - could be one of the optimistic layers
    const forest = (0, store_1.getActiveForest)(store, activeTransaction);
    (0, store_1.touchOperation)(env, store, operationDescriptor);
    const resultsMap = options.optimistic && optimisticLayers.length
        ? optimisticReadResults
        : forest.readResults;
    let readState = resultsMap.get(operationDescriptor);
    if (!readState || readState.dirtyNodes.size) {
        readState = growOutputTree(env, store, forest, operationDescriptor, optimistic, readState);
        normalizeRootLevelTypeName(readState.outputTree);
        resultsMap.set(operationDescriptor, readState);
    }
    const { outputTree } = readState;
    // Safeguard: make sure previous state doesn't leak outside write operation
    (0, assert_1.assert)(!outputTree?.prev);
    return readState;
}
function readFragment(env, store, activeTransaction, options) {
    const id = options.id ?? options.rootId ?? "ROOT_QUERY";
    const document = env.addTypename
        ? (0, descriptor_1.transformDocument)(options.query)
        : options.query;
    const fragment = (0, descriptor_1.getFragmentNode)(document);
    const chunkMatcher = (chunk) => {
        if (chunk.missingFields?.size || chunk.partialFields?.size) {
            return false;
        }
        const aliases = chunk.selection.spreads?.get(fragment.name.value) ?? EMPTY_ARRAY;
        return aliases.some((spread) => !chunk.selection.skippedSpreads?.has(spread) &&
            // Note: currently only spreads with @nonreactive directive are supported
            spread.__refs.some((ref) => ref.node.directives?.some((d) => d.name.value === "nonreactive" &&
                isConditionallyEnabled(d, chunk.operation.variablesWithDefaults))));
    };
    // Normally, this is a data forest, but when executed within transaction - could be one of the optimistic layers
    const forest = (0, store_1.getActiveForest)(store, activeTransaction);
    const ops = forest.operationsByNodes.get(id);
    for (const opId of ops ?? EMPTY_ARRAY) {
        const tree = forest.trees.get(opId);
        if (!tree || !hasMatchingFragment(tree, fragment, options.variables)) {
            continue;
        }
        const { outputTree } = readOperation(env, store, activeTransaction, tree.operation, options);
        const nodeChunks = outputTree.nodes.get(id);
        if (!nodeChunks?.length) {
            continue;
        }
        const matchingChunk = nodeChunks?.find(chunkMatcher);
        if (matchingChunk) {
            return matchingChunk;
        }
    }
    return undefined;
}
function hasMatchingFragment(tree, fragment, variables) {
    const treeFragment = tree.operation.fragmentMap.get(fragment.name.value);
    if (treeFragment !== fragment) {
        return false;
    }
    if (variables &&
        !(0, descriptor_1.variablesAreEqual)(tree.operation.variablesWithDefaults, variables, Object.keys(variables))) {
        return false;
    }
    return true;
}
function normalizeRootLevelTypeName(tree) {
    var _a;
    // Root-level __typename field may become out of sync due to difference in manual writes/optimistic results and network results
    //   so forcing consistent state matching operation selection set:
    const rootNode = tree.nodes.get(tree.rootNodeKey)?.[0];
    if (!rootNode || Object.isFrozen(rootNode.data)) {
        return;
    }
    if (rootNode.selection.fields.has("__typename")) {
        (_a = rootNode.data).__typename ?? (_a.__typename = rootNode.type || tree.operation.rootType);
    }
    else if (rootNode.data.__typename) {
        delete rootNode.data.__typename;
    }
}
function growOutputTree(env, store, forest, operation, optimistic, previous) {
    let dataTree = forest.trees.get(operation.id);
    for (const layer of (0, store_1.getEffectiveReadLayers)(store, forest, false)) {
        dataTree = layer.trees.get(operation.id);
        if (dataTree) {
            break;
        }
    }
    if (!dataTree) {
        dataTree = growDataTree(env, forest, operation);
        (0, addTree_1.addTree)(forest, dataTree);
    }
    const tree = applyTransformations(env, dataTree, (0, store_1.getEffectiveReadLayers)(store, forest, optimistic), previous);
    indexReadPolicies(env, tree);
    if (tree === dataTree) {
        return { outputTree: tree, dirtyNodes: new Map() };
    }
    // ApolloCompat: this is to throw properly when field policy returns a ref which doesn't exist in cache
    for (const ref of tree.danglingReferences ?? EMPTY_ARRAY) {
        let ops = forest.operationsWithDanglingRefs.get(ref);
        if (!ops) {
            ops = new Set();
            forest.operationsWithDanglingRefs.set(ref, ops);
        }
        ops.add(tree.operation);
    }
    tree.prev = null;
    (0, addTree_1.trackTreeNodes)(forest, tree);
    return { outputTree: tree, dirtyNodes: new Map() };
}
function growDataTree(env, forest, operationDescriptor) {
    const { possibleSelections, rootNodeKey, rootType } = operationDescriptor;
    const rootDraft = (0, values_1.createDraft)(operationDescriptor, possibleSelections, rootNodeKey, rootType);
    (0, values_1.hydrateDraft)(env, rootDraft, (0, draftHelpers_1.createChunkProvider)([forest]));
    // ApolloCompat: mostly added for tests
    if (!rootDraft.data &&
        rootNodeKey === "ROOT_QUERY" &&
        rootDraft.selection.fields?.size === 1 &&
        rootDraft.selection.fields.has("__typename")) {
        rootDraft.data = {
            __typename: env.rootTypes?.query ?? "Query",
        };
    }
    const source = { data: rootDraft?.data ?? {} };
    const tree = (0, indexTree_1.indexTree)(env, operationDescriptor, source, rootDraft.missingFields);
    tree.grown = true;
    return tree;
}
/**
 * Executes selections of the input tree using node chunks from provided layers.
 * Output tree contains a blend of data from different layers. Data from earlier layers has priority.
 */
function applyTransformations(env, inputTree, dataLayers, previous) {
    // This effectively disables recycling when optimistic layers are present, which is suboptimal.
    const hasOptimisticLayers = dataLayers.length > 1;
    const operation = inputTree.operation;
    // TODO: inputTree.incompleteChunks must be updated on write, then we can remove size check
    if (!inputTree.incompleteChunks.size && !hasOptimisticLayers) {
        // Fast-path: skip optimistic transforms
        return (0, policies_1.applyReadPolicies)(env, dataLayers, env.readPolicies, inputTree);
    }
    // For dirty nodes we should not recycle existing chunks
    const dirtyNodes = previous?.dirtyNodes ??
        resolveAffectedOptimisticNodes(inputTree, dataLayers);
    if (!inputTree.incompleteChunks.size && !dirtyNodes.size) {
        // Fast-path: skip optimistic transforms
        return (0, policies_1.applyReadPolicies)(env, dataLayers, env.readPolicies, inputTree);
    }
    // Slow-path: apply optimistic layers first
    const optimisticDraft = (0, values_1.hydrateDraft)(env, (0, values_1.createDraft)(operation, operation.possibleSelections, operation.rootNodeKey, operation.rootType), (0, draftHelpers_1.createChunkProvider)(dataLayers), (0, draftHelpers_1.createChunkMatcher)(dataLayers, false, dirtyNodes));
    const optimisticTree = (0, indexTree_1.indexTree)(env, operation, { data: optimisticDraft.data }, optimisticDraft.missingFields, inputTree);
    return (0, policies_1.applyReadPolicies)(env, dataLayers, env.readPolicies, optimisticTree);
}
function indexReadPolicies(env, tree) {
    // TODO: this seems to be unnecessary anymore, verify and remove
    //   The only reason why we still use it is complex read policies that read fields from nodes that are not directly
    //   listed in the final tree. Thus, to properly invalidate those cases we must additionally track dependent
    //   nodes and their fields. Today, we invalidate the whole node on any change if it has read policy.
    const { readPolicies } = env;
    if (!readPolicies.size) {
        return;
    }
    const typeNames = readPolicies.size > tree.typeMap.size
        ? tree.typeMap.keys()
        : readPolicies.keys();
    for (const typeName of typeNames) {
        const chunks = tree.typeMap.get(typeName);
        const fieldMap = readPolicies.get(typeName);
        if (!chunks?.length || !fieldMap?.size) {
            continue;
        }
        for (const chunk of chunks) {
            if (chunk.hasNestedReadPolicies) {
                continue;
            }
            for (const field of fieldMap.keys()) {
                if (chunk.selection.fields.has(field)) {
                    chunk.hasNestedReadPolicies = true;
                    let ref = tree.dataMap.get(chunk.data);
                    while (ref && !(0, values_1.isRootRef)(ref) && !ref.parent.hasNestedReadPolicies) {
                        ref.parent.hasNestedReadPolicies = true;
                        ref = tree.dataMap.get(ref.parent.data);
                    }
                }
            }
        }
    }
}
function reportFirstMissingField(tree) {
    const pathEnv = {
        findParent: (0, values_1.createParentLocator)(tree.dataMap),
    };
    const [chunk] = tree.incompleteChunks;
    const path = (0, values_1.getDataPathForDebugging)(pathEnv, chunk);
    let message;
    if ((0, values_1.isObjectValue)(chunk)) {
        (0, assert_1.assert)(chunk.missingFields?.size);
        const [missingField] = chunk.missingFields;
        message =
            `Can't find field '${missingField.name}' on ` +
                (chunk.key
                    ? chunk.key + ` object`
                    : `object ` + inspect(chunk.data, null, 2));
        path.push(missingField.name);
    }
    else {
        (0, assert_1.assert)(chunk.missingItems?.size);
        const [missingIndex] = chunk.missingItems;
        message =
            `Can't find item at index ${missingIndex} on array ` +
                inspect(chunk.data, null, 2) +
                `\n` +
                `It could have been deleted using cache.modify, cache.evict or written incorrectly with manual cache.write`;
        path.push(missingIndex);
    }
    return new client_1.MissingFieldError(message, path, (0, descriptor_1.getOriginalDocument)(tree.operation.document), tree.operation.variables);
}
function resolveAffectedOptimisticNodes(inputTree, dataLayers) {
    if (dataLayers.length <= 1) {
        return EMPTY_MAP;
    }
    const result = new Map();
    for (let i = 0; i < dataLayers.length - 1; i++) {
        // Note: last layer is the data layer
        const optimisticLayer = dataLayers[i];
        const nodeKeys = inputTree.nodes.size < optimisticLayer.operationsByNodes.size
            ? inputTree.nodes.keys()
            : optimisticLayer.operationsByNodes.keys();
        for (const nodeKey of nodeKeys) {
            if (optimisticLayer.operationsByNodes.has(nodeKey) &&
                inputTree.nodes.has(nodeKey)) {
                result.set(nodeKey, EMPTY_SET);
            }
        }
    }
    // Add parent nodes to make sure they are not recycled
    //   (when parents are recycled, nested affected nodes won't be updated properly)
    appendParentNodes(inputTree, result);
    return result;
}
function appendParentNodes(inputTree, dirtyNodes) {
    const findParent = (0, values_1.createParentLocator)(inputTree.dataMap);
    for (const nodeKey of dirtyNodes.keys()) {
        const chunks = inputTree.nodes.get(nodeKey);
        for (const chunk of chunks ?? EMPTY_ARRAY) {
            let parentInfo = findParent(chunk);
            while (!(0, values_1.isRootRef)(parentInfo)) {
                if ((0, values_1.isParentObjectRef)(parentInfo) && (0, values_1.isNodeValue)(parentInfo.parent)) {
                    let dirtyFields = dirtyNodes.get(parentInfo.parent.key);
                    if (dirtyFields && dirtyFields.has(parentInfo.field.name)) {
                        break;
                    }
                    if (!dirtyFields) {
                        dirtyFields = new Set();
                        dirtyNodes.set(parentInfo.parent.key, dirtyFields);
                    }
                    dirtyFields.add(parentInfo.field.name);
                }
                if (!(0, values_1.isCompositeListValue)(parentInfo.parent) &&
                    !(0, values_1.isObjectValue)(parentInfo.parent)) {
                    break;
                }
                parentInfo = findParent(parentInfo.parent);
            }
        }
    }
}
const isConditionallyEnabled = (directive, variables) => {
    const ifArgument = directive.arguments?.[0];
    if (!ifArgument) {
        return true;
    }
    (0, assert_1.assert)(ifArgument.name.value === "if");
    if (ifArgument.value.kind === "BooleanValue") {
        return ifArgument.value.value;
    }
    if (ifArgument.value.kind === "Variable") {
        return Boolean(variables[ifArgument.value.name.value]);
    }
    return false;
};
const inspect = JSON.stringify.bind(JSON);
const EMPTY_ARRAY = Object.freeze([]);
const EMPTY_SET = new Set();
const EMPTY_MAP = new Map();
EMPTY_SET.add = () => EMPTY_SET;
EMPTY_MAP.set = () => EMPTY_MAP;
