import type { IndexedTree, UpdateTreeResult } from "../forest/types";
import type {
  CompositeListChunk,
  GraphChunk,
  ObjectChunk,
  OperationResult,
  ParentLocator,
} from "../values/types";
import type {
  CacheEnv,
  DataForest,
  DataTree,
  DeferredResultEntry,
  DeferPlaceholder,
  DeliveredFields,
  ExecutionResult,
  IncrementalDeferResult,
  IncrementalExecution,
  ModifyResult,
  OptimisticLayer,
  PendingAnchor,
  PendingResult,
  ResultData,
  SplicedResult,
  SpliceState,
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
import { indexTree } from "../forest/indexTree";
import {
  ascendFromChunk,
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
import type {
  CompositeListDifference,
  ObjectDifference,
  ValueDifference,
} from "../diff/types";
import * as Difference from "../diff/difference";
import { resolveNormalizedField } from "../descriptor/resolvedSelection";
import { getNodeChunks } from "./draftHelpers";
import { replaceTree } from "../forest/addTree";
import { invalidateReadResults } from "./invalidate";
import { IndexedForest } from "../forest/types";

export function write(
  env: CacheEnv,
  store: Store,
  activeTransaction: Transaction,
  options: WriteOptions,
  splice?: SplicedResult,
): WriteResult {
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
    splice?.missingFields,
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
    splice?.deliveredFields,
  );

  if (splice) {
    addPlaceholders(
      splice.incremental,
      splice.pending,
      incomingResult,
      modifiedIncomingResult,
      splice.anchors,
    );
  } else if (execution) {
    updateIncrementalExecution(
      store,
      targetForest,
      operationDescriptor,
      execution,
      incomingResult,
      modifiedIncomingResult,
    );
  }

  const difference = diffTree(
    targetForest,
    modifiedIncomingResult,
    env,
    splice && seedDifferences(incomingResult, splice.deliveredFields),
  );

  if (difference.errors.length) {
    processDiffErrors(targetForest, modifiedIncomingResult, difference);
  }

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
 * Writes subsequent results of incremental delivery (`@defer`) as a regular result of the operation:
 * data of all results of the payload is spliced into a copy of the stored result of the operation
 * (only objects on the path to delivered objects are copied), and the copy is written as a whole.
 *
 * Objects data is delivered to are located by placeholders (see `DeferPlaceholder`) in the stored result.
 * Merge policies only run for delivered fields (see `DeliveredFields`).
 */
export function writeSubsequentResult(
  env: CacheEnv,
  store: Store,
  activeTransaction: Transaction,
  options: WriteOptions,
  execution: SubsequentIncrementalExecutionResult & ExecutionResult,
): WriteResult | undefined {
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
    return undefined;
  }
  const targetForest = getActiveForest(store, activeTransaction);
  const tree = getExistingResult(env, store, targetForest, operation);
  let result: WriteResult | undefined;
  if (tree) {
    const splice = spliceIncrementalResults(env, tree, incremental, execution);
    if (splice) {
      result = write(
        env,
        store,
        activeTransaction,
        { ...options, result: splice.data, execution: undefined },
        splice,
      );
    } else if (execution.pending?.length) {
      addPlaceholders(incremental, execution.pending, tree, tree, EMPTY_ARRAY);
    }
  }
  for (const { id } of execution.completed ?? EMPTY_ARRAY) {
    incremental.pending.delete(id);
  }
  if (!execution.hasNext) {
    store.incrementalExecutions.delete(operation);
  }
  return result;
}

function spliceIncrementalResults(
  env: CacheEnv,
  tree: IndexedTree,
  incremental: IncrementalExecution,
  execution: SubsequentIncrementalExecutionResult,
): SplicedResult | undefined {
  let entries = collectDeferredResults(env, tree, incremental, execution);
  if (!entries.length) {
    return undefined;
  }
  const state: SpliceState = {
    tree,
    copies: new Map(),
    deliveredFields: new Map(),
    missingFields: new Map(),
  };
  const data = copyValue(state, tree.result.data);
  assert(isResultData(data));

  const anchors: PendingAnchor[] = [];
  while (entries.length) {
    // Objects at sub-paths may be delivered by other results of the payload
    const unresolved: DeferredResultEntry[] = [];
    for (const entry of entries) {
      const path = entry.subPath?.length
        ? [...entry.path, ...entry.subPath]
        : entry.path;
      const target = spliceAt(state, data, path);
      if (!target) {
        unresolved.push(entry);
        continue;
      }
      spliceData(state, target, entry.data);
      anchors.push({
        path: entry.subPath?.length
          ? [...entry.placeholder.path, ...entry.subPath]
          : entry.placeholder.path,
        data: target,
      });
    }
    if (unresolved.length === entries.length) {
      break;
    }
    entries = unresolved;
  }
  if (!anchors.length) {
    return undefined;
  }
  return {
    incremental,
    pending: execution.pending ?? EMPTY_ARRAY,
    data,
    deliveredFields: state.deliveredFields,
    missingFields: state.missingFields,
    anchors,
  };
}

function collectDeferredResults(
  env: CacheEnv,
  tree: IndexedTree,
  incremental: IncrementalExecution,
  execution: SubsequentIncrementalExecutionResult,
): DeferredResultEntry[] {
  const entries: DeferredResultEntry[] = [];
  const pathEnv: TraverseEnv = {
    findParent: createParentLocator(tree.dataMap),
  };
  for (const result of execution.incremental ?? EMPTY_ARRAY) {
    if (result.id === undefined) {
      // TODO: the earlier draft format (`path` and `label`)
      env.logger?.warnOnce(
        "incremental_format_not_supported",
        "Incremental results without `id` (the 2022 draft format) are not supported yet and are ignored",
      );
      continue;
    }
    // TODO: streamed list items (`items`)
    if (!isDeferResult(result) || !isResultData(result.data)) {
      continue;
    }
    const placeholder = incremental.pending.get(result.id);
    const target = placeholder && resolvePlaceholder(tree, placeholder);
    if (!placeholder || !target) {
      // Completed, unknown, or the object is gone from the stored result
      continue;
    }
    entries.push({
      placeholder,
      path: getResponsePath(pathEnv, target),
      subPath: result.subPath,
      data: result.data,
    });
  }
  return entries;
}

// Copies objects on the path (copy-on-write), returns the (copied) object at the path
function spliceAt(
  state: SpliceState,
  data: ResultData,
  path: ResponsePath,
): ResultData | undefined {
  let current: ResultData | unknown[] = data;
  for (const step of path) {
    let copy: ResultData | unknown[] | undefined;
    if (Array.isArray(current)) {
      if (typeof step !== "number") {
        return undefined;
      }
      copy = copyValue(state, current[step]);
      if (copy) {
        current[step] = copy;
      }
    } else {
      if (typeof step !== "string") {
        return undefined;
      }
      copy = copyValue(state, current[step]);
      if (copy) {
        current[step] = copy;
      }
    }
    if (!copy) {
      return undefined;
    }
    current = copy;
  }
  return isResultData(current) ? current : undefined;
}

function copyValue(
  state: SpliceState,
  value: unknown,
): ResultData | unknown[] | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const known = state.copies.get(value);
  if (known) {
    return known;
  }
  let copy: ResultData | unknown[];
  if (Array.isArray(value)) {
    copy = value.slice();
  } else {
    const object: ResultData = { ...value };
    const chunk = isSourceObject(value)
      ? state.tree.dataMap.get(value)?.value
      : undefined;
    // Objects of the stored result have no delivered fields yet,
    //   objects of incremental results (spliced earlier in this payload) are delivered as a whole
    state.deliveredFields.set(
      object,
      new Set(chunk ? EMPTY_ARRAY : Object.keys(object)),
    );
    if (chunk && isObjectValue(chunk) && chunk.missingFields?.size) {
      // Data of missing fields may be stale (e.g. fields deleted by cache.modify)
      assert(isSourceObject(object));
      for (const field of chunk.missingFields) {
        delete object[field.dataKey];
      }
      state.missingFields.set(object, new Set(chunk.missingFields));
    }
    copy = object;
  }
  state.copies.set(value, copy);
  state.copies.set(copy, copy);
  return copy;
}

function spliceData(state: SpliceState, target: ResultData, data: ResultData) {
  const delivered = state.deliveredFields.get(target);
  assert(delivered);
  for (const key of Object.keys(data)) {
    const existing = target[key];
    const incoming = data[key];
    if (isResultData(existing) && isResultData(incoming)) {
      // The object is in the stored result already, e.g. a field selected by multiple fragments
      const copy = copyValue(state, existing);
      assert(isResultData(copy));
      target[key] = copy;
      spliceData(state, copy, incoming);
    } else {
      target[key] = incoming;
      delivered.add(key);
      deleteMissingField(state, target, key);
    }
  }
}

function deleteMissingField(
  state: SpliceState,
  target: ResultData,
  key: string,
) {
  const missingFields = isSourceObject(target)
    ? state.missingFields.get(target)
    : undefined;
  for (const field of missingFields ?? EMPTY_ARRAY) {
    if (field.dataKey === key) {
      missingFields?.delete(field);
    }
  }
}

/**
 * Initial differences of nodes with spliced data (see diffTree): restricted to delivered fields and paths to them.
 * Other fields of copied objects are the same as in the stored result, so they are not compared.
 *
 * Built in the indexed result: merge policies only change values of delivered fields (paths stay the same).
 */
function seedDifferences(
  tree: IndexedTree,
  deliveredFields: DeliveredFields,
): NodeDifferenceMap | undefined {
  const findParent = createParentLocator(tree.dataMap);
  const seed: NodeDifferenceMap = new Map();
  for (const [data, delivered] of deliveredFields) {
    const chunk = isSourceObject(data)
      ? tree.dataMap.get(data)?.value
      : undefined;
    if (!chunk || !isObjectValue(chunk)) {
      // E.g. shared objects were cloned when indexing: diff in full
      return undefined;
    }
    const difference = seedDifference(seed, findParent, deliveredFields, chunk);
    if (!difference) {
      // Delivered as a part of a delivered field (diffed in full)
      continue;
    }
    assert(Difference.isObjectDifference(difference));
    for (const field of chunk.selection.fieldQueue) {
      if (delivered.has(field.dataKey)) {
        Difference.enqueueField(
          difference,
          resolveNormalizedField(chunk.selection, field),
        );
      }
    }
  }
  // Nodes with other chunks (e.g. in delivered data) are diffed in full
  for (const nodeKey of seed.keys()) {
    for (const chunk of tree.nodes.get(nodeKey) ?? EMPTY_ARRAY) {
      if (
        !deliveredFields.has(chunk.data) &&
        !tree.prev?.dataMap.has(chunk.data)
      ) {
        seed.delete(nodeKey);
        break;
      }
    }
  }
  return seed;
}

function seedDifference(
  seed: NodeDifferenceMap,
  findParent: ParentLocator,
  deliveredFields: DeliveredFields,
  value: ObjectChunk | CompositeListChunk,
): ObjectDifference | CompositeListDifference | undefined {
  if (isObjectValue(value) && isNodeValue(value)) {
    let difference = seed.get(value.key);
    if (!difference) {
      difference = Difference.createObjectDifference();
      seed.set(value.key, difference);
    }
    return difference;
  }
  const parentRef = findParent(value);
  let difference: ValueDifference | undefined;
  if (isParentObjectRef(parentRef)) {
    if (
      deliveredFields.get(parentRef.parent.data)?.has(parentRef.field.dataKey)
    ) {
      return undefined;
    }
    const parent = seedDifference(
      seed,
      findParent,
      deliveredFields,
      parentRef.parent,
    );
    if (!parent) {
      return undefined;
    }
    assert(Difference.isObjectDifference(parent));
    const entry = resolveNormalizedField(
      parentRef.parent.selection,
      parentRef.field,
    );
    Difference.enqueueField(parent, entry);
    difference =
      Difference.getFieldDifference(parent, entry)?.state ??
      Difference.addFieldDifference(
        parent,
        entry,
        Difference.createCompositeValueDifference(value),
      ).state;
  } else if (isParentListRef(parentRef)) {
    const parent = seedDifference(
      seed,
      findParent,
      deliveredFields,
      parentRef.parent,
    );
    if (!parent) {
      return undefined;
    }
    assert(Difference.isCompositeListDifference(parent));
    Difference.enqueueListItem(parent, parentRef.index);
    difference =
      Difference.getListItemDifference(parent, parentRef.index) ??
      Difference.addListItemDifference(
        parent,
        parentRef.index,
        Difference.createCompositeValueDifference(value),
      );
  }
  assert(
    Difference.isObjectDifference(difference) ||
      Difference.isCompositeListDifference(difference),
  );
  return difference;
}

/**
 * Remembers placeholders of pending results announced by the initial result of an incremental execution
 * (replaces the previous execution of the operation).
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
  const incremental: IncrementalExecution = {
    key: execution.key,
    pending: new Map(),
  };
  addPlaceholders(incremental, execution.pending, indexed, merged, EMPTY_ARRAY);
  store.incrementalExecutions.set(operation, incremental);
}

/**
 * Paths of pending results are resolved in the indexed result (as returned by the server):
 * from the root, or from the closest anchor (delivered object) of the payload for nested `@defer`.
 * Addresses are captured in the result with merge policies applied (merge policies may move objects).
 */
function addPlaceholders(
  incremental: IncrementalExecution,
  pending: ReadonlyArray<PendingResult>,
  indexed: IndexedTree,
  merged: IndexedTree,
  anchors: ReadonlyArray<PendingAnchor>,
) {
  if (!pending.length) {
    return;
  }
  const findIndexedParent = createParentLocator(indexed.dataMap);
  const findMergedParent =
    merged === indexed
      ? findIndexedParent
      : createParentLocator(merged.dataMap);
  for (const { id, path } of pending) {
    const chunk = resolvePendingChunk(indexed, path, anchors);
    if (!chunk) {
      continue;
    }
    const mergedChunk = merged.dataMap.get(chunk.data)?.value;
    const placeholder =
      mergedChunk && isObjectValue(mergedChunk)
        ? createPlaceholder(findMergedParent, mergedChunk, path)
        : createPlaceholder(findIndexedParent, chunk, path);
    if (placeholder) {
      incremental.pending.set(id, placeholder);
    }
  }
}

function resolvePendingChunk(
  tree: IndexedTree,
  path: ResponsePath,
  anchors: ReadonlyArray<PendingAnchor>,
): ObjectChunk | undefined {
  let anchor: PendingAnchor | undefined;
  for (const candidate of anchors) {
    if (
      (!anchor || candidate.path.length > anchor.path.length) &&
      isPathPrefix(candidate.path, path)
    ) {
      anchor = candidate;
    }
  }
  const anchorChunk =
    anchor && isSourceObject(anchor.data)
      ? tree.dataMap.get(anchor.data)?.value
      : undefined;
  if (anchor && anchorChunk && isObjectValue(anchorChunk)) {
    return resolveResponsePath(anchorChunk, path.slice(anchor.path.length));
  }
  const root = tree.dataMap.get(tree.result.data)?.value;
  return root && isObjectValue(root)
    ? resolveResponsePath(root, path)
    : undefined;
}

function createPlaceholder(
  findParent: ParentLocator,
  chunk: ObjectChunk,
  path: ResponsePath,
): DeferPlaceholder | undefined {
  const pathFromNode: (FieldInfo | number)[] = [];
  let current: ObjectChunk | CompositeListChunk = chunk;
  while (!isNodeValue(current)) {
    const parentRef = findParent(current);
    if (isParentObjectRef(parentRef)) {
      pathFromNode.push(parentRef.field);
      current = parentRef.parent;
    } else if (isParentListRef(parentRef)) {
      pathFromNode.push(parentRef.index);
      current = parentRef.parent;
    } else {
      return undefined;
    }
  }
  pathFromNode.reverse();
  return {
    path,
    nodeKey: current.key,
    nodeSelections: current.possibleSelections,
    pathFromNode,
  };
}

// Resolves the placeholder object in the current stored result
function resolvePlaceholder(
  tree: IndexedTree,
  placeholder: DeferPlaceholder,
): ObjectChunk | undefined {
  for (const node of tree.nodes.get(placeholder.nodeKey) ?? EMPTY_ARRAY) {
    if (node.possibleSelections !== placeholder.nodeSelections) {
      continue;
    }
    let value: GraphChunk | undefined = node;
    for (const step of placeholder.pathFromNode) {
      value =
        typeof step === "number"
          ? resolveListItem(value, step)
          : isObjectValue(value) && selectsField(value, step)
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

function selectsField(chunk: ObjectChunk, field: FieldInfo): boolean {
  return chunk.selection.fields.get(field.name)?.includes(field) ?? false;
}

function getResponsePath(
  env: TraverseEnv,
  chunk: ObjectChunk,
): (string | number)[] {
  const path: (string | number)[] = [];
  ascendFromChunk(env, chunk, (_, __, step) => {
    path.push(typeof step === "number" ? step : step.dataKey);
  });
  return path.reverse();
}

function isPathPrefix(prefix: ResponsePath, path: ResponsePath): boolean {
  return (
    prefix.length <= path.length &&
    prefix.every((step, index) => path[index] === step)
  );
}

function isResultData(value: unknown): value is ResultData {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDeferResult(
  result: NonNullable<
    SubsequentIncrementalExecutionResult["incremental"]
  >[number],
): result is IncrementalDeferResult {
  return "data" in result;
}

function appendAffectedOperationsFromOtherLayers(
  env: CacheEnv,
  store: Store,
  affectedForestOperationsMutable: Map<OperationDescriptor, NodeDifferenceMap>,
  targetForest: DataForest | OptimisticLayer,
  incomingResult: IndexedTree,
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
  model: IndexedTree,
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
