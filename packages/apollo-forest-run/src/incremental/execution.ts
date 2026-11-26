import type { Draft, IndexedTree } from "../forest/types";
import type {
  CompositeListChunk,
  GraphChunk,
  GraphChunkReference,
  ObjectChunk,
  ParentLocator,
  SourceObject,
} from "../values/types";
import type {
  CacheEnv,
  DataForest,
  OptimisticLayer,
  Store,
  Transaction,
  ExecutionWriteOptions,
} from "../cache/types";
import type {
  DeferredResult,
  ExecutionResult,
  InitialExecutionResult,
  IncrementalDeferResult,
  IncrementalExecution,
  IncrementalStreamResult,
  ObjectAddress,
  ResponsePathKey,
  SplicedIncrementalResult,
  SplicedIncrementalResultEntry,
  SpliceState,
  SubsequentExecutionResult,
  SubsequentIncrementalExecutionResult,
} from "./types";
import type {
  FieldInfo,
  OperationDescriptor,
  ResponsePath,
} from "../descriptor/types";
import type { NodeDifferenceMap } from "../diff/types";
import { assert } from "../jsutils/assert";
import { resolveOperationDescriptor } from "../cache/descriptor";
import {
  getActiveForest,
  getExistingResult,
  shouldCache,
} from "../cache/store";
import {
  copySourcesUpToRoot,
  createParentLocator,
  findClosestNode,
  getDataPath,
  isCompositeListValue,
  isNodeValue,
  isObjectValue,
  isParentObjectRef,
  isReachable,
  isRootRef,
  resolveFieldChunk,
  resolveListItemChunk,
} from "../values";
import * as Difference from "../diff/difference";
import { resolveNormalizedField } from "../descriptor/resolvedSelection";
import { accumulate } from "../jsutils/map";
import {
  convertIncrementalDeliveryResult,
  isIncrementalDeliveryResult,
  trackPendingResults,
} from "./format";

/**
 * Subsequent results of incremental delivery (`@defer`, the 2022 draft format) are written as a regular result
 * of the operation: data of all results of the payload is spliced into a copy of the stored result of the operation
 * (only objects on the path to delivered objects are copied), and the copy is written as a whole (see `write`).
 *
 * Objects data is delivered to are located by placeholders (addresses, see `ObjectAddress`), keyed by response paths
 * of incremental results. Placeholders are captured for chunks with deferred fragments (`tree.deferredChunks`)
 * of the initial result and of delivered data.
 * Merge policies only run for delivered fields (see `DeliveredFields`), diffing is restricted to them too (`seed`).
 *
 * Results in the incremental delivery format are converted to the 2022 draft format first
 * (see `convertIncrementalDeliveryResult`).
 * Returns undefined when there is nothing to write.
 */
export function spliceSubsequentResult(
  env: CacheEnv,
  store: Store,
  activeTransaction: Transaction,
  options: ExecutionWriteOptions,
  execution: SubsequentExecutionResult,
): SplicedIncrementalResult | undefined {
  assert(typeof execution.hasNext === "boolean");
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
  const result = isIncrementalDeliveryResult(execution)
    ? convertIncrementalDeliveryResult(incremental, execution)
    : execution;
  const targetForest = getActiveForest(store, activeTransaction);
  const tree = getExistingResult(env, store, targetForest, operation);
  const spliced = tree
    ? spliceIncrementalResults(tree, incremental, result)
    : undefined;
  if (result.hasNext === false) {
    store.incrementalExecutions.delete(operation);
  }
  return spliced;
}

/**
 * Captures placeholders after indexing (and applying merge policies to) a written result:
 * of the initial result of an incremental execution, or of delivered data of a spliced result (nested `@defer`).
 */
export function captureIncrementalExecution(
  store: Store,
  targetForest: DataForest | OptimisticLayer,
  operation: OperationDescriptor,
  execution: InitialExecutionResult | SplicedIncrementalResult | undefined,
  indexed: IndexedTree,
  merged: IndexedTree,
) {
  if (!execution) {
    return;
  }
  if (isSplicedIncrementalResult(execution)) {
    captureDeliveredPlaceholders(execution, indexed, merged);
  } else {
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

/**
 * Merge policies of a spliced result only run for delivered fields (other fields already went through them):
 * listed fields of copies of stored objects and all fields of delivered objects (not objects of the stored result).
 */
export function createDeliveredFieldFilter(
  { deliveredFields }: SplicedIncrementalResult,
  indexed: IndexedTree,
): (parent: ObjectChunk, field: FieldInfo) => boolean {
  return (parent, field) =>
    deliveredFields.get(parent.data)?.has(field.dataKey) ??
    !indexed.prev?.dataMap.has(parent.data);
}

/**
 * Initial differences of nodes with spliced data (see diffTree), collected when splicing:
 * restricted to delivered fields and paths to them (other fields of copies are the same as in the stored result).
 */
export function seedDifferences(
  indexed: IndexedTree,
  { deliveredFields, seed }: SplicedIncrementalResult,
): NodeDifferenceMap | undefined {
  for (const copy of deliveredFields.keys()) {
    if (!indexed.dataMap.has(copy)) {
      // E.g. shared objects were cloned when indexing: diff in full
      return undefined;
    }
  }
  // Nodes with other chunks (e.g. in delivered data) are diffed in full
  for (const nodeKey of seed.keys()) {
    for (const chunk of indexed.nodes.get(nodeKey) ?? EMPTY_ARRAY) {
      if (
        !deliveredFields.has(chunk.data) &&
        !indexed.prev?.dataMap.has(chunk.data)
      ) {
        seed.delete(nodeKey);
        break;
      }
    }
  }
  return seed;
}

function spliceIncrementalResults(
  tree: IndexedTree,
  incremental: IncrementalExecution,
  execution: SubsequentIncrementalExecutionResult,
): SplicedIncrementalResult | undefined {
  const results = mergeNestedResults(execution);
  if (!results.length) {
    return undefined;
  }
  const state: SpliceState = {
    tree,
    copies: new Map(),
    deliveredFields: new Map(),
    missingFields: new Map(),
    seed: new Map(),
    differences: new Map(),
  };
  const pathEnv = { findParent: createParentLocator(tree.dataMap) };
  const entries: SplicedIncrementalResultEntry[] = [];
  for (const { path, data } of results) {
    const address = incremental.placeholders.get(getPathKey(path));
    const chunk = address && resolveAddress(tree, address);
    if (chunk) {
      spliceData(state, chunk, data);
      entries.push({ path, data, localPath: getDataPath(pathEnv, chunk) });
    }
  }
  if (!entries.length) {
    return undefined;
  }
  const data = state.copies.get(tree.result.data);
  assert(data && !Array.isArray(data));
  return {
    kind: "SplicedIncrementalResult",
    incremental,
    data,
    deliveredFields: state.deliveredFields,
    missingFields: state.missingFields,
    seed: state.seed,
    results: entries,
  };
}

/**
 * Results delivered within data of other results of the payload (nested `@defer`) are merged into their data
 * by relative paths (server paths are consistent within a payload), other results are spliced at their placeholders.
 */
function mergeNestedResults(
  execution: SubsequentIncrementalExecutionResult,
): DeferredResult[] {
  const results: DeferredResult[] = [];
  for (const result of execution.incremental ?? EMPTY_ARRAY) {
    // Note: results without data (e.g. errors only) are not written. TODO: streamed list items (`items`)
    if (isDeferResult(result) && result.path && isSourceData(result.data)) {
      results.push({ path: result.path, data: result.data });
    }
  }
  results.sort((a, b) => a.path.length - b.path.length);
  const merged: DeferredResult[] = [];
  for (const result of results) {
    let parent: DeferredResult | undefined;
    for (const candidate of merged) {
      if (
        (!parent || candidate.path.length > parent.path.length) &&
        isPathPrefix(candidate.path, result.path)
      ) {
        parent = candidate;
      }
    }
    const data = parent
      ? mergeAt(parent.data, result.path, parent.path.length, result.data)
      : undefined;
    if (parent && isSourceData(data)) {
      parent.data = data;
    } else {
      merged.push(result);
    }
  }
  return merged;
}

// Copy-on-write merge of data at the path (undefined when the path is not in the value)
function mergeAt(
  value: unknown,
  path: ResponsePath,
  index: number,
  data: SourceObject,
): unknown {
  if (index === path.length) {
    return isSourceData(value) ? mergeSourceData(value, data) : undefined;
  }
  const step = path[index];
  if (Array.isArray(value) && typeof step === "number") {
    const item = mergeAt(value[step], path, index + 1, data);
    if (item === undefined) {
      return undefined;
    }
    const copy: unknown[] = [...value];
    copy[step] = item;
    return copy;
  }
  if (isSourceData(value) && typeof step === "string") {
    const item = mergeAt(value[step], path, index + 1, data);
    return item === undefined ? undefined : { ...value, [step]: item };
  }
  return undefined;
}

function mergeSourceData(
  target: SourceObject,
  source: SourceObject,
): SourceObject {
  const result: SourceObject = { ...target };
  for (const key of Object.keys(source)) {
    const existing = result[key];
    const incoming = source[key];
    result[key] =
      isSourceData(existing) && isSourceData(incoming)
        ? mergeSourceData(existing, incoming)
        : incoming;
  }
  return result;
}

// Resolves the object in the current stored result
function resolveAddress(
  tree: IndexedTree,
  { nodeKey, nodeSelections, pathFromNode }: ObjectAddress,
): ObjectChunk | undefined {
  // Any chunk of the node with the same selection (the same node at multiple locations has the same data)
  for (const node of tree.nodes.get(nodeKey) ?? EMPTY_ARRAY) {
    const chunk =
      node.possibleSelections === nodeSelections
        ? resolveResponsePath(node, pathFromNode)
        : undefined;
    // Values deleted in place by cache.modify stay in `tree.nodes` (and `tree.dataMap`)
    if (chunk && isReachable(tree.dataMap, chunk)) {
      return chunk;
    }
  }
  return undefined;
}

/**
 * Splices data into a copy of the object (copying objects on the path to it), returns the copy.
 * Data of fields with objects of the stored result is spliced into copies of those objects.
 */
function spliceData(
  state: SpliceState,
  chunk: ObjectChunk,
  data: SourceObject,
): SourceObject {
  const { copies, deliveredFields, differences } = state;
  copySourcesUpToRoot(
    state.tree.dataMap,
    copies,
    chunk,
    (value, ref, copy, existing) =>
      visitCopy(state, value, ref, copy, existing),
  );
  const target = copies.get(chunk.data);
  assert(target && !Array.isArray(target));
  const delivered = deliveredFields.get(target);
  assert(delivered);
  for (const key of Object.keys(data)) {
    const incoming = data[key];
    const existing = isSourceData(incoming)
      ? chunk.fieldChunks.get(key)?.value
      : undefined;
    if (isSourceData(incoming) && existing && isObjectValue(existing)) {
      // E.g. a field selected by multiple fragments
      spliceData(state, existing, incoming);
      continue;
    }
    target[key] = incoming;
    delivered.add(key);
    for (const field of state.missingFields.get(target) ?? EMPTY_ARRAY) {
      if (field.dataKey === key) {
        state.missingFields.get(target)?.delete(field);
      }
    }
  }
  const difference = differences.get(chunk);
  assert(Difference.isObjectDifference(difference));
  for (const field of chunk.selection.fieldQueue) {
    if (delivered.has(field.dataKey)) {
      Difference.enqueueField(
        difference,
        resolveNormalizedField(chunk.selection, field),
      );
    }
  }
  return target;
}

// Collects state of a copied object and seed differences on the path to it (from the root down)
function visitCopy(
  state: SpliceState,
  chunk: ObjectChunk | CompositeListChunk,
  parentRef: GraphChunkReference | undefined,
  copy: Draft,
  existingCopy: Draft | undefined,
) {
  if (!existingCopy && isObjectValue(chunk) && !Array.isArray(copy)) {
    // Objects of the stored result have no delivered fields yet
    state.deliveredFields.set(copy, new Set());
    if (chunk.missingFields?.size) {
      // Data of missing fields may be stale (e.g. fields deleted by cache.modify)
      for (const field of chunk.missingFields) {
        delete copy[field.dataKey];
      }
      state.missingFields.set(copy, new Set(chunk.missingFields));
    }
  }
  const { seed, differences } = state;
  if (differences.has(chunk)) {
    return;
  }
  if (isObjectValue(chunk) && isNodeValue(chunk)) {
    // Fields of parent nodes leading to nested nodes are not compared (nodes are diffed on their own)
    let difference = seed.get(chunk.key);
    if (!difference) {
      difference = Difference.createObjectDifference();
      seed.set(chunk.key, difference);
    }
    differences.set(chunk, difference);
    return;
  }
  assert(parentRef && !isRootRef(parentRef));
  const parent = differences.get(parentRef.parent);
  let difference;
  if (isParentObjectRef(parentRef)) {
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
        Difference.createCompositeValueDifference(chunk),
      ).state;
  } else {
    assert(Difference.isCompositeListDifference(parent));
    Difference.enqueueListItem(parent, parentRef.index);
    difference =
      Difference.getListItemDifference(parent, parentRef.index) ??
      Difference.addListItemDifference(
        parent,
        parentRef.index,
        Difference.createCompositeValueDifference(chunk),
      );
  }
  assert(
    Difference.isObjectDifference(difference) ||
      Difference.isCompositeListDifference(difference),
  );
  differences.set(chunk, difference);
}

/**
 * Starts tracking an incremental execution with its initial result (replaces the previous execution of the operation).
 * Placeholders are keyed by response paths in the indexed result (as returned by the server).
 */
function updateIncrementalExecution(
  store: Store,
  targetForest: DataForest | OptimisticLayer,
  operation: OperationDescriptor,
  execution: InitialExecutionResult,
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
  const findParent = createParentLocator(indexed.dataMap);
  const findMergedParent = createParentLocator(merged.dataMap);
  for (const chunk of indexed.deferredChunks ?? EMPTY_ARRAY) {
    addPlaceholder(
      incremental,
      merged,
      findParent,
      findMergedParent,
      chunk,
      getDataPath({ findParent }, chunk),
    );
  }
  if (incremental.placeholders.size) {
    store.incrementalExecutions.set(operation, incremental);
  } else {
    // No objects with deferred fragments (enabled for the operation variables): nothing to write later
    store.incrementalExecutions.delete(operation);
  }
}

/**
 * Captures placeholders of chunks with deferred fragments in delivered data (nested `@defer`), keyed by the response path
 * of the spliced result + the path within its data.
 */
function captureDeliveredPlaceholders(
  { incremental, results }: SplicedIncrementalResult,
  indexed: IndexedTree,
  merged: IndexedTree,
) {
  const root = indexed.dataMap.get(indexed.result.data)?.value;
  assert(root && isObjectValue(root));
  // Objects results were delivered to (by chunks: unlike sources, chunks are unique per location)
  const targets = new Map<ObjectChunk, SplicedIncrementalResultEntry[]>();
  for (const result of results) {
    const chunk = resolveResponsePath(root, result.localPath);
    if (chunk) {
      accumulate(targets, chunk, result);
    }
  }
  const findParent = createParentLocator(indexed.dataMap);
  const findMergedParent = createParentLocator(merged.dataMap);
  for (const chunk of indexed.deferredChunks ?? EMPTY_ARRAY) {
    // The closest object results were delivered to
    let target: ObjectChunk | CompositeListChunk = chunk;
    let entries = targets.get(chunk);
    while (!entries) {
      const ref = findParent(target);
      if (isRootRef(ref)) {
        break;
      }
      target = ref.parent;
      entries = isObjectValue(target) ? targets.get(target) : undefined;
    }
    const pathFromTarget = entries
      ? getDataPath({ findParent }, chunk, target)
      : EMPTY_ARRAY;
    // Only objects within delivered data: paths of other objects in the stored result may differ from server paths
    const result = entries?.find(({ data }) =>
      isWithinData(data, pathFromTarget),
    );
    if (result) {
      addPlaceholder(incremental, merged, findParent, findMergedParent, chunk, [
        ...result.path,
        ...pathFromTarget,
      ]);
    }
  }
}

// The address is captured in the result with merge policies applied (merge policies may move objects)
function addPlaceholder(
  incremental: IncrementalExecution,
  merged: IndexedTree,
  findParent: ParentLocator,
  findMergedParent: ParentLocator,
  chunk: ObjectChunk,
  path: ResponsePath,
) {
  const mergedChunk = merged.dataMap.get(chunk.data)?.value;
  incremental.placeholders.set(
    getPathKey(path),
    mergedChunk && isObjectValue(mergedChunk)
      ? createAddress(findMergedParent, mergedChunk)
      : createAddress(findParent, chunk),
  );
}

function createAddress(
  findParent: ParentLocator,
  chunk: ObjectChunk,
): ObjectAddress {
  const node = findClosestNode(chunk, findParent);
  return {
    nodeKey: node.key,
    nodeSelections: node.possibleSelections,
    pathFromNode: getDataPath({ findParent }, chunk, node),
  };
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
function isSourceData(value: unknown): value is SourceObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Whether the path (response keys and list indexes) is within the data
function isWithinData(data: unknown, path: ResponsePath): boolean {
  let value = data;
  for (const step of path) {
    if (Array.isArray(value) && typeof step === "number") {
      value = value[step];
    } else if (isSourceData(value) && typeof step === "string") {
      value = value[step];
    } else {
      return false;
    }
  }
  return isSourceData(value);
}

function getPathKey(path: ResponsePath): ResponsePathKey {
  return path.join(".");
}

function isDeferResult(
  result: IncrementalDeferResult | IncrementalStreamResult,
): result is IncrementalDeferResult {
  return "data" in result;
}

export function isSplicedIncrementalResult(
  execution: InitialExecutionResult | SplicedIncrementalResult,
): execution is SplicedIncrementalResult {
  return "kind" in execution && execution.kind === "SplicedIncrementalResult";
}

export function isSubsequentResult(
  execution: ExecutionResult,
): execution is SubsequentExecutionResult {
  return !("data" in execution);
}

const EMPTY_ARRAY = Object.freeze([]);
