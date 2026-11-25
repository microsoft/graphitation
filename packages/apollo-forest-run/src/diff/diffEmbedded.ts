import type {
  CompositeListChunk,
  NodeKey,
  NodeValue,
  ObjectChunk,
  ParentLocator,
} from "../values/types";
import type {
  CompositeListDifference,
  DiffEnv,
  DiffError,
  NodeDifferenceMap,
  ObjectDiffState,
  ObjectDifference,
  ValueDifference,
} from "./types";
import type {
  IndexedForest,
  IndexedTree,
  IndexedOperationFragment,
} from "../forest/types";
import { resolveNormalizedField } from "../descriptor/resolvedSelection";
import { assert } from "../jsutils/assert";
import {
  isNodeValue,
  isObjectValue,
  isParentObjectRef,
  isRootRef,
} from "../values/predicates";
import { createObjectAggregate } from "../values/create";
import {
  findClosestNode,
  getGraphValueReference,
  retrieveEmbeddedValue,
} from "../values/traverse";
import { createOperationFragmentParentLocator } from "../forest/parentLocator";
import { diffObject } from "./diffObject";
import {
  addDirtyField,
  addDirtyListItem,
  addFieldDifference,
  addListItemDifference,
  createCompositeListDifference,
  createObjectDifference,
  getFieldDifference,
  getListItemDifference,
  isComplete,
  isCompositeListDifference,
  isDirty,
  isObjectDifference,
} from "./difference";

// Re-using state object for multiple roots
const rootDiffState: ObjectDiffState = {
  difference: undefined,
  errors: [],
};

/**
 * Diffs roots of an indexed operation fragment embedded into nodes of the stored tree (see createOperationFragmentParentLocator).
 * Differences are recorded as differences of the closest nodes of roots (along the path to each root).
 */
export function diffEmbeddedRoots(
  forest: IndexedForest,
  model: IndexedOperationFragment,
  nodeDifference: NodeDifferenceMap,
  env: DiffEnv,
  onErrors: (root: ObjectChunk, errors: DiffError[]) => void,
): void {
  const findParent = createOperationFragmentParentLocator(
    model.dataMap,
    model.roots,
    model.findStoredParent,
  );
  for (const { data } of model.roots) {
    const rootRef = model.dataMap.get(data);
    assert(rootRef && isObjectValue(rootRef.value));
    const root = rootRef.value;
    if (root.key !== false) {
      continue;
    }
    const node = findClosestNode(root, findParent);
    const ref = getGraphValueReference({ findParent }, root);
    const existing = getEmbeddedChunkDifference(
      nodeDifference,
      findParent,
      root,
    );
    assert(!existing || isObjectDifference(existing));

    // Note: continues the difference of the same object within the node, when the node is in the tree too
    const state = rootDiffState;
    state.difference = existing;
    state.errors = [];

    for (const operation of forest.operationsByNodes.get(node.key) ?? []) {
      const baseNode = getBaseNode(forest.trees.get(operation), node.key);
      const base =
        baseNode && retrieveEmbeddedValue({ findParent }, baseNode, ref);
      if (base && isObjectValue(base)) {
        diffObject(base, root, env, state);
        if (state.difference && isComplete(state.difference)) {
          break;
        }
      }
    }
    const difference = state.difference;
    if (difference && isDirty(difference)) {
      const added = getEmbeddedChunkDifference(
        nodeDifference,
        findParent,
        root,
        difference,
      );
      assert(added === difference);
    }
    if (state.errors?.length) {
      onErrors(root, state.errors);
    }
  }
}

function getBaseNode(
  tree: IndexedTree | undefined,
  key: NodeKey,
): NodeValue | undefined {
  const chunks = tree?.nodes.get(key);
  if (!chunks?.length) {
    return undefined;
  }
  const node = chunks.length === 1 ? chunks[0] : createObjectAggregate(chunks);
  assert(isNodeValue(node));
  return node;
}
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
