import type {
  CacheEnv,
  ExecutionWriteOptions,
  Store,
  Transaction,
} from "../cache/types";
import { resolveOperationDescriptor, ROOT_NODES } from "../cache/descriptor";
import { applyMergePolicies } from "../cache/policies";
import { createDataForest } from "../cache/store";
import {
  getExistingResult,
  resolveExtraRootNodeType,
  setExplicitRootId,
  write,
} from "../cache/write";
import type { IndexedTree } from "../forest/types";
import { trackTreeNodes } from "../forest/addTree";
import { indexTree } from "../forest/indexTree";
import { assert } from "../jsutils/assert";
import { isObjectValue } from "../values";
import type { SourceObject } from "../values/types";
import { assemble, isDeferTarget } from "./data";

export function writeExecution(
  env: CacheEnv,
  store: Store,
  transaction: Transaction,
  { execution, ...options }: ExecutionWriteOptions,
): string | undefined {
  assert(!transaction.optimisticLayer && !transaction.forceOptimistic);
  const initial = "data" in execution;
  const rootKey =
    options.dataId ?? (initial ? env.objectKey(execution.data) : undefined);
  assert(rootKey !== false);
  const operation = resolveOperationDescriptor(
    env,
    store,
    options.query,
    options.variables,
    rootKey,
  );
  const executions = store.incrementalExecutions;
  const pending = executions.get(operation);
  let data: SourceObject;
  if (initial) {
    data = execution.data as SourceObject;
  } else {
    assert(typeof execution.hasNext === "boolean");
    if (!pending || execution.key !== pending.key) {
      if (!operation.cache) transaction.nonCacheableOperations?.add(operation);
      return;
    }
    data = assemble(operation, pending.serverData, execution);
    if (execution.hasNext && data === pending.serverData) return;
  }

  const overwrite =
    options.overwrite ?? (!initial ? pending?.overwrite : undefined);
  if ("hasNext" in execution && execution.hasNext && operation.hasDeferSites) {
    // Preview transforms (e.g. root typename normalization) must never change serverData.
    const previewData = { ...data };
    if (!ROOT_NODES.includes(operation.rootNodeKey) && env.addTypename) {
      previewData.__typename ??= resolveExtraRootNodeType(
        env,
        store,
        operation,
        data,
      );
    }
    if (options.dataId) env.keyMap?.set(previewData, options.dataId);
    const tree = indexTree(
      env,
      operation,
      { data: previewData },
      undefined,
      null,
      true,
    );
    // With no enabled defer site in the initial data (e.g. @defer(if: false)), write normally.
    if (!initial || hasDeferredFragment(tree)) {
      setExplicitRootId(tree, options.dataId);
      tree.prev =
        getExistingResult(env, store, store.dataForest, operation) ?? null;
      const merged = applyMergePolicies(
        env,
        [store.dataForest],
        env.mergePolicies,
        tree,
        overwrite ?? false,
      );
      merged.prev = tree.prev = null;
      const forest = createDataForest();
      forest.trees.set(operation.id, merged);
      trackTreeNodes(forest, merged);
      if (initial) executions.delete(operation); // Most recently started execution takes precedence.
      executions.set(operation, {
        key: execution.key,
        serverData: data,
        overwrite,
        forest,
      });
      if (options.broadcast !== false) {
        (transaction.previewOperations ??= new Set()).add(operation);
      }
      return initial ? tree.rootNodeKey : undefined;
    }
  }

  // A complete result supersedes the preview. Commit raw server data, never policy output.
  executions.delete(operation);
  const result = write(
    env,
    store,
    transaction,
    { ...options, overwrite, result: data },
    !initial,
  );
  transaction.changelog.push(result);
  // A shared keyVars tree may not change at all, but its exact watch must leave preview mode.
  if (pending && options.broadcast !== false) {
    (transaction.previewOperations ??= new Set()).add(operation);
  }
  return initial && result.incoming.nodes.size
    ? result.incoming.rootNodeKey
    : undefined;
}

function hasDeferredFragment(tree: IndexedTree): boolean {
  for (const { value } of tree.dataMap.values()) {
    if (isObjectValue(value) && isDeferTarget(tree.operation, value.selection))
      return true;
  }
  return false;
}
