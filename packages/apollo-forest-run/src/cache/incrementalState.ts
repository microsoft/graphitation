import type { IndexedForest, IndexedTree } from "../forest/types";
import type { ObjectChunk } from "../values/types";
import { isParentListRef, isParentObjectRef } from "../values/predicates";
import type { IncrementalIdentity, IncrementalTarget } from "./incremental";

type State = { targets: Map<string, IncrementalTarget> };
const states = new WeakMap<IndexedForest, State>();

export function getIncrementalState(forest: IndexedForest): State {
  let state = states.get(forest);
  if (!state) {
    state = { targets: new Map() };
    states.set(forest, state);
  }
  return state;
}

export function resetIncrementalState(forest: IndexedForest) {
  states.delete(forest);
}

export function isCurrentIncrementalState(forest: IndexedForest, state: State) {
  return states.get(forest) === state;
}

export function captureIncrementalTarget(
  forest: IndexedForest,
  identity: IncrementalIdentity,
): IncrementalTarget {
  const state = getIncrementalState(forest);
  const type = getLiveType(forest, identity.id);
  if (type !== identity.typename) {
    state.targets.delete(identity.id);
    return { ...identity, token: undefined };
  }
  let target = state.targets.get(identity.id);
  if (!target || target.typename !== type) {
    target = { ...identity, token: {} };
    state.targets.set(identity.id, target);
  }
  return { ...target };
}

export function isIncrementalTargetValid(
  forest: IndexedForest,
  target: IncrementalTarget,
): boolean {
  refreshIncrementalTargets(forest, [target.id]);
  const saved = states.get(forest)?.targets.get(target.id);
  return (
    target.token !== undefined &&
    saved?.token === target.token &&
    saved.typename === target.typename
  );
}

export function invalidateIncrementalTarget(forest: IndexedForest, id: string) {
  states.get(forest)?.targets.delete(id);
}

// Only tracked IDs are inspected; ordinary cache use allocates no token state.
export function refreshIncrementalTargets(
  forest: IndexedForest,
  ids: Iterable<string>,
) {
  const targets = states.get(forest)?.targets;
  if (!targets?.size) return;
  for (const id of ids) {
    const target = targets.get(id);
    if (target && getLiveType(forest, id) !== target.typename) {
      targets.delete(id);
    }
  }
}

function getLiveType(forest: IndexedForest, id: string): string | undefined {
  if (forest.deletedNodes.has(id)) return;
  let type: string | undefined;
  for (const operationId of forest.operationsByNodes.get(id) ?? []) {
    const tree = forest.trees.get(operationId);
    if (!tree) continue;
    for (const chunk of tree.nodes.get(id) ?? []) {
      if (!isLiveChunk(tree, chunk)) continue;
      const next =
        chunk.type ||
        (id === tree.rootNodeKey ? tree.operation.rootType : undefined);
      if (!next || (type && type !== next)) return;
      type = next;
    }
  }
  return type;
}

function isLiveChunk(tree: IndexedTree, chunk: ObjectChunk): boolean {
  let ref = tree.dataMap.get(chunk.data);
  while (ref) {
    if (isParentObjectRef(ref)) {
      if (
        ref.parent.missingFields?.has(ref.field) ||
        ref.parent.fieldChunks.get(ref.field.dataKey) !== ref
      )
        return false;
    } else if (isParentListRef(ref)) {
      if (
        ref.parent.missingItems?.has(ref.index) ||
        ref.parent.itemChunks[ref.index] !== ref
      )
        return false;
    } else {
      return !ref.detached;
    }
    ref = tree.dataMap.get(ref.parent.data);
  }
  return false;
}
