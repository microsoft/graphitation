import type {
  IndexedForest,
  IndexedTree,
  IncrementalTarget,
} from "../forest/types";
import type { ObjectChunk } from "../values/types";
import { isParentListRef, isParentObjectRef } from "../values/predicates";

export function getIncrementalState(forest: IndexedForest) {
  return (forest.incremental ??= { targets: new Map() });
}

export function resetIncrementalState(forest: IndexedForest) {
  forest.incremental?.targets.clear();
  forest.incremental = undefined;
}

export function captureIncrementalTarget(
  forest: IndexedForest,
  identity: Pick<IncrementalTarget, "id" | "typename">,
): IncrementalTarget {
  const state = getIncrementalState(forest);
  const type = getLiveType(forest, identity.id);
  let target = state.targets.get(identity.id);
  if (target && target.typename !== type) {
    state.targets.delete(identity.id);
    target = undefined;
  }
  if (type !== identity.typename) {
    return { ...identity, token: undefined };
  }
  if (!target) {
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
  const saved = forest.incremental?.targets.get(target.id);
  return (
    target.token !== undefined &&
    saved?.token === target.token &&
    saved.typename === target.typename
  );
}

export function invalidateIncrementalTarget(forest: IndexedForest, id: string) {
  forest.incremental?.targets.delete(id);
}

// Only tracked IDs are inspected; ordinary cache use allocates no token state.
export function refreshIncrementalTargets(
  forest: IndexedForest,
  ids: Iterable<string>,
) {
  const targets = forest.incremental?.targets;
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
