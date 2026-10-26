/**
 * `invalidate`: matches the changes a log holds against view instance descriptors,
 * following `../api.invalidation`.
 *
 * A descriptor's reads come grouped by store, and the log keeps each store's changes apart,
 * so a read is tested only against the changes to its store after it, and nothing is
 * grouped per call. A read shared by several descriptors, as every reader of one memoized
 * view shares its reads, is matched once per revision it is asked from, and the answer is
 * reused.
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

/** The first change after `start` that hits a read, at `revision`; none when `change` is undefined. */
type Scan = {
  start: number;
  revision: number;
  change: StoreChange | undefined;
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

  const stale: Invalidated<T>[] = [];
  const reported = new Set<T>();
  const scans = new Map<StoreRead, Scan>();
  for (const each of descriptors) {
    if (reported.has(each)) continue;
    let reason: StaleReason | undefined;
    if (each.matchedThrough < tail) reason = UNVERIFIABLE;
    else if (each.matchedThrough < head)
      reason = firstHit(env, log, scans, each);
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

/** The first of the reads a change hits, with its witness, if any. */
function firstHit(
  env: Environment,
  log: ChangeLog,
  scans: Map<StoreRead, Scan>,
  descriptor: ViewInstanceDescriptor,
): StaleReason | undefined {
  const matchedThrough = descriptor.matchedThrough;
  assertAlways(env, log.tail <= matchedThrough);
  for (const [store, reads] of descriptor.storeReads) {
    assertAlways(env, reads.length > 0);
    for (const read of reads) {
      const internals = internalsOf(read.view);
      assertAlways(
        env,
        internals?.kind === "store",
        "A store read names a store view",
      );
      assertAlways(env, internals.store === store);
      const start = Math.max(answeredAt(read), matchedThrough);
      const scan = scanOf(log, scans, store, read, internals.matches, start);
      if (scan.change === undefined) continue;
      assertAlways(env, scan.revision > start);
      return {
        kind: "hit",
        read,
        change: scan.change,
        revision: scan.revision,
      };
    }
  }
  return undefined;
}

/**
 * The first change to `store` after `start` that hits `read`, if any. Reuses the last scan
 * of `read` when it started no later and found nothing, or found a hit after `start`.
 */
function scanOf(
  log: ChangeLog,
  scans: Map<StoreRead, Scan>,
  store: StoreName,
  read: StoreRead,
  matches: Matches,
  start: number,
): Scan {
  let known = scans.get(read);
  if (known !== undefined && known.start <= start) {
    if (known.change === undefined || known.revision > start) return known;
  }
  if (known === undefined) {
    known = { start, revision: -1, change: undefined };
    scans.set(read, known);
  }
  known.start = start;
  known.revision = -1;
  known.change = undefined;
  if (start >= log.head) return known;
  for (const delivery of log.since(start, store)) {
    for (const change of delivery.changes) {
      if (!matches(read.args, change, read.footprint)) continue;
      known.revision = delivery.revision;
      known.change = change;
      return known;
    }
  }
  return known;
}
