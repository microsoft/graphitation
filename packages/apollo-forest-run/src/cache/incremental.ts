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
  DeliveredFields,
  ExecutionResult,
  IncrementalDeferResult,
  IncrementalExecution,
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
  findClosestNode,
  getDataPath,
  isCompositeListValue,
  isNodeValue,
  isObjectValue,
  isParentListRef,
  isParentObjectRef,
  isSourceObject,
  resolveFieldChunk,
  resolveListItemChunk,
  TraverseEnv,
} from "../values";
import * as Difference from "../diff/difference";
import { resolveNormalizedField } from "../descriptor/resolvedSelection";

/**
 * Subsequent results of incremental delivery (`@defer`) are written as a regular result of the operation:
 * data of all results of the payload is spliced into a copy of the stored result of the operation
 * (only objects on the path to delivered objects are copied), and the copy is written as a whole (see `write`).
 *
 * Objects data is delivered to are located by placeholders (see `DeferPlaceholder`) in the stored result.
 * Merge policies only run for delivered fields (see `DeliveredFields`).
 *
 * Also updates the state of the execution (`pending`, `completed`, `hasNext`).
 * Returns undefined when there is nothing to write.
 */
export function spliceSubsequentResult(
  env: CacheEnv,
  store: Store,
  activeTransaction: Transaction,
  options: WriteOptions,
  execution: SubsequentIncrementalExecutionResult & ExecutionResult,
): SplicedResult | undefined {
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
  let splice: SplicedResult | undefined;
  if (tree) {
    splice = spliceIncrementalResults(env, tree, incremental, execution);
    if (!splice && execution.pending?.length) {
      addPlaceholders(incremental, execution.pending, tree, tree, EMPTY_ARRAY);
    }
  }
  // Note: placeholders of pending results announced by the payload are added by the write of the spliced result
  for (const { id } of execution.completed ?? EMPTY_ARRAY) {
    incremental.pending.delete(id);
  }
  if (!execution.hasNext) {
    store.incrementalExecutions.delete(operation);
  }
  return splice;
}

/**
 * Captures placeholders of pending results after indexing (and applying merge policies to) a written result:
 * announced by the initial result of an incremental execution, or by the payload of a spliced result.
 */
export function captureIncrementalExecution(
  store: Store,
  targetForest: DataForest | OptimisticLayer,
  operation: OperationDescriptor,
  execution: ExecutionResult | undefined,
  splice: SplicedResult | undefined,
  indexed: IndexedTree,
  merged: IndexedTree,
) {
  if (splice) {
    addPlaceholders(
      splice.incremental,
      splice.pending,
      indexed,
      merged,
      splice.anchors,
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
      path: getDataPath(pathEnv, target),
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
export function seedDifferences(
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
