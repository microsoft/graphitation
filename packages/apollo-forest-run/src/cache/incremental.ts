import { Cache } from "@apollo/client";
import { accumulateMany } from "../jsutils/map";
import { diffObject } from "../diff/diffObject";
import { diffNodes } from "../diff/diffTree";
import * as Difference from "../diff/difference";
import { resolveSelection } from "../descriptor/resolvedSelection";
import { addDirtyChunkDifference } from "../forest/transformTree";
import { indexTree } from "../forest/indexTree";
import { DeferredIndex, DeferredPlaceholder } from "../forest/deferred";
import { IndexedForest, IndexedTree } from "../forest/types";
import {
  createParentLocator,
  isObjectValue,
  isParentListRef,
  isRootRef,
  isSourceObject,
} from "../values";
import {
  CompositeListChunk,
  NodeMap,
  ObjectChunk,
  SourceObject,
} from "../values/types";
import {
  resolveOperationDescriptor,
  resolveResultDescriptor,
} from "./descriptor";
import { getActiveForest, getEffectiveReadLayers } from "./store";
import { applyMergePolicies } from "./policies";
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
  let tree = forest.trees.get(owner.id);
  let execution = tree?.pendingDeferred?.get(request);

  if (isSourceObject(payload.data) && !execution) {
    const index = new DeferredIndex();
    result = write(env, store, transaction, options, {
      index,
      owner: owner.id,
    });
    transaction.changelog.push(result);
    if (request.aborted) return result;
    tree = forest.trees.get(owner.id);
    if (tree && index.hasPending) {
      const pending = (tree.pendingDeferred ??= new Map());
      const dispose = () => {
        store.activeDeliveries.delete(dispose);
        request.removeEventListener("abort", dispose);
        index.clear();
        pending.delete(request);
      };
      execution = { index, dispose };
      pending.set(request, execution);
      store.activeDeliveries.add(dispose);
      request.addEventListener("abort", dispose, { once: true });
    }
  }
  if (!tree || !execution) return result;
  const { index, dispose } = execution;
  try {
    const parts = payload.incremental;
    if (!parts?.length) return result;
    const seen = new Set<string>();
    const independent =
      parts.length > 1 &&
      parts.every(({ path, label, data }) => {
        const site = path && index.peekUnique(path, label);
        if (
          !site ||
          !site.chunk.key ||
          seen.has(site.chunk.key) ||
          !isSourceObject(data) ||
          Array.isArray(data)
        )
          return false;
        seen.add(site.chunk.key);
        const policies =
          site.chunk.type && env.mergePolicies.get(site.chunk.type);
        return (
          resolveSelection(
            operation,
            site.selection,
            site.chunk.type || null,
          ).fieldQueue.every(
            (field) =>
              !Object.prototype.hasOwnProperty.call(data, field.dataKey) ||
              (!field.selection &&
                !isSourceObject(data[field.dataKey]) &&
                !(policies && policies.has(field.name))),
          ) && !!findTarget(forest, tree, site)
        );
      });
    if (independent) writeParts(parts);
    else
      for (const part of parts) {
        if (request.aborted) break;
        writeParts([part]);
      }
  } finally {
    if (payload.hasNext === false || !index.hasPending) dispose();
  }
  return result;

  function writeParts(parts: readonly Patch[]) {
    const ownerTree = forest.trees.get(owner.id);
    if (!ownerTree) return;
    const nodes: NodeMap = new Map();
    const embedded: [Target, ObjectChunk][] = [];
    let incoming: IndexedTree | undefined;
    for (const { path, label, data: source } of parts) {
      if (!path) continue;
      const site = index.matchPatch(operation, path, label, source);
      if (!site || !isSourceObject(source) || Array.isArray(source)) continue;
      const { chunk } = site;
      const target = findTarget(forest, ownerTree, site);
      if (!target) continue;
      const selection = site.selection;
      const data: SourceObject = Object.create(null);
      if (chunk.type) data.__typename = chunk.type;
      for (const { dataKey } of resolveSelection(
        operation,
        selection,
        chunk.type || null,
      ).fieldQueue)
        if (Object.prototype.hasOwnProperty.call(source, dataKey))
          data[dataKey] = source[dataKey];
      const model = indexTree(
        env,
        {
          ...operation,
          possibleSelections: selection,
          rootNodeKey: chunk.key || operation.rootNodeKey,
          rootType: chunk.type || "",
        },
        { data },
        undefined,
        null,
        { rootNodeKey: chunk.key || operation.rootNodeKey },
      );
      const merged = applyMergePolicies(
        env,
        getEffectiveReadLayers(store, forest, false),
        env.mergePolicies,
        model,
        options.overwrite ?? false,
        target.chunk,
      );
      for (const [id, chunks] of merged.nodes) {
        if (!chunk.key && id === merged.rootNodeKey) {
          embedded.push([target, chunks[0]]);
        } else accumulateMany(nodes, id, chunks);
      }
      if (!incoming)
        incoming = { ...merged, nodes, dataMap: new Map(merged.dataMap) };
      else
        for (const [source, ref] of merged.dataMap)
          incoming.dataMap.set(source, ref);
    }
    if (!incoming) return;
    result = writeIndexedTree(env, store, forest, options, incoming, {
      kind: "patch",
      delivery: {
        index,
        owner: owner.id,
      },
      diff: (layer) => {
        const graph = diffNodes(layer, nodes, env);
        for (const [target, root] of embedded) {
          const diff = diffObject(target.chunk, root, env).difference;
          if (diff && Difference.isDirty(diff))
            addDirtyChunkDifference(
              {
                findParent: createParentLocator(target.tree.dataMap),
                nodeDifference: graph.nodeDifference,
              },
              target.chunk,
              diff,
            );
        }
        return graph;
      },
    });
    transaction.changelog.push(result);
  }
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
