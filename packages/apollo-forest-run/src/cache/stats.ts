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
    microseconds(item.time),
    microseconds(item.steps.updateCallback.time),
    microseconds(item.steps.collectWatches.time),
    [
      microseconds(item.steps.removeOptimistic.time),
      item.steps.removeOptimistic.affectedOperations,
    ],
    [
      microseconds(item.steps.notifyWatches.time),
      item.steps.notifyWatches.notifiedWatches,
    ],
    [
      microseconds(item.steps.eviction.time),
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
    microseconds(item.time),
    microseconds(descriptor.time),
    [microseconds(indexing.time), indexing.totalNodes],
    microseconds(mergePolicies.time),
    [
      microseconds(diff.time),
      diff.dirtyNodes.length,
      diff.newNodes.length,
      diff.errors,
    ],
    [microseconds(affectedOperations.time), affectedOperations.totalCount],
    [microseconds(update.time), update.updated],
    [
      microseconds(affectedLayerOperations.time),
      affectedLayerOperations.totalCount,
    ],
    microseconds(invalidateReadResults.time),
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
      return [2, microseconds(item.time)];
    default:
      assertNever(item);
  }
}

const microseconds = (time: number) => Math.round(time * 1000);
