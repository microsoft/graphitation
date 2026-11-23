import { Cache } from "@apollo/client";
import { cloneDeep, merge } from "lodash";
import { FieldInfo, PossibleSelections } from "../descriptor/types";
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
import {
  DeferredIndex,
  DeferredPlaceholder,
  deferredPathKey,
} from "../forest/deferred";
import { IndexedForest, IndexedTree } from "../forest/types";
import { assert } from "../jsutils/assert";
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
    const tree = forest.trees.get(owner.id);
    if (!tree) return result;
    const groups = new Map<string | SourceObject, PatchGroup>();
    const introduced = new Map<SourceObject, PatchGroup>();
    const delivered = new Map<string, DeferredPlaceholder>();
    for (const { path, label, data } of payload.incremental ?? []) {
      if (!path) continue;
      const coordinate = deferredPathKey(path, label);
      const site =
        index.matchPatch(operation, path, label, data) ??
        delivered.get(coordinate);
      if (!site || !isSourceObject(data) || Array.isArray(data)) continue;
      delivered.set(coordinate, site);
      const { chunk, selection } = site;
      const resolved = resolveSelection(
        operation,
        selection,
        chunk.type || null,
      );
      const parent = introduced.get(chunk.data);
      const key = chunk.key || chunk.data;
      let group = parent ?? groups.get(key);
      if (!group) {
        const target = findTarget(forest, tree, site);
        if (!target) continue;
        group = {
          target,
          site,
          data: Object.create(null),
          fields: new Map(),
          aliases: new Map(),
          selection,
        };
        groups.set(key, group);
      }
      // Only batch-owned objects are mutated. Matching a site introduced
      // earlier in the payload extends its parent's incoming data in place.
      const dest = parent ? chunk.data : group.data;
      const partData: SourceObject = Object.create(null);
      if (chunk.type) dest.__typename = chunk.type;
      if (chunk.type) partData.__typename = chunk.type;
      for (const field of resolved.fieldQueue) {
        if (!Object.prototype.hasOwnProperty.call(data, field.dataKey))
          continue;
        const value = data[field.dataKey];
        let dataKey = field.dataKey;
        if (!parent) {
          const name = fieldToStringKey(
            resolveNormalizedField(resolved, field),
          );
          const alias = group.aliases.get(name);
          if (alias !== undefined) dataKey = alias;
          else {
            // Two locations for one entity can use the same alias for
            // different arguments. Keep both in the combined fragment.
            if (group.fields.has(dataKey)) dataKey = `$${group.fields.size}`;
            group.aliases.set(name, dataKey);
          }
        }
        const existing = dest[dataKey];
        partData[field.dataKey] = dest[dataKey] =
          field.selection && isSourceObject(value)
            ? isSourceObject(existing) &&
              Array.isArray(existing) === Array.isArray(value)
              ? merge(existing, value)
              : cloneDeep(value)
            : value;
        if (!parent) {
          const previous = group.fields.get(dataKey);
          const combined =
            previous?.selection && previous !== field
              ? chunk.selection.fields
                  .get(field.name)
                  ?.find((f) => f.dataKey === field.dataKey)
              : undefined;
          const info = combined ?? field;
          group.fields.set(
            dataKey,
            dataKey === info.dataKey ? info : { ...info, dataKey },
          );
        }
      }
      if (!parent && selection !== group.selection) group.selection = undefined;
      const descriptor = {
        ...operation,
        possibleSelections: selection,
        rootNodeKey: chunk.key || operation.rootNodeKey,
        rootType: chunk.type || "",
      };
      const part = indexTree(
        env,
        descriptor,
        { data: partData },
        undefined,
        null,
        {
          index,
          path,
          rootOwner: chunk,
        },
      );
      if (!parent && !group.model && group.selection) group.model = part;
      else group.reindex = true;
      for (const [source, ref] of part.dataMap) {
        if (source !== partData && isObjectValue(ref.value))
          introduced.set(ref.value.data, group);
      }
    }
    if (!groups.size) return result;
    const layers = getEffectiveReadLayers(store, forest, false);
    const nodes: NodeMap = new Map();
    const embedded: [Target, ObjectChunk][] = [];
    const targets: ObjectChunk[] = [];
    let incoming: IndexedTree | undefined;
    for (const group of groups.values()) {
      const { chunk } = group.site;
      const model =
        group.model && !group.reindex
          ? group.model
          : indexTree(
              env,
              {
                ...operation,
                selections: new Map(operation.selections),
                possibleSelections:
                  group.selection ?? deliveredSelection(group),
                rootNodeKey: chunk.key || operation.rootNodeKey,
                rootType: chunk.type || "",
              },
              { data: group.data },
              undefined,
              null,
              { index: new DeferredIndex(), path: [], rootOwner: chunk },
            );
      const merged = applyMergePolicies(
        env,
        layers,
        env.mergePolicies,
        model,
        options.overwrite ?? false,
        group.target.chunk,
      );
      for (const [id, chunks] of merged.nodes) {
        if (!chunk.key && id === merged.rootNodeKey) {
          embedded.push([group.target, chunks[0]]);
          targets.push(group.target.chunk);
        } else accumulateMany(nodes, id, chunks);
      }
      if (!incoming)
        incoming = { ...merged, nodes, dataMap: new Map(merged.dataMap) };
      else
        for (const [source, ref] of merged.dataMap)
          incoming.dataMap.set(source, ref);
    }
    assert(incoming);
    result = writeIndexedTree(env, store, forest, options, incoming, {
      kind: "patch",
      delivery: { index, owner: owner.id, targets },
      diff: (layer, model) => {
        const graph = diffNodes(layer, model.nodes, env);
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
type PatchGroup = {
  target: Target;
  site: DeferredPlaceholder;
  data: SourceObject;
  fields: Map<string, FieldInfo>;
  aliases: Map<string, string>;
  selection?: PossibleSelections;
  model?: IndexedTree;
  reindex?: boolean;
};

function deliveredSelection(group: PatchGroup): PossibleSelections {
  const fields = new Map<string, FieldInfo[]>();
  const fieldQueue = [...group.fields.values()];
  for (const field of fieldQueue) accumulate(fields, field.name, field);
  return new Map([
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
  ]);
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
