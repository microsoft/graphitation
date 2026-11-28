import type { IndexedTree } from "../forest/types";
import type { ObjectChunk } from "../values/types";
import type {
  CacheEnv,
  DataForest,
  OptimisticLayer,
  Store,
  Transaction,
  ExecutionWriteOptions,
} from "../cache/types";
import type {
  ExecutionResult,
  InitialExecutionResult,
  IncrementalExecution,
  SplicedIncrementalResult,
  SubsequentExecutionResult,
} from "./types";
import type { FieldInfo, OperationDescriptor } from "../descriptor/types";
import { assert } from "../jsutils/assert";
import { resolveOperationDescriptor } from "../cache/descriptor";
import { getExistingResult, shouldCache } from "../cache/store";
import { createObjectKey, capturePlaceholders } from "./placeholders";
import { spliceIncrementalResults } from "./splice";

export { addMissingBaseFields } from "./missingFields";

// TODO: support the incremental delivery format (graphql-js 17: pending/id/subPath/completed);
//   a converter to the 2022 format existed in db17a309 (incremental/format.ts)

/**
 * Subsequent results of incremental delivery (`@defer`, the 2022 draft format) are written as a regular result
 * of the operation: data of all results of the payload is spliced into a copy of the stored result of the operation
 * (only objects on the path to delivered objects are copied), and the copy is written as a whole (see `write`).
 *
 * Objects data is delivered to are located by placeholders (addresses, see `ObjectAddress`), keyed by response paths
 * of incremental results. Placeholders are captured in data received from the server (the initial result
 * and delivered data, see capturePlaceholders).
 * Merge policies only run for delivered fields (see `DeliveredFields`), transient trees are diffed against their previous state.
 *
 * Returns undefined when there is nothing to write.
 */
export function spliceSubsequentResult(
  env: CacheEnv,
  store: Store,
  activeTransaction: Transaction,
  options: ExecutionWriteOptions,
  execution: SubsequentExecutionResult,
): SplicedIncrementalResult | undefined {
  assert(typeof execution.hasNext === "boolean");
  const operation = resolveOperationDescriptor(
    env,
    store,
    options.query,
    options.variables,
    options.dataId,
  );
  const incremental = store.incrementalExecutions.get(operation);
  if (!incremental || incremental.key !== execution.key) {
    // Results of an unknown or a superseded execution
    return undefined;
  }
  // Execution results are written to the base forest only
  const tree =
    getExistingResult(env, store, store.dataForest, operation) ??
    incremental.transientTree;
  const { mergePolicies } = env;
  const spliced = tree
    ? spliceIncrementalResults(
        tree,
        incremental,
        execution,
        (type, field) => Boolean(mergePolicies.get(type)?.has(field)),
        createObjectKey(env, tree.operation),
      )
    : undefined;
  if (execution.hasNext === false) {
    store.incrementalExecutions.delete(operation);
    if (!operation.cache) {
      // The descriptor was retained while the execution was pending (see canReleaseOperationDescriptor)
      activeTransaction.nonCacheableOperations?.add(operation);
    }
  }
  return spliced;
}

/**
 * Starts tracking an incremental execution with its initial result (after indexing it and applying merge policies),
 * or keeps the transient tree of a spliced result current.
 */
export function captureIncrementalExecution(
  env: CacheEnv,
  store: Store,
  targetForest: DataForest | OptimisticLayer,
  operation: OperationDescriptor,
  execution: InitialExecutionResult | SplicedIncrementalResult | undefined,
  indexed: IndexedTree,
  merged: IndexedTree,
) {
  if (!execution) {
    return;
  }
  if (isSplicedIncrementalResult(execution)) {
    if (execution.incremental.transientTree) {
      execution.incremental.transientTree = merged;
    }
  } else {
    updateIncrementalExecution(
      env,
      store,
      targetForest,
      operation,
      execution,
      indexed,
      merged,
    );
  }
}

/**
 * Merge policies of a spliced result only run for delivered fields (other fields already went through them):
 * listed fields of copies of stored objects and all fields of delivered objects (not objects of the stored result).
 */
export function createDeliveredFieldFilter({
  deliveredFields,
  tree,
}: SplicedIncrementalResult): (
  parent: ObjectChunk,
  field: FieldInfo,
) => boolean {
  return (parent, field) =>
    deliveredFields.get(parent.data)?.has(field.dataKey) ??
    !tree.dataMap.has(parent.data);
}

/**
 * Starts tracking an incremental execution with its initial result (replaces the previous execution of the operation).
 * Placeholders are captured in the indexed result (as returned by the server: merge policies don't change it).
 */
function updateIncrementalExecution(
  env: CacheEnv,
  store: Store,
  targetForest: DataForest | OptimisticLayer,
  operation: OperationDescriptor,
  execution: InitialExecutionResult,
  indexed: IndexedTree,
  merged: IndexedTree,
) {
  if (
    !("hasNext" in execution) ||
    !execution.hasNext ||
    !operation.hasDeferSites
  ) {
    // E.g. deferred data was resolved inline by the server (a complete result)
    store.incrementalExecutions.delete(operation);
    return;
  }
  const incremental: IncrementalExecution = {
    key: execution.key,
    placeholders: new Map(),
    serverData: undefined,
    // Results of operations which are not stored (e.g. mutations) are spliced into their latest result
    transientTree: shouldCache(targetForest, operation) ? undefined : merged,
  };
  const { data } = indexed.result;
  const selections = indexed.operation.possibleSelections;
  capturePlaceholders(
    {
      operation: indexed.operation,
      objectKey: createObjectKey(env, indexed.operation),
      incremental,
    },
    data,
    data,
    selections,
    EMPTY_ARRAY,
    {
      nodeKey: indexed.rootNodeKey,
      nodeSelections: selections,
      pathFromNode: EMPTY_ARRAY,
      types: [data.__typename || indexed.operation.rootType || false],
    },
    false,
    true,
  );
  if (incremental.placeholders.size) {
    store.incrementalExecutions.set(operation, incremental);
  } else {
    // No objects with deferred fragments (enabled for the operation variables): nothing to write later
    store.incrementalExecutions.delete(operation);
  }
}

export function isSplicedIncrementalResult(
  execution: InitialExecutionResult | SplicedIncrementalResult,
): execution is SplicedIncrementalResult {
  return "kind" in execution && execution.kind === "SplicedIncrementalResult";
}

// Complete or initial results are written as is (subsequent results are spliced into the stored result first)
export function isInitialExecutionWrite(
  options: ExecutionWriteOptions,
): options is ExecutionWriteOptions & { execution: InitialExecutionResult } {
  return "data" in options.execution;
}

export function isSubsequentResult(
  execution: ExecutionResult,
): execution is SubsequentExecutionResult {
  return !("data" in execution);
}

const EMPTY_ARRAY = Object.freeze([]);
