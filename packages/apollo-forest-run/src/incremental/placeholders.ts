import type { IndexedTree } from "../forest/types";
import type { GraphChunk, ObjectChunk } from "../values/types";
import type { CacheEnv } from "../cache/types";
import type {
  IncrementalExecution,
  ObjectAddress,
  ObjectKeyFn,
  AddressStep,
  ResponsePathKey,
} from "./types";
import type {
  FieldInfo,
  PossibleSelections,
  OperationDescriptor,
  ResponsePath,
  TypeName,
} from "../descriptor/types";
import { assert } from "../jsutils/assert";
import {
  isCompositeListValue,
  isObjectValue,
  isReachable,
  resolveFieldChunk,
  resolveListItemChunk,
} from "../values";
import { resolveSelection } from "../descriptor/resolvedSelection";
import { isSourceData, mergeServerData } from "./data";

export function createObjectKey(
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

// Resolves the object in the current stored result
export function resolveAddress(
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

type CaptureContext = {
  operation: OperationDescriptor;
  objectKey: ObjectKeyFn;
  incremental: IncrementalExecution;
};

/**
 * Captures placeholders of objects with deferred fragments (enabled for the operation variables) in data received
 * from the server, walking only selections leading to them (see hasDeferSites).
 *
 * `data` is the value in the server view (identifies objects), `delivered` - the part of it to walk (e.g. data
 * of a subsequent result). Addresses are captured on the spot: the closest keyed object (or the root) + the path
 * from it (`address` is the address of `data` when `isAddressed`, otherwise of its parent + the path to it).
 * Data of objects with deferred fragments is added to the server data (unless it is within it already).
 *
 * Note: addresses are captured in the server view, not in the stored result: the same for keyed objects,
 *   but an unkeyed object in a list rearranged by a merge policy may get another index (rare).
 */
export function capturePlaceholders(
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
    if (field.selection && hasDeferSites(field.selection)) {
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
export function getAddressSelections({
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

/**
 * Whether objects with the selections (or below) may have defer sites (computed once per document).
 *
 * Static (possible selections): resolving selections of types the data doesn't have would change resolved hashes
 * of the operation (see getResolvedHash), so only selections of objects in the data are resolved (as when indexing).
 * Sites disabled by variables are checked on resolved selections when capturing.
 */
function hasDeferSites(selections: PossibleSelections): boolean {
  let result = selectionsWithDeferSites.get(selections);
  if (result === undefined) {
    result = findDeferSites(selections);
    selectionsWithDeferSites.set(selections, result);
  }
  return result;
}

function findDeferSites(selections: PossibleSelections): boolean {
  for (const selection of selections.values()) {
    if (selection.deferSites?.length) {
      return true;
    }
    for (const fields of selection.fields.values()) {
      for (const field of fields) {
        if (field.selection && hasDeferSites(field.selection)) {
          return true;
        }
      }
    }
  }
  return false;
}

const selectionsWithDeferSites = new WeakMap<PossibleSelections, boolean>();

/**
 * Resolves an object by list indexes and fields: response keys (e.g. paths of incremental results) or fields
 * of selections (addresses: a field of the selection of the object, e.g. not an alias of another field).
 * With `types`, objects fields are resolved on must be of the same types (when known).
 */
export function resolvePath(
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

export function resolveListItem(
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

export function getPathKey(path: ResponsePath): ResponsePathKey {
  return path.join(".");
}

// Whether the object is of the type (when both are known)
export function isOfType(chunk: ObjectChunk, type: unknown): boolean {
  return !type || !chunk.type || chunk.type === type;
}

const EMPTY_ARRAY = Object.freeze([]);
