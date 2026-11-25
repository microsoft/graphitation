import type { IndexedTree } from "../forest/types";
import type {
  CompositeListChunk,
  GraphChunk,
  ObjectChunk,
  ParentLocator,
} from "../values/types";
import type {
  CacheEnv,
  DataForest,
  DeferredResultEntry,
  DeferPlaceholder,
  ExecutionResult,
  IncrementalDeferResult,
  IncrementalExecution,
  IncrementalUpdate,
  OptimisticLayer,
  PendingAnchor,
  PendingResult,
  ResultData,
  Store,
  SubsequentIncrementalExecutionResult,
  Transaction,
  WriteOptions,
} from "./types";
import type {
  FieldInfo,
  OperationDescriptor,
  ResponsePath,
} from "../descriptor/types";
import type {
  CompositeListDifference,
  NodeDifferenceMap,
  ObjectDifference,
  ValueDifference,
} from "../diff/types";
import { assert } from "../jsutils/assert";
import { resolveOperationDescriptor } from "./descriptor";
import { getActiveForest, getExistingResult, shouldCache } from "./store";
import {
  createParentLocator,
  createTypedObjectChunk,
  findClosestNode,
  getDataPath,
  isCompositeListValue,
  isMissingValue,
  isNodeValue,
  isObjectValue,
  isParentListRef,
  isParentObjectRef,
  isRootRef,
  isSourceObject,
  resolveFieldChunk,
  resolveListItemChunk,
  TraverseEnv,
} from "../values";
import * as Difference from "../diff/difference";
import { resolveNormalizedField } from "../descriptor/resolvedSelection";
import { updateTree } from "../forest/updateTree";

/**
 * Subsequent results of incremental delivery (`@defer`) are written as a regular result of the operation:
 * the stored result of the operation is updated with data of all results of the payload (see updateTree),
 * and the updated result is written as a whole (see `write`).
 *
 * Objects data is delivered to are located by placeholders (see `DeferPlaceholder`) in the stored result.
 * The difference applied to the stored result also restricts merge policies and diffing to delivered fields.
 *
 * Also updates the state of the execution (`pending`, `completed`, `hasNext`).
 * Returns undefined when there is nothing to write.
 */
export function applySubsequentResult(
  env: CacheEnv,
  store: Store,
  activeTransaction: Transaction,
  options: WriteOptions,
  execution: SubsequentIncrementalExecutionResult & ExecutionResult,
): IncrementalUpdate | undefined {
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
  let update: IncrementalUpdate | undefined;
  if (tree) {
    update = updateWithIncrementalResults(env, tree, incremental, execution);
    if (!update && execution.pending?.length) {
      addPlaceholders(incremental, execution.pending, tree, tree, EMPTY_ARRAY);
    }
  }
  // Note: placeholders of pending results announced by the payload are added by the write of the updated result
  for (const { id } of execution.completed ?? EMPTY_ARRAY) {
    incremental.pending.delete(id);
  }
  if (!execution.hasNext) {
    store.incrementalExecutions.delete(operation);
  }
  return update;
}

/**
 * Captures placeholders of pending results after indexing (and applying merge policies to) a written result:
 * announced by the initial result of an incremental execution, or by the payload of an updated result.
 */
export function captureIncrementalExecution(
  store: Store,
  targetForest: DataForest | OptimisticLayer,
  operation: OperationDescriptor,
  execution: ExecutionResult | undefined,
  update: IncrementalUpdate | undefined,
  indexed: IndexedTree,
  merged: IndexedTree,
) {
  if (update) {
    addPlaceholders(
      update.incremental,
      update.pending,
      indexed,
      merged,
      update.anchors,
    );
  } else if (execution) {
    updateIncrementalExecution(
      store,
      targetForest,
      operation,
      execution,
      indexed,
      merged,
    );
  }
}

function updateWithIncrementalResults(
  env: CacheEnv,
  tree: IndexedTree,
  incremental: IncrementalExecution,
  execution: SubsequentIncrementalExecutionResult,
): IncrementalUpdate | undefined {
  const root = tree.dataMap.get(tree.result.data)?.value;
  assert(root && isObjectValue(root));
  let entries = collectDeferredResults(env, tree, incremental, execution);

  // Delivered data at its path in the stored result
  let patch: ResultData = {};
  const anchors: PendingAnchor[] = [];
  while (entries.length) {
    // Objects at sub-paths may be delivered by other results of the payload
    const unresolved: DeferredResultEntry[] = [];
    for (const entry of entries) {
      if (
        !resolveResponsePath(root, entry.path) &&
        !isResultData(getPatchValue(patch, entry.path))
      ) {
        unresolved.push(entry);
        continue;
      }
      const merged = mergeData(patch, wrapData(entry.path, entry.data));
      assert(isResultData(merged));
      patch = merged;
      anchors.push(entry);
    }
    if (unresolved.length === entries.length) {
      break;
    }
    entries = unresolved;
  }
  if (!anchors.length) {
    return undefined;
  }
  const difference: NodeDifferenceMap = new Map();
  patchValue(difference, root, patch, undefined);

  const { updatedTree } = updateTree(env, tree, difference);
  if (updatedTree === tree) {
    return undefined;
  }
  return {
    incremental,
    pending: execution.pending ?? EMPTY_ARRAY,
    tree: updatedTree,
    difference,
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
    const subPath = result.subPath ?? EMPTY_ARRAY;
    entries.push({
      responsePath: [...placeholder.path, ...subPath],
      path: [...getDataPath(pathEnv, target), ...subPath],
      data: result.data,
    });
  }
  return entries;
}

// List indexes are keys of wrapping objects (see mergeData)
function wrapData(path: ResponsePath, data: ResultData): ResultData {
  let value = data;
  for (let i = path.length - 1; i >= 0; i--) {
    value = { [path[i]]: value };
  }
  return value;
}

// Objects are merged field by field (e.g. a field selected by multiple fragments), lists are replaced.
//   Wrapped items (keyed by list indexes) are merged into delivered lists.
function mergeData(existing: unknown, incoming: unknown): unknown {
  if (Array.isArray(existing) || Array.isArray(incoming)) {
    const [list, items] = Array.isArray(existing)
      ? [existing, incoming]
      : [incoming, existing];
    if (!Array.isArray(list) || !isResultData(items)) {
      return incoming;
    }
    const merged = list.slice();
    for (const key of Object.keys(items)) {
      const index = Number(key);
      if (index >= 0 && index < merged.length) {
        merged[index] = mergeData(merged[index], items[key]);
      }
    }
    return merged;
  }
  if (!isResultData(existing) || !isResultData(incoming)) {
    return incoming;
  }
  const merged = { ...existing };
  for (const key of Object.keys(incoming)) {
    merged[key] = mergeData(merged[key], incoming[key]);
  }
  return merged;
}

function getPatchValue(patch: ResultData, path: ResponsePath): unknown {
  let value: unknown = patch;
  for (const step of path) {
    if (isResultData(value)) {
      value = value[step];
    } else {
      value =
        Array.isArray(value) && typeof step === "number"
          ? value[step]
          : undefined;
    }
  }
  return value;
}

/**
 * Fills (or replaces) fields of an object of the stored result with delivered data.
 * Objects and lists of the stored result within delivered data are updated in place (see patchValue).
 */
function patchObject(
  differences: NodeDifferenceMap,
  chunk: ObjectChunk,
  patch: ResultData,
  difference: ObjectDifference,
) {
  let delivered: ObjectChunk | undefined;
  for (const key of Object.keys(patch)) {
    const field = chunk.selection.fieldQueue.find((f) => f.dataKey === key);
    if (!field) {
      continue;
    }
    const entry = resolveNormalizedField(chunk.selection, field);
    const existing = Difference.getFieldDifference(difference, entry);
    const patched = patchValue(
      differences,
      resolveObjectField(chunk, field),
      patch[key],
      existing?.state,
    );
    if (patched === null) {
      continue;
    }
    let state: ValueDifference;
    if (patched) {
      state = patched;
    } else {
      assert(isSourceObject(patch));
      delivered ??= createTypedObjectChunk(
        chunk.operation,
        chunk.possibleSelections,
        patch,
        chunk.type || undefined,
        chunk.key,
      );
      const base = resolveFieldChunk(chunk, field);
      const value = resolveFieldChunk(delivered, field);
      state =
        chunk.missingFields?.has(field) || isMissingValue(base)
          ? Difference.createFiller(value)
          : Difference.createReplacement(base, value);
    }
    if (existing) {
      existing.state = state;
    } else {
      Difference.addFieldDifference(difference, entry, state);
    }
    if (Difference.isDirty(state)) {
      Difference.addDirtyField(difference, entry);
    }
  }
}

function patchList(
  differences: NodeDifferenceMap,
  list: CompositeListChunk,
  patch: ResultData,
  difference: CompositeListDifference,
) {
  for (const key of Object.keys(patch)) {
    const index = Number(key);
    const state = patchValue(
      differences,
      resolveListItem(list, index),
      patch[key],
      difference.itemState.get(index),
    );
    if (state) {
      difference.itemState.set(index, state);
      if (Difference.isDirty(state)) {
        Difference.addDirtyListItem(difference, index);
      }
    }
  }
}

/**
 * Updates an object (or a list) of the stored result in place with delivered data.
 * Returns null for nodes (their differences are not nested, see NodeDifferenceMap),
 * and undefined when the value is replaced with delivered data.
 */
function patchValue(
  differences: NodeDifferenceMap,
  value: GraphChunk | undefined,
  patch: unknown,
  existing: ValueDifference | undefined,
): ObjectDifference | CompositeListDifference | null | undefined {
  if (!value || !isResultData(patch)) {
    return undefined;
  }
  if (isCompositeListValue(value)) {
    const difference = Difference.isCompositeListDifference(existing)
      ? existing
      : Difference.createCompositeListDifference();
    patchList(differences, value, patch, difference);
    return difference;
  }
  if (!isObjectValue(value)) {
    return undefined;
  }
  if (isNodeValue(value)) {
    const difference =
      differences.get(value.key) ?? Difference.createObjectDifference();
    differences.set(value.key, difference);
    patchObject(differences, value, patch, difference);
    return null;
  }
  const difference = Difference.isObjectDifference(existing)
    ? existing
    : Difference.createObjectDifference();
  patchObject(differences, value, patch, difference);
  return difference;
}

/**
 * Whether a field of an object of the updated result is delivered by incremental results:
 * filled (or replaced) by the difference applied to the stored result, or within delivered data.
 */
export function isDeliveredField(
  tree: IndexedTree,
  differences: NodeDifferenceMap,
  findParent: ParentLocator,
  parent: ObjectChunk,
  field: FieldInfo,
): boolean {
  const difference = resolveChunkDifference(
    tree,
    differences,
    findParent,
    parent,
  );
  return isDelivered(
    Difference.isObjectDifference(difference)
      ? Difference.getFieldDifference(
          difference,
          resolveNormalizedField(parent.selection, field),
        )?.state
      : difference,
  );
}

// Difference applied to an object (or a list) of the updated result (delivered value within delivered data)
function resolveChunkDifference(
  tree: IndexedTree,
  differences: NodeDifferenceMap,
  findParent: ParentLocator,
  chunk: ObjectChunk | CompositeListChunk,
): ValueDifference | undefined {
  if (tree.prev?.dataMap.has(chunk.data)) {
    // Not touched by incremental results
    return undefined;
  }
  const ref = findParent(chunk);
  const parent = isRootRef(ref)
    ? undefined
    : resolveChunkDifference(tree, differences, findParent, ref.parent);
  let difference = isDelivered(parent) ? parent : undefined;
  if (isParentObjectRef(ref) && Difference.isObjectDifference(parent)) {
    const entry = resolveNormalizedField(ref.parent.selection, ref.field);
    difference = Difference.getFieldDifference(parent, entry)?.state;
  } else if (
    isParentListRef(ref) &&
    Difference.isCompositeListDifference(parent)
  ) {
    difference = Difference.getListItemDifference(parent, ref.index);
  }
  return !difference && isNodeValue(chunk)
    ? differences.get(chunk.key)
    : difference;
}

function isDelivered(difference: ValueDifference | undefined): boolean {
  return (
    Difference.isFiller(difference) || Difference.isReplacement(difference)
  );
}

/**
 * Initial differences of nodes updated by incremental results (see diffTree): restricted to delivered fields
 * and paths to them (other fields are the same as in the stored result).
 * Nodes with chunks within delivered data are compared in full.
 *
 * Built from (and consumes) the difference applied to the stored result.
 */
export function seedDifferences(
  tree: IndexedTree,
  differences: NodeDifferenceMap,
): NodeDifferenceMap {
  const findParent = createParentLocator(tree.dataMap);
  const comparedInFull = [...differences.keys()].filter((nodeKey) =>
    tree.nodes
      .get(nodeKey)
      ?.some((chunk) =>
        isDelivered(
          resolveChunkDifference(tree, differences, findParent, chunk),
        ),
      ),
  );
  for (const nodeKey of comparedInFull) {
    differences.delete(nodeKey);
  }
  for (const difference of differences.values()) {
    seedDifference(difference);
  }
  return differences;
}

// Delivered values are queued (to be compared), paths to them are queued with their nested differences.
//   Returns false for delivered values.
function seedDifference(difference: ValueDifference): boolean {
  if (Difference.isCompositeListDifference(difference)) {
    difference.itemQueue = difference.dirtyItems ?? new Set();
    difference.dirtyItems = undefined;
    for (const [index, item] of difference.itemState) {
      if (!seedDifference(item)) {
        difference.itemState.delete(index);
      }
    }
    return true;
  }
  if (!Difference.isObjectDifference(difference)) {
    return false;
  }
  difference.fieldQueue = difference.dirtyFields ?? new Set();
  difference.dirtyFields = undefined;
  for (const [fieldName, state] of difference.fieldState) {
    const entries = (Array.isArray(state) ? state : [state]).filter((entry) =>
      seedDifference(entry.state),
    );
    if (entries.length) {
      difference.fieldState.set(fieldName, entries);
    } else {
      difference.fieldState.delete(fieldName);
    }
  }
  return true;
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
    incremental.pending.set(id, placeholder);
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
      (!anchor || candidate.responsePath.length > anchor.responsePath.length) &&
      isPathPrefix(candidate.responsePath, path)
    ) {
      anchor = candidate;
    }
  }
  const root = tree.dataMap.get(tree.result.data)?.value;
  if (!root || !isObjectValue(root)) {
    return undefined;
  }
  return resolveResponsePath(
    root,
    anchor ? [...anchor.path, ...path.slice(anchor.responsePath.length)] : path,
  );
}

function createPlaceholder(
  findParent: ParentLocator,
  chunk: ObjectChunk,
  path: ResponsePath,
): DeferPlaceholder {
  const env: TraverseEnv = { findParent };
  const node = findClosestNode(chunk, findParent);
  return {
    path,
    nodeKey: node.key,
    nodeSelections: node.possibleSelections,
    pathFromNode: getDataPath(env, chunk, node),
  };
}

// Resolves the placeholder object in the current stored result
function resolvePlaceholder(
  tree: IndexedTree,
  placeholder: DeferPlaceholder,
): ObjectChunk | undefined {
  for (const node of tree.nodes.get(placeholder.nodeKey) ?? EMPTY_ARRAY) {
    const chunk =
      node.possibleSelections === placeholder.nodeSelections
        ? resolveResponsePath(node, placeholder.pathFromNode)
        : undefined;
    if (chunk) {
      return chunk;
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

function isPathPrefix(prefix: ResponsePath, path: ResponsePath): boolean {
  return (
    prefix.length <= path.length &&
    prefix.every((step, index) => path[index] === step)
  );
}

// Unlike isSourceObject, excludes lists
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

export function isSubsequentResult(
  execution: ExecutionResult,
): execution is SubsequentIncrementalExecutionResult & ExecutionResult {
  return !("data" in execution);
}

const EMPTY_ARRAY = Object.freeze([]);
