import type {
  NodeKey,
  PossibleSelections,
  TypeName,
} from "../descriptor/types";
import type { ObjectChunk } from "../values/types";
import type { IndexedTree } from "./types";
import { isParentListRef, isRootRef } from "../values";

export type ResponsePath = ReadonlyArray<string | number>;

/**
 * Cache address of a deferred fragment's target object.
 *
 * Addresses do not reference chunks, so they stay valid across tree updates:
 * a keyed target is addressed by its key, an embedded one by the path (response keys
 * and list indices) from its closest keyed ancestor.
 */
export type DeferTarget = {
  nodeKey: NodeKey;
  path: ResponsePath;
  typeName: TypeName | undefined;
  selection: PossibleSelections;
};

// Pending targets of a single incremental execution.
//   Keyed by response path and label (`null` when the key is ambiguous)
export type DeferIndex = Map<string, DeferTarget | null>;

// Execution identity used when the client doesn't provide one
export const DEFAULT_EXECUTION = Object.freeze({});

export function deferTargetKey(path: ResponsePath, label: string | undefined) {
  return JSON.stringify([label ?? null, path]);
}

export function addDeferTarget(
  index: DeferIndex,
  key: string,
  target: DeferTarget,
) {
  const existing = index.get(key);
  if (existing === undefined) {
    index.set(key, target);
  } else if (existing !== null && !isSameTarget(existing, target)) {
    // Unlabeled fragments sharing a path can't be told apart by their payloads
    index.set(key, null);
  }
}

export function takeDeferTarget(
  index: DeferIndex,
  path: ResponsePath,
  label: string | undefined,
): DeferTarget | undefined {
  const key = deferTargetKey(path, label);
  const target = index.get(key);
  index.delete(key);
  return target ?? undefined;
}

function isSameTarget(a: DeferTarget, b: DeferTarget) {
  return (
    a.selection === b.selection &&
    a.nodeKey === b.nodeKey &&
    a.path.length === b.path.length &&
    a.path.every((segment, i) => segment === b.path[i])
  );
}

export function addressKey(nodeKey: NodeKey, path: ResponsePath) {
  return path.length ? JSON.stringify([nodeKey, path]) : nodeKey;
}

/**
 * Resolves a cache address of an object in a tree: its key, or for an embedded object,
 * the closest keyed ancestor and the path from it.
 *
 * The root of the tree may be addressed explicitly (e.g. when the tree is a fragment of another result).
 */
export function resolveObjectAddress(
  tree: IndexedTree,
  object: ObjectChunk,
  rootAddress?: { nodeKey: NodeKey; path: ResponsePath },
): { nodeKey: NodeKey; path: ResponsePath } | undefined {
  const path: (string | number)[] = [];
  let chunk = object;
  while (chunk.data !== tree.result.data) {
    if (chunk.key !== false) {
      return { nodeKey: chunk.key, path };
    }
    let ref = tree.dataMap.get(chunk.data);
    while (ref && isParentListRef(ref)) {
      path.unshift(ref.index);
      ref = tree.dataMap.get(ref.parent.data);
    }
    if (!ref || isRootRef(ref)) {
      return undefined;
    }
    path.unshift(ref.field.dataKey);
    chunk = ref.parent;
  }
  return rootAddress
    ? { nodeKey: rootAddress.nodeKey, path: [...rootAddress.path, ...path] }
    : { nodeKey: tree.rootNodeKey, path };
}
