import { Cache } from "@apollo/client";
import {
  FieldInfo,
  OperationDescriptor,
  PossibleSelections,
} from "../descriptor/types";
import { accumulate, accumulateMany } from "../jsutils/map";
import { diffObject } from "../diff/diffObject";
import { diffNodes } from "../diff/diffTree";
import * as Difference from "../diff/difference";
import {
  resolveSelection,
  resolveNormalizedField,
} from "../descriptor/resolvedSelection";
import { fieldToStringKey } from "./keys";
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
  SourceValue,
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
    const groups = new Map<string | SourceObject, MatchedPatch[]>();
    for (const { path, label, data } of payload.incremental ?? []) {
      if (!path) continue;
      const site = index.matchPatch(operation, path, label, data);
      if (!site || !isSourceObject(data) || Array.isArray(data)) continue;
      accumulate(groups, site.chunk.key || site.chunk.data, { site, data });
    }
    if (!groups.size) return result;
    const layers = getEffectiveReadLayers(store, forest, false);
    const nodes: NodeMap = new Map();
    const embedded: [Target, ObjectChunk][] = [];
    let incoming: IndexedTree | undefined;
    for (const group of groups.values()) {
      const { site } = group[0];
      const { chunk } = site;
      const target = findTarget(forest, tree, site);
      if (!target) continue;
      const { data, selection } = prepareFragment(env, operation, group);
      const model = indexTree(
        env,
        {
          ...operation,
          selections:
            selection === site.selection
              ? operation.selections
              : new Map(operation.selections),
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
        layers,
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
    if (!incoming) return result;
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
  } finally {
    if (payload.hasNext === false || !index.hasPending) dispose();
  }
  return result;
}

type Target = { tree: IndexedTree; chunk: ObjectChunk };

// Only combine fields within the same logical object. In particular a list
// position is not an identity, and a shorter incoming list replaces its tail.
function stageComposite(
  env: CacheEnv,
  operation: OperationDescriptor,
  selection: PossibleSelections,
  previous: SourceValue | undefined,
  incoming: SourceValue | undefined,
): SourceValue | undefined {
  if (!isSourceObject(incoming)) return incoming;
  if (Array.isArray(incoming)) {
    const prior = Array.isArray(previous) ? previous : [];
    const keyOf = (item: SourceValue) =>
      isSourceObject(item) &&
      !Array.isArray(item) &&
      env.objectKey(
        item,
        resolveSelection(operation, selection, item.__typename ?? null),
        operation,
      );
    const keyed = new Map(prior.map((item) => [keyOf(item), item]));
    return incoming.map((item, i) => {
      const key = keyOf(item);
      return stageComposite(
        env,
        operation,
        selection,
        key ? keyed.get(key) : prior[i],
        item,
      );
    }) as typeof incoming;
  }
  const resolved = resolveSelection(
    operation,
    selection,
    incoming.__typename ?? null,
  );
  const prior =
    isSourceObject(previous) && !Array.isArray(previous) ? previous : undefined;
  const same =
    prior &&
    prior.__typename === incoming.__typename &&
    env.objectKey(prior, resolved, operation) ===
      env.objectKey(incoming, resolved, operation);
  const out: SourceObject = same ? prior : Object.create(null);
  // Preserve even unselected key fields for cache implementations with custom IDs.
  for (const key of Object.keys(incoming)) {
    const child = resolved.fieldQueue.find((f) => f.dataKey === key)?.selection;
    out[key] = child
      ? stageComposite(env, operation, child, out[key], incoming[key])
      : incoming[key];
  }
  return out;
}
type MatchedPatch = { site: DeferredPlaceholder; data: SourceObject };

function prepareFragment(
  env: CacheEnv,
  operation: OperationDescriptor,
  patches: MatchedPatch[],
) {
  const data: SourceObject = Object.create(null);
  const { chunk, selection } = patches[0].site;
  if (chunk.type) data.__typename = chunk.type;
  if (patches.length === 1) {
    const source = patches[0].data;
    for (const { dataKey } of resolveSelection(
      operation,
      selection,
      chunk.type || null,
    ).fieldQueue)
      if (Object.prototype.hasOwnProperty.call(source, dataKey))
        data[dataKey] = source[dataKey];
    return { data, selection };
  }

  const aliases = new Map<string, string>();
  const byKey = new Map<string, FieldInfo>();
  for (const { site, data: source } of patches) {
    const resolved = resolveSelection(
      operation,
      site.selection,
      site.chunk.type || null,
    );
    for (const field of resolved.fieldQueue) {
      if (!Object.prototype.hasOwnProperty.call(source, field.dataKey))
        continue;
      const name = fieldToStringKey(resolveNormalizedField(resolved, field));
      const dataKey =
        aliases.get(name) ??
        (byKey.has(field.dataKey) ? `$${byKey.size}` : field.dataKey);
      aliases.set(name, dataKey);
      const value = source[field.dataKey];
      data[dataKey] = field.selection
        ? stageComposite(env, operation, field.selection, data[dataKey], value)
        : value;
      const previous = byKey.get(dataKey);
      const info =
        previous?.selection && previous !== field
          ? site.chunk.selection.fields
              .get(field.name)
              ?.find((f) => f.dataKey === field.dataKey) ?? field
          : field;
      byKey.set(
        dataKey,
        dataKey === info.dataKey ? info : { ...info, dataKey },
      );
    }
  }
  if (patches.every((p) => p.site.selection === selection))
    return { data, selection };
  const fields = new Map<string, FieldInfo[]>();
  const fieldQueue = [...byKey.values()];
  for (const field of fieldQueue) accumulate(fields, field.name, field);
  return {
    data,
    selection: new Map([
      [
        null,
        {
          depth: 0,
          fields,
          fieldQueue,
          fieldsToNormalize: fieldQueue,
          fieldsWithSelections: fieldQueue
            .filter((f) => f.selection)
            .map((f) => f.name),
          structuralHash: 0,
        },
      ],
    ]) as PossibleSelections,
  };
}

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
