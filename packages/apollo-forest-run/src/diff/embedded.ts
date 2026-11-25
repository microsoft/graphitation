import type {
  CompositeListChunk,
  ObjectChunk,
  ParentLocator,
} from "../values/types";
import type {
  CompositeListDifference,
  NodeDifferenceMap,
  ObjectDifference,
  ValueDifference,
} from "./types";
import { resolveNormalizedField } from "../descriptor/resolvedSelection";
import { assert } from "../jsutils/assert";
import {
  isNodeValue,
  isObjectValue,
  isParentObjectRef,
  isRootRef,
} from "../values/predicates";
import {
  addDirtyField,
  addDirtyListItem,
  addFieldDifference,
  addListItemDifference,
  createCompositeListDifference,
  createObjectDifference,
  getFieldDifference,
  getListItemDifference,
  isCompositeListDifference,
  isObjectDifference,
} from "./difference";
/**
 * Difference of an embedded chunk within the difference of its closest node
 * (resolved by ascending from the chunk with the locator, so the node may be outside of the chunk tree).
 *
 * When `added` is set, it is added as the chunk difference (if missing), missing differences on the path
 * are created, and the path is marked dirty.
 */
export function getEmbeddedChunkDifference(
  nodeDifference: NodeDifferenceMap,
  findParent: ParentLocator,
  chunk: ObjectChunk | CompositeListChunk,
  added?: ObjectDifference,
  target = chunk,
): ValueDifference | undefined {
  if (isNodeValue(chunk)) {
    let difference = nodeDifference.get(chunk.key);
    if (!difference && added) {
      difference = chunk === target ? added : createObjectDifference();
      nodeDifference.set(chunk.key, difference);
    }
    return difference;
  }
  const ref = findParent(chunk);
  assert(!isRootRef(ref));
  const parent = getEmbeddedChunkDifference(
    nodeDifference,
    findParent,
    ref.parent,
    added,
    target,
  );
  if (isParentObjectRef(ref)) {
    if (!isObjectDifference(parent)) {
      return undefined;
    }
    const field = resolveNormalizedField(ref.parent.selection, ref.field);
    const existing = getFieldDifference(parent, field)?.state;
    if (!added) {
      return existing;
    }
    addDirtyField(parent, field);
    return (
      existing ??
      addFieldDifference(
        parent,
        field,
        chunk === target ? added : createChunkDifference(chunk),
      ).state
    );
  }
  if (!isCompositeListDifference(parent)) {
    return undefined;
  }
  const existing = getListItemDifference(parent, ref.index);
  if (!added) {
    return existing;
  }
  addDirtyListItem(parent, ref.index);
  return (
    existing ??
    addListItemDifference(
      parent,
      ref.index,
      chunk === target ? added : createChunkDifference(chunk),
    )
  );
}

function createChunkDifference(
  chunk: ObjectChunk | CompositeListChunk,
): ObjectDifference | CompositeListDifference {
  return isObjectValue(chunk)
    ? createObjectDifference()
    : createCompositeListDifference();
}
