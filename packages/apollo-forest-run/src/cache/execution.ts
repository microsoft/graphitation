import type {
  FragmentSpreadNode,
  InlineFragmentNode,
  SelectionSetNode,
} from "graphql";
import type { OperationDescriptor } from "../descriptor/types";
import type {
  CacheEnv,
  DataForest,
  ExecutionWriteOptions,
  InFlightExecution,
  Store,
  Transaction,
  WriteOptionsInternal,
} from "./types";
import type {
  ExecutionResult,
  IncrementalDeferResult,
  IncrementalStreamResult,
  ResultData,
  SubsequentExecutionResult,
} from "../incremental/types";
import { assert } from "../jsutils/assert";
import {
  resolveOperationDescriptor,
  resolveResultDescriptor,
} from "./descriptor";
import { addInFlightExecution, removeInFlightExecution } from "./store";
import { mergeAt } from "../incremental/data";

/**
 * Routing of execution results, resolved by `write` (results are written by the regular write).
 *
 * Results of an incremental execution are written to its in-flight layer (see InFlightExecution) until it completes
 * (`hasNext: false`, also sent by the client on timeout). Then the received result is written to the data forest
 * as a single result (as if it was received at once, without `@defer`):
 * - the initial result is written as is to a new in-flight layer
 * - subsequent results are spliced into the received result (copy-on-write, by response paths), which is written
 *   to the in-flight layer as a whole
 * - on completion, the received result is written to the data forest (and the layer is dropped)
 *
 * A new execution of the operation cancels the current one (its in-flight layer is discarded).
 */
export type ExecutionWrite = {
  forest: DataForest;
  data: ResultData;
  // The in-flight execution written to (the target forest is its layer)
  inFlight: InFlightExecution | null;
};

export function resolveExecutionWrite(
  env: CacheEnv,
  store: Store,
  transaction: Transaction,
  options: ExecutionWriteOptions,
): ExecutionWrite {
  // Executions are written to the data forest only (never optimistic)
  assert(!transaction.optimisticLayer);
  const { execution } = options;
  const operation = resolveExecutionOperation(env, store, options);
  const current = store.inFlightExecutions.get(operation);

  if (isSubsequentResult(execution)) {
    assert(current && current.key === execution.key);
    const data = spliceIncrementalResults(current.data, execution);
    if (!execution.hasNext) {
      removeExecution(store, transaction, current);
      return { forest: store.dataForest, data, inFlight: null };
    }
    current.data = data;
    return { forest: current.forest, data, inFlight: current };
  }
  if (current) {
    removeExecution(store, transaction, current);
  }
  if (
    !("hasNext" in execution) ||
    !execution.hasNext ||
    !hasEnabledDefer(operation)
  ) {
    // E.g. deferred data resolved inline by the server (a complete result)
    return { forest: store.dataForest, data: execution.data, inFlight: null };
  }
  const inFlight = addInFlightExecution(
    env,
    store,
    operation,
    execution.key,
    execution.data,
  );
  return { forest: inFlight.forest, data: inFlight.data, inFlight };
}

/**
 * Results of unknown or superseded executions (and subsequent results without data to write) are not written
 */
export function shouldWriteExecutionResult(
  env: CacheEnv,
  store: Store,
  options: ExecutionWriteOptions,
): boolean {
  const { execution } = options;
  if (!isSubsequentResult(execution)) {
    return true;
  }
  const current = store.inFlightExecutions.get(
    resolveExecutionOperation(env, store, options),
  );
  return (
    current !== undefined &&
    current.key === execution.key &&
    (!execution.hasNext || getDeferResults(execution).length > 0)
  );
}

export function isExecutionWrite(
  options: WriteOptionsInternal,
): options is ExecutionWriteOptions {
  // An explicit nullish `execution` (e.g. untyped options of `write`) is a regular write of `result`
  return "execution" in options && options.execution != null;
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
export function isSubsequentResult(
  execution: ExecutionResult,
): execution is SubsequentExecutionResult {
  return !("data" in execution);
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

function removeExecution(
  store: Store,
  transaction: Transaction,
  execution: InFlightExecution,
) {
  // Readers of the in-flight layer read from the data forest again
  const readers = removeInFlightExecution(store, execution);
  transaction.affectedOperations ??= new Set();
  transaction.rereadOperations ??= new Set();
  for (const operation of readers) {
    transaction.affectedOperations.add(operation);
    transaction.rereadOperations.add(operation);
  }
}

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
