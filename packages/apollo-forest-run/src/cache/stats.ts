import type {
  ModifyStats,
  ModifyStatsSerialized,
  TimedEvent,
  TransactionStats,
  TransactionStatsSerialized,
  WriteStats,
  WriteStatsSerialized,
} from "./types";
import { assertNever } from "../jsutils/assert";

export const createTimedEvent = (start = false): TimedEvent => ({
  time: Number.NaN,
  start: start ? performance.now() : Number.NaN,
});

export function markStart<T extends TimedEvent>(event: T): T {
  event.start = performance.now();
  return event;
}
export function markEnd<T extends TimedEvent>(event: T): T {
  event.time = performance.now() - event.start;
  return event;
}

export function transactionToJSON(
  item: TransactionStats,
): TransactionStatsSerialized {
  return [
    0,
    normalize(item.time),
    normalize(item.steps.updateCallback.time),
    normalize(item.steps.collectWatches.time),
    [
      normalize(item.steps.removeOptimistic.time),
      item.steps.removeOptimistic.affectedOperations,
    ],
    [
      normalize(item.steps.notifyWatches.time),
      item.steps.notifyWatches.notifiedWatches,
    ],
    [
      normalize(item.steps.eviction.time),
      item.steps.eviction.evictedOperations,
    ],
    item.log.map(toJSON),
  ];
}

function writeToJSON(item: WriteStats): WriteStatsSerialized {
  const {
    descriptor,
    indexing,
    mergePolicies,
    diff,
    affectedOperations,
    update,
    affectedLayerOperations,
    invalidateReadResults,
  } = item.steps;
  return [
    1,
    item.op,
    item.opId,
    normalize(item.time),
    normalize(descriptor.time),
    [normalize(indexing.time), indexing.totalNodes],
    normalize(mergePolicies.time),
    [
      normalize(diff.time),
      diff.dirtyNodes.length,
      diff.newNodes.length,
      diff.errors,
    ],
    [normalize(affectedOperations.time), affectedOperations.totalCount],
    [normalize(update.time), update.updated],
    [
      normalize(affectedLayerOperations.time),
      affectedLayerOperations.totalCount,
    ],
    normalize(invalidateReadResults.time),
  ];
}

function toJSON(
  item: TransactionStats | WriteStats | ModifyStats,
): TransactionStatsSerialized | WriteStatsSerialized | ModifyStatsSerialized {
  switch (item.kind) {
    case "Transaction":
      return transactionToJSON(item);
    case "Write":
      return writeToJSON(item);
    case "Modify":
      return [2, normalize(item.time)];
    default:
      assertNever(item);
  }
}

// performance.now() is limited to 100 microseconds due to security reasons.
// But this precision (100 microseconds) is enough for us
const normalize = (time: number) => Math.round(time * 10);
