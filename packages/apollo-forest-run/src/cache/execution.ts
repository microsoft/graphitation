import type {
  CacheEnv,
  ExecutionWriteOptions,
  InFlightExecution,
  Store,
  Transaction,
  WriteResult,
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
import { write } from "./write";
import { mergeAt } from "../incremental/data";

/**
 * Writes an execution result.
 *
 * Results of an incremental execution are written to its in-flight layer (see InFlightExecution) until it completes
 * (`hasNext: false`, also sent by the client on timeout). Then the received result is written to the data forest
 * as a single result (as if it was received at once, without `@defer`).
 *
 * All writes are regular writes, only routed to different layers:
 * - the initial result is written as is to a new in-flight layer
 * - subsequent results are spliced into the received result (copy-on-write, by response paths), which is written
 *   to the in-flight layer as a whole
 * - on completion, the received result is written to the data forest
 *
 * A new execution of the operation cancels the current one (its in-flight layer is discarded).
 * Results of unknown or superseded executions are ignored.
 */
export function writeExecutionResult(
  env: CacheEnv,
  store: Store,
  transaction: Transaction,
  options: ExecutionWriteOptions,
): WriteResult | undefined {
  // Executions are written to the data forest only (never optimistic)
  assert(!transaction.optimisticLayer);
  const { execution, ...writeOptions } = options;
  const operation = resolveResultDescriptor(
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
  const current = store.inFlightExecutions.get(operation);

  if (isSubsequentResult(execution)) {
    if (!current || current.key !== execution.key) {
      return undefined;
    }
    const data = spliceIncrementalResults(current.data, execution);
    if (!execution.hasNext) {
      removeExecution(store, transaction, current);
      return write(env, store, transaction, { ...writeOptions, result: data });
    }
    if (data === current.data) {
      return undefined;
    }
    current.data = data;
    return write(
      env,
      store,
      transaction,
      { ...writeOptions, result: data },
      current.forest,
    );
  }
  if (current) {
    removeExecution(store, transaction, current);
  }
  if (!("hasNext" in execution) || !execution.hasNext) {
    return write(env, store, transaction, {
      ...writeOptions,
      result: execution.data,
    });
  }
  const inFlight = addInFlightExecution(
    env,
    store,
    operation,
    execution.key,
    execution.data,
  );
  return write(
    env,
    store,
    transaction,
    { ...writeOptions, result: inFlight.data },
    inFlight.forest,
  );
}

export function isSubsequentResult(
  execution: ExecutionResult,
): execution is SubsequentExecutionResult {
  return !("data" in execution);
}

function removeExecution(
  store: Store,
  transaction: Transaction,
  execution: InFlightExecution,
) {
  // Readers of the in-flight layer read from the data forest again
  const readers = removeInFlightExecution(store, execution);
  transaction.affectedOperations ??= new Set();
  for (const operation of readers) {
    transaction.affectedOperations.add(operation);
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
  const results = (execution.incremental ?? EMPTY_ARRAY).filter(isDeferResult);
  // Parents first: data of nested @defer may be delivered with its parent in the same payload
  results.sort((a, b) => (a.path?.length ?? 0) - (b.path?.length ?? 0));
  for (const result of results) {
    if (result.data) {
      data = mergeAt(data, result.path ?? EMPTY_ARRAY, result.data) ?? data;
    }
  }
  return data;
}

function isDeferResult(
  result: IncrementalDeferResult | IncrementalStreamResult,
): result is IncrementalDeferResult {
  return "data" in result;
}

const EMPTY_ARRAY = Object.freeze([]);
