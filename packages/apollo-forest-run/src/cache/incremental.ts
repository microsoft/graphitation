import type { Cache } from "@apollo/client";
import type { ResponsePath } from "../forest/deferTargets";
import type { DeferIndexing } from "../forest/indexTree";
import type { IndexedTree } from "../forest/types";
import type { GraphChunk, ObjectChunk } from "../values/types";
import type {
  CacheEnv,
  DataForest,
  OptimisticLayer,
  Store,
  Transaction,
  WriteResult,
} from "./types";
import type { NodeKey } from "../descriptor/types";
import { takeDeferTarget } from "../forest/deferTargets";
import {
  isCompositeListValue,
  isObjectValue,
  isParentListRef,
  isRootRef,
  isSourceObject,
} from "../values";
import {
  getFragmentDescriptor,
  resolveOperationDescriptor,
} from "./descriptor";
import { getActiveForest } from "./store";
import { write } from "./write";

type IncrementalWrite = Pick<Cache.WriteOptions, "query" | "variables"> & {
  // Identity of the incremental execution
  token: object;
};

export type InitialWriteOptions = IncrementalWrite & {
  data: Record<string, unknown>;
  // Deferred fragments announced by the initial result (all deferred fragments when omitted)
  pending?: ReadonlyArray<{ path: ResponsePath; label?: string }>;
  overwrite?: boolean;
};

export type IncrementalWriteOptions = IncrementalWrite & {
  patches: ReadonlyArray<{
    path: ResponsePath;
    label?: string;
    data: Record<string, unknown> | null;
  }>;
};

/**
 * Writes the initial result of an incremental execution as a regular result,
 * and remembers where its deferred fragments must be written to.
 */
export function writeInitialData(
  env: CacheEnv,
  store: Store,
  activeTransaction: Transaction,
  { query, variables, data, pending, overwrite, token }: InitialWriteOptions,
): WriteResult {
  const deferIndexing: DeferIndexing = {
    targets: new Map(),
    isPending: pending && createPendingFilter(pending),
    embedded: [],
  };
  const result = write(
    env,
    store,
    activeTransaction,
    { query, variables, result: data, overwrite },
    undefined,
    deferIndexing,
  );
  // Merge policies may move embedded objects (e.g. append a page to existing list items)
  for (const { target, source } of deferIndexing.embedded ?? []) {
    const chunk = result.incoming.dataMap.get(source)?.value;
    const address =
      chunk && isObjectValue(chunk)
        ? resolveAddress(result.incoming, chunk)
        : undefined;
    target.dataId = address?.dataId ?? target.dataId;
    target.subPath = address?.subPath ?? target.subPath;
  }
  store.deferTargets.set(token, deferIndexing.targets);
  return result;
}

/**
 * Writes deferred fragments as fragment writes to the objects they were deferred on
 * in the initial result (even if the operation doesn't reach those objects anymore).
 */
export function writeIncrementalData(
  env: CacheEnv,
  store: Store,
  activeTransaction: Transaction,
  { query, variables, patches, token }: IncrementalWriteOptions,
): WriteResult[] {
  const targets = store.deferTargets.get(token);
  if (!targets) {
    return [];
  }
  const forest = getActiveForest(store, activeTransaction);
  const operation = resolveOperationDescriptor(env, store, query, variables);
  const results: WriteResult[] = [];
  for (const { path, label, data } of patches) {
    const target = takeDeferTarget(targets, path, label);
    if (!target || !isSourceObject(data) || Array.isArray(data)) {
      continue;
    }
    const embedded = target.subPath.length
      ? findEmbeddedObject(forest, target.dataId, target.subPath)
      : undefined;
    if (target.subPath.length && !embedded) {
      continue;
    }
    const result = { ...data };
    if (target.typeName) {
      result.__typename ??= target.typeName;
    }
    results.push(
      write(
        env,
        store,
        activeTransaction,
        { query, variables, result },
        {
          operation: getFragmentDescriptor(
            env,
            operation,
            target.selection,
            target.typeName ?? "",
          ),
          dataId: target.dataId,
          embedded,
        },
        // Nested deferred fragments of this patch
        { targets, path, root: target },
      ),
    );
  }
  return results;
}

function createPendingFilter(
  pending: NonNullable<InitialWriteOptions["pending"]>,
) {
  const keys = new Set<string>();
  for (const { path, label } of pending) {
    keys.add(JSON.stringify([path, label ?? null]));
    keys.add(JSON.stringify([path, null]));
  }
  return (path: ResponsePath, label: string | undefined) =>
    keys.has(JSON.stringify([path, label ?? null])) ||
    keys.has(JSON.stringify([path, null]));
}

function findEmbeddedObject(
  forest: DataForest | OptimisticLayer,
  dataId: NodeKey,
  subPath: ResponsePath,
): { tree: IndexedTree; chunk: ObjectChunk } | undefined {
  for (const operationId of forest.operationsByNodes.get(dataId) ?? []) {
    const tree = forest.trees.get(operationId);
    for (const nodeChunk of tree?.nodes.get(dataId) ?? []) {
      let value = nodeChunk as GraphChunk | undefined;
      for (const step of subPath) {
        if (value !== undefined && typeof step === "number") {
          value = isCompositeListValue(value)
            ? value.itemChunks[step]?.value
            : undefined;
        } else if (value !== undefined) {
          value = isObjectValue(value)
            ? value.fieldChunks.get(step as string)?.value
            : undefined;
        }
      }
      if (tree && value && isObjectValue(value) && value.key === false) {
        return { tree, chunk: value };
      }
    }
  }
  return undefined;
}

function resolveAddress(
  tree: IndexedTree,
  chunk: ObjectChunk,
): { dataId: NodeKey; subPath: ResponsePath } | undefined {
  const subPath: (string | number)[] = [];
  let ref = tree.dataMap.get(chunk.data);
  while (ref && !isRootRef(ref)) {
    subPath.unshift(isParentListRef(ref) ? ref.index : ref.field.dataKey);
    const parent = ref.parent;
    ref = tree.dataMap.get(parent.data);
    if (isObjectValue(parent) && parent.key !== false) {
      return { dataId: parent.key, subPath };
    }
  }
  return ref ? { dataId: tree.rootNodeKey, subPath } : undefined;
}
