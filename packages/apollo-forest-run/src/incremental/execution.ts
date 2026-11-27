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
  ObjectWrite,
  PayloadWrites,
  AddressFieldStep,
  SpliceState,
  SubsequentExecutionResult,
  SubsequentIncrementalExecutionResult,
} from "./types";
import type {
  FieldInfo,
  NodeKey,
  PossibleSelections,
  OperationDescriptor,
  ResponsePath,
} from "../descriptor/types";
import type { NodeDifferenceMap } from "../diff/types";
import type { GraphDifference } from "../diff/diffTree";
import { DiffErrorKind } from "../diff/types";
import { assert } from "../jsutils/assert";
import { resolveOperationDescriptor } from "../cache/descriptor";
import { getExistingResult, shouldCache } from "../cache/store";
import {
  copySourcesUpToRoot,
  createParentLocator,
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
import {
  getFieldByDataKey,
  resolveNormalizedField,
  resolveSelection,
} from "../descriptor/resolvedSelection";
import { accumulate, getOrCreate } from "../jsutils/map";
import {
  getDataAt,
  isPathPrefix,
  isSourceData,
  mergeAt,
  mergeServerData,
} from "./data";
import { equal } from "@wry/equality";

// TODO: support the incremental delivery format (graphql-js 17: pending/id/subPath/completed);
//   a converter to the 2022 format existed in db17a309 (incremental/format.ts)

/**
 * Subsequent results of incremental delivery (`@defer`, the 2022 draft format) are written as a regular result
 * of the operation: data of all results of the payload is spliced into a copy of the stored result of the operation
 * (only objects on the path to delivered objects are copied), and the copy is written as a whole (see `write`).
 *
 * Objects data is delivered to are located by placeholders (addresses, see `ObjectAddress`), keyed by response paths
 * of incremental results. Placeholders are captured for chunks with deferred fragments (`tree.deferredChunks`)
 * of the initial result and of delivered data.
 * Merge policies only run for delivered fields (see `PayloadWrites`), diffing is restricted to them too (`seed`).
 *
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
  // Execution results are written to the base forest only
  const tree =
    getExistingResult(env, store, store.dataForest, operation) ??
    incremental.transientTree;
  const { mergePolicies, objectKey } = env;
  const spliced = tree
    ? spliceIncrementalResults(
        tree,
        incremental,
        execution,
        (type, field) => Boolean(mergePolicies.get(type)?.has(field)),
        (data, selections) =>
          objectKey(
            data,
            resolveSelection(
              tree.operation,
              selections,
              data.__typename ?? null,
            ),
            tree.operation,
          ),
      )
    : undefined;
  if (execution.hasNext === false) {
    store.incrementalExecutions.delete(operation);
    if (!operation.cache) {
      // The descriptor was retained while the execution was pending (see canReleaseOperationDescriptor)
      activeTransaction.nonCacheableOperations?.add(operation);
    }
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
    if (execution.incremental.transientTree) {
      execution.incremental.transientTree = merged;
    }
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
export function createDeliveredFieldFilter({
  writes,
  tree,
}: SplicedIncrementalResult): (
  parent: ObjectChunk,
  field: FieldInfo,
) => boolean {
  return (parent, field) =>
    writes.get(parent.data)?.fields.has(field.dataKey) ??
    !tree.dataMap.has(parent.data);
}

/**
 * Initial differences of nodes with spliced data (see diffTree), collected when splicing:
 * restricted to delivered fields and paths to them (other fields of copies are the same as in the stored result).
 */
export function seedDifferences(
  indexed: IndexedTree,
  { writes, seed, incremental, tree }: SplicedIncrementalResult,
): NodeDifferenceMap | undefined {
  for (const copy of writes.keys()) {
    if (!indexed.dataMap.has(copy)) {
      // E.g. shared objects were cloned when indexing: diff in full
      return undefined;
    }
  }
  // Nodes with other chunks (e.g. in delivered data) are diffed in full
  for (const nodeKey of seed.keys()) {
    for (const chunk of indexed.nodes.get(nodeKey) ?? EMPTY_ARRAY) {
      if (!writes.has(chunk.data) && !tree.dataMap.has(chunk.data)) {
        seed.delete(nodeKey);
        break;
      }
    }
  }
  if (incremental.transientTree) {
    // Unlike stored trees, a transient tree doesn't receive other writes: its untouched nodes are not compared
    //   (otherwise they would revert writes made since its previous state)
    for (const [nodeKey, chunks] of indexed.nodes) {
      if (!seed.has(nodeKey) && isRecycled(tree, chunks)) {
        seed.set(nodeKey, Difference.createObjectDifference());
      }
    }
  }
  return seed;
}

// Whether all chunks are recycled from the tree
function isRecycled(tree: IndexedTree, chunks: ObjectChunk[]): boolean {
  for (const chunk of chunks) {
    if (!tree.dataMap.has(chunk.data)) {
      return false;
    }
  }
  return true;
}

function spliceIncrementalResults(
  tree: IndexedTree,
  incremental: IncrementalExecution,
  execution: SubsequentIncrementalExecutionResult,
  hasMergePolicy: SpliceState["hasMergePolicy"],
  objectKey: SpliceState["objectKey"],
): SplicedIncrementalResult | undefined {
  const results = mergeNestedResults(execution);
  if (!results.length) {
    return undefined;
  }
  const state: SpliceState = {
    tree,
    hasMergePolicy,
    objectKey,
    copies: new Map(),
    objects: new Map(),
    missingFields: new Map(),
    seed: new Map(),
    differences: new Map(),
    missingBaseFields: [],
  };
  const { serverData } = incremental;
  const root = tree.dataMap.get(tree.result.data)?.value;
  assert(root && isObjectValue(root));
  for (const { path, data } of results) {
    const address = incremental.placeholders.get(getPathKey(path));
    if (!address) {
      continue;
    }
    const chunk = resolveAddress(tree, address);
    if (chunk) {
      const server = serverData && getDataAt(serverData, path);
      spliceData(state, chunk, path, data, server);
    }
    // Another object at the response path (e.g. a link replaced by another write) didn't receive data.
    //   Note: positional (e.g. lists may have changed), only marks missing fields (a refetch at worst, never a write)
    const local = resolveObjectPath(root, path);
    if (local && local !== chunk && !(local.key && local.key === chunk?.key)) {
      recordMiss(state, local, data);
    }
  }
  // Data received from the server (after splicing: data is spliced against data received before)
  for (const { path, data } of results) {
    incremental.serverData = mergeServerData(
      incremental.serverData,
      path,
      data,
    );
  }
  const writes = finishObjectWrites(state);
  if (!writes) {
    // E.g. all delivered objects were skipped or all values were received already: nothing to write
    return undefined;
  }
  const data = state.copies.get(tree.result.data);
  assert(data && !Array.isArray(data));
  return {
    kind: "SplicedIncrementalResult",
    incremental,
    tree,
    data,
    writes,
    missingFields: state.missingFields,
    missingBaseFields: state.missingBaseFields,
    seed: state.seed,
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

// Resolves the object in the current stored result
function resolveAddress(
  tree: IndexedTree,
  { nodeKey, nodeSelections, pathFromNode, type }: ObjectAddress,
): ObjectChunk | undefined {
  // Any chunk of the node with the same selection (the same node at multiple locations has the same data)
  for (const node of tree.nodes.get(nodeKey) ?? EMPTY_ARRAY) {
    const chunk =
      node.possibleSelections === nodeSelections
        ? resolveObjectPath(node, pathFromNode)
        : undefined;
    // Values deleted in place by cache.modify stay in `tree.nodes` (and `tree.dataMap`)
    if (chunk && isReachable(tree.dataMap, chunk)) {
      // An object of another type (e.g. an unkeyed object replaced by another write) is another object
      return isOfType(chunk, type) ? chunk : undefined;
    }
  }
  return undefined;
}

/**
 * Splices data into a copy of the object (copying objects on the path to it).
 * `path` is the response path of the object (in the server view), `server` - its data received from the server so far.
 *
 * Data is spliced against data received from the server (results of the same execution):
 * - values received already are not delivered again (e.g. fields selected by multiple fragments);
 * - objects and lists received already are containers: the structure is local (links and lists are never changed),
 *   data goes by identity. Objects are resolved by keys in the stored result (local links and lists may differ,
 *   e.g. after merge policies or other writes), objects of lists are paired by indexes in the server view,
 *   objects without keys are resolved by the local location (see resolveReceivedObject).
 *   Containers are not delivered as a whole (e.g. not incoming values of merge policies);
 * - other values are delivered (as is for fields with merge policies, incoming values of merge policies).
 */
function spliceData(
  state: SpliceState,
  chunk: ObjectChunk,
  path: ResponsePath,
  data: SourceObject,
  server: SourceObject | undefined,
) {
  const target = copyObject(state, chunk);
  const write = getObjectWrite(state, chunk);
  write.paths.push(path);

  for (const key of Object.keys(data)) {
    const incoming = data[key];
    const received = server?.[key];
    const field = getFieldByDataKey(chunk.selection, key);
    const existing = chunk.fieldChunks.get(key)?.value;
    if (received !== undefined && received !== null && field?.selection) {
      // A container
      if (isSourceData(incoming) && isSourceData(received)) {
        const object = resolveReceivedObject(
          state,
          existing,
          received,
          incoming,
          field.selection,
        );
        if (object) {
          spliceData(state, object, [...path, key], incoming, received);
        }
        if (
          object !== existing &&
          existing !== undefined &&
          isObjectValue(existing)
        ) {
          // Another object at the location (e.g. a link replaced by another write): it didn't receive the data
          recordMiss(state, existing, incoming);
        }
        continue;
      } else if (Array.isArray(incoming) && Array.isArray(received)) {
        spliceList(
          state,
          existing !== undefined && isCompositeListValue(existing)
            ? existing
            : undefined,
          [...path, key],
          incoming,
          received,
          field.selection,
        );
        continue;
      }
    }
    if (
      received !== undefined &&
      equal(received, incoming) &&
      (write.fields.has(key) || !isMissingField(chunk.missingFields, key))
    ) {
      // Received already
      continue;
    } else if (
      received == null &&
      field?.selection &&
      isSourceData(incoming) &&
      existing !== undefined &&
      isObjectValue(existing) &&
      !(chunk.type && state.hasMergePolicy(chunk.type, field.name)) &&
      isSameObject(state, existing, incoming, field.selection)
    ) {
      // First delivery of an object the stored result has already (e.g. written by another operation)
      spliceData(state, existing, [...path, key], incoming, undefined);
      if (!write.fields.has(key)) {
        write.fields.set(key, []);
      }
    } else {
      target[key] = incoming;
      accumulate(write.fields, key, path);
    }
  }
}

/**
 * Fields delivered to other objects (with another identity) than the local objects at their locations are missing
 * in the local objects (unless they have them): reads of the operation are incomplete (e.g. refetch the result).
 * Missing fields are marked down to leaves through local objects and lists (positionally: marking only).
 * Note: list items are resolved by keys (local lists may legitimately differ), so items skipped there are not marked.
 */
function markSkippedFieldsMissing(state: SpliceState) {
  for (const { chunk, missed } of state.objects.values()) {
    for (const data of missed ?? EMPTY_ARRAY) {
      markMissingFields(state, chunk, data);
    }
  }
}

function markMissingFields(
  state: SpliceState,
  chunk: ObjectChunk,
  data: SourceObject,
) {
  // Fields delivered to the object by this payload (e.g. by another result: objects are resolved by keys)
  const delivered = state.objects.get(chunk)?.fields;
  let missingFields: FieldInfo[] | undefined;
  for (const field of chunk.selection.fieldQueue) {
    const value = data[field.dataKey];
    if (value === undefined || delivered?.has(field.dataKey)) {
      continue;
    }
    if (
      chunk.data[field.dataKey] === undefined ||
      chunk.missingFields?.has(field)
    ) {
      missingFields ??= [];
      missingFields.push(field);
    } else if (field.selection && value !== null && typeof value === "object") {
      markMissingValueFields(state, resolveFieldChunk(chunk, field), value);
    }
  }
  if (!missingFields) {
    return;
  }
  // Same values (missing) are not compared when diffing: report missing fields of the stored result explicitly
  state.missingBaseFields.push({
    kind: DiffErrorKind.MissingBaseFields,
    chunk,
    missingFields,
  });
  const target = copyObject(state, chunk);
  const missing = getOrCreate(state.missingFields, target, () => new Set());
  for (const field of missingFields) {
    missing.add(field);
  }
}

function markMissingValueFields(
  state: SpliceState,
  value: GraphChunk,
  data: unknown,
) {
  if (isObjectValue(value) && isSourceData(data)) {
    markMissingFields(state, value, data);
  } else if (isCompositeListValue(value) && Array.isArray(data)) {
    for (let index = 0; index < data.length; index++) {
      const item = resolveListItem(value, index);
      if (item) {
        markMissingValueFields(state, item, data[index]);
      }
    }
  }
}

/**
 * Fields of local objects delivered to other objects (see markSkippedFieldsMissing) are missing in the stored result:
 *   reported as diff errors (marks stored chunks incomplete, so reads report missing data)
 */
export function addMissingBaseFields(
  difference: GraphDifference,
  { missingBaseFields }: SplicedIncrementalResult,
) {
  if (!missingBaseFields.length) {
    return;
  }
  // A single error of this kind is expected (see processDiffErrors)
  for (const error of difference.errors) {
    if (error.kind === "MissingFields") {
      error.base = error.base
        ? [...error.base, ...missingBaseFields]
        : missingBaseFields;
      return;
    }
  }
  difference.errors.push({ kind: "MissingFields", base: missingBaseFields });
}

// Splices items of a list received already (a container), paired by indexes in the server view
function spliceList(
  state: SpliceState,
  list: CompositeListChunk | undefined,
  path: ResponsePath,
  data: unknown[],
  server: unknown[],
  selections: PossibleSelections,
) {
  for (let index = 0; index < data.length; index++) {
    const incoming = data[index];
    const received = server[index];
    const local = list && resolveListItem(list, index);
    if (isSourceData(incoming)) {
      const receivedObject = isSourceData(received) ? received : undefined;
      const object = resolveReceivedObject(
        state,
        local,
        receivedObject ?? incoming,
        incoming,
        selections,
      );
      if (object) {
        spliceData(state, object, [...path, index], incoming, receivedObject);
      }
    } else if (Array.isArray(incoming) && Array.isArray(received)) {
      spliceList(
        state,
        local !== undefined && isCompositeListValue(local) ? local : undefined,
        [...path, index],
        incoming,
        received,
        selections,
      );
    }
  }
}

// A chunk of the node with the selection, which is a part of the stored result
function findNodeChunk(
  tree: IndexedTree,
  key: NodeKey,
  selections: PossibleSelections,
): ObjectChunk | undefined {
  for (const chunk of tree.nodes.get(key) ?? EMPTY_ARRAY) {
    if (
      chunk.possibleSelections === selections &&
      isReachable(tree.dataMap, chunk)
    ) {
      return chunk;
    }
  }
  return undefined;
}

function isMissingField(
  missing: ObjectChunk["missingFields"],
  key: string,
): boolean {
  for (const field of missing ?? EMPTY_ARRAY) {
    if (field.dataKey === key) {
      return true;
    }
  }
  return false;
}

// Finalize missing fields and seed the diff once per copy, after all deliveries are known.
function finishObjectWrites(state: SpliceState): PayloadWrites | undefined {
  markSkippedFieldsMissing(state);
  const writes: PayloadWrites = new Map();
  let hasWrites = false;
  for (const write of state.objects.values()) {
    const { chunk, fields } = write;
    const copy = state.copies.get(chunk.data);
    if (!copy) {
      // A miss alone need not change the stored object.
      continue;
    }
    assert(!Array.isArray(copy));
    writes.set(copy, write);
    for (const field of chunk.missingFields ?? EMPTY_ARRAY) {
      if (!fields.has(field.dataKey)) {
        getOrCreate(state.missingFields, copy, () => new Set()).add(field);
      }
    }
    if (!fields.size) {
      continue;
    }
    hasWrites = true;
    const difference = state.differences.get(chunk);
    assert(Difference.isObjectDifference(difference));
    for (const field of chunk.selection.fieldQueue) {
      if (!fields.has(field.dataKey)) {
        continue;
      }
      if (
        field.selection &&
        chunk.type &&
        state.hasMergePolicy(chunk.type, field.name)
      ) {
        // A merge policy may change the whole value, not only the delivered fields.
        difference.fieldState.delete(field.name);
      }
      Difference.enqueueField(
        difference,
        resolveNormalizedField(chunk.selection, field),
      );
    }
  }
  return hasWrites || state.missingBaseFields.length ? writes : undefined;
}

// Whether the object is of the type (when both are known)
function isOfType(chunk: ObjectChunk, type: unknown): boolean {
  return !type || !chunk.type || chunk.type === type;
}

// Whether the delivered object is the local object (never splice fields of an object into another identity)
function isSameObject(
  state: SpliceState,
  local: ObjectChunk,
  incoming: SourceObject,
  selections: PossibleSelections,
): boolean {
  return (
    (state.objectKey(incoming, selections) ?? false) === local.key &&
    (!incoming.__typename || incoming.__typename === local.type)
  );
}

/**
 * The object of the stored result data received from the server is delivered to: by its key (the object
 * may be elsewhere in the stored result, e.g. a local write replaced a link or moved a list item),
 * or (objects without keys) the local object of the same type at the same location.
 * Objects not in the stored result are skipped (their deferred fields stay missing, e.g. refetched by reads).
 *
 * Limitation: objects reachable in the result only under a different selection (e.g. another field with other
 * aliases or arguments) are not updated: skipped, the operation reports incomplete if applicable
 * (see markSkippedFieldsMissing).
 */
function resolveReceivedObject(
  state: SpliceState,
  local: GraphChunk | undefined,
  received: SourceObject,
  incoming: SourceObject,
  selections: PossibleSelections,
): ObjectChunk | undefined {
  const localObject =
    local !== undefined && isObjectValue(local) ? local : undefined;
  const key = state.objectKey(received, selections);
  if (typeof key !== "string") {
    // A known different type rules out a match by location
    const type = received.__typename ?? incoming.__typename;
    return localObject && isOfType(localObject, type) ? localObject : undefined;
  }
  return localObject?.key === key
    ? localObject
    : findNodeChunk(state.tree, key, selections);
}

function getObjectWrite(state: SpliceState, chunk: ObjectChunk): ObjectWrite {
  return getOrCreate(state.objects, chunk, () => ({
    chunk,
    fields: new Map(),
    paths: [],
  }));
}

function recordMiss(
  state: SpliceState,
  chunk: ObjectChunk,
  data: SourceObject,
) {
  (getObjectWrite(state, chunk).missed ??= []).push(data);
}

function copyObject(state: SpliceState, chunk: ObjectChunk): SourceObject {
  copySourcesUpToRoot(
    state.tree.dataMap,
    state.copies,
    chunk,
    (value, ref, copy, existing) =>
      visitCopy(state, value, ref, copy, existing),
  );
  const copy = state.copies.get(chunk.data);
  assert(copy && !Array.isArray(copy));
  return copy;
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
    getObjectWrite(state, chunk);
    if (chunk.missingFields?.size) {
      // Data of missing fields may be stale (e.g. fields deleted by cache.modify)
      for (const field of chunk.missingFields) {
        delete copy[field.dataKey];
      }
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
  let step;
  if (isParentObjectRef(parentRef)) {
    assert(Difference.isObjectDifference(parent));
    step = resolveNormalizedField(parentRef.parent.selection, parentRef.field);
    Difference.enqueueField(parent, step);
  } else {
    assert(Difference.isCompositeListDifference(parent));
    step = parentRef.index;
    Difference.enqueueListItem(parent, step);
  }
  differences.set(
    chunk,
    Difference.getOrCreateEmbeddedDifference(parent, step, () =>
      Difference.createCompositeValueDifference(chunk),
    ),
  );
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
    !operation.hasDeferSites
  ) {
    // E.g. deferred data was resolved inline by the server (a complete result)
    store.incrementalExecutions.delete(operation);
    return;
  }
  const incremental: IncrementalExecution = {
    key: execution.key,
    placeholders: new Map(),
    serverData: undefined,
    // Results of operations which are not stored (e.g. mutations) are spliced into their latest result
    transientTree: shouldCache(targetForest, operation) ? undefined : merged,
  };
  const findParent = createParentLocator(indexed.dataMap);
  const findMergedParent = createParentLocator(merged.dataMap);
  for (const chunk of indexed.deferredChunks ?? EMPTY_ARRAY) {
    const path = getDataPath({ findParent }, chunk);
    addPlaceholder(
      incremental,
      merged,
      findParent,
      findMergedParent,
      chunk,
      path,
    );
    // Data of the indexed result is as received from the server (merge policies don't change it).
    //   Deferred chunks are in pre-order: data of nested ones is within data of their ancestors
    if (!incremental.serverData || !getDataAt(incremental.serverData, path)) {
      incremental.serverData = mergeServerData(
        incremental.serverData,
        path,
        chunk.data,
      );
    }
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
  { incremental, tree, writes }: SplicedIncrementalResult,
  indexed: IndexedTree,
  merged: IndexedTree,
) {
  const root = indexed.dataMap.get(indexed.result.data)?.value;
  assert(root && isObjectValue(root));
  const stored = { findParent: createParentLocator(tree.dataMap) };
  const targets = new Map<ObjectChunk, ObjectWrite>();
  for (const [copy, write] of writes) {
    if (!write.paths.length) {
      continue;
    }
    // Indexing may clone shared sources. In that case locate the target by its local path.
    const chunk =
      indexed.dataMap.get(copy)?.value ??
      resolveObjectPath(root, getDataPath(stored, write.chunk));
    if (chunk && isObjectValue(chunk)) {
      targets.set(chunk, write);
    }
  }
  const findParent = createParentLocator(indexed.dataMap);
  const findMergedParent = createParentLocator(merged.dataMap);
  for (const chunk of indexed.deferredChunks ?? EMPTY_ARRAY) {
    // The closest object results were delivered to
    let target: ObjectChunk | CompositeListChunk = chunk;
    let write = targets.get(chunk);
    while (!write) {
      const ref = findParent(target);
      if (isRootRef(ref)) {
        break;
      }
      target = ref.parent;
      write = isObjectValue(target) ? targets.get(target) : undefined;
    }
    if (!write) {
      continue;
    }
    const pathFromTarget = getDataPath({ findParent }, chunk, target);
    // Bind the spliced object itself, or a descendant of a field written whole at that server location.
    const field = pathFromTarget[0];
    assert(field === undefined || typeof field === "string");
    const paths = field === undefined ? write.paths : write.fields.get(field);
    for (const path of paths ?? EMPTY_ARRAY) {
      addPlaceholder(incremental, merged, findParent, findMergedParent, chunk, [
        ...path,
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
  const pathFromNode: (AddressFieldStep | number)[] = [];
  let node: ObjectChunk | CompositeListChunk = chunk;
  while (!isNodeValue(node)) {
    const ref = findParent(node);
    assert(!isRootRef(ref));
    pathFromNode.push(
      isParentObjectRef(ref)
        ? {
            parentType: ref.parent.type,
            dataKey: ref.field.dataKey,
            fieldName: ref.field.name,
          }
        : ref.index,
    );
    node = ref.parent;
  }
  return {
    nodeKey: node.key,
    nodeSelections: node.possibleSelections,
    pathFromNode: pathFromNode.reverse(),
    type: chunk.type,
  };
}

function resolveObjectPath(
  chunk: ObjectChunk,
  path: ResponsePath | ObjectAddress["pathFromNode"],
): ObjectChunk | undefined {
  let value: GraphChunk | undefined = chunk;
  for (const step of path) {
    if (typeof step === "number") {
      value = resolveListItem(value, step);
    } else if (isObjectValue(value)) {
      value = resolveObjectField(value, step);
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
  step: string | AddressFieldStep,
): GraphChunk | undefined {
  const key = typeof step === "string" ? step : step.dataKey;
  const field = getFieldByDataKey(chunk.selection, key);
  // A response key in an address may now alias a different field on a different type.
  return field?.selection &&
    (typeof step === "string" ||
      (field.name === step.fieldName && isOfType(chunk, step.parentType))) &&
    chunk.data[key] !== undefined &&
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

// Complete or initial results are written as is (subsequent results are spliced into the stored result first)
export function isInitialExecutionWrite(
  options: ExecutionWriteOptions,
): options is ExecutionWriteOptions & { execution: InitialExecutionResult } {
  return "data" in options.execution;
}

export function isSubsequentResult(
  execution: ExecutionResult,
): execution is SubsequentExecutionResult {
  return !("data" in execution);
}

const EMPTY_ARRAY = Object.freeze([]);
