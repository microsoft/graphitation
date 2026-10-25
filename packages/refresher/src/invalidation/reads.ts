/**
 * What a store read and a descriptor say about consistency, derived from what they record:
 * when each read was asked, what its store reported, and how far the descriptor was matched.
 */

import type { Revision } from "../api.core";
import type { ViewInstanceDescriptor } from "../api.invalidation";
import type { StoreRead } from "../api.stores";

/**
 * The revision the answer reflects every change through, and only later changes are
 * matched against the read: the one the store reported, or else the one it was asked at.
 */
export function answeredAt(read: StoreRead): Revision {
  return read.reported ?? read.startedAt;
}

/** Whether the store answered from state older than asked. See `AnnotationArgs.revision`. */
export function isLagging(read: StoreRead): boolean {
  return read.reported !== undefined && read.reported < read.startedAt;
}

/**
 * Whether the store answered as of exactly the revision asked, as a store keeping history
 * does: it can answer as of an earlier revision just as well. A store reading its current
 * state that happens to be at the revision asked looks the same, and costs a rerun at most.
 */
export function isExact(read: StoreRead): boolean {
  return read.reported === read.startedAt;
}

/**
 * The revision the descriptor's result reflects every change through: its `matchedThrough`,
 * or, when a store answered one of its reads from state older than asked, the oldest
 * revision such an answer reported.
 */
export function validThroughOf(descriptor: ViewInstanceDescriptor): Revision {
  let through = descriptor.matchedThrough;
  for (const group of descriptor.storeReads.values()) {
    for (const read of group) {
      const reported = read.reported;
      if (
        reported !== undefined &&
        reported < read.startedAt &&
        reported < through
      ) {
        through = reported;
      }
    }
  }
  return through;
}

/**
 * Whether it settled stale: a store answered one of its reads from state older than asked.
 * Its result misses what the store had not caught up with, and matching never changes that.
 */
export function settledStale(
  descriptor: Pick<ViewInstanceDescriptor, "storeReads">,
): boolean {
  for (const group of descriptor.storeReads.values()) {
    for (const read of group) if (isLagging(read)) return true;
  }
  return false;
}
