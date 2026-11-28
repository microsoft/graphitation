import type { IndexedTree } from "../forest/types";
import type {
  CompositeListChunk,
  GraphChunk,
  ObjectChunk,
  SourceObject,
} from "../values/types";
import type {
  DeferredResult,
  IncrementalDeferResult,
  IncrementalExecution,
  IncrementalStreamResult,
  SplicedIncrementalResult,
  SpliceState,
  SubsequentIncrementalExecutionResult,
} from "./types";
import type {
  NodeKey,
  PossibleSelections,
  ResponsePath,
} from "../descriptor/types";
import { assert } from "../jsutils/assert";
import {
  copySourcesUpToRoot,
  isCompositeListValue,
  isObjectValue,
  isParentObjectRef,
  isReachable,
} from "../values";
import {
  getDataAt,
  isPathPrefix,
  isSourceData,
  mergeAt,
  mergeServerData,
} from "./data";
import { equal } from "@wry/equality";
import {
  resolveAddress,
  capturePlaceholders,
  getAddressSelections,
  resolvePath,
  resolveListItem,
  getPathKey,
  isOfType,
} from "./placeholders";
import {
  markSkippedFieldsMissing,
  isMissingField,
  hasDeliveredFields,
  visitCopy,
} from "./missingFields";

export function spliceIncrementalResults(
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

function isDeferResult(
  result: IncrementalDeferResult | IncrementalStreamResult,
): result is IncrementalDeferResult {
  return "data" in result;
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

const EMPTY_ARRAY = Object.freeze([]);
