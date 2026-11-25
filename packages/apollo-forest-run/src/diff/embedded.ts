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
 * (resolved by ascending from the chunk with the locator, so the node may be outside of the chunk tree)
 */
export function getEmbeddedChunkDifference(
  nodeDifference: NodeDifferenceMap,
  findParent: ParentLocator,
  chunk: ObjectChunk | CompositeListChunk,
): ValueDifference | undefined {
  if (isNodeValue(chunk)) {
    return nodeDifference.get(chunk.key);
  }
  const ref = findParent(chunk);
  assert(!isRootRef(ref));
  const parentDifference = getEmbeddedChunkDifference(
    nodeDifference,
    findParent,
    ref.parent,
  );
  if (isParentObjectRef(ref)) {
    return isObjectDifference(parentDifference)
      ? getFieldDifference(
          parentDifference,
          resolveNormalizedField(ref.parent.selection, ref.field),
        )?.state
      : undefined;
  }
  return isCompositeListDifference(parentDifference)
    ? getListItemDifference(parentDifference, ref.index)
    : undefined;
}

/**
 * Adds a dirty difference of an embedded chunk to the difference of its closest node (keeps existing differences).
 * Returns the difference of the chunk (existing or added).
 */
export function addEmbeddedChunkDifference(
  nodeDifference: NodeDifferenceMap,
  findParent: ParentLocator,
  chunk: ObjectChunk | CompositeListChunk,
  difference?: ObjectDifference | CompositeListDifference, // Created when missing
): ValueDifference {
  if (isNodeValue(chunk)) {
    let nodeDiff = nodeDifference.get(chunk.key);
    if (!nodeDiff) {
      const created = difference ?? createObjectDifference();
      assert(isObjectDifference(created));
      nodeDiff = created;
      nodeDifference.set(chunk.key, nodeDiff);
    }
    return nodeDiff;
  }
  const ref = findParent(chunk);
  assert(!isRootRef(ref));
  const parentDifference = addEmbeddedChunkDifference(
    nodeDifference,
    findParent,
    ref.parent,
  );
  if (isParentObjectRef(ref)) {
    assert(isObjectDifference(parentDifference));
    const field = resolveNormalizedField(ref.parent.selection, ref.field);
    addDirtyField(parentDifference, field);
    return (
      getFieldDifference(parentDifference, field) ??
      addFieldDifference(
        parentDifference,
        field,
        difference ?? createChunkDifference(chunk),
      )
    ).state;
  }
  assert(isCompositeListDifference(parentDifference));
  addDirtyListItem(parentDifference, ref.index);
  return (
    getListItemDifference(parentDifference, ref.index) ??
    addListItemDifference(
      parentDifference,
      ref.index,
      difference ?? createChunkDifference(chunk),
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
