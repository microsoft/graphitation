import type {
  NodeKey,
  PossibleSelections,
  TypeName,
} from "../descriptor/types";
import type { SourceObject } from "../values/types";

export type ResponsePath = ReadonlyArray<string | number>;

/**
 * Where to write a deferred fragment: an object key, plus a path (response keys and list indices)
 * when the target object is embedded into its closest keyed ancestor.
 */
export type DeferTarget = {
  label: string | undefined;
  path: ResponsePath; // response path of the deferred fragment
  dataId: NodeKey;
  subPath: ResponsePath;
  typeName: TypeName | undefined;
  selection: PossibleSelections;
};

// Pending deferred fragments of an incremental execution by response path and label.
//   `null` marks ambiguous keys: unlabeled fragments sharing a path can't be told apart.
export type DeferTargets = Map<string, DeferTarget | null>;

export type EmbeddedDeferTarget = {
  target: DeferTarget;
  source: SourceObject;
};

export function addDeferTarget(targets: DeferTargets, target: DeferTarget) {
  addKey(targets, targetKey(target.path, target.label), target);
  if (target.label !== undefined) {
    // Allows patches without labels (when the path is unambiguous)
    addKey(targets, targetKey(target.path, undefined), target);
  }
}

export function takeDeferTarget(
  targets: DeferTargets,
  path: ResponsePath,
  label: string | undefined,
): DeferTarget | undefined {
  const target = targets.get(targetKey(path, label));
  if (!target) {
    return;
  }
  targets.delete(targetKey(path, target.label));
  const unlabeled = targetKey(path, undefined);
  if (targets.get(unlabeled) === target) {
    targets.delete(unlabeled);
  }
  return target;
}

function addKey(targets: DeferTargets, key: string, target: DeferTarget) {
  const existing = targets.get(key);
  if (existing === undefined) {
    targets.set(key, target);
  } else if (existing !== null && !isSameTarget(existing, target)) {
    targets.set(key, null);
  }
}

function targetKey(path: ResponsePath, label: string | undefined) {
  return JSON.stringify([label ?? null, path]);
}

function isSameTarget(a: DeferTarget, b: DeferTarget) {
  return (
    a.selection === b.selection &&
    a.label === b.label &&
    a.dataId === b.dataId &&
    a.subPath.length === b.subPath.length &&
    a.subPath.every((step, i) => step === b.subPath[i])
  );
}
