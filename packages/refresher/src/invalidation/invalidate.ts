/**
 * `invalidate`: matches the changes a log holds against view instance descriptors,
 * following `../api.invalidation`.
 *
 * It scans the log once, from the earliest revision any descriptor needs, grouping changes
 * by store into parallel arrays; a descriptor's reads come grouped by store too, so only
 * the reads of a store that changed are tested, and only against changes to it.
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
import { answeredAt } from "./reads";

const UNVERIFIABLE: Unverifiable = Object.freeze({ kind: "unverifiable" });

/** The changes to one store, in revision order, with the revision of each. */
type StoreChanges = {
  readonly store: StoreName;
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
    const matchedThrough = each.matchedThrough;
    if (each.storeReads.size === 0) continue;
    if (matchedThrough >= tail && matchedThrough < from) from = matchedThrough;
  }
  const byStore = from < head ? changesByStore(env, log, from) : undefined;

  const stale: Invalidated<T>[] = [];
  const reported = new Set<T>();
  const scans = new Map<StoreRead, Scan>();
  for (const each of descriptors) {
    if (reported.has(each)) continue;
    let reason: StaleReason | undefined;
    if (each.matchedThrough < tail) reason = UNVERIFIABLE;
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
        group = { store: change.store, revisions: [], changes: [] };
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
  const own = descriptor.storeReads;
  // Walks the smaller side: the stores it read, or the stores that changed.
  if (own.size < byStore.size) {
    for (const [store, reads] of own) {
      const group = byStore.get(store);
      if (group === undefined) continue;
      const hit = hitIn(env, scans, group, reads, descriptor.matchedThrough);
      if (hit !== undefined) return hit;
    }
  } else {
    for (const group of byStore.values()) {
      const reads = own.get(group.store);
      if (reads === undefined) continue;
      const hit = hitIn(env, scans, group, reads, descriptor.matchedThrough);
      if (hit !== undefined) return hit;
    }
  }
  return undefined;
}

/** The first of the reads, all of the group's store, a change of the group hits, if any. */
function hitIn(
  env: Environment,
  scans: Map<StoreRead, Scan>,
  group: StoreChanges,
  reads: readonly StoreRead[],
  matchedThrough: number,
): StaleReason | undefined {
  assertAlways(env, reads.length > 0);
  for (const read of reads) {
    const internals = internalsOf(read.view);
    assertAlways(
      env,
      internals?.kind === "store",
      "A store read names a store view",
    );
    assertAlways(env, internals.store === group.store);
    const start = Math.max(answeredAt(read), matchedThrough);
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
