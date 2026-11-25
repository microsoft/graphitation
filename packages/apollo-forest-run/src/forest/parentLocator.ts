import type {
  CompositeListChunk,
  DataMap,
  ObjectChunk,
  ParentLocator,
} from "../values/types";
import type { AnyIndexedTree, OperationFragmentTree } from "./types";
import {
  createParentLocator,
  isObjectValue,
  isParentListRef,
  isParentObjectRef,
} from "../values";
import { assert } from "../jsutils/assert";

// Parent locator of any tree kind
export function createTreeParentLocator(tree: AnyIndexedTree): ParentLocator {
  return tree.kind === "OperationFragment"
    ? createOperationFragmentParentLocator(tree)
    : createParentLocator(tree.dataMap);
}

/**
 * Chunks of an operation fragment tree are resolved in the tree itself, except for roots: each root takes the place
 * of its target object in the stored tree, so ascending from a root continues in the stored tree.
 */
export function createOperationFragmentParentLocator(
  tree: OperationFragmentTree,
): ParentLocator {
  const { dataMap, findStoredParent } = tree;
  const rootParents: DataMap = new Map();
  for (const { data, target } of tree.roots) {
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
