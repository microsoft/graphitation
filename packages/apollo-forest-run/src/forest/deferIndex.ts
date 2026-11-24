import type {
  NodeKey,
  PossibleSelections,
  TypeName,
} from "../descriptor/types";

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

export type DeferIndex = {
  // Identifies the execution which produced this index (opaque, provided by the client)
  execution: unknown;
  // Keyed by response path and label; `null` when the key is ambiguous
  targets: Map<string, DeferTarget | null>;
};

export function createDeferIndex(execution: unknown): DeferIndex {
  return { execution, targets: new Map() };
}

export function addDeferTarget(
  index: DeferIndex,
  path: ResponsePath,
  label: string | undefined,
  target: DeferTarget,
) {
  const key = deferTargetKey(path, label);
  const existing = index.targets.get(key);
  if (existing === undefined) {
    index.targets.set(key, target);
  } else if (existing !== null && !isSameTarget(existing, target)) {
    // Unlabeled fragments sharing a path can't be told apart by their payloads
    index.targets.set(key, null);
  }
}

export function takeDeferTarget(
  index: DeferIndex,
  path: ResponsePath,
  label: string | undefined,
): DeferTarget | undefined {
  const key = deferTargetKey(path, label);
  const target = index.targets.get(key);
  index.targets.delete(key);
  return target ?? undefined;
}

function deferTargetKey(path: ResponsePath, label: string | undefined) {
  return JSON.stringify([label ?? null, path]);
}

function isSameTarget(a: DeferTarget, b: DeferTarget) {
  return (
    a.selection === b.selection &&
    a.nodeKey === b.nodeKey &&
    a.path.length === b.path.length &&
    a.path.every((segment, i) => segment === b.path[i])
  );
}
