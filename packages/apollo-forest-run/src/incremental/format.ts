import type {
  IncrementalDeliverySubsequentResult,
  IncrementalDeferResult,
  IncrementalExecution,
  IncrementalStreamResult,
  PendingResult,
  SubsequentExecutionResult,
  SubsequentIncrementalExecutionResult,
  TrackedPendingResult,
} from "./types";
import type { ResponsePath } from "../descriptor/types";
import type { SourceObject } from "../values/types";
import {
  getDataAt,
  isPathPrefix,
  isSourceData,
  mergeAt,
  mergeSourceData,
} from "./data";

/**
 * Subsequent results in the incremental delivery format (`pending`, `id`, `subPath`, `completed`) are converted
 * to the 2022 draft format (results addressed by `path` and `label`), similar to Relay's
 * RelayIncrementalDeliveryConverter (https://github.com/meta/relay/commit/c270fbf4b9d011892300e389240bfeaedfe714bb).
 *
 * Results are converted as they arrive (not buffered until `completed`). A result with `subPath` is never resolved
 * against the cache: it is converted to a result at its pending path, with data received at that path so far
 * (see TrackedPendingResult and reassembleAtPendingPath), i.e. as the server sees it (e.g. local reorders of lists are overwritten).
 *
 * Fragments omitted by the server (all fields were already delivered) need no special handling: their data
 * is in the cache already, and objects with nested deferred fragments are known statically (see placeholders).
 */
export function convertIncrementalDeliveryResult(
  incremental: IncrementalExecution,
  execution: IncrementalDeliverySubsequentResult,
): SubsequentIncrementalExecutionResult {
  // Data of pending results announced by this payload may be delivered by this payload (nested @defer)
  const announced = trackPendingResults(incremental, execution.pending);
  const pendingResults = incremental.pendingResults;
  const results: (IncrementalDeferResult | IncrementalStreamResult)[] = [];
  for (const result of execution.incremental ?? EMPTY_ARRAY) {
    const pending = pendingResults?.get(result.id);
    if (!pending) {
      continue;
    }
    const { errors, extensions } = result;
    const { path, label } = pending;
    if ("items" in result) {
      results.push({ items: result.items, errors, extensions, path, label });
      continue;
    }
    const { subPath = EMPTY_ARRAY } = result;
    const data = isSourceData(result.data) ? result.data : undefined;
    const reassembled =
      data && subPath.length && pending.data
        ? reassembleAtPendingPath(pending.data, subPath, data)
        : data;
    results.push(
      reassembled
        ? { data: reassembled, errors, extensions, path, label }
        : // Unknown data at the pending path: addressed by the full path
          {
            data: result.data,
            errors,
            extensions,
            path: [...path, ...subPath],
            label,
          },
    );
    if (data && pendingResults) {
      retainDeliveredData(pendingResults, [...path, ...subPath], data);
    }
  }
  for (const pending of announced) {
    pending.data ??= resolveRetainedData(incremental, pending);
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

/**
 * Starts tracking announced pending results with data received at their paths so far: in `initialData`
 * (the initial result) or in data of other pending results.
 */
export function trackPendingResults(
  incremental: IncrementalExecution,
  pending: ReadonlyArray<PendingResult> | undefined,
  initialData?: SourceObject,
): TrackedPendingResult[] {
  const tracked: TrackedPendingResult[] = [];
  for (const result of pending ?? EMPTY_ARRAY) {
    const entry: TrackedPendingResult = { ...result, data: undefined };
    entry.data = initialData
      ? getDataAt(initialData, result.path, 0)
      : resolveRetainedData(incremental, entry);
    (incremental.pendingResults ??= new Map()).set(result.id, entry);
    tracked.push(entry);
  }
  return tracked;
}

// Data at the path of the pending result in data retained by the closest pending result above it
function resolveRetainedData(
  incremental: IncrementalExecution,
  pending: TrackedPendingResult,
): SourceObject | undefined {
  let closest: TrackedPendingResult | undefined;
  for (const other of incremental.pendingResults?.values() ?? EMPTY_ARRAY) {
    if (
      other !== pending &&
      other.data &&
      isPathPrefix(other.path, pending.path) &&
      (!closest || other.path.length > closest.path.length)
    ) {
      closest = other;
    }
  }
  return closest?.data
    ? getDataAt(closest.data, pending.path, closest.path.length)
    : undefined;
}

// Merges delivered data into data retained by pending results at, above, or below its path
//   (e.g. a nested pending result completes after its ancestor)
function retainDeliveredData(
  pendingResults: Map<string, TrackedPendingResult>,
  path: ResponsePath,
  data: SourceObject,
) {
  for (const pending of pendingResults.values()) {
    if (isPathPrefix(path, pending.path)) {
      const atPending = getDataAt(data, pending.path, path.length);
      if (atPending) {
        pending.data = pending.data
          ? mergeSourceData(pending.data, atPending)
          : atPending;
      }
    } else if (pending.data && isPathPrefix(pending.path, path)) {
      const merged = mergeAt(pending.data, path, pending.path.length, data);
      if (isSourceData(merged)) {
        pending.data = merged;
      }
    }
  }
}

function reassembleAtPendingPath(
  base: SourceObject,
  subPath: ResponsePath,
  data: SourceObject,
): SourceObject | undefined {
  const reassembled = reassemble(base, subPath, data);
  return isSourceData(reassembled) ? reassembled : undefined;
}

/**
 * Data of a result with `subPath` as data at the pending path: objects on the sub-path contain only the next step
 * (merged into existing objects when spliced), lists are complete (the server view) and their items are complete
 * objects (with key fields to match them by identity).
 */
function reassemble(
  base: unknown,
  subPath: ResponsePath,
  data: SourceObject,
  index = 0,
  inList = false,
): SourceObject | unknown[] | undefined {
  if (index === subPath.length) {
    if (!isSourceData(base)) {
      return undefined;
    }
    return inList ? mergeSourceData(base, data) : data;
  }
  const step = subPath[index];
  if (Array.isArray(base) && typeof step === "number") {
    const item = reassemble(base[step], subPath, data, index + 1, true);
    if (item === undefined) {
      return undefined;
    }
    const copy: unknown[] = [...base];
    copy[step] = item;
    return copy;
  }
  if (isSourceData(base) && typeof step === "string") {
    const value = reassemble(base[step], subPath, data, index + 1, inList);
    if (value === undefined) {
      return undefined;
    }
    const object = (inList ? { ...base } : {}) as SourceObject;
    object[step] = value as SourceObject;
    return object;
  }
  return undefined;
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
