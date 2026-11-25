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
  EmbeddedRootAddress,
  NodeKey,
} from "./types";
import { ValueKind } from "./types";
import type { FieldInfo, NormalizedFieldEntry } from "../descriptor/types";
import { resolveNormalizedField } from "../descriptor/resolvedSelection";
import * as Predicates from "./predicates";
import * as ResolveValue from "./resolve";
import { assert, assertNever } from "../jsutils/assert";

const stack: (FieldInfo | number)[] = [];
const normalizedStack: (NormalizedFieldEntry | number)[] = [];

export type TraverseEnv = {
  findParent: ParentLocator;
};

/**
 * Synthetic key of a tree root embedded into a node of another tree (see RootChunkReference.embeddedIn).
 * Such root is indexed as a node, so that tree-local operations work as usual. The key never leaves its tree:
 * lookups in other trees are resolved via the embedded root address.
 */
export const EMBEDDED_ROOT_KEY = "__EMBEDDED_ROOT__";

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
  Predicates.isNodeValue(chunk) && chunk.key !== EMBEDDED_ROOT_KEY
    ? chunk.key
    : [env.findParent(chunk), env.findParent];

/**
 * Key of the node in the store: for an embedded root - key of the node it is embedded into
 * (in this case, `node` itself is not in the store, embedded value must be retrieved by reference).
 */
export function resolveStoredNodeKey(
  node: NodeChunk,
  findParent: ParentLocator,
): NodeKey {
  if (node.key !== EMBEDDED_ROOT_KEY) {
    return node.key;
  }
  const ref = findParent(node);
  assert(Predicates.isRootRef(ref) && ref.embeddedIn);
  return ref.embeddedIn.nodeKey;
}

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
  const embeddedIn =
    parentRef && Predicates.isRootRef(parentRef)
      ? parentRef.embeddedIn
      : undefined;
  if (embeddedIn) {
    // Reference from a tree with an embedded root: continue from the node it is embedded into
    return retrieveFromEmbeddedRoot(source, embeddedIn);
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
  return descendNormalizedPath(
    source,
    resolveNormalizedField(parentRef.parent.selection, parentRef.field),
  );
}

function retrieveFromEmbeddedRoot(
  source: NodeValue,
  { nodeKey, path }: EmbeddedRootAddress,
): GraphValue | undefined {
  assert(nodeKey === source.key && path.length);
  // Steps from the embedded root (collected in normalizedStack) are popped after the path to it
  for (let i = path.length - 1; i > 0; i--) {
    normalizedStack.push(path[i]);
  }
  return descendNormalizedPath(source, path[0]);
}

// Descends from the source by the first step + steps collected in normalizedStack (in reverse order)
function descendNormalizedPath(
  source: NodeValue,
  firstStep: NormalizedFieldEntry | number,
): GraphValue | undefined {
  let parent: CompositeValue = source;
  let step: NormalizedFieldEntry | number | undefined = firstStep;
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
  if (typeof ref === "string") {
    return true;
  }
  if (Predicates.isRootRef(ref[0])) {
    return !ref[0].embeddedIn;
  }
  const value = resolveGraphValueReference(ref[0]);
  return Predicates.isNodeValue(value);
}
