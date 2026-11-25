import type {
  IndexedOperationFragment,
  IndexedTree,
  OperationFragmentRoot,
  UpdateTreeResult,
} from "../forest/types";
import type {
  CompositeListChunk,
  GraphChunk,
  ObjectChunk,
  OperationResult,
  ParentLocator,
  SourceObject,
} from "../values/types";
import type {
  CacheEnv,
  DataForest,
  DataTree,
  DeferTarget,
  ExecutionResult,
  IncrementalDeferResult,
  IncrementalExecution,
  ModifyResult,
  OperationFragmentWriteResult,
  OperationWriteResult,
  OptimisticLayer,
  PendingId,
  Store,
  SubsequentIncrementalExecutionResult,
  Transaction,
  WriteOptions,
  WriteResult,
} from "./types";
import type {
  FieldInfo,
  NodeKey,
  OperationDescriptor,
  PossibleSelections,
  ResponsePath,
} from "../descriptor/types";
import { assert } from "../jsutils/assert";
import {
  resolveResultDescriptor,
  resolveOperationDescriptor,
  ROOT_NODES,
  ROOT_TYPES,
} from "./descriptor";
import { applyMergePolicies } from "./policies";
import {
  getActiveForest,
  getEffectiveReadLayers,
  touchOperation,
} from "./store";
import { diffTree, GraphDifference } from "../diff/diffTree";
import {
  resolveAffectedOperations,
  updateAffectedTrees,
} from "../forest/updateForest";
import { indexOperationFragment, indexTree } from "../forest/indexTree";
import { createTreeParentLocator } from "../forest/parentLocator";
import { describeOperationFragment } from "../descriptor/operation";
import {
  createParentLocator,
  isCompositeListValue,
  isNodeValue,
  isObjectValue,
  isParentListRef,
  isParentObjectRef,
  isSourceObject,
  markAsPartial,
  resolveFieldChunk,
  resolveListItemChunk,
  TraverseEnv,
} from "../values";
import { NodeDifferenceMap } from "../forest/updateTree";
import { getNodeChunks } from "./draftHelpers";
import { replaceTree } from "../forest/addTree";
import { invalidateReadResults } from "./invalidate";
import { IndexedForest } from "../forest/types";

export function write(
  env: CacheEnv,
  store: Store,
  activeTransaction: Transaction,
  options: WriteOptions,
): OperationWriteResult {
  const { mergePolicies, objectKey, addTypename, keyMap } = env;
  const targetForest = getActiveForest(store, activeTransaction);

  // Subsequent results of incremental delivery are written by writeSubsequentResult
  const { execution } = options;
  assert(!execution || !isSubsequentResult(execution));

  // An initial result of incremental delivery is written as a regular (partial) result
  const result = execution ? execution.data : options.result;
  const writeData = typeof result === "object" && result !== null ? result : {};
  const rootNodeKey = options.dataId ?? objectKey(writeData);
  assert(rootNodeKey !== false);

  // ApolloCompat (apollo allows writing fragments without proper id in the data)
  if (rootNodeKey !== undefined && options.dataId) {
    keyMap?.set(writeData, rootNodeKey);
  }
  const operationDescriptor = resolveOperationDescriptor(
    env,
    store,
    options.query,
    options.variables,
    rootNodeKey,
  );
  touchOperation(env, store, operationDescriptor);
  if (!operationDescriptor.cache) {
    // Results of this operation are never stored, so nothing will ever evict its descriptor.
    // Remember it, so that the outermost transaction can release it on completion.
    // (the set only exists when `env.cleanupNonCacheableOperations` is enabled)
    activeTransaction.nonCacheableOperations?.add(operationDescriptor);
  }
  const operationResult: OperationResult = { data: writeData };

  if (
    !ROOT_TYPES.includes(operationDescriptor.rootType) &&
    rootNodeKey === undefined
  ) {
    throw new Error(`Could not identify object ${inspect(writeData)}`);
  }

  let existingResult = getExistingResult(
    env,
    store,
    targetForest,
    operationDescriptor,
  );
  const existingData = existingResult?.result.data;

  // Safeguard: make sure previous state doesn't leak outside write operation
  assert(!existingResult?.prev);

  if (writeData === existingData && existingResult) {
    return {
      options,
      incoming: existingResult,
      affected: [],
      difference: undefined,
      affectedNodes: new Set(),
      updateStats: [],
    };
  }

  if (!ROOT_NODES.includes(operationDescriptor.rootNodeKey)) {
    const typeName = resolveExtraRootNodeType(
      env,
      store,
      operationDescriptor,
      writeData,
    );
    if (addTypename && typeName && !writeData["__typename"]) {
      writeData["__typename"] = typeName;
    }
    targetForest.extraRootIds.set(
      operationDescriptor.rootNodeKey,
      typeName ?? "",
    );
    operationDescriptor.rootType = typeName ?? "";
  }

  const incomingResult = indexTree(
    env,
    operationDescriptor,
    operationResult,
    undefined,
    existingResult,
  );

  // ApolloCompat: necessary for fragment writes with custom ids
  if (options.dataId && incomingResult.rootNodeKey !== options.dataId) {
    const rootNode = incomingResult.nodes.get(incomingResult.rootNodeKey);
    assert(rootNode);
    incomingResult.nodes.set(options.dataId, rootNode);
    incomingResult.nodes.delete(incomingResult.rootNodeKey);
    incomingResult.rootNodeKey = options.dataId;
  }

  const modifiedIncomingResult = applyMergePolicies(
    env,
    getEffectiveReadLayers(store, targetForest, false),
    mergePolicies,
    incomingResult,
    options.overwrite ?? false,
  );

  if (execution) {
    updateIncrementalExecution(
      store,
      targetForest,
      operationDescriptor,
      execution,
      incomingResult,
      modifiedIncomingResult,
    );
  }

  const difference = diffIncomingTree(
    targetForest,
    modifiedIncomingResult,
    env,
  );

  if (
    existingResult &&
    existingResult.grown &&
    existingResult.incompleteChunks.size > 0
  ) {
    // Remove incomplete placeholder tree (saves unnecessary update)
    targetForest.trees.delete(operationDescriptor.id);
    existingResult = undefined;
  }

  // This function returns exhaustive list of affected operations. It may contain false-positives,
  // because operationsWithNodes also reflects nodes from optimistic updates and read policy results
  // (which may not exist in the main forest trees)
  const affectedOperations = resolveAffectedOperations(
    targetForest,
    difference,
  );

  const chunkProvider = (key: NodeKey) =>
    getNodeChunks(getEffectiveReadLayers(store, targetForest, false), key);

  const allUpdates = updateAffectedTrees(
    env,
    targetForest,
    affectedOperations,
    chunkProvider,
    modifiedIncomingResult,
  );

  if (!existingResult && shouldCache(targetForest, operationDescriptor)) {
    affectedOperations.set(operationDescriptor, difference.nodeDifference);
    // Note: even with existingResult === undefined the tree for this operation may still exist in the cache
    //   (when existingResult is resolved with a different key descriptor due to key variables)
    // TODO: replace with addTree and add a proper check for keyVariables
    replaceTree(env, targetForest, modifiedIncomingResult);
  }

  appendAffectedOperationsFromOtherLayers(
    env,
    store,
    affectedOperations,
    targetForest,
    modifiedIncomingResult,
  );

  invalidateReadResults(
    env,
    store,
    targetForest,
    difference,
    affectedOperations,
    modifiedIncomingResult,
  );
  incomingResult.prev = null;
  modifiedIncomingResult.prev = null;

  return {
    options,
    incoming: modifiedIncomingResult,
    affected: affectedOperations.keys(),
    difference,
    affectedNodes: aggregateAllAffectedNodes(difference, allUpdates),
    updateStats: allUpdates.map((update) => update.stats ?? null),
  };
}

/**
 * Writes subsequent results of incremental delivery (`@defer`): data of deferred fragments is written to objects
 * of the stored tree the fragments were deferred on (see `DeferTarget`). Objects missing in the stored tree are not created.
 *
 * Results for objects with the same selection are written together (one operation fragment per selection).
 */
export function writeSubsequentResult(
  env: CacheEnv,
  store: Store,
  activeTransaction: Transaction,
  options: WriteOptions,
  execution: SubsequentIncrementalExecutionResult & ExecutionResult,
): OperationFragmentWriteResult[] {
  const operation = resolveOperationDescriptor(
    env,
    store,
    options.query,
    options.variables,
    options.dataId,
  );
  const incremental = store.incrementalExecutions.get(operation);
  if (!incremental || incremental.key !== execution.key) {
    // Results of an unknown or a superseded execution
    return [];
  }
  touchOperation(env, store, operation);
  const targetForest = getActiveForest(store, activeTransaction);
  // TODO: register targets of `execution.pending` (fragments deferred within delivered fragments, next PR)
  const results: OperationFragmentWriteResult[] = [];
  let entries = collectDeferredResults(env, incremental, execution);
  while (entries.length) {
    // Objects at sub-paths may be delivered by other results of the payload: those are written in the next round
    const tree = getExistingResult(env, store, targetForest, operation);
    const { groups, unresolved } = groupDeferredResults(tree, entries);
    if (!groups.size) {
      break;
    }
    for (const [selections, group] of groups) {
      results.push(
        ...writeDeferredResults(
          env,
          store,
          targetForest,
          operation,
          options,
          selections,
          group,
        ),
      );
    }
    entries = unresolved;
  }
  for (const { id } of execution.completed ?? EMPTY_ARRAY) {
    incremental.pending.delete(id);
  }
  if (!execution.hasNext) {
    store.incrementalExecutions.delete(operation);
  }
  return results;
}

function writeDeferredResults(
  env: CacheEnv,
  store: Store,
  targetForest: DataForest | OptimisticLayer,
  operation: OperationDescriptor,
  options: WriteOptions,
  selections: PossibleSelections,
  entries: DeferredResultEntry[],
): OperationFragmentWriteResult[] {
  // Every write replaces the stored tree, so targets are resolved in its current state
  const tree = getExistingResult(env, store, targetForest, operation);
  if (!tree) {
    return [];
  }
  const roots = resolveFragmentRoots(tree, entries);
  if (!roots.length) {
    return [];
  }
  const fragment = describeOperationFragment(
    tree.operation.env,
    tree.operation,
    selections,
  );
  const incoming = indexOperationFragment(
    env,
    fragment,
    createTreeParentLocator(tree),
    roots,
  );
  // TODO: merge policies of fragment fields (next PR)
  return [writeOperationFragment(env, store, targetForest, options, incoming)];
}

function writeOperationFragment(
  env: CacheEnv,
  store: Store,
  targetForest: DataForest | OptimisticLayer,
  options: WriteOptions,
  incoming: IndexedOperationFragment,
): OperationFragmentWriteResult {
  const difference = diffIncomingTree(targetForest, incoming, env);
  const affectedOperations = resolveAffectedOperations(
    targetForest,
    difference,
  );
  const chunkProvider = (key: NodeKey) =>
    getNodeChunks(getEffectiveReadLayers(store, targetForest, false), key);

  // TODO: history entries of fragment writes (history only records incoming trees of operations)
  const allUpdates = updateAffectedTrees(
    env,
    targetForest,
    affectedOperations,
    chunkProvider,
  );
  appendAffectedOperationsFromOtherLayers(
    env,
    store,
    affectedOperations,
    targetForest,
    incoming,
  );
  // Note: invalidation of incomplete read results is conservative without the incoming operation tree
  invalidateReadResults(
    env,
    store,
    targetForest,
    difference,
    affectedOperations,
  );
  return {
    options,
    incoming,
    affected: affectedOperations.keys(),
    difference,
    affectedNodes: aggregateAllAffectedNodes(difference, allUpdates),
    updateStats: allUpdates.map((update) => update.stats ?? null),
  };
}

function diffIncomingTree(
  targetForest: DataForest | OptimisticLayer,
  incoming: IndexedTree | IndexedOperationFragment,
  env: CacheEnv,
): GraphDifference {
  const difference = diffTree(targetForest, incoming, env);
  if (difference.errors.length) {
    processDiffErrors(targetForest, incoming, difference);
  }
  return difference;
}

/**
 * Remembers targets of deferred fragments announced by the initial result of an incremental execution
 * (replaces the previous execution of the operation).
 *
 * Paths are resolved in the indexed result, addresses in the result with merge policies applied
 * (merge policies may move objects, e.g. append a page to existing list items).
 */
function updateIncrementalExecution(
  store: Store,
  targetForest: DataForest | OptimisticLayer,
  operation: OperationDescriptor,
  execution: ExecutionResult,
  indexed: IndexedTree,
  merged: IndexedTree,
) {
  if (
    !("hasNext" in execution) ||
    !execution.hasNext ||
    !execution.pending?.length ||
    !shouldCache(targetForest, operation)
  ) {
    store.incrementalExecutions.delete(operation);
    return;
  }
  const root = indexed.dataMap.get(indexed.result.data)?.value;
  assert(root && isObjectValue(root));
  const findMergedParent = createParentLocator(merged.dataMap);
  const pending = new Map<PendingId, DeferTarget>();
  for (const { id, path } of execution.pending) {
    const chunk = resolveResponsePath(root, path);
    const mergedChunk = chunk
      ? merged.dataMap.get(chunk.data)?.value
      : undefined;
    const target =
      mergedChunk && isObjectValue(mergedChunk)
        ? getDeferTarget(findMergedParent, mergedChunk)
        : undefined;
    if (target) {
      pending.set(id, target);
    }
  }
  const incremental: IncrementalExecution = { key: execution.key, pending };
  store.incrementalExecutions.set(operation, incremental);
}

type DeferredResultEntry = {
  target: DeferTarget;
  subPath: ResponsePath | undefined;
  data: SourceObject;
};

function collectDeferredResults(
  env: CacheEnv,
  incremental: IncrementalExecution,
  execution: SubsequentIncrementalExecutionResult,
): DeferredResultEntry[] {
  const entries: DeferredResultEntry[] = [];
  for (const result of execution.incremental ?? EMPTY_ARRAY) {
    if (result.id === undefined) {
      // TODO: the earlier draft format (`path` and `label`, next PR)
      env.logger?.warnOnce(
        "incremental_format_not_supported",
        "Incremental results without `id` (the 2022 draft format) are not supported yet and are ignored",
      );
      continue;
    }
    // Note: streamed list items (`items`) are not supported
    if (!isDeferResult(result) || !isSourceObject(result.data)) {
      continue;
    }
    const target = incremental.pending.get(result.id);
    if (target) {
      entries.push({ target, subPath: result.subPath, data: result.data });
    }
  }
  return entries;
}

// Groups results by the selection of their target objects (one operation fragment per selection)
function groupDeferredResults(
  tree: IndexedTree | undefined,
  entries: DeferredResultEntry[],
): {
  groups: Map<PossibleSelections, DeferredResultEntry[]>;
  unresolved: DeferredResultEntry[];
} {
  const groups = new Map<PossibleSelections, DeferredResultEntry[]>();
  const unresolved: DeferredResultEntry[] = [];
  for (const entry of entries) {
    const chunk = tree ? resolveEntryTarget(tree, entry) : undefined;
    if (!chunk) {
      unresolved.push(entry);
      continue;
    }
    const group = groups.get(chunk.possibleSelections);
    if (group) {
      group.push(entry);
    } else {
      groups.set(chunk.possibleSelections, [entry]);
    }
  }
  return { groups, unresolved };
}
function resolveFragmentRoots(
  tree: IndexedTree,
  entries: DeferredResultEntry[],
): OperationFragmentRoot[] {
  const roots = new Map<ObjectChunk, OperationFragmentRoot>();
  for (const entry of entries) {
    const target = resolveEntryTarget(tree, entry);
    if (!target) {
      continue;
    }
    const root = roots.get(target);
    if (root) {
      // Results of different fragments deferred on the same object
      root.data = mergeSourceObjects(root.data, entry.data);
    } else {
      roots.set(target, { data: withTypename(entry.data, target), target });
    }
  }
  return [...roots.values()];
}

function resolveEntryTarget(
  tree: IndexedTree,
  { target, subPath }: DeferredResultEntry,
): ObjectChunk | undefined {
  const chunk = resolveDeferTarget(tree, target);
  return chunk && subPath?.length ? resolveResponsePath(chunk, subPath) : chunk;
}

function resolveDeferTarget(
  tree: IndexedTree,
  target: DeferTarget,
): ObjectChunk | undefined {
  for (const node of tree.nodes.get(target.nodeKey) ?? EMPTY_ARRAY) {
    if (node.possibleSelections !== target.nodeSelections) {
      continue;
    }
    let value: GraphChunk | undefined = node;
    for (const step of target.path) {
      value =
        typeof step === "number"
          ? resolveListItem(value, step)
          : isObjectValue(value) && hasField(value, step)
          ? resolveObjectField(value, step)
          : undefined;
      if (!value) {
        break;
      }
    }
    if (value && isObjectValue(value)) {
      return value;
    }
  }
  return undefined;
}

// Resolves an object by response keys and list indexes (e.g. paths of incremental results)
function resolveResponsePath(
  chunk: ObjectChunk,
  path: ResponsePath,
): ObjectChunk | undefined {
  let value: GraphChunk | undefined = chunk;
  for (const step of path) {
    if (typeof step === "number") {
      value = resolveListItem(value, step);
    } else if (isObjectValue(value)) {
      const field = value.selection.fieldQueue.find(
        (field) => field.dataKey === step,
      );
      value = field ? resolveObjectField(value, field) : undefined;
    } else {
      value = undefined;
    }
    if (!value) {
      return undefined;
    }
  }
  return isObjectValue(value) ? value : undefined;
}

function resolveObjectField(
  chunk: ObjectChunk,
  field: FieldInfo,
): GraphChunk | undefined {
  return field.selection &&
    chunk.data[field.dataKey] !== undefined &&
    !chunk.missingFields?.has(field)
    ? resolveFieldChunk(chunk, field)
    : undefined;
}

function resolveListItem(
  value: GraphChunk,
  index: number,
): GraphChunk | undefined {
  return isCompositeListValue(value) &&
    index >= 0 &&
    index < value.data.length &&
    !value.missingItems?.has(index)
    ? resolveListItemChunk(value, index)
    : undefined;
}

function hasField(chunk: ObjectChunk, field: FieldInfo): boolean {
  return chunk.selection.fields.get(field.name)?.includes(field) ?? false;
}

function getDeferTarget(
  findParent: ParentLocator,
  chunk: ObjectChunk,
): DeferTarget | undefined {
  const path: (FieldInfo | number)[] = [];
  let current: ObjectChunk | CompositeListChunk = chunk;
  while (!isNodeValue(current)) {
    const parentRef = findParent(current);
    if (isParentObjectRef(parentRef)) {
      path.push(parentRef.field);
      current = parentRef.parent;
    } else if (isParentListRef(parentRef)) {
      path.push(parentRef.index);
      current = parentRef.parent;
    } else {
      return undefined;
    }
  }
  path.reverse();
  return {
    nodeKey: current.key,
    nodeSelections: current.possibleSelections,
    path,
  };
}

function isDeferResult(
  result: NonNullable<
    SubsequentIncrementalExecutionResult["incremental"]
  >[number],
): result is IncrementalDeferResult {
  return "data" in result;
}

// TODO: remove when indexOperationFragment types roots by their targets (roots without `__typename` are untyped)
function withTypename(data: SourceObject, target: ObjectChunk): SourceObject {
  return target.type && data.__typename === undefined
    ? { ...data, __typename: target.type }
    : data;
}

function mergeSourceObjects(
  target: SourceObject,
  source: SourceObject,
): SourceObject {
  const result: SourceObject = { ...target };
  for (const key of Object.keys(source)) {
    const existing = result[key];
    const incoming = source[key];
    result[key] =
      isSourceObject(existing) && isSourceObject(incoming)
        ? mergeSourceObjects(existing, incoming)
        : incoming;
  }
  return result;
}

function appendAffectedOperationsFromOtherLayers(
  env: CacheEnv,
  store: Store,
  affectedForestOperationsMutable: Map<OperationDescriptor, NodeDifferenceMap>,
  targetForest: DataForest | OptimisticLayer,
  incomingResult: IndexedTree | IndexedOperationFragment,
) {
  // Optimistic reads go through all existing layers
  //  And those layers may be affected by incoming results too, so we actually need to diff all other layers too
  //  TODO: just write to all effective layers?
  for (const layer of getEffectiveReadLayers(store, targetForest, true)) {
    if (layer === targetForest) {
      continue;
    }
    resolveAffectedOperations(
      layer,
      diffTree(layer, incomingResult, env),
      affectedForestOperationsMutable,
    );
  }
}

function processDiffErrors(
  forest: DataForest | OptimisticLayer,
  model: IndexedTree | IndexedOperationFragment,
  difference: GraphDifference,
) {
  const pathEnv: TraverseEnv = {
    findParent: (chunk) => {
      const tree = forest.trees.get(chunk.operation.id);
      const parentInfo = tree?.dataMap.get(chunk.data);
      assert(parentInfo);
      return parentInfo;
    },
  };

  for (const diffError of difference.errors) {
    if (diffError.kind === "MissingFields") {
      for (const baseChunkError of diffError.base ?? EMPTY_ARRAY) {
        // Missing chunks
        const chunk = baseChunkError.chunk;
        chunk.missingFields ??= new Set();
        for (const field of baseChunkError.missingFields) {
          chunk.missingFields.add(field);
        }
        const tree = forest.trees.get(chunk.operation.id);
        if (tree) {
          tree.incompleteChunks.add(chunk);
        }
        const parentInfo = pathEnv.findParent(chunk);
        markAsPartial(pathEnv, parentInfo);
      }

      pathEnv.findParent = createParentLocator(model.dataMap);
      for (const modelChunkError of diffError.model ?? EMPTY_ARRAY) {
        // Missing chunks
        const chunk = modelChunkError.chunk;
        chunk.missingFields ??= new Set();
        for (const field of modelChunkError.missingFields) {
          chunk.missingFields.add(field);
        }
        const parentInfo = pathEnv.findParent(chunk);
        markAsPartial(pathEnv, parentInfo);
        model.incompleteChunks.add(chunk);
      }
    }
  }
}

function getExistingResult(
  env: CacheEnv,
  store: Store,
  targetForest: IndexedForest,
  operation: OperationDescriptor,
): DataTree | undefined {
  const op = resolveResultDescriptor(env, store, operation);
  return targetForest.trees.get(op.id);
}

function shouldCache(
  targetForest: DataForest | OptimisticLayer,
  operation: OperationDescriptor,
) {
  // Always cache results for optimistic layers (even if operation is not cacheable, e.g. it is a mutation)
  if (targetForest.layerTag !== null) {
    return true;
  }
  return operation.cache;
}

function aggregateAllAffectedNodes(
  difference: GraphDifference,
  updates: UpdateTreeResult[],
): Set<NodeKey> {
  const accumulator = new Set<NodeKey>([
    ...difference.newNodes,
    ...difference.nodeDifference.keys(),
  ]);
  for (const { affectedNodes } of updates) {
    for (const nodeKey of affectedNodes) {
      accumulator.add(nodeKey);
    }
  }
  return accumulator;
}

function resolveExtraRootNodeType(
  env: CacheEnv,
  store: Store,
  operationDescriptor: OperationDescriptor,
  data: Record<string, unknown> & { __typename?: string },
): string | undefined {
  if (data["__typename"]) {
    return data["__typename"];
  }
  // Try fragment condition (fragments on abstract types are ignored)
  if (operationDescriptor.kind === "DetachedFragment") {
    const [fragmentDef] = operationDescriptor.fragmentMap.values();
    const typeName = fragmentDef?.typeCondition.name.value;
    if (!env.possibleTypes?.[typeName]) {
      return typeName;
    }
  }
  // Finally, try from store
  const [chunk] = getNodeChunks(
    [store.dataForest, ...store.optimisticLayers],
    operationDescriptor.rootNodeKey,
  );
  if (chunk?.type) {
    return chunk.type;
  }
  return undefined;
}

const inspect = JSON.stringify.bind(JSON);
const EMPTY_ARRAY = Object.freeze([]);

export function isWrite(op: WriteResult | ModifyResult): op is WriteResult {
  return "incoming" in op; // write has "incoming" tree
}

export function isSubsequentResult(
  execution: ExecutionResult,
): execution is SubsequentIncrementalExecutionResult & ExecutionResult {
  return !("data" in execution);
}
