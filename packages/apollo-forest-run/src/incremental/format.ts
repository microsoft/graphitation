import type {
  IncrementalDeliverySubsequentResult,
  IncrementalDeferResult,
  IncrementalExecution,
  IncrementalStreamResult,
  PendingResult,
  SubsequentExecutionResult,
  SubsequentIncrementalExecutionResult,
} from "./types";

/**
 * Subsequent results in the incremental delivery format (`pending`, `id`, `subPath`, `completed`) are converted
 * to the 2022 draft format (results addressed by `path` and `label`), similar to Relay's
 * RelayIncrementalDeliveryConverter (https://github.com/meta/relay/commit/c270fbf4b9d011892300e389240bfeaedfe714bb).
 *
 * Results are converted as they arrive (not buffered until `completed`): delivered data is spliced as is.
 * Fragments omitted by the server (all fields were already delivered) need no special handling: their data
 * is in the cache already, and objects with nested deferred fragments are known statically (see placeholders).
 */
export function convertIncrementalDeliveryResult(
  incremental: IncrementalExecution,
  execution: IncrementalDeliverySubsequentResult,
): SubsequentIncrementalExecutionResult {
  trackPendingResults(incremental, execution.pending);
  const pendingResults = incremental.pendingResults;
  const results: (IncrementalDeferResult | IncrementalStreamResult)[] = [];
  for (const result of execution.incremental ?? EMPTY_ARRAY) {
    const pending = pendingResults?.get(result.id);
    if (!pending) {
      continue;
    }
    const { errors, extensions } = result;
    const { path, label } = pending;
    results.push(
      "items" in result
        ? { items: result.items, errors, extensions, path, label }
        : {
            data: result.data,
            errors,
            extensions,
            path: result.subPath?.length ? [...path, ...result.subPath] : path,
            label,
          },
    );
  }
  for (const { id, errors } of execution.completed ?? EMPTY_ARRAY) {
    const pending = pendingResults?.get(id);
    if (pending && errors) {
      // A fragment failed as a whole
      results.push({
        data: null,
        errors,
        path: pending.path,
        label: pending.label,
      });
    }
    pendingResults?.delete(id);
  }
  return {
    incremental: results,
    hasNext: execution.hasNext,
    extensions: execution.extensions,
  };
}

export function trackPendingResults(
  incremental: IncrementalExecution,
  pending: ReadonlyArray<PendingResult> | undefined,
) {
  for (const result of pending ?? EMPTY_ARRAY) {
    (incremental.pendingResults ??= new Map()).set(result.id, result);
  }
}

// Only results of the incremental delivery format have `pending`, `completed`, or results with `id`
export function isIncrementalDeliveryResult(
  execution: SubsequentExecutionResult,
): execution is IncrementalDeliverySubsequentResult &
  SubsequentExecutionResult {
  if ("pending" in execution || "completed" in execution) {
    return true;
  }
  const results: ReadonlyArray<object> = execution.incremental ?? EMPTY_ARRAY;
  return results.some((result) => "id" in result);
}

const EMPTY_ARRAY = Object.freeze([]);
