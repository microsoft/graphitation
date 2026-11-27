import type { Draft, IndexedTree } from "../forest/types";
import type {
  CompositeListChunk,
  GraphChunk,
  ObjectChunk,
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
  ObjectKeyFn,
  AddressStep,
  ResponsePathKey,
  SplicedIncrementalResult,
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
  TypeName,
} from "../descriptor/types";
import type { GraphDifference } from "../diff/diffTree";
import { DiffErrorKind } from "../diff/types";
import { assert } from "../jsutils/assert";
import { resolveOperationDescriptor } from "../cache/descriptor";
import { getExistingResult, shouldCache } from "../cache/store";
import {
  copySourcesUpToRoot,
  isCompositeListValue,
  isObjectValue,
  isParentObjectRef,
  isReachable,
  resolveFieldChunk,
  resolveListItemChunk,
} from "../values";
import { resolveSelection } from "../descriptor/resolvedSelection";
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
 * of incremental results. Placeholders are captured in data received from the server (the initial result
 * and delivered data, see capturePlaceholders).
 * Merge policies only run for delivered fields (see `DeliveredFields`), transient trees are diffed against their previous state.
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
  const { mergePolicies } = env;
  const spliced = tree
    ? spliceIncrementalResults(
        tree,
        incremental,
        execution,
        (type, field) => Boolean(mergePolicies.get(type)?.has(field)),
        createObjectKey(env, tree.operation),
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

function createObjectKey(
  { objectKey }: CacheEnv,
  operation: OperationDescriptor,
): ObjectKeyFn {
  return (data, selections) =>
    objectKey(
      data,
      resolveSelection(operation, selections, data.__typename ?? null),
      operation,
    );
}

/**
 * Starts tracking an incremental execution with its initial result (after indexing it and applying merge policies),
 * or keeps the transient tree of a spliced result current.
 */
export function captureIncrementalExecution(
  env: CacheEnv,
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
    if (execution.incremental.transientTree) {
      execution.incremental.transientTree = merged;
    }
  } else {
    updateIncrementalExecution(
      env,
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
  deliveredFields,
  tree,
}: SplicedIncrementalResult): (
  parent: ObjectChunk,
  field: FieldInfo,
) => boolean {
  return (parent, field) =>
    deliveredFields.get(parent.data)?.has(field.dataKey) ??
    !tree.dataMap.has(parent.data);
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
    incremental,
    hasMergePolicy,
    objectKey,
    copies: new Map(),
    deliveredFields: new Map(),
    missingFields: new Map(),
    skipped: [],
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
    const local = resolvePath(root, path);
    if (local && local !== chunk && !(local.key && local.key === chunk?.key)) {
      state.skipped.push({ chunk: local, data });
    }
  }
  markSkippedFieldsMissing(state);
  // Data received from the server (after splicing: data is spliced against data received before)
  for (const { path, data } of results) {
    incremental.serverData = mergeServerData(
      incremental.serverData,
      path,
      data,
    );
  }
  // Placeholders of nested `@defer` within delivered data
  for (const { path, data } of results) {
    const address = incremental.placeholders.get(getPathKey(path));
    const server =
      incremental.serverData && getDataAt(incremental.serverData, path);
    if (address && server) {
      capturePlaceholders(
        { operation: tree.operation, objectKey, incremental },
        server,
        data,
        getAddressSelections(address),
        path,
        address,
        true,
        true,
      );
    }
  }
  if (!hasDeliveredFields(state) && !state.missingBaseFields.length) {
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
    deliveredFields: state.deliveredFields,
    missingFields: state.missingFields,
    missingBaseFields: state.missingBaseFields,
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
  { nodeKey, nodeSelections, pathFromNode, types }: ObjectAddress,
): ObjectChunk | undefined {
  // Any chunk of the node with the same selection (the same node at multiple locations has the same data)
  for (const node of tree.nodes.get(nodeKey) ?? EMPTY_ARRAY) {
    const chunk =
      node.possibleSelections === nodeSelections
        ? resolvePath(node, pathFromNode, types)
        : undefined;
    // Values deleted in place by cache.modify stay in `tree.nodes` (and `tree.dataMap`)
    if (chunk && isReachable(tree.dataMap, chunk)) {
      // An object of another type (e.g. an unkeyed object replaced by another write) is another object
      return isOfType(chunk, types[types.length - 1]) ? chunk : undefined;
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
  const { copies, deliveredFields, missingFields } = state;
  copySourcesUpToRoot(
    state.tree.dataMap,
    copies,
    chunk,
    (value, _, copy, existing) => visitCopy(state, value, copy, existing),
  );
  const target = copies.get(chunk.data);
  assert(target && !Array.isArray(target));
  const delivered = deliveredFields.get(target);
  assert(delivered);

  for (const key of Object.keys(data)) {
    const incoming = data[key];
    const received = server?.[key];
    const ref = chunk.fieldChunks.get(key);
    const field = ref && isParentObjectRef(ref) ? ref.field : undefined;
    if (received !== undefined && received !== null && field?.selection) {
      // A container
      const existing = ref?.value;
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
          state.skipped.push({ chunk: existing, data: incoming });
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
      !isMissingField(missingFields.get(target), key)
    ) {
      // Received already
      continue;
    } else if (
      received == null &&
      field?.selection &&
      isSourceData(incoming) &&
      ref?.value !== undefined &&
      isObjectValue(ref.value) &&
      !(chunk.type && state.hasMergePolicy(chunk.type, field.name)) &&
      isSameObject(state, ref.value, incoming, field.selection)
    ) {
      // First delivery of an object the stored result has already (e.g. written by another operation)
      spliceData(state, ref.value, [...path, key], incoming, undefined);
    } else {
      target[key] = incoming;
    }
    delivered.add(key);
    const missing = missingFields.get(target);
    for (const field of missing ?? EMPTY_ARRAY) {
      if (field.dataKey === key) {
        missing?.delete(field);
      }
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
  for (const { chunk, data } of state.skipped) {
    markMissingFields(state, chunk, data);
  }
}

function markMissingFields(
  state: SpliceState,
  chunk: ObjectChunk,
  data: SourceObject,
) {
  // Fields delivered to the object by this payload (e.g. by another result: objects are resolved by keys)
  const copy = state.copies.get(chunk.data);
  const delivered =
    copy && !Array.isArray(copy) ? state.deliveredFields.get(copy) : undefined;
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
  copySourcesUpToRoot(
    state.tree.dataMap,
    state.copies,
    chunk,
    (value, _, copy, existing) => visitCopy(state, value, copy, existing),
  );
  const target = state.copies.get(chunk.data);
  assert(target && !Array.isArray(target));
  let missing = state.missingFields.get(target);
  if (!missing) {
    missing = new Set();
    state.missingFields.set(target, missing);
  }
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
  missing: Set<FieldInfo> | undefined,
  key: string,
): boolean {
  for (const field of missing ?? EMPTY_ARRAY) {
    if (field.dataKey === key) {
      return true;
    }
  }
  return false;
}

function hasDeliveredFields({ deliveredFields }: SpliceState): boolean {
  for (const fields of deliveredFields.values()) {
    if (fields.size) {
      return true;
    }
  }
  return false;
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

// Collects state of a copied object (on the path to a delivered object, from the root down)
function visitCopy(
  state: SpliceState,
  chunk: ObjectChunk | CompositeListChunk,
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
}

/**
 * Starts tracking an incremental execution with its initial result (replaces the previous execution of the operation).
 * Placeholders are captured in the indexed result (as returned by the server: merge policies don't change it).
 */
function updateIncrementalExecution(
  env: CacheEnv,
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
  const { data } = indexed.result;
  const selections = indexed.operation.possibleSelections;
  capturePlaceholders(
    {
      operation: indexed.operation,
      objectKey: createObjectKey(env, indexed.operation),
      incremental,
    },
    data,
    data,
    selections,
    EMPTY_ARRAY,
    {
      nodeKey: indexed.rootNodeKey,
      nodeSelections: selections,
      pathFromNode: EMPTY_ARRAY,
      types: [data.__typename || indexed.operation.rootType || false],
    },
    false,
    true,
  );
  if (incremental.placeholders.size) {
    store.incrementalExecutions.set(operation, incremental);
  } else {
    // No objects with deferred fragments (enabled for the operation variables): nothing to write later
    store.incrementalExecutions.delete(operation);
  }
}

type CaptureContext = {
  operation: OperationDescriptor;
  objectKey: ObjectKeyFn;
  incremental: IncrementalExecution;
};

/**
 * Captures placeholders of objects with deferred fragments (enabled for the operation variables) in data received
 * from the server, walking only selections leading to them (see hasDeferredFragments).
 *
 * `data` is the value in the server view (identifies objects), `delivered` - the part of it to walk (e.g. data
 * of a subsequent result). Addresses are captured on the spot: the closest keyed object (or the root) + the path
 * from it (`address` is the address of `data` when `isAddressed`, otherwise of its parent + the path to it).
 * Data of objects with deferred fragments is added to the server data (unless it is within it already).
 *
 * Note: addresses are captured in the server view, not in the stored result: the same for keyed objects,
 *   but an unkeyed object in a list rearranged by a merge policy may get another index (rare).
 */
function capturePlaceholders(
  context: CaptureContext,
  data: unknown,
  delivered: unknown,
  selections: PossibleSelections,
  path: ResponsePath,
  address: ObjectAddress,
  inServerData: boolean,
  isAddressed = false,
) {
  if (Array.isArray(delivered) && Array.isArray(data)) {
    for (let index = 0; index < delivered.length; index++) {
      capturePlaceholders(
        context,
        data[index],
        delivered[index],
        selections,
        [...path, index],
        { ...address, pathFromNode: [...address.pathFromNode, index] },
        inServerData,
      );
    }
    return;
  }
  if (!isSourceData(delivered) || !isSourceData(data)) {
    return;
  }
  const { operation, incremental, objectKey } = context;
  if (!isAddressed) {
    const key = objectKey(data, selections);
    const type = data.__typename || false;
    address =
      typeof key === "string"
        ? {
            nodeKey: key,
            nodeSelections: selections,
            pathFromNode: EMPTY_ARRAY,
            types: [type],
          }
        : { ...address, types: [...address.types, type] };
  }
  const { types } = address;
  const selection = resolveSelection(
    operation,
    selections,
    types[types.length - 1] || null,
  );
  if (selection.deferredFragments) {
    incremental.placeholders.set(getPathKey(path), address);
    if (!inServerData) {
      incremental.serverData = mergeServerData(
        incremental.serverData,
        path,
        data,
      );
      inServerData = true;
    }
  }
  for (const field of selection.fieldQueue) {
    if (field.selection && hasDeferredFragments(operation, field.selection)) {
      capturePlaceholders(
        context,
        data[field.dataKey],
        delivered[field.dataKey],
        field.selection,
        [...path, field.dataKey],
        { ...address, pathFromNode: [...address.pathFromNode, field] },
        inServerData,
      );
    }
  }
}

// Selections of the addressed object
function getAddressSelections({
  nodeSelections,
  pathFromNode,
}: ObjectAddress): PossibleSelections {
  for (let index = pathFromNode.length - 1; index >= 0; index--) {
    const step = pathFromNode[index];
    if (typeof step !== "number") {
      assert(step.selection);
      return step.selection;
    }
  }
  return nodeSelections;
}

// Whether objects with the selections (or below) may have deferred fragments enabled for the operation variables
//   (lazily computed once per operation)
function hasDeferredFragments(
  operation: OperationDescriptor,
  selections: PossibleSelections,
): boolean {
  let known = deferredSelections.get(operation);
  if (!known) {
    known = new Map();
    deferredSelections.set(operation, known);
  }
  let result = known.get(selections);
  if (result === undefined) {
    result = false;
    for (const typeName of selections.keys()) {
      const selection = resolveSelection(operation, selections, typeName);
      if (
        selection.deferredFragments ||
        selection.fieldQueue.some(
          (field) =>
            field.selection !== undefined &&
            hasDeferredFragments(operation, field.selection),
        )
      ) {
        result = true;
        break;
      }
    }
    known.set(selections, result);
  }
  return result;
}

const deferredSelections = new WeakMap<
  OperationDescriptor,
  Map<PossibleSelections, boolean>
>();

/**
 * Resolves an object by list indexes and fields: response keys (e.g. paths of incremental results) or fields
 * of selections (addresses: a field of the selection of the object, e.g. not an alias of another field).
 * With `types`, objects fields are resolved on must be of the same types (when known).
 */
function resolvePath(
  chunk: ObjectChunk,
  path: ReadonlyArray<string | AddressStep>,
  types?: ReadonlyArray<TypeName | false>,
): ObjectChunk | undefined {
  let value: GraphChunk | undefined = chunk;
  let objectIndex = 0;
  for (const step of path) {
    if (typeof step === "number") {
      value = resolveListItem(value, step);
    } else if (
      isObjectValue(value) &&
      (!types || isOfType(value, types[objectIndex++]))
    ) {
      const field =
        typeof step === "string"
          ? value.selection.fieldQueue.find((field) => field.dataKey === step)
          : value.selection.fieldQueue.includes(step)
          ? step
          : undefined;
      value = field && resolveObjectField(value, field);
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
