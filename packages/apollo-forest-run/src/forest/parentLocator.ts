import type {
  CompositeListChunk,
  DataMap,
  ObjectChunk,
  ParentLocator,
} from "../values/types";
import type {
  IndexedOperationFragment,
  IndexedTree,
  OperationFragmentRoot,
} from "./types";
import {
  createParentLocator,
  isObjectValue,
  isParentListRef,
  isParentObjectRef,
} from "../values";
import { assert } from "../jsutils/assert";

// Parent locator of any tree kind
export function createTreeParentLocator(
  tree: IndexedTree | IndexedOperationFragment,
): ParentLocator {
  return tree.kind === "OperationFragment"
    ? createOperationFragmentParentLocator(
        tree.dataMap,
        tree.roots,
        tree.findStoredParent,
      )
    : createParentLocator(tree.dataMap);
}

/**
 * Chunks of an indexed operation fragment are resolved in the fragment itself, except for roots: each root takes the place
 * of its target object in the stored tree, so ascending from a root continues in the stored tree.
 */
export function createOperationFragmentParentLocator(
  dataMap: DataMap,
  roots: OperationFragmentRoot[],
  findStoredParent: ParentLocator,
): ParentLocator {
  const rootParents: DataMap = new Map();
  for (const { data, target } of roots) {
    const rootRef = dataMap.get(data);
    assert(rootRef && isObjectValue(rootRef.value));
    const value = rootRef.value;
    const targetRef = findStoredParent(target);
    rootParents.set(
      data,
      isParentObjectRef(targetRef)
        ? { value, parent: targetRef.parent, field: targetRef.field }
        : isParentListRef(targetRef)
        ? { value, parent: targetRef.parent, index: targetRef.index }
        : rootRef,
    );
  }
  return (chunk: ObjectChunk | CompositeListChunk) =>
    rootParents.get(chunk.data) ??
    dataMap.get(chunk.data) ??
    findStoredParent(chunk);
}
