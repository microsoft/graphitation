/* eslint-disable */
import type {
  OperationDescriptor,
  PossibleSelections,
} from "../descriptor/types";
import type {
  NestedList,
  ObjectChunk,
  ObjectValue,
  NodeKey,
  NodeChunk,
  CompositeValueChunk,
  ObjectDraft,
  SourceObject,
} from "../values/types";
import type { ObjectDifference } from "../diff/types";
import type {
  IndexedTree,
  Draft,
  Source,
  UpdateState,
  ForestEnv,
} from "./types";
import { assert } from "../jsutils/assert";
import { indexTree } from "./indexTree";
import { isDirty } from "../diff/difference";
import {
  createDraft,
  hydrateDraft,
  isCompositeListValue,
  isObjectValue,
  isParentListRef,
  isParentObjectRef,
  isRootRef,
  isSourceObject,
  resolveObjectKey,
} from "../values";
import { updateObject } from "./updateObject";
import { createUpdateLogger } from "../telemetry/updateStats/updateLogger";

export type NodeDifferenceMap = Map<string, ObjectDifference>;
type ComplexValue = SourceObject | NestedList<SourceObject>;

export function updateTree(
  base: IndexedTree,
  differenceMap: NodeDifferenceMap,
  env: ForestEnv,
  getNodeChunks?: (key: NodeKey) => Iterable<NodeChunk>,
  state?: UpdateState,
): UpdateState {
  const rootChunks = base.nodes.get(base.rootNodeKey);
  assert(rootChunks?.length === 1);
  const rootChunk = rootChunks[0];
  state ??= {
    indexedTree: base,
    drafts: new Map(),
    missingFields: new Map(),
    statsLogger: createUpdateLogger(),
  };
  const { missingFields, drafts } = state;

  // Preserve existing information about any missing fields.
  // (updated objects will get their own entry in the map, so there won't be collisions)
  for (const incompleteChunk of base.incompleteChunks) {
    assert(isObjectValue(incompleteChunk));
    if (incompleteChunk.missingFields) {
      missingFields.set(
        incompleteChunk.data,
        new Set(incompleteChunk.missingFields),
      );
    }
  }

  // Update existing chunks starting from the deepest.
  //
  // There are two challenges when updating using diffs:
  // 1. List layout updates change object paths, so deep objects must be updated _before_ any parent list layouts
  //    (otherwise, if lists are updated first - we may end up updating incorrect objects when applying the diff)
  //
  // 2. Plain objects may contain deeply nested nodes, and it is not known if those nodes are actually "dirty"
  //    until we run updates on them, thus it is not clear if we should create drafts for
  //    all intermediate objects from chunk source down to the nested node.
  //
  // By executing updates from bottom to top we make sure that list updates happen after all nested objects
  //   are already updated (thus, we can safely change paths); and that all "dirty" child nodes
  //   (and their intermediate parent plain objects) already have their "drafts" by the time we update them.
  const chunkQueue = resolveAffectedChunks(base, differenceMap);
  chunkQueue.sort((a, b) => b.selection.depth - a.selection.depth); // parent is missing for orphan nodes

  let dirty = false;
  for (const chunk of chunkQueue) {
    const difference = differenceMap.get(chunk.key as string);
    assert(difference);

    const result = updateObject(
      env,
      base.dataMap,
      chunk,
      difference,
      completeObject.bind(null, env, base, getNodeChunks),
      state,
    );
    if (!result) {
      continue;
    }
    assert(result.draft === drafts.get(chunk.data));

    // ApolloCompat: orphan nodes are mutated in place
    // TODO: remove this together with orphan nodes
    const chunkRef = base.dataMap.get(chunk.data);
    assert(chunkRef);

    if (chunkRef.parent === null && chunkRef.detached) {
      Object.assign(chunk, {
        source: result.draft,
        missingFields: result?.missingFields?.get(result.draft),
      });
      continue;
    }

    createSourceCopiesUpToRoot(env, base, chunk, state);
    dirty = true;
  }
  if (!dirty) {
    return state;
  }
  const rootDraft = drafts.get(rootChunk.data);
  assert(isSourceObject(rootDraft));

  for (const [source, draft] of drafts.entries()) {
    if (!isSourceObject(source)) {
      continue;
    }
    // Preserve missing fields
    const missing = missingFields.get(source);
    if (missing?.size && isSourceObject(draft)) {
      missingFields.set(draft, missing);
    }
    // ApolloCompat
    const key = env.keyMap?.get(source);
    if (key && isSourceObject(draft)) {
      env.keyMap?.set(draft, key);
    }
  }
  const newIndexedResult = indexTree(
    env,
    base.operation,
    { data: rootDraft },
    missingFields,
    base,
  );
  if (env.apolloCompat_keepOrphanNodes) {
    apolloBackwardsCompatibility_saveOrphanNodes(base, newIndexedResult);
  }
  state.indexedTree = newIndexedResult;
  return state;
}

function resolveAffectedChunks(
  base: IndexedTree,
  differenceMap: NodeDifferenceMap,
): ObjectChunk[] {
  const affectedChunks: ObjectChunk[] = [];
  for (const [objectKey, difference] of differenceMap.entries()) {
    if (!isDirty(difference)) {
      continue;
    }
    const chunks = base.nodes.get(objectKey);
    if (chunks?.length) {
      affectedChunks.push(...chunks);
    }
  }
  return affectedChunks;
}

function completeObject(
  env: ForestEnv,
  base: IndexedTree,
  getNodeChunks: ((key: NodeKey) => Iterable<NodeChunk>) | undefined,
  object: ObjectValue,
  possibleSelections: PossibleSelections,
  operation: OperationDescriptor,
): ObjectDraft {
  const draft = createDraft(
    operation,
    possibleSelections,
    object.key, // Only nodes may have reliable graph reference at this point
    object.type,
  );

  // TODO: remove full matching from here. It should be properly handled by hydrateObjectDraft.
  //   This is not happening today, so disabling the code below will fail a couple of tests in Apollo suite and degrade perf
  //   There is also one failing test in "updateTree.test.ts" ("prepends item of another type and modifies nested entity field")
  //   which is currently passing by accident (the test has no __typename field on union member and doesn't provide "possibleTypes" env)
  //   It is not failing because we re-use the original object which does have a __typename (at write time)
  let fullMatch: ObjectChunk | undefined;
  if (!object.isAggregate) {
    fullMatch =
      object.possibleSelections === possibleSelections ? object : undefined;
  } else {
    for (const item of object.chunks) {
      if (item.possibleSelections === possibleSelections) {
        fullMatch = item;
      }
    }
  }
  if (fullMatch) {
    draft.data = fullMatch.data;
    draft.missingFields = fullMatch.missingFields
      ? new Map([[fullMatch.data, fullMatch.missingFields]])
      : undefined;

    return draft;
  }

  // Copy object value into a different selection set.
  // This way, logical graph value is materialized for usage in a different operation.
  hydrateDraft(env, draft, object);

  if (!draft.incompleteValues?.size) {
    return draft;
  }

  return hydrateDraft(env, draft, function getSourceChunks(ref) {
    const key = resolveObjectKey(ref);
    assert(key !== undefined);
    if (key === false) {
      // This should have been covered already by copyObjectValue
      return [];
    }
    return (getNodeChunks ? getNodeChunks(key) : base.nodes.get(key)) ?? [];
  });
}

function createSourceCopiesUpToRoot(
  env: ForestEnv,
  tree: IndexedTree,
  from: CompositeValueChunk,
  state: UpdateState,
): ComplexValue {
  const { drafts, statsLogger } = state;
  const parent = from.data ? tree.dataMap.get(from.data) : null;

  if (!parent || isRootRef(parent)) {
    assert(isObjectValue(from));
    const data = from.data;
    let draft = drafts.get(data);
    if (!draft) {
      draft = { ...data };
      statsLogger.copy(from);
      drafts.set(data, draft);
    }
    return data;
  }
  const parentSource = createSourceCopiesUpToRoot(
    env,
    tree,
    parent.parent,
    state,
  );
  const parentDraft = drafts.get(parentSource);
  assert(parentDraft);

  const dataKey = isParentObjectRef(parent)
    ? parent.field.dataKey
    : parent.index;
  const value = (parentSource as any)[dataKey];

  let draft = drafts.get(value);
  if (!draft) {
    draft = (Array.isArray(value) ? [...value] : { ...value }) as Draft;
    statsLogger.copy(from);
    drafts.set(value, draft);
  }
  (parentDraft as any)[dataKey] = draft;
  return value;
}

function apolloBackwardsCompatibility_saveOrphanNodes(
  current: IndexedTree,
  next: IndexedTree,
) {
  const currentNodes = current.nodes;
  const nextNodes = next.nodes;
  // There could be situations when some node is _replaced_ in the original result tree,
  //   e.g. when object type changes for field of union type.
  // In case of Apollo InMemoryCache, original node still exist in the cache, except it is no longer reachable
  //   from root-nodes.
  // In case of ForestRun - this node is removed right away. In many cases this is a desired behavior,
  //   since we clean up garbage automatically.
  // However, manual writes/reads from cache _may_ expect orphan nodes to still be in the cache.
  // Another problem is that many Apollo tests are based on "extract" / "restore" methods and snapshots
  // which fail when orphan nodes are removed.
  // So during this transition period, we want to keep "orphan" nodes is the cache.
  for (const nodeId of currentNodes.keys()) {
    if (nextNodes.has(nodeId)) {
      continue;
    }
    const nodeChunks = currentNodes.get(nodeId);
    if (!nodeChunks) {
      continue;
    }
    nextNodes.set(nodeId, nodeChunks);
    for (const chunk of nodeChunks) {
      next.dataMap.set(chunk.data, {
        value: chunk,
        parent: null,
        detached: true,
      });
    }
  }
}
