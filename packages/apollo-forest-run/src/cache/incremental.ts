import { Cache } from "@apollo/client";
import { diffObject } from "../diff/diffObject";
import { diffNodes } from "../diff/diffTree";
import * as Difference from "../diff/difference";
import { resolveSelection } from "../descriptor/resolvedSelection";
import { addDirtyChunkDifference } from "../forest/transformTree";
import { indexTree } from "../forest/indexTree";
import { DeferredIndex, DeferredPlaceholder } from "../forest/deferred";
import { IndexedForest, IndexedTree } from "../forest/types";
import { assert } from "../jsutils/assert";
import {
  createParentLocator,
  isObjectValue,
  isParentListRef,
  isRootRef,
  isSourceObject,
} from "../values";
import { CompositeListChunk, ObjectChunk, SourceObject } from "../values/types";
import {
  resolveOperationDescriptor,
  resolveResultDescriptor,
} from "./descriptor";
import { getActiveForest } from "./store";
import { CacheEnv, Store, Transaction, WriteResult } from "./types";
import { write, writeIndexedTree } from "./write";

// Shared with Apollo without requiring either package to import the other.
export const incrementalDelivery = Symbol.for(
  "apollo.cache.incrementalDelivery.v1",
);
type Path = readonly (string | number)[];
type Patch = { path?: Path; label?: string; data?: unknown };
type Delivery = {
  request: AbortSignal;
  payload: {
    data?: unknown;
    incremental?: readonly Patch[];
    hasNext?: boolean;
  };
};
export type WriteOptions = Cache.WriteOptions & {
  [incrementalDelivery]?: Delivery;
};

export function writeIncremental(
  env: CacheEnv,
  store: Store,
  transaction: Transaction,
  options: WriteOptions,
  { request, payload }: Delivery,
): WriteResult | undefined {
  if (request.aborted) return;
  const forest = getActiveForest(store, transaction);
  const operation = resolveOperationDescriptor(
    env,
    store,
    options.query,
    options.variables,
    options.dataId,
  );
  const owner = resolveResultDescriptor(env, store, operation);
  let result: WriteResult | undefined;
  let execution = forest.trees.get(owner.id)?.pendingDeferred?.get(request);

  if (isSourceObject(payload.data) && !execution) {
    const index = new DeferredIndex();
    result = write(env, store, transaction, options, {
      index,
      owner: owner.id,
    });
    transaction.changelog.push(result);
    const tree = forest.trees.get(owner.id);
    if (tree && index.hasPending) {
      const pending = (tree.pendingDeferred ??= new Map());
      const dispose = () => {
        request.removeEventListener("abort", dispose);
        index.clear();
        pending.delete(request);
      };
      execution = { index, dispose };
      pending.set(request, execution);
      request.addEventListener("abort", dispose, { once: true });
    }
  }
  if (!execution) return result;
  const { index, dispose } = execution;
  try {
    for (const { path, label, data } of payload.incremental ?? []) {
      if (!path) continue;
      const site = index.matchPatch(operation, path, label, data);
      if (!site || !isSourceObject(data) || Array.isArray(data)) continue;
      const { chunk, selection } = site;
      const fields = resolveSelection(
        operation,
        selection,
        chunk.type || null,
      ).fieldQueue;
      const tree = forest.trees.get(owner.id);
      if (!tree) continue;
      const target = findTarget(forest, tree, site);
      if (!target) continue;

      // Normalize just the delivered fragment. In particular, don't run a
      // parent relationship or list's merge policy on a later patch.
      const rootData = Object.create(null) as SourceObject;
      for (const { dataKey } of fields) {
        if (Object.prototype.hasOwnProperty.call(data, dataKey))
          rootData[dataKey] = data[dataKey];
      }
      if (chunk.type) rootData.__typename = chunk.type;
      const rootNodeKey = chunk.key || operation.rootNodeKey;
      const incoming = indexTree(
        env,
        {
          ...operation,
          possibleSelections: selection,
          rootNodeKey,
          rootType: chunk.type || "",
        },
        { data: rootData },
        undefined,
        null,
        { index, path, rootOwner: chunk },
      );
      result = writeIndexedTree(env, store, forest, options, incoming, {
        kind: "patch",
        diff: (layer, model) => diffFragment(env, layer, target, model),
        delivery: { index, owner: owner.id, target: target.chunk },
      });
      transaction.changelog.push(result);
    }
  } finally {
    if (payload.hasNext === false || !index.hasPending) dispose();
  }
  return result;
}

type Target = { tree: IndexedTree; chunk: ObjectChunk };

function findTarget(
  forest: IndexedForest,
  owner: IndexedTree,
  { chunk }: DeferredPlaceholder,
): Target | undefined {
  if (chunk.key === false) {
    // There is no normalized identity for an embedded object. A recycled
    // source is safe (even after a list move); never guess by current index.
    const ref = owner.dataMap.get(chunk.data);
    return ref && isObjectValue(ref.value) && isReachable(owner, ref.value)
      ? { tree: owner, chunk: ref.value }
      : undefined;
  }
  if (forest.deletedNodes.has(chunk.key)) return;
  for (const id of forest.operationsByNodes.get(chunk.key) ?? []) {
    const tree = forest.trees.get(id);
    const live = tree?.nodes.get(chunk.key)?.find((c) => isReachable(tree, c));
    if (live && tree) return { tree, chunk: live };
  }
  return;
}

function isReachable(
  tree: IndexedTree,
  chunk: ObjectChunk | CompositeListChunk,
): boolean {
  const ref = tree.dataMap.get(chunk.data);
  if (!ref || ref.value !== chunk) return false;
  if (isRootRef(ref)) return !ref.detached;
  const current = isParentListRef(ref)
    ? ref.parent.itemChunks[ref.index]
    : ref.parent.fieldChunks.get(ref.field.dataKey);
  return current?.value === chunk && isReachable(tree, ref.parent);
}

function diffFragment(
  env: CacheEnv,
  forest: IndexedForest,
  target: Target,
  model: IndexedTree,
) {
  if (target.chunk.key !== false) return diffNodes(forest, model.nodes, env);
  // For an embedded target lift only its field difference to the nearest
  // normalized owner, using the *current* verified chain, never the wire path.
  const children = new Map(model.nodes);
  children.delete(model.rootNodeKey);
  const graph = diffNodes(forest, children, env);
  const root = model.nodes.get(model.rootNodeKey)?.[0];
  assert(root);
  const diff = diffObject(target.chunk, root, env).difference;
  if (diff && Difference.isDirty(diff)) {
    const findParent = createParentLocator(target.tree.dataMap);
    addDirtyChunkDifference(
      { findParent, nodeDifference: graph.nodeDifference },
      target.chunk,
      diff,
    );
  }
  return graph;
}
