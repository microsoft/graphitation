import type { Cache } from "@apollo/client";
import type { OperationDescriptor } from "../descriptor/types";
import type {
  DeferIndex,
  DeferTarget,
  ResponsePath,
} from "../forest/deferIndex";
import type { IndexedTree } from "../forest/types";
import type { GraphChunk, ObjectChunk, SourceObject } from "../values/types";
import type { CacheEnv, Store, Transaction, WriteResult } from "./types";
import type { DataForest, OptimisticLayer } from "./types";
import { takeDeferTarget } from "../forest/deferIndex";
import { isCompositeListValue, isObjectValue, isSourceObject } from "../values";
import {
  getFragmentDescriptor,
  resolveOperationDescriptor,
  resolveResultDescriptor,
} from "./descriptor";
import { getActiveForest } from "./store";
import { writeOperation } from "./write";

/**
 * The same symbol as `handleIncrementalSymbol` of `@apollo/client` 4.
 */
export const handleIncrementalSymbol = Symbol.for(
  "apollo.cache.handleIncremental",
);

/**
 * Mirrors `DiffIncrementalInfo` of `@apollo/client` 4 (`streamInfo` is not supported).
 *
 * The client creates a separate `isDeferPending` function for every request, so ForestRun
 * also uses it to tell incremental executions apart.
 */
export interface DiffIncrementalInfo {
  isDeferPending?: (path: ResponsePath, label: string | undefined) => boolean;
}

export interface IncrementalPatch {
  // Full response path of the deferred fragment (e.g. `pending.path` + `subPath` for the latest format)
  path: ResponsePath;
  label?: string;
  data?: Record<string, unknown> | null;
}

/**
 * ForestRun extension of `DiffIncrementalInfo` for subsequent payloads.
 *
 * Apollo 4 writes subsequent payloads as full results (after merging them by response path into
 * the latest cache data). Instead, ForestRun applies patches to their original cache objects.
 */
export interface WriteIncrementalInfo extends DiffIncrementalInfo {
  // Deferred fragments of a subsequent payload (in payload order)
  incremental?: ReadonlyArray<IncrementalPatch>;
  hasNext?: boolean;
}

export type WriteOptions = Cache.WriteOptions & {
  [handleIncrementalSymbol]?: WriteIncrementalInfo;
};

// Root key of a patch for an embedded object (it never leaves the incoming tree)
const EMBEDDED_TARGET_KEY = "__FOREST_RUN_EMBEDDED_DEFER_TARGET__";

const isObjectLike = (value: unknown): value is object =>
  (typeof value === "object" && value !== null) || typeof value === "function";

/**
 * Writes deferred fragments of an incremental execution to the cache objects they were
 * deferred on in the initial result.
 *
 * Patches are applied in payload order, as fragment writes of deferred selections.
 * Patches of other executions, unknown or already applied fragments are ignored.
 */
export function writeIncremental(
  env: CacheEnv,
  store: Store,
  activeTransaction: Transaction,
  options: WriteOptions,
  { incremental = [], hasNext, isDeferPending }: WriteIncrementalInfo,
): WriteResult[] {
  const forest = getActiveForest(store, activeTransaction);
  const operation = resolveOperationDescriptor(
    env,
    store,
    options.query,
    options.variables,
    options.dataId,
  );
  const resultOperationId = resolveResultDescriptor(env, store, operation).id;
  if (!operation.cache) {
    activeTransaction.nonCacheableOperations?.add(operation);
  }
  const execution = isObjectLike(isDeferPending) ? isDeferPending : undefined;
  const getIndex = () => {
    const index =
      forest.trees.get(resultOperationId)?.deferIndex ??
      (execution && store.deferIndexes.get(execution));
    return index?.execution === isDeferPending ? index : undefined;
  };
  const results: WriteResult[] = [];
  for (const patch of incremental) {
    const index = getIndex();
    if (!index) {
      break;
    }
    const target = takeDeferTarget(index, patch.path, patch.label);
    if (!target || !isSourceObject(patch.data) || Array.isArray(patch.data)) {
      continue;
    }
    const result = writePatch(
      env,
      store,
      activeTransaction,
      forest,
      operation,
      forest.trees.get(resultOperationId),
      index,
      target,
      patch.path,
      patch.data,
      options,
    );
    if (result) {
      results.push(result);
    }
  }
  if (hasNext === false && getIndex()) {
    delete forest.trees.get(resultOperationId)?.deferIndex;
    if (execution) {
      store.deferIndexes.delete(execution);
    }
  }
  return results;
}

function writePatch(
  env: CacheEnv,
  store: Store,
  activeTransaction: Transaction,
  forest: DataForest | OptimisticLayer,
  operation: OperationDescriptor,
  tree: IndexedTree | undefined,
  index: DeferIndex,
  target: DeferTarget,
  path: ResponsePath,
  patchData: SourceObject,
  options: Cache.WriteOptions,
): WriteResult | undefined {
  const fragment = getFragmentDescriptor(
    env,
    operation,
    target.selection,
    target.typeName ?? "",
  );
  const data =
    target.typeName && !patchData.__typename
      ? { __typename: target.typeName, ...patchData }
      : { ...patchData };

  const deferIndexing = {
    index,
    path,
    anchor: { nodeKey: target.nodeKey, path: target.path },
  };
  if (!target.path.length) {
    // Deferred fragments are written to their original entity, even when it is not reachable from the
    // operation anymore. Deleted or evicted entities are not re-created though.
    if (!nodeExists(forest, target.nodeKey)) {
      return;
    }
    return writeOperation(
      env,
      store,
      activeTransaction,
      fragment,
      data,
      { ...options, dataId: undefined, result: data },
      { retain: false, rootNodeKey: target.nodeKey, deferIndexing },
    );
  }
  // Embedded objects are addressed by path from their closest node in the operation result tree
  // (they are not written when the result tree is not stored)
  const chunk = tree && findEmbeddedTarget(tree, target);
  if (!tree || !chunk) {
    return;
  }
  return writeOperation(
    env,
    store,
    activeTransaction,
    fragment,
    data,
    { ...options, dataId: undefined, result: data },
    {
      retain: false,
      rootNodeKey: EMBEDDED_TARGET_KEY,
      deferIndexing,
      embeddedTarget: { tree, chunk },
    },
  );
}

function nodeExists(forest: DataForest | OptimisticLayer, nodeKey: string) {
  if (forest.deletedNodes.has(nodeKey)) {
    return false;
  }
  for (const operationId of forest.operationsByNodes.get(nodeKey) ?? []) {
    if (forest.trees.get(operationId)?.nodes.has(nodeKey)) {
      return true;
    }
  }
  return false;
}

function findEmbeddedTarget(
  tree: IndexedTree,
  { nodeKey, path }: DeferTarget,
): ObjectChunk | undefined {
  for (const nodeChunk of tree.nodes.get(nodeKey) ?? []) {
    let value = nodeChunk as GraphChunk | undefined;
    for (const step of path) {
      if (value === undefined) {
        break;
      }
      if (typeof step === "number") {
        value = isCompositeListValue(value)
          ? value.itemChunks[step]?.value
          : undefined;
      } else {
        value = isObjectValue(value)
          ? value.fieldChunks.get(step)?.value
          : undefined;
      }
    }
    if (value && isObjectValue(value) && value.key === false) {
      return value;
    }
  }
  return undefined;
}
