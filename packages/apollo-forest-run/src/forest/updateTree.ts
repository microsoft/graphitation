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
import type { NodeDifferenceMap } from "../diff/types";
import type {
  Draft,
  ForestEnv,
  IndexedTree,
  UpdateTreeContext,
  UpdateTreeResult,
} from "./types";
import { assert } from "../jsutils/assert";
import { indexTree } from "./indexTree";
import { isDirty } from "../diff/difference";
import {
  createDraft,
  createParentLocator,
  hydrateDraft,
  isNodeValue,
  isObjectValue,
  isParentObjectRef,
  isRootRef,
  isSourceObject,
  resolveObjectKey,
} from "../values";
import { updateObject } from "./updateObject";
import { createUpdateLogger } from "../telemetry/updateStats/updateLogger";

type ComplexValue = SourceObject | NestedList<SourceObject>;

export { NodeDifferenceMap }; // FIXME

export function updateTree(
  env: ForestEnv,
  base: IndexedTree,
  differenceMap: NodeDifferenceMap,
  getNodeChunks?: (key: NodeKey) => Iterable<NodeChunk>,
): UpdateTreeResult {
  const rootChunks = base.nodes.get(base.rootNodeKey);
  assert(rootChunks?.length === 1);
  const rootChunk = rootChunks[0];
  const context: UpdateTreeContext = {
    operation: base.operation,
    drafts: new Map(),
    changes: new Map(),
    changedNodes: new Set(),
    affectedNodes: new Set(),
    missingFields: new Map(),
    completeObject: completeObject.bind(null, env, base, getNodeChunks),
    findParent: createParentLocator(base.dataMap),
    statsLogger: createUpdateLogger(env.logUpdateStats),
    childChanges: [],
    env,
  };
  const {
    operation,
    missingFields,
    drafts,
    changes,
    changedNodes,
    affectedNodes,
    statsLogger,
  } = context;

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

  for (const chunk of chunkQueue) {
    const difference = differenceMap.get(chunk.key as string);
    assert(difference);

    statsLogger?.startChunkUpdate(chunk);
    const result = updateObject(context, chunk, difference);
    if (!result) {
      continue;
    }
    assert(result.draft === drafts.get(chunk.data));
    changedNodes.add(chunk.key as string);

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
    createSourceCopiesUpToRoot(context, base, chunk);
    statsLogger?.finishChunkUpdate();
  }
  if (!changedNodes.size) {
    return {
      updatedTree: base,
      changes,
      changedNodes,
      affectedNodes,
      missingFields,
      stats: statsLogger?.getStats(operation.debugName),
    };
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
  const updatedTree = indexTree(
    env,
    base.operation,
    { data: rootDraft },
    missingFields,
    base,
  );
  if (env.apolloCompat_keepOrphanNodes) {
    apolloBackwardsCompatibility_saveOrphanNodes(base, updatedTree);
  }
  return {
    updatedTree,
    changes,
    changedNodes,
    affectedNodes,
    missingFields,
    stats: statsLogger?.getStats(operation.debugName),
  };
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
  context: UpdateTreeContext,
  tree: IndexedTree,
  from: CompositeValueChunk,
  isRootCall = true,
  isIndirectlyAffected = false,
): ComplexValue {
  const { drafts, affectedNodes, statsLogger } = context;
  const parent = from.data ? tree.dataMap.get(from.data) : null;

  if (isIndirectlyAffected && isNodeValue(from)) {
    // Affected nodes include:
    // 1. Nodes with difference that were modified (some nodes with normalized difference won't be actually affected by the update due to not having)
    // 2. Parent nodes affected by the change in nested nodes
    affectedNodes.add(from.key);
  }

  if (!parent || isRootRef(parent)) {
    assert(isObjectValue(from));
    const data = from.data;
    let draft = drafts.get(data);
    statsLogger?.copyParentChunkStats(from, draft);
    if (!draft) {
      draft = { ...data };
      drafts.set(data, draft);
    }
    return data;
  }
  const parentSource = createSourceCopiesUpToRoot(
    context,
    tree,
    parent.parent,
    false,
    true,
  );
  const parentDraft = drafts.get(parentSource);
  assert(parentDraft);

  const dataKey = isParentObjectRef(parent)
    ? parent.field.dataKey
    : parent.index;
  const value = (parentSource as any)[dataKey];

  let draft = drafts.get(value);

  // Only report copies made while traversing up the tree.
  // The initial (root) call includes fields copied by updateValue,
  // which are unrelated to the upward copy process.
  if (!isRootCall) {
    statsLogger?.copyParentChunkStats(from, draft);
  }
  if (!draft) {
    draft = (Array.isArray(value) ? [...value] : { ...value }) as Draft;
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
