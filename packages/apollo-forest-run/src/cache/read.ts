import type { FieldReadFunction } from "@apollo/client/cache/inmemory/policies";
import type {
  FieldName,
  OperationDescriptor,
  TypeName,
} from "../descriptor/types";
import type { ObjectDraft, SourceObject } from "../values/types";
import type { IndexedTree } from "../forest/types";
import type {
  CacheEnv,
  DataForest,
  DataTree,
  OptimisticLayer,
  ResultTree,
  Store,
  Transaction,
} from "./types";
import {
  createDraft,
  hydrateDraft,
  getDataPathForDebugging,
  isObjectValue,
  isRootRef,
  TraverseEnv,
  createParentLocator,
} from "../values";
import { applyReadPolicies } from "./policies";
import { indexTree } from "../forest/indexTree";
import { createChunkMatcher, createChunkProvider } from "./draftHelpers";
import { getDiffDescriptor, getOriginalDocument } from "./descriptor";
import { Cache, MissingFieldError } from "@apollo/client";
import {
  getActiveForest,
  getEffectiveReadLayers,
  touchOperation,
} from "./store";
import { assert } from "../jsutils/assert";
import { addTree, trackTreeNodes } from "../forest/addTree";

export function read<TData>(
  env: CacheEnv,
  store: Store,
  activeTransaction: Transaction | undefined,
  options: Cache.DiffOptions,
): Cache.DiffResult<TData> & { dangling?: Set<string> } {
  const { partialReadResults, optimisticLayers, optimisticReadResults } = store;

  const optimistic = activeTransaction?.forceOptimistic ?? options.optimistic;

  // Normally, this is a data forest, but when executed within transaction - could be one of the optimistic layers
  const forest = getActiveForest(store, activeTransaction);
  const operationDescriptor = getDiffDescriptor(env, store, options);
  touchOperation(env, store, operationDescriptor);

  const resultsMap =
    options.optimistic && optimisticLayers.length
      ? optimisticReadResults
      : forest.readResults;

  let readState = resultsMap.get(operationDescriptor);

  if (!readState || readState.dirtyNodes.size) {
    // TODO: more granular updates, as we know all dirty nodes and their dirty fields
    readState = {
      outputTree: growOutputTree(
        env,
        store,
        forest,
        operationDescriptor,
        optimistic,
      ),
      dirtyNodes: new Map(),
    };
    normalizeRootLevelTypeName(readState.outputTree);
    resultsMap.set(operationDescriptor, readState);
  }
  const { outputTree } = readState;

  // Safeguard: make sure previous state doesn't leak outside write operation
  assert(!outputTree?.prev);

  // FIXME: this may break with optimistic layers - partialReadResults should be per layer?
  if (outputTree.incompleteChunks.size) {
    partialReadResults.add(operationDescriptor);
    return {
      result: outputTree.result.data,
      complete: false,
      missing: [reportFirstMissingField(outputTree)],
      dangling: outputTree.danglingReferences,
    } as Cache.DiffResult<any>;
  }
  partialReadResults.delete(operationDescriptor);
  return {
    result: outputTree.result.data,
    complete: true,
  } as Cache.DiffResult<any>;
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
) {
  // See if we can just use primary data tree
  let dataTree = forest.trees.get(operation.id);

  if (!dataTree) {
    dataTree = growDataTree(env, forest, operation);
    addTree(forest, dataTree);
  }
  const tree = applyTransformations(
    dataTree,
    env.readPolicies,
    getEffectiveReadLayers(store, forest, optimistic),
    env,
  );
  indexReadPolicies(env, tree);

  if (tree === dataTree) {
    return tree;
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
  return tree;
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
  inputTree: ResultTree,
  readPoliciesMap: Map<TypeName, Map<FieldName, FieldReadFunction>>,
  dataLayers: (OptimisticLayer | DataForest)[],
  env: CacheEnv,
): IndexedTree {
  // This effectively disables recycling when optimistic layers are present, which is suboptimal.
  const hasOptimisticLayers = dataLayers.length > 1;
  const operation = inputTree.operation;

  // TODO: inputTree.incompleteChunks must be updated on write, then we can remove size check
  if (!inputTree.incompleteChunks.size && !hasOptimisticLayers) {
    // Fast-path: skip optimistic layers
    return applyReadPolicies(env, dataLayers, readPoliciesMap, inputTree);
  }

  // Slow-path: apply optimistic layers first
  // TODO: hydrate dirty fields only!
  const optimisticDraft = hydrateDraft(
    env,
    createDraft(
      operation,
      operation.possibleSelections,
      operation.rootNodeKey,
      operation.rootType,
    ),
    createChunkProvider(dataLayers),
    createChunkMatcher(dataLayers),
  );
  const optimisticTree = indexTree(
    env,
    operation,
    { data: optimisticDraft.data as SourceObject },
    optimisticDraft.missingFields,
    inputTree,
  );
  return applyReadPolicies(env, dataLayers, readPoliciesMap, optimisticTree);
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
  const path: Record<string, unknown> = {};
  const tail = getDataPathForDebugging(pathEnv, chunk).reduce(
    (acc, segment) => (acc[segment] = {}),
    path,
  );

  let message;
  if (isObjectValue(chunk)) {
    assert(chunk.missingFields?.size);
    const [missingField] = chunk.missingFields;

    message =
      `Can't find field '${missingField.name}' on ` +
      (chunk.key
        ? chunk.key + ` object`
        : `object ` + inspect(chunk.data, null, 2));
    tail[missingField.name] = message;
  } else {
    assert(chunk.missingItems?.size);
    const [missingIndex] = chunk.missingItems;
    message =
      `Can't find item at index ${missingIndex} on array ` +
      inspect(chunk.data, null, 2) +
      `\n` +
      `It could have been deleted using cache.modify, cache.evict or written incorrectly with manual cache.write`;
    tail[missingIndex] = message;
  }

  return new MissingFieldError(
    message,
    path as MissingFieldError["path"],
    getOriginalDocument(tree.operation.document),
    tree.operation.variables,
  );
}

const inspect = JSON.stringify.bind(JSON);
const EMPTY_ARRAY = Object.freeze([]);
