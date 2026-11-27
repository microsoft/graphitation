import type {
  CompositeListChunk,
  CompositeValue,
  GraphChunk,
  GraphValue,
  GraphValueReference,
  NodeChunk,
  NodeValue,
  ObjectChunk,
  GraphChunkReference,
  ParentLocator,
  DataMap,
} from "./types";
import { ValueKind } from "./types";
import type { FieldInfo, NormalizedFieldEntry } from "../descriptor/types";
import type { Draft, Source } from "../forest/types";
import { resolveNormalizedField } from "../descriptor/resolvedSelection";
import * as Predicates from "./predicates";
import * as ResolveValue from "./resolve";
import { assert, assertNever } from "../jsutils/assert";

const stack: (FieldInfo | number)[] = [];
const normalizedStack: (NormalizedFieldEntry | number)[] = [];

export type TraverseEnv = {
  findParent: ParentLocator;
};

export const createParentLocator =
  (map: DataMap): ParentLocator =>
  (chunk: ObjectChunk | CompositeListChunk) => {
    const parent = map.get(chunk.data);
    assert(parent);
    return parent;
  };

export function getDataPathForDebugging(
  env: TraverseEnv,
  chunk: ObjectChunk | CompositeListChunk,
  from?: ObjectChunk | CompositeListChunk,
): (string | number)[] {
  const parentInfo = env.findParent(chunk);
  if (!parentInfo || Predicates.isRootRef(parentInfo) || chunk === from) {
    return [];
  }
  const path = getDataPathForDebugging(env, parentInfo.parent, from);
  if (Predicates.isParentObjectRef(parentInfo)) {
    path.push(parentInfo.field.dataKey);
  } else if (Predicates.isParentListRef(parentInfo)) {
    path.push(parentInfo.index);
  }
  return path;
}

// Builds a " at path <path>" clause for invariant messages. Wrapped in try/catch because
//   it runs while reporting a violation, when the tree may already be inconsistent.
function embeddedPathClause(env: TraverseEnv, source: NodeValue): string {
  if (source.isAggregate) {
    return "";
  }
  try {
    const path = getDataPathForDebugging(env, source);
    return path.length ? ` at path ${path.join(".")}` : "";
  } catch {
    return "";
  }
}

export function findClosestNode(
  chunk: ObjectChunk | CompositeListChunk,
  findParent: ParentLocator,
): NodeChunk {
  if (Predicates.isNodeValue(chunk)) {
    return chunk;
  }
  const parentInfo = findParent(chunk);
  assert(parentInfo.parent);
  return findClosestNode(parentInfo.parent, findParent);
}

export function ascendFromChunk(
  env: TraverseEnv,
  from: ObjectChunk | CompositeListChunk,
  visit?: (
    value: ObjectChunk | CompositeListChunk,
    parent: ObjectChunk | CompositeListChunk,
    step: number | FieldInfo, // TODO: | SpreadInfo (for fragment aliases)
  ) => void | false,
): ObjectChunk | CompositeListChunk {
  let value: ObjectChunk | CompositeListChunk = from;
  let parentInfo: GraphChunkReference | null = env.findParent(from);
  while (parentInfo?.parent) {
    const step = Predicates.isParentListRef(parentInfo)
      ? parentInfo.index
      : parentInfo.field;
    if (visit?.(value, parentInfo.parent, step) === false) {
      break;
    }
    value = parentInfo.parent;
    parentInfo = env.findParent(parentInfo.parent);
  }
  return value;
}

export function descendToChunk(
  env: TraverseEnv,
  from: ObjectChunk,
  to: ObjectChunk | CompositeListChunk,
  visit?: (
    value: GraphChunk,
    parent: ObjectChunk | CompositeListChunk,
    step: number | FieldInfo, // TODO: | SpreadInfo (for fragment aliases)
  ) => void | false,
): GraphChunk | undefined {
  if (
    Predicates.isCompositeValue(to) &&
    from.possibleSelections === to.possibleSelections
  ) {
    // This function allows traversing chunks from different operations
    //   as long as they share the same document. This comparison is the easiest way to know it.
    return;
  }
  // Note: this is a hot-path, so have to cut corners type-wise
  stack.length = 0;

  let parentInfo: GraphChunkReference | null = env.findParent(to);
  while (
    parentInfo?.parent &&
    parentInfo?.parent.possibleSelections !== from.possibleSelections
  ) {
    stack.push(
      Predicates.isParentObjectRef(parentInfo)
        ? parentInfo.field
        : parentInfo.index,
    );
    parentInfo = env.findParent(parentInfo.parent);
  }
  // This function allows to traverse a chunk from the different tree with the same operation
  assert(
    parentInfo &&
      Predicates.isParentObjectRef(parentInfo) &&
      parentInfo.parent.possibleSelections === from.possibleSelections,
  );

  let parent: ObjectChunk | CompositeListChunk = from;
  let step: FieldInfo | number | undefined = parentInfo.field;

  let value: GraphChunk | undefined;
  while (step !== undefined) {
    if (parent.kind === ValueKind.Object) {
      assert(typeof step !== "number");
      value = ResolveValue.resolveFieldChunk(parent, step);
    } else if (parent.kind === ValueKind.CompositeList) {
      assert(typeof step === "number");
      value = ResolveValue.resolveListItemChunk(parent, step);
    } else {
      assertNever(parent);
    }
    if (visit?.(value, parent, step) === false) {
      break;
    }
    if (
      !Predicates.isObjectValue(value) &&
      !Predicates.isCompositeListValue(value)
    ) {
      value = undefined;
      break;
    }
    parent = value;
    step = stack.pop();
  }
  stack.length = 0;

  return value;
}

export function getChunkReference(
  env: TraverseEnv,
  chunk: ObjectChunk | CompositeListChunk,
): GraphChunkReference {
  return env.findParent(chunk);
}

export const getGraphValueReference = (
  env: TraverseEnv,
  chunk: ObjectChunk | CompositeListChunk,
): GraphValueReference =>
  Predicates.isNodeValue(chunk)
    ? chunk.key
    : [env.findParent(chunk), env.findParent];

export function getChunkFieldReference(
  env: TraverseEnv,
  parent: ObjectChunk,
  field: FieldInfo,
  value: GraphChunk,
): GraphChunkReference {
  if (
    Predicates.isObjectValue(value) ||
    Predicates.isCompositeListValue(value)
  ) {
    return env.findParent(value);
  }
  return { value, parent, field };
}

export function retrieveEmbeddedChunk(
  env: TraverseEnv,
  node: NodeChunk,
  ref: ObjectChunk | CompositeListChunk, // note, this could be a chunk from a different operation than node, but
) {
  return descendToChunk(env, node, ref, undefined);
}

export function retrieveEmbeddedValue(
  env: TraverseEnv,
  source: NodeValue,
  ref: GraphValueReference,
): GraphValue | undefined {
  if (typeof ref === "string") {
    assert(source.key === ref);
    return source;
  }

  // Note: this is a hot-path, so have to cut corners type-wise
  normalizedStack.length = 0;
  const refParentLocator = ref[1];
  let parentRef: GraphChunkReference | null = ref[0];
  while (
    parentRef?.parent &&
    (parentRef.parent as ObjectChunk).key !== source.key
  ) {
    normalizedStack.push(
      Predicates.isParentObjectRef(parentRef)
        ? resolveNormalizedField(parentRef.parent.selection, parentRef.field)
        : parentRef.index,
    );
    parentRef = refParentLocator(parentRef.parent);
  }
  if (
    !parentRef ||
    !Predicates.isParentObjectRef(parentRef) ||
    parentRef.parent.key !== source.key
  ) {
    const operationClause =
      "operation" in source ? ` in "${source.operation.debugName}"` : "";
    assert(
      false,
      `Failed to resolve embedded value${operationClause}${embeddedPathClause(
        env,
        source,
      )}: reference does not descend from ${
        source.type || "the expected node"
      }`,
    );
  }
  if (source === resolveGraphValueReference(parentRef)) {
    return resolveGraphValueReference(ref[0]);
  }
  let parent: CompositeValue = source;
  let step: NormalizedFieldEntry | number | undefined = resolveNormalizedField(
    parentRef.parent.selection,
    parentRef.field,
  );
  while (step !== undefined) {
    if (Predicates.isObjectValue(parent)) {
      assert(typeof step !== "number");
      const tmp = ResolveValue.aggregateFieldValue(parent, step);
      if (tmp === undefined) {
        return undefined;
      }
      if (!Predicates.isCompositeValue(tmp)) {
        assert(stack.length === 0);
        return tmp;
      }
      parent = tmp;
    } else if (Predicates.isCompositeListValue(parent)) {
      assert(typeof step === "number");
      parent = ResolveValue.aggregateListItemValue(parent, step);
    } else if (
      Predicates.isCompositeNullValue(parent) ||
      Predicates.isCompositeUndefinedValue(parent)
    ) {
      return parent;
    } else {
      assertNever(parent);
    }
    step = normalizedStack.pop();
  }
  normalizedStack.length = 0;
  return parent;
}

export function resolveGraphValueReference(
  ref: GraphChunkReference,
): GraphChunk {
  if (ref.value !== undefined) {
    return ref.value;
  }
  assert(!Predicates.isRootRef(ref));
  return Predicates.isParentObjectRef(ref)
    ? ResolveValue.resolveFieldChunk(ref.parent, ref.field)
    : ResolveValue.resolveListItemChunk(ref.parent, ref.index);
}

export function resolveObjectKey(
  ref: GraphValueReference,
): string | false | undefined {
  if (typeof ref === "string") {
    return ref;
  }
  if (!ref[0].parent) {
    return false;
  }
  const value = resolveGraphValueReference(ref[0]);
  return Predicates.isObjectValue(value) ? value.key : undefined;
}

export function isNodeRef(ref: GraphValueReference): boolean {
  if (typeof ref === "string" || Predicates.isRootRef(ref[0])) {
    return true;
  }
  const value = resolveGraphValueReference(ref[0]);
  return Predicates.isNodeValue(value);
}

/**
 * Copies sources of `from` and of all its parents up to the root (copies in `copies` are reused: copy-on-write)
 * and links every copy into the copy of its parent. Returns the (original) source of `from`.
 *
 * `enter` is called for every chunk on the path, from `from` up to the root (before copying).
 * `visit` is called for every chunk on the path, from the root down to `from`, after its copy is linked
 * (`existingCopy` is the copy made before this call, if any).
 */
export function copySourcesUpToRoot(
  dataMap: DataMap,
  copies: Map<Source, Draft>,
  from: ObjectChunk | CompositeListChunk,
  visit?: (
    chunk: ObjectChunk | CompositeListChunk,
    parentRef: GraphChunkReference | undefined,
    copy: Draft,
    existingCopy: Draft | undefined,
    isFrom: boolean,
  ) => void,
  enter?: (chunk: ObjectChunk | CompositeListChunk, isFrom: boolean) => void,
  isFrom = true,
): Source {
  enter?.(from, isFrom);
  const parent = dataMap.get(from.data);

  if (!parent || Predicates.isRootRef(parent)) {
    assert(Predicates.isObjectValue(from));
    const data = from.data;
    const existingCopy = copies.get(data);
    const copy = existingCopy ?? { ...data };
    if (!existingCopy) {
      copies.set(data, copy);
    }
    visit?.(from, parent, copy, existingCopy, isFrom);
    return data;
  }
  const parentSource = copySourcesUpToRoot(
    dataMap,
    copies,
    parent.parent,
    visit,
    enter,
    false,
  );
  const parentCopy = copies.get(parentSource);
  assert(parentCopy);

  const dataKey = Predicates.isParentObjectRef(parent)
    ? parent.field.dataKey
    : parent.index;
  const value = (parentSource as any)[dataKey];

  const existingCopy = copies.get(value);
  const copy =
    existingCopy ??
    ((Array.isArray(value) ? [...value] : { ...value }) as Draft);
  if (!existingCopy) {
    copies.set(value, copy);
  }
  (parentCopy as any)[dataKey] = copy;
  visit?.(from, parent, copy, existingCopy, isFrom);
  return value;
}

// Whether the chunk is still a part of the tree (e.g. not under a field deleted in place by cache.modify)
export function isReachable(
  dataMap: DataMap,
  chunk: ObjectChunk | CompositeListChunk,
): boolean {
  let value: ObjectChunk | CompositeListChunk = chunk;
  for (;;) {
    const ref = dataMap.get(value.data);
    if (!ref || ref.value !== value) {
      return false;
    }
    if (Predicates.isRootRef(ref)) {
      return !ref.detached;
    }
    const current = Predicates.isParentObjectRef(ref)
      ? ref.parent.fieldChunks.get(ref.field.dataKey)
      : ref.parent.itemChunks[ref.index];
    if (current !== ref) {
      return false;
    }
    value = ref.parent;
  }
}
