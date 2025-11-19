import type {
  FieldName,
  OperationDescriptor,
  VariableValues,
} from "../descriptor/types";
import type { ObjectChunk, ObjectDraft, SourceObject } from "../values/types";
import type { IndexedTree } from "../forest/types";
import type {
  CacheEnv,
  DataForest,
  DataTree,
  OptimisticLayer,
  ResultTree,
  Store,
  Transaction,
  TransformedResult,
  DirtyNodeMap,
} from "./types";
import {
  createDraft,
  hydrateDraft,
  getDataPathForDebugging,
  isObjectValue,
  isRootRef,
  TraverseEnv,
  createParentLocator,
  isNodeValue,
  isCompositeListValue,
  isParentObjectRef,
} from "../values";
import { applyReadPolicies } from "./policies";
import { indexTree } from "../forest/indexTree";
import { createChunkMatcher, createChunkProvider } from "./draftHelpers";
import {
  getDiffDescriptor,
  getFragmentNode,
  getOriginalDocument,
  isFragmentDocument,
  transformDocument,
  variablesAreEqual,
} from "./descriptor";
import { Cache, MissingFieldError } from "@apollo/client";
import {
  getActiveForest,
  getEffectiveReadLayers,
  touchOperation,
} from "./store";
import { assert } from "../jsutils/assert";
import { addTree, trackTreeNodes } from "../forest/addTree";
import { DirectiveNode, FragmentDefinitionNode } from "graphql";
import { OPERATION_HISTORY_SYMBOL } from "../descriptor/operation";

export function read<TData>(
  env: CacheEnv,
  store: Store,
  activeTransaction: Transaction | undefined,
  options: Cache.DiffOptions,
): Cache.DiffResult<TData> & { dangling?: Set<string> } {
  if (env.optimizeFragmentReads && isFragmentDocument(options.query)) {
    const chunk = readFragment(env, store, activeTransaction, options);
    if (chunk) {
      return {
        result: chunk.data as TData,
        complete: !chunk.missingFields?.size,
      };
    }
  }

  const { outputTree } = readOperation(
    env,
    store,
    activeTransaction,
    getDiffDescriptor(env, store, options),
    options,
  );

  // FIXME: this may break with optimistic layers - partialReadResults should be per layer?
  if (outputTree.incompleteChunks.size) {
    store.partialReadResults.add(outputTree.operation);
    return {
      result: outputTree.result.data as TData,
      complete: false,
      missing: [reportFirstMissingField(outputTree)],
      dangling: outputTree.danglingReferences,
    };
  }
  store.partialReadResults.delete(outputTree.operation);

  return {
    result: outputTree.result.data as TData,
    complete: true,
  };
}

function readOperation(
  env: CacheEnv,
  store: Store,
  activeTransaction: Transaction | undefined,
  operationDescriptor: OperationDescriptor,
  options: Cache.DiffOptions,
): TransformedResult {
  const { optimisticLayers, optimisticReadResults } = store;

  const optimistic = activeTransaction?.forceOptimistic ?? options.optimistic;

  // Normally, this is a data forest, but when executed within transaction - could be one of the optimistic layers
  const forest = getActiveForest(store, activeTransaction);
  touchOperation(env, store, operationDescriptor);

  const resultsMap =
    options.optimistic && optimisticLayers.length
      ? optimisticReadResults
      : forest.readResults;

  let readState = resultsMap.get(operationDescriptor);

  if (!readState || readState.dirtyNodes.size) {
    readState = growOutputTree(
      env,
      store,
      forest,
      operationDescriptor,
      optimistic,
      readState,
    );
    normalizeRootLevelTypeName(readState.outputTree);

    if (
      readState.outputTree.history.items.length &&
      !readState.outputTree.result.data[OPERATION_HISTORY_SYMBOL]
    ) {
      const outputTree = readState.outputTree;

      Object.defineProperty(outputTree.result.data, OPERATION_HISTORY_SYMBOL, {
        get() {
          return {
            totalEntries: outputTree.history.totalEntries,
            history: Array.from(outputTree.history),
          };
        },
        enumerable: false,
      });
    }

    resultsMap.set(operationDescriptor, readState);
  }
  const { outputTree } = readState;

  // Safeguard: make sure previous state doesn't leak outside write operation
  assert(!outputTree?.prev);

  return readState;
}

function readFragment(
  env: CacheEnv,
  store: Store,
  activeTransaction: Transaction | undefined,
  options: Cache.DiffOptions,
) {
  const id = options.id ?? options.rootId ?? "ROOT_QUERY";
  const document = env.addTypename
    ? transformDocument(options.query)
    : options.query;

  const fragment = getFragmentNode(document);
  const chunkMatcher = (chunk: ObjectChunk) => {
    if (chunk.missingFields?.size || chunk.partialFields?.size) {
      return false;
    }
    const aliases =
      chunk.selection.spreads?.get(fragment.name.value) ?? EMPTY_ARRAY;
    return aliases.some(
      (spread) =>
        !chunk.selection.skippedSpreads?.has(spread) &&
        // Note: currently only spreads with @nonreactive directive are supported
        spread.__refs.some((ref) =>
          ref.node.directives?.some(
            (d) =>
              d.name.value === "nonreactive" &&
              isConditionallyEnabled(d, chunk.operation.variablesWithDefaults),
          ),
        ),
    );
  };

  // Normally, this is a data forest, but when executed within transaction - could be one of the optimistic layers
  const forest = getActiveForest(store, activeTransaction);

  const ops = forest.operationsByNodes.get(id);
  for (const opId of ops ?? EMPTY_ARRAY) {
    const tree = forest.trees.get(opId);
    if (!tree || !hasMatchingFragment(tree, fragment, options.variables)) {
      continue;
    }
    const { outputTree } = readOperation(
      env,
      store,
      activeTransaction,
      tree.operation,
      options,
    );
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

function hasMatchingFragment(
  tree: IndexedTree,
  fragment: FragmentDefinitionNode,
  variables?: VariableValues,
): boolean {
  const treeFragment = tree.operation.fragmentMap.get(fragment.name.value);
  if (treeFragment !== fragment) {
    return false;
  }
  if (
    variables &&
    !variablesAreEqual(
      tree.operation.variablesWithDefaults,
      variables,
      Object.keys(variables),
    )
  ) {
    return false;
  }
  return true;
}

function normalizeRootLevelTypeName(tree: IndexedTree) {
  // Root-level __typename field may become out of sync due to difference in manual writes/optimistic results and network results
  //   so forcing consistent state matching operation selection set:
  const rootNode = tree.nodes.get(tree.rootNodeKey)?.[0];
  if (!rootNode || Object.isFrozen(rootNode.data)) {
    return;
  }
  if (rootNode.selection.fields.has("__typename")) {
    rootNode.data.__typename ??= rootNode.type || tree.operation.rootType;
  } else if (rootNode.data.__typename) {
    delete rootNode.data.__typename;
  }
}

function growOutputTree(
  env: CacheEnv,
  store: Store,
  forest: DataForest | OptimisticLayer,
  operation: OperationDescriptor,
  optimistic: boolean,
  previous?: TransformedResult,
): TransformedResult {
  let dataTree: IndexedTree | undefined = forest.trees.get(operation.id);
  for (const layer of getEffectiveReadLayers(store, forest, false)) {
    dataTree = layer.trees.get(operation.id);
    if (dataTree) {
      break;
    }
  }
  if (!dataTree) {
    dataTree = growDataTree(env, forest, operation);
    addTree(forest, dataTree);
  }
  const tree = applyTransformations(
    env,
    dataTree,
    getEffectiveReadLayers(store, forest, optimistic),
    previous,
  );
  indexReadPolicies(env, tree);

  if (tree === dataTree) {
    return { outputTree: tree, dirtyNodes: new Map() };
  }

  // ApolloCompat: this is to throw properly when field policy returns a ref which doesn't exist in cache
  for (const ref of tree.danglingReferences ?? EMPTY_ARRAY) {
    let ops = forest.operationsWithDanglingRefs.get(ref);
    if (!ops) {
      ops = new Set<OperationDescriptor>();
      forest.operationsWithDanglingRefs.set(ref, ops);
    }
    ops.add(tree.operation);
  }

  tree.prev = null;
  trackTreeNodes(forest, tree);
  return { outputTree: tree, dirtyNodes: new Map() };
}

function growDataTree(
  env: CacheEnv,
  forest: DataForest | OptimisticLayer,
  operationDescriptor: OperationDescriptor,
): DataTree {
  const { possibleSelections, rootNodeKey, rootType } = operationDescriptor;

  const rootDraft: ObjectDraft = createDraft(
    operationDescriptor,
    possibleSelections,
    rootNodeKey,
    rootType,
  );
  hydrateDraft(env, rootDraft, createChunkProvider([forest]));

  // ApolloCompat: mostly added for tests
  if (
    !rootDraft.data &&
    rootNodeKey === "ROOT_QUERY" &&
    rootDraft.selection.fields?.size === 1 &&
    rootDraft.selection.fields.has("__typename")
  ) {
    rootDraft.data = {
      __typename: env.rootTypes?.query ?? "Query",
    } as SourceObject;
  }
  const source = { data: rootDraft?.data ?? ({} as SourceObject) };
  const tree: DataTree = indexTree(
    env,
    operationDescriptor,
    source,
    rootDraft.missingFields,
  );
  tree.grown = true;
  return tree;
}

/**
 * Executes selections of the input tree using node chunks from provided layers.
 * Output tree contains a blend of data from different layers. Data from earlier layers has priority.
 */
function applyTransformations(
  env: CacheEnv,
  inputTree: ResultTree,
  dataLayers: (OptimisticLayer | DataForest)[],
  previous?: TransformedResult,
): IndexedTree {
  // This effectively disables recycling when optimistic layers are present, which is suboptimal.
  const hasOptimisticLayers = dataLayers.length > 1;
  const operation = inputTree.operation;

  // TODO: inputTree.incompleteChunks must be updated on write, then we can remove size check
  if (!inputTree.incompleteChunks.size && !hasOptimisticLayers) {
    // Fast-path: skip optimistic transforms
    return applyReadPolicies(env, dataLayers, env.readPolicies, inputTree);
  }

  // For dirty nodes we should not recycle existing chunks
  const dirtyNodes =
    previous?.dirtyNodes ??
    resolveAffectedOptimisticNodes(inputTree, dataLayers);

  if (!inputTree.incompleteChunks.size && !dirtyNodes.size) {
    // Fast-path: skip optimistic transforms
    return applyReadPolicies(env, dataLayers, env.readPolicies, inputTree);
  }

  // Slow-path: apply optimistic layers first
  const optimisticDraft = hydrateDraft(
    env,
    createDraft(
      operation,
      operation.possibleSelections,
      operation.rootNodeKey,
      operation.rootType,
    ),
    createChunkProvider(dataLayers),
    createChunkMatcher(dataLayers, false, dirtyNodes),
  );
  const optimisticTree = indexTree(
    env,
    operation,
    { data: optimisticDraft.data as SourceObject },
    optimisticDraft.missingFields,
    inputTree,
  );
  return applyReadPolicies(env, dataLayers, env.readPolicies, optimisticTree);
}

function indexReadPolicies(env: CacheEnv, tree: ResultTree) {
  // TODO: this seems to be unnecessary anymore, verify and remove
  //   The only reason why we still use it is complex read policies that read fields from nodes that are not directly
  //   listed in the final tree. Thus, to properly invalidate those cases we must additionally track dependent
  //   nodes and their fields. Today, we invalidate the whole node on any change if it has read policy.
  const { readPolicies } = env;

  if (!readPolicies.size) {
    return;
  }
  const typeNames =
    readPolicies.size > tree.typeMap.size
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
          while (ref && !isRootRef(ref) && !ref.parent.hasNestedReadPolicies) {
            ref.parent.hasNestedReadPolicies = true;
            ref = tree.dataMap.get(ref.parent.data);
          }
        }
      }
    }
  }
}

function reportFirstMissingField(tree: IndexedTree): MissingFieldError {
  const pathEnv: TraverseEnv = {
    findParent: createParentLocator(tree.dataMap),
  };
  const [chunk] = tree.incompleteChunks;
  const path = getDataPathForDebugging(pathEnv, chunk);

  let message;
  if (isObjectValue(chunk)) {
    assert(chunk.missingFields?.size);
    const [missingField] = chunk.missingFields;

    message =
      `Can't find field '${missingField.name}' on ` +
      (chunk.key
        ? chunk.key + ` object`
        : `object ` + inspect(chunk.data, null, 2));
    path.push(missingField.name);
  } else {
    assert(chunk.missingItems?.size);
    const [missingIndex] = chunk.missingItems;
    message =
      `Can't find item at index ${missingIndex} on array ` +
      inspect(chunk.data, null, 2) +
      `\n` +
      `It could have been deleted using cache.modify, cache.evict or written incorrectly with manual cache.write`;
    path.push(missingIndex);
  }

  return new MissingFieldError(
    message,
    path,
    getOriginalDocument(tree.operation.document),
    tree.operation.variables,
  );
}

function resolveAffectedOptimisticNodes(
  inputTree: ResultTree,
  dataLayers: (OptimisticLayer | DataForest)[],
): DirtyNodeMap {
  if (dataLayers.length <= 1) {
    return EMPTY_MAP;
  }
  const result: DirtyNodeMap = new Map();

  for (let i = 0; i < dataLayers.length - 1; i++) {
    // Note: last layer is the data layer
    const optimisticLayer = dataLayers[i];
    const nodeKeys =
      inputTree.nodes.size < optimisticLayer.operationsByNodes.size
        ? inputTree.nodes.keys()
        : optimisticLayer.operationsByNodes.keys();

    for (const nodeKey of nodeKeys) {
      if (
        optimisticLayer.operationsByNodes.has(nodeKey) &&
        inputTree.nodes.has(nodeKey)
      ) {
        result.set(nodeKey, EMPTY_SET as Set<FieldName>);
      }
    }
  }
  // Add parent nodes to make sure they are not recycled
  //   (when parents are recycled, nested affected nodes won't be updated properly)
  appendParentNodes(inputTree, result);
  return result;
}

function appendParentNodes(inputTree: ResultTree, dirtyNodes: DirtyNodeMap) {
  const findParent = createParentLocator(inputTree.dataMap);
  for (const nodeKey of dirtyNodes.keys()) {
    const chunks = inputTree.nodes.get(nodeKey);
    for (const chunk of chunks ?? EMPTY_ARRAY) {
      let parentInfo = findParent(chunk);
      while (!isRootRef(parentInfo)) {
        if (isParentObjectRef(parentInfo) && isNodeValue(parentInfo.parent)) {
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
        if (
          !isCompositeListValue(parentInfo.parent) &&
          !isObjectValue(parentInfo.parent)
        ) {
          break;
        }
        parentInfo = findParent(parentInfo.parent);
      }
    }
  }
}

const isConditionallyEnabled = (
  directive: DirectiveNode,
  variables: VariableValues,
): boolean => {
  const ifArgument = directive.arguments?.[0];
  if (!ifArgument) {
    return true;
  }
  assert(ifArgument.name.value === "if");
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
