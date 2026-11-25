import type { IndexedTree } from "../forest/types";
import type {
  CompositeListChunk,
  DataMap,
  GraphChunk,
  ObjectChunk,
  ParentLocator,
} from "../values/types";
import type {
  CacheEnv,
  DataForest,
  DeferPlaceholder,
  DeferredResult,
  DeliveredFields,
  ExecutionResult,
  IncrementalDeferResult,
  IncrementalExecution,
  IncrementalStreamResult,
  OptimisticLayer,
  ResponsePathKey,
  ResultData,
  SplicedResult,
  SpliceState,
  Store,
  SubsequentExecutionResult,
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
import {
  convertSubsequentResult,
  isGraphQL17Result,
  trackPendingResults,
} from "./incrementalFormat";

/**
 * Subsequent results of incremental delivery (`@defer`, the 2022 draft format) are written as a regular result
 * of the operation: data of all results of the payload is spliced into a copy of the stored result of the operation
 * (only objects on the path to delivered objects are copied), and the copy is written as a whole (see `write`).
 *
 * Objects data is delivered to are located by placeholders (see `DeferPlaceholder`), keyed by response paths
 * of incremental results. Placeholders are captured statically: for objects with deferred fragments
 * (enabled for the operation variables) in the initial result and in delivered data.
 * Merge policies only run for delivered fields (see `DeliveredFields`).
 *
 * Results in the GraphQL 17 format are converted to the 2022 format first (see `convertSubsequentResult`).
 * Returns undefined when there is nothing to write.
 */
export function spliceSubsequentResult(
  env: CacheEnv,
  store: Store,
  activeTransaction: Transaction,
  options: WriteOptions,
  execution: SubsequentExecutionResult,
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
  const result = isGraphQL17Result(execution)
    ? convertSubsequentResult(incremental, execution)
    : execution;
  const targetForest = getActiveForest(store, activeTransaction);
  const tree = getExistingResult(env, store, targetForest, operation);
  const splice = tree
    ? spliceIncrementalResults(tree, incremental, result)
    : undefined;
  if (!result.hasNext) {
    store.incrementalExecutions.delete(operation);
  }
  return splice;
}

/**
 * Captures placeholders after indexing (and applying merge policies to) a written result:
 * of the initial result of an incremental execution, or of delivered data of a spliced result (nested `@defer`).
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
    for (const [target, path] of splice.targets) {
      const chunk = isSourceObject(target)
        ? indexed.dataMap.get(target)?.value
        : undefined;
      if (chunk && isObjectValue(chunk)) {
        // Objects of the stored result already have their placeholders
        const known = indexed.prev?.dataMap;
        capturePlaceholders(
          splice.incremental,
          indexed,
          merged,
          chunk,
          path,
          known,
        );
      }
    }
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
  tree: IndexedTree,
  incremental: IncrementalExecution,
  execution: SubsequentIncrementalExecutionResult,
): SplicedResult | undefined {
  const results: DeferredResult[] = [];
  for (const result of execution.incremental ?? EMPTY_ARRAY) {
    // Note: results without data (e.g. errors only) are not written. TODO: streamed list items (`items`)
    if (isDeferResult(result) && result.path && isResultData(result.data)) {
      results.push({ path: result.path, data: result.data });
    }
  }
  if (!results.length) {
    return undefined;
  }
  // Results deferred within delivered data of the same payload (nested `@defer`) are spliced after their parents
  results.sort((a, b) => a.path.length - b.path.length);

  const state: SpliceState = {
    tree,
    copies: new Map(),
    deliveredFields: new Map(),
    missingFields: new Map(),
  };
  const data = copyValue(state, tree.result.data);
  assert(isResultData(data));
  const pathEnv: TraverseEnv = {
    findParent: createParentLocator(tree.dataMap),
  };
  const targets = new Map<ResultData, ResponsePath>();
  for (const result of results) {
    const target = spliceTarget(
      state,
      pathEnv,
      incremental,
      targets,
      data,
      result.path,
    );
    if (target) {
      spliceData(state, target, result.data);
      targets.set(target, result.path);
    }
  }
  if (!targets.size) {
    return undefined;
  }
  return {
    incremental,
    data,
    deliveredFields: state.deliveredFields,
    missingFields: state.missingFields,
    targets,
  };
}

/**
 * Resolves (and copies) the object a result is delivered to: within data delivered by the payload
 * (results nested in a parent result of the same payload, server paths are consistent within a payload),
 * or in the stored result by its placeholder.
 */
function spliceTarget(
  state: SpliceState,
  pathEnv: TraverseEnv,
  incremental: IncrementalExecution,
  targets: Map<ResultData, ResponsePath>,
  data: ResultData,
  path: ResponsePath,
): ResultData | undefined {
  let parent: ResultData | undefined;
  let parentPath: ResponsePath = EMPTY_ARRAY;
  for (const [target, targetPath] of targets) {
    if (
      (!parent || targetPath.length > parentPath.length) &&
      isPathPrefix(targetPath, path)
    ) {
      parent = target;
      parentPath = targetPath;
    }
  }
  const nested = parent
    ? spliceAt(state, parent, path.slice(parentPath.length))
    : undefined;
  if (nested) {
    return nested;
  }
  const placeholder = incremental.placeholders.get(getPathKey(path));
  const chunk = placeholder && resolvePlaceholder(state.tree, placeholder);
  return chunk ? spliceAt(state, data, getDataPath(pathEnv, chunk)) : undefined;
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
 * Starts tracking an incremental execution with its initial result (replaces the previous execution of the operation).
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
    !operation.hasDeferSites ||
    !shouldCache(targetForest, operation)
  ) {
    // E.g. deferred data was resolved inline by the server (a complete result)
    store.incrementalExecutions.delete(operation);
    return;
  }
  const incremental: IncrementalExecution = {
    key: execution.key,
    placeholders: new Map(),
    pendingResults: undefined,
  };
  if ("pending" in execution) {
    trackPendingResults(incremental, execution.pending);
  }
  const root = indexed.dataMap.get(indexed.result.data)?.value;
  assert(root && isObjectValue(root));
  capturePlaceholders(
    incremental,
    indexed,
    merged,
    root,
    EMPTY_ARRAY,
    undefined,
  );
  if (incremental.placeholders.size) {
    store.incrementalExecutions.set(operation, incremental);
  } else {
    // No objects with deferred fragments (enabled for the operation variables): nothing to write later
    store.incrementalExecutions.delete(operation);
  }
}

/**
 * Captures placeholders of objects with deferred fragments (enabled for the operation variables) at and below `chunk`
 * (objects of `known` and below are skipped). `path` is the response path of the chunk in the server view
 * (indexed results are not changed by merge policies), placeholders are keyed by paths of incremental results.
 *
 * Addresses are captured in the result with merge policies applied (merge policies may move objects).
 *
 * Note: objects with deferred fragments delivered inline (partially) get placeholders too, unused ones are dropped
 *   with the execution.
 */
function capturePlaceholders(
  incremental: IncrementalExecution,
  indexed: IndexedTree,
  merged: IndexedTree,
  chunk: ObjectChunk,
  path: ResponsePath,
  known: DataMap | undefined,
) {
  const findIndexedParent = createParentLocator(indexed.dataMap);
  const findMergedParent =
    merged === indexed
      ? findIndexedParent
      : createParentLocator(merged.dataMap);
  const capture = (value: GraphChunk | undefined, valuePath: ResponsePath) => {
    if (!value) {
      return;
    }
    if (isObjectValue(value) && !known?.has(value.data)) {
      if (value.selection.deferredFragments?.length) {
        const mergedValue = merged.dataMap.get(value.data)?.value;
        incremental.placeholders.set(
          getPathKey(valuePath),
          mergedValue && isObjectValue(mergedValue)
            ? createPlaceholder(findMergedParent, mergedValue)
            : createPlaceholder(findIndexedParent, value),
        );
      }
      for (const field of value.selection.fieldQueue) {
        if (field.selection) {
          capture(resolveObjectField(value, field), [
            ...valuePath,
            field.dataKey,
          ]);
        }
      }
    } else if (isCompositeListValue(value) && !known?.has(value.data)) {
      for (let index = 0; index < value.data.length; index++) {
        capture(resolveListItem(value, index), [...valuePath, index]);
      }
    }
  };
  capture(chunk, path);
}

function createPlaceholder(
  findParent: ParentLocator,
  chunk: ObjectChunk,
): DeferPlaceholder {
  const node = findClosestNode(chunk, findParent);
  return {
    nodeKey: node.key,
    nodeSelections: node.possibleSelections,
    pathFromNode: getDataPath({ findParent }, chunk, node),
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

function getPathKey(path: ResponsePath): ResponsePathKey {
  return path.join(".");
}

function isDeferResult(
  result: IncrementalDeferResult | IncrementalStreamResult,
): result is IncrementalDeferResult {
  return "data" in result;
}

export function isSubsequentResult(
  execution: ExecutionResult,
): execution is SubsequentExecutionResult {
  return !("data" in execution);
}

const EMPTY_ARRAY = Object.freeze([]);
