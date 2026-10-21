/**
 * `invalidate`: matches the changes a log holds against view instance descriptors,
 * following `../api.invalidation`.
 *
 * It scans the log once, from the earliest revision any descriptor needs, grouping changes
 * by store into parallel arrays, so a read is tested only against changes to its own store.
 * A read shared by several descriptors, as every reader of one memoized view shares its
 * reads, is matched once per revision it is asked from, and the answer is reused.
 */
import type { StoreName } from "../api.core";
import type {
  ChangeLog,
  InvalidateArgs,
  InvalidateFn,
  InvalidateResult,
  Invalidated,
  StaleReason,
  Unverifiable,
  ViewInstanceDescriptor,
} from "../api.invalidation";
import type { Environment } from "../api.env";
import type { StoreChange, StoreRead } from "../api.stores";
import { assertAlways, assertSometimes } from "../env/assert";
import { internalsOf } from "../views/definitions";

const UNVERIFIABLE: Unverifiable = Object.freeze({ kind: "unverifiable" });

/** The changes to one store, in revision order, with the revision of each. */
type StoreChanges = {
  readonly revisions: number[];
  readonly changes: StoreChange[];
};

/** The first change after `start` that hits a read: its index, or -1 for none. */
type Scan = {
  start: number;
  hit: number;
};

type Matches = (
  args: unknown,
  change: StoreChange,
  footprint: unknown,
) => boolean;

export const invalidate: InvalidateFn = <T extends ViewInstanceDescriptor>(
  args: InvalidateArgs<T>,
): InvalidateResult<T> => {
  const { env, changes: log, descriptors } = args;
  const { tail, head } = log;
  assertAlways(env, tail <= head);

  let from = head;
  for (const each of descriptors) {
    const validThrough = each.validThrough;
    if (each.storeReads.length === 0) continue;
    if (validThrough >= tail && validThrough < from) from = validThrough;
  }
  const byStore = from < head ? changesByStore(env, log, from) : undefined;

  const stale: Invalidated<T>[] = [];
  const reported = new Set<T>();
  const scans = new Map<StoreRead, Scan>();
  for (const each of descriptors) {
    if (reported.has(each)) continue;
    let reason: StaleReason | undefined;
    if (each.validThrough < tail) reason = UNVERIFIABLE;
    else if (byStore !== undefined)
      reason = firstHit(env, byStore, scans, each);
    if (reason === undefined) continue;
    reported.add(each);
    stale.push({ descriptor: each, reason });
  }
  assertSometimes(
    env,
    stale.length > 0,
    "An invalidation finds a stale descriptor",
  );
  return { stale };
};

/** The deliveries after `from`, grouped by store. */
function changesByStore(
  env: Environment,
  log: ChangeLog,
  from: number,
): Map<StoreName, StoreChanges> {
  const head = log.head;
  const byStore = new Map<StoreName, StoreChanges>();
  let previous = from;
  for (const delivery of log.since(from)) {
    const revision = delivery.revision;
    assertAlways(
      env,
      revision > previous,
      "Deliveries strictly increase in revision",
    );
    assertAlways(
      env,
      revision <= head,
      "A delivery lies within the log's window",
    );
    previous = revision;
    for (const change of delivery.changes) {
      let group = byStore.get(change.store);
      if (group === undefined) {
        group = { revisions: [], changes: [] };
        byStore.set(change.store, group);
      }
      group.revisions.push(revision);
      group.changes.push(change);
    }
  }
  return byStore;
}

/** The first of the reads a change hits, with its witness, if any. */
function firstHit(
  env: Environment,
  byStore: ReadonlyMap<StoreName, StoreChanges>,
  scans: Map<StoreRead, Scan>,
  descriptor: ViewInstanceDescriptor,
): StaleReason | undefined {
  for (const read of descriptor.storeReads) {
    const internals = internalsOf(read.view);
    assertAlways(
      env,
      internals?.kind === "store",
      "A store read names a store view",
    );
    const group = byStore.get(internals.store);
    if (group === undefined) continue;
    const start = Math.max(read.revision, descriptor.validThrough);
    const hit = scanOf(scans, group, read, internals.matches, start);
    if (hit < 0) continue;
    return {
      kind: "hit",
      read,
      change: group.changes[hit]!,
      revision: group.revisions[hit]!,
    };
  }
  return undefined;
}

/**
 * The index of the first change after `start` that hits `read`, or -1. Reuses the last scan
 * of `read` when it started no later and found nothing, or found a hit after `start`.
 */
function scanOf(
  scans: Map<StoreRead, Scan>,
  group: StoreChanges,
  read: StoreRead,
  matches: Matches,
  start: number,
): number {
  const known = scans.get(read);
  if (known !== undefined && known.start <= start) {
    if (known.hit < 0) return -1;
    if (group.revisions[known.hit]! > start) return known.hit;
  }
  const { revisions, changes } = group;
  let hit = -1;
  for (
    let index = firstAfter(revisions, start);
    index < changes.length;
    index++
  ) {
    if (matches(read.args, changes[index]!, read.footprint)) {
      hit = index;
      break;
    }
  }
  if (known === undefined) {
    scans.set(read, { start, hit });
  } else {
    known.start = start;
    known.hit = hit;
  }
  return hit;
}

/** The index of the first revision greater than `start`. */
function firstAfter(revisions: readonly number[], start: number): number {
  let low = 0;
  let high = revisions.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (revisions[middle]! > start) high = middle;
    else low = middle + 1;
  }
  return low;
}
