import type {
  FragmentSpreadNode,
  InlineFragmentNode,
  SelectionSetNode,
} from "graphql";
import type { OperationDescriptor } from "../descriptor/types";
import type {
  CacheEnv,
  DataForest,
  Execution,
  ExecutionWriteOptions,
  OptimisticLayer,
  Store,
  Transaction,
  WriteOptionsInternal,
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
import { getActiveForest } from "./store";
import { mergeAt } from "../incremental/data";

/**
 * Target of an execution write, resolved by `write` (results are written by the regular write).
 *
 * Results of the current execution of an operation are written to its optimistic layer (see Execution) as a whole
 * (received data so far). Other results are written like `write` writes `result`.
 */
export type ExecutionWrite = {
  forest: DataForest | OptimisticLayer;
  data: ResultData;
  // The current execution written to (the target forest is its layer)
  current: Execution | null;
};

export function resolveExecutionWrite(
  env: CacheEnv,
  store: Store,
  transaction: Transaction,
  options: ExecutionWriteOptions,
): ExecutionWrite {
  const { execution } = options;
  const current = store.executions.get(
    resolveExecutionOperation(env, store, options),
  );
  if (current && current.key === execution.key) {
    const layer = store.optimisticLayers.find(
      (layer) => layer.layerTag === current.layerTag,
    );
    assert(layer);
    return { forest: layer, data: current.data, current };
  }
  // E.g. a complete result, or untyped options of `write` (a subsequent result is the same as `write` without `result`)
  return {
    forest: getActiveForest(store, transaction),
    data: isSubsequentResult(execution) ? {} : execution.data,
    current: null,
  };
}

export function isExecutionWrite(
  options: WriteOptionsInternal,
): options is ExecutionWriteOptions {
  // An explicit nullish `execution` (e.g. untyped options of `write`) is a regular write of `result`
  return "execution" in options && options.execution != null;
}

export function resolveExecutionOperation(
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

export function addExecution(
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
export function isIncrementalResult(
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
export function spliceIncrementalResults(
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
