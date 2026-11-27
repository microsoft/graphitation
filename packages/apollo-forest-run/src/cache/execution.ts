import type {
  FragmentSpreadNode,
  InlineFragmentNode,
  SelectionSetNode,
} from "graphql";
import type { Cache } from "@apollo/client";
import type { OperationDescriptor } from "../descriptor/types";
import type {
  CacheEnv,
  Execution,
  ExecutionWriteOptions,
  OptimisticLayer,
  Store,
  Transaction,
  WriteResult,
} from "./types";
import type {
  ExecutionKey,
  ExecutionResult,
  IncrementalDeferResult,
  IncrementalStreamResult,
  InitialExecutionResult,
  ResultData,
  SubsequentExecutionResult,
} from "../incremental/types";
import { assert } from "../jsutils/assert";
import {
  resolveOperationDescriptor,
  resolveResultDescriptor,
} from "./descriptor";
import { createOptimisticLayer, removeOptimisticLayers } from "./store";
import { write } from "./write";
import { mergeAt } from "../incremental/data";

// Runs `update` in a new optimistic transaction with the layer tag (ApolloCompat: replays of layers, see ForestRun)
export type OptimisticTransactionRunner = (
  layerTag: string,
  update: (transaction: Transaction) => void,
) => void;

/**
 * Writes an execution result with the regular write. Returns undefined for ignored results.
 *
 * Results of an incremental execution (`@defer`) are written to a regular optimistic layer of the execution until
 * it completes (`hasNext: false`, also sent by the client on timeout):
 * - the initial result creates the layer
 * - subsequent results are spliced into the received result (copy-on-write, by response paths), which is written
 *   to the layer as a whole
 * - on completion, the layer is removed and the received result is written as a single result
 *
 * A new execution of the operation cancels the current one (its layer is removed without writing).
 * Results of unknown or superseded executions are ignored.
 */
export function writeExecutionResult(
  env: CacheEnv,
  store: Store,
  transaction: Transaction,
  options: ExecutionWriteOptions,
  cache: unknown,
  runOptimisticTransaction: OptimisticTransactionRunner,
): WriteResult | undefined {
  const { execution, ...writeOptions } = options;
  const operation = resolveExecutionOperation(env, store, options);
  const current = store.executions.get(operation);

  if (isSubsequentResult(execution)) {
    if (!current || current.key !== execution.key) {
      // E.g. late results of a superseded execution
      return undefined;
    }
    const data = spliceIncrementalResults(current.data, execution);
    if (!execution.hasNext) {
      removeExecution(env, store, transaction, current, cache);
      return writeResult(env, store, transaction, {
        ...writeOptions,
        result: data,
      });
    }
    if (data === current.data) {
      return undefined;
    }
    current.data = data;
    const layer = store.optimisticLayers.find(
      (layer) => layer.layerTag === current.layerTag,
    );
    assert(layer);
    return writeResult(
      env,
      store,
      transaction,
      { ...writeOptions, result: data },
      layer,
    );
  }
  if (current) {
    removeExecution(env, store, transaction, current, cache);
  }
  const result = { ...writeOptions, result: execution.data };
  if (!isIncrementalResult(operation, execution)) {
    return writeResult(env, store, transaction, result);
  }
  // Executions are never optimistic
  assert(!transaction.optimisticLayer);
  const added = addExecution(store, operation, execution.key, execution.data);
  // ApolloCompat: replays write the data received so far to a new layer
  const replay = () =>
    runOptimisticTransaction(added.layerTag, (transaction) =>
      writeResult(env, store, transaction, {
        ...writeOptions,
        result: added.data,
      }),
    );
  const layer = createOptimisticLayer(added.layerTag, replay);
  store.optimisticLayers.push(layer);
  return writeResult(env, store, transaction, result, layer);
}

function writeResult(
  env: CacheEnv,
  store: Store,
  transaction: Transaction,
  options: Cache.WriteOptions,
  layer?: OptimisticLayer,
): WriteResult {
  const result = write(env, store, transaction, options, layer);
  transaction.changelog.push(result);
  return result;
}

function removeExecution(
  env: CacheEnv,
  store: Store,
  transaction: Transaction,
  execution: Execution,
  cache: unknown,
) {
  const affected = removeOptimisticLayers(
    cache,
    env,
    store,
    execution.layerTag,
  );
  transaction.affectedOperations ??= new Set();
  for (const operation of affected ?? EMPTY_ARRAY) {
    transaction.affectedOperations.add(operation);
  }
  // Deleted after the layer: keeps the descriptor of a non-cacheable operation (see canReleaseOperationDescriptor)
  store.executions.delete(execution.operation);
}

function resolveExecutionOperation(
  env: CacheEnv,
  store: Store,
  options: ExecutionWriteOptions,
): OperationDescriptor {
  return resolveResultDescriptor(
    env,
    store,
    resolveOperationDescriptor(
      env,
      store,
      options.query,
      options.variables,
      options.dataId,
    ),
  );
}

function addExecution(
  store: Store,
  operation: OperationDescriptor,
  key: ExecutionKey | undefined,
  data: ResultData,
): Execution {
  assert(!store.executions.has(operation));
  const execution: Execution = {
    operation,
    key,
    layerTag: `@defer:${operation.debugName}:${++executionCount}`,
    data,
  };
  store.executions.set(operation, execution);
  return execution;
}

let executionCount = 0;

export function isSubsequentResult(
  execution: ExecutionResult,
): execution is SubsequentExecutionResult {
  return !("data" in execution);
}

// An initial result with pending results of @defer enabled by its variables (e.g. not resolved inline by the server)
function isIncrementalResult(
  operation: OperationDescriptor,
  execution: InitialExecutionResult,
): boolean {
  return (
    "hasNext" in execution && execution.hasNext && hasEnabledDefer(operation)
  );
}

// Whether the operation has @defer directives enabled by its variables (`if` argument)
function hasEnabledDefer(operation: OperationDescriptor): boolean {
  let enabled = enabledDefer.get(operation);
  if (enabled === undefined) {
    enabled = selectsEnabledDefer(
      operation,
      operation.definition.selectionSet,
      new Set(),
    );
    enabledDefer.set(operation, enabled);
  }
  return enabled;
}

function selectsEnabledDefer(
  operation: OperationDescriptor,
  selectionSet: SelectionSetNode,
  visitedFragments: Set<string>,
): boolean {
  for (const selection of selectionSet.selections) {
    if (selection.kind !== "Field" && isEnabledDefer(operation, selection)) {
      return true;
    }
    const nested =
      selection.kind !== "FragmentSpread"
        ? selection.selectionSet
        : visitedFragments.has(selection.name.value)
        ? undefined
        : operation.fragmentMap.get(selection.name.value)?.selectionSet;
    if (selection.kind === "FragmentSpread") {
      visitedFragments.add(selection.name.value);
    }
    if (nested && selectsEnabledDefer(operation, nested, visitedFragments)) {
      return true;
    }
  }
  return false;
}

function isEnabledDefer(
  operation: OperationDescriptor,
  selection: InlineFragmentNode | FragmentSpreadNode,
): boolean {
  const defer = selection.directives?.find((d) => d.name.value === "defer");
  const condition = defer?.arguments?.find((a) => a.name.value === "if");
  if (!defer || !condition) {
    return Boolean(defer);
  }
  const { value } = condition;
  return value.kind === "Variable"
    ? Boolean(operation.variablesWithDefaults[value.name.value])
    : value.kind !== "BooleanValue" || value.value;
}

const enabledDefer = new WeakMap<OperationDescriptor, boolean>();

/**
 * Splices data of deferred fragments into the result by their response paths (in the server view, so local changes
 * of lists can't misplace them, see apollographql/apollo-client#13530). Copy-on-write: received results stay intact.
 *
 * TODO: streamed list items (`items`)
 */
function spliceIncrementalResults(
  data: ResultData,
  execution: SubsequentExecutionResult,
): ResultData {
  for (const { path = EMPTY_ARRAY, data: delivered } of getDeferResults(
    execution,
  )) {
    data = mergeAt(data, path, delivered) ?? data;
  }
  return data;
}

// Results with data, parents first: data of nested @defer may be delivered with its parent in the same payload
function getDeferResults(
  execution: SubsequentExecutionResult,
): (IncrementalDeferResult & { data: ResultData })[] {
  const results: (IncrementalDeferResult & { data: ResultData })[] = [];
  for (const result of execution.incremental ?? EMPTY_ARRAY) {
    if (isDeferResult(result) && result.data) {
      results.push({ ...result, data: result.data });
    }
  }
  return results.sort((a, b) => (a.path?.length ?? 0) - (b.path?.length ?? 0));
}

function isDeferResult(
  result: IncrementalDeferResult | IncrementalStreamResult,
): result is IncrementalDeferResult {
  return "data" in result;
}

const EMPTY_ARRAY = Object.freeze([]);
