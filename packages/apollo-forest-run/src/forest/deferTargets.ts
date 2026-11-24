import type {
  DeferLabel,
  NodeKey,
  NormalizedFieldEntry,
  PossibleSelections,
  TypeName,
} from "../descriptor/types";
import type { ObjectChunk, ParentLocator, SourceObject } from "../values/types";
import {
  fieldEntriesAreEqual,
  resolveNormalizedField,
} from "../descriptor/resolvedSelection";
import { isParentListRef, isRootRef } from "../values";

export type ResponsePath = ReadonlyArray<string | number>;

// Normalized fields (name + arguments) and list indices from an object to an object embedded into it
export type EmbeddedPath = ReadonlyArray<NormalizedFieldEntry | number>;

/**
 * Where to write a deferred fragment: an object key, plus a path for objects embedded
 * into their closest keyed ancestor (similar to client ids of embedded records in Relay).
 */
export type DeferTarget = {
  label: DeferLabel | undefined;
  path: ResponsePath; // response path of the deferred fragment
  dataId: NodeKey;
  subPath: EmbeddedPath;
  typeName: TypeName | undefined;
  selection: PossibleSelections;
};

// A target found while indexing a result (addressed relative to the result root)
export type CollectedDeferTarget = {
  target: DeferTarget;
  source: SourceObject;
};

// Pending deferred fragments of an incremental execution by response path and label.
//   `null` marks ambiguous keys: unlabeled fragments sharing a path can't be told apart.
// Response path and label of a deferred fragment
export type DeferTargetKey = string;

export type DeferTargets = Map<DeferTargetKey, DeferTarget | null>;

export function addDeferTarget(targets: DeferTargets, target: DeferTarget) {
  addKey(targets, targetKey(target.path, target.label), target);
  if (target.label !== undefined) {
    // Allows payloads without labels (when the path is unambiguous)
    addKey(targets, targetKey(target.path, undefined), target);
  }
}

export function getDeferTarget(
  targets: DeferTargets,
  path: ResponsePath,
  label: DeferLabel | undefined,
): DeferTarget | undefined {
  return targets.get(targetKey(path, label)) ?? undefined;
}

export function deleteDeferTarget(targets: DeferTargets, target: DeferTarget) {
  const labeled = targetKey(target.path, target.label);
  const unlabeled = targetKey(target.path, undefined);
  if (targets.get(labeled) === target) {
    targets.delete(labeled);
  }
  if (targets.get(unlabeled) === target) {
    targets.delete(unlabeled);
  }
}

/**
 * Address of an object: its key, or for an embedded object - the closest keyed ancestor
 * and the path from it. The root object is addressed by `rootKey`.
 */
export function resolveObjectAddress(
  findParent: ParentLocator,
  object: ObjectChunk,
  rootKey: NodeKey,
): { dataId: NodeKey; subPath: EmbeddedPath } | undefined {
  const subPath: (NormalizedFieldEntry | number)[] = [];
  let ref = findParent(object);
  if (object.key !== false && !isRootRef(ref)) {
    return { dataId: object.key, subPath };
  }
  while (ref && !isRootRef(ref)) {
    if (isParentListRef(ref)) {
      subPath.unshift(ref.index);
      ref = findParent(ref.parent);
      continue;
    }
    const parent = ref.parent;
    subPath.unshift(resolveNormalizedField(parent.selection, ref.field));
    ref = findParent(parent);
    if (ref && isRootRef(ref)) {
      return { dataId: rootKey, subPath };
    }
    if (parent.key !== false) {
      return { dataId: parent.key, subPath };
    }
  }
  return ref ? { dataId: rootKey, subPath } : undefined;
}

function addKey(
  targets: DeferTargets,
  key: DeferTargetKey,
  target: DeferTarget,
) {
  const existing = targets.get(key);
  if (existing === undefined) {
    targets.set(key, target);
  } else if (existing !== null && !isSameTarget(existing, target)) {
    targets.set(key, null);
  }
}

function targetKey(
  path: ResponsePath,
  label: DeferLabel | undefined,
): DeferTargetKey {
  return JSON.stringify([label ?? null, path]);
}

function isSameTarget(a: DeferTarget, b: DeferTarget) {
  return (
    a.selection === b.selection &&
    a.label === b.label &&
    a.dataId === b.dataId &&
    a.subPath.length === b.subPath.length &&
    a.subPath.every((step, i) => {
      const other = b.subPath[i];
      return typeof step === "number" || typeof other === "number"
        ? step === other
        : fieldEntriesAreEqual(step, other);
    })
  );
}
