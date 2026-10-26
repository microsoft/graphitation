/**
 * The store contract on stale answers, which the runtime checks against its change log:
 * a store never answers from before a change it registered that its `matches` accepts for
 * the read. That change already lies behind the read, and could never restart it. See
 * `AnnotationArgs.revision`.
 */

import type { Revision } from "../api.core";
import type { Environment } from "../api.env";
import type { ExecutionState, ViewInstance } from "../api.execution";
import type { ChangeLog } from "../api.invalidation";
import type { StoreRead } from "../api.stores";
import { assertSometimes } from "../env/assert";
import { storeError, valueErrorOf } from "../errors";
import { nameOf } from "../execution/context";
import { answeredAt, isLagging, settledStale } from "../invalidation/reads";
import { internalsOf } from "../views/definitions";

/**
 * Fails, with a `STALE_ANSWER` store error, every settled instance of `state` reading a
 * store answer older than asked that breaks the contract: the store instance that read it,
 * and every instance reading that one inline, as each records the read. Each instance
 * reading an answer older than asked is checked once, in `checked`. Nothing tells once
 * `log` is trimmed past the answer.
 */
export function failStaleAnswers(
  env: Environment,
  log: ChangeLog,
  state: ExecutionState,
  checked: WeakSet<ViewInstance>,
): void {
  let broken: Map<StoreRead, unknown> | undefined;
  // `forEach` makes no entry or iterator result per instance, as `for...of` may.
  state.instances.forEach((instance) => {
    if (instance.status !== "settled") return;
    const descriptor = instance.descriptor;
    // Most read no stale answer: checking that again is cheaper than holding each in `checked`.
    if (
      descriptor === undefined ||
      !settledStale(descriptor) ||
      checked.has(instance)
    )
      return;
    checked.add(instance);
    broken ??= new Map();
    const error = firstBroken(env, log, broken, descriptor.storeReads.values());
    if (error === undefined) return;
    instance.data = null;
    instance.errors = [valueErrorOf(error, false)];
  });
}

/** What the first of `reads` answered from older state than asked that breaks the contract fails with. */
function firstBroken(
  env: Environment,
  log: ChangeLog,
  broken: Map<StoreRead, unknown>,
  reads: Iterable<readonly StoreRead[]>,
): unknown {
  for (const each of reads) {
    for (const read of each) {
      if (!isLagging(read)) continue;
      if (!broken.has(read)) broken.set(read, missedChange(env, log, read));
      const error = broken.get(read);
      if (error !== undefined) return error;
    }
  }
  return undefined;
}

/**
 * What a stale answer fails with when it breaks the contract: a change after the revision
 * it reported, through the one asked, that its store's `matches` accepts for the read.
 * None when nothing tells, as once `log` is trimmed past the reported revision.
 */
function missedChange(
  env: Environment,
  log: ChangeLog,
  read: StoreRead,
): unknown {
  const internals = internalsOf(read.view);
  const reported = answeredAt(read);
  if (internals?.kind !== "store" || reported < log.tail) return undefined;
  const through = Math.min(read.startedAt, log.head);
  if (reported >= through) return undefined;
  let missed: Revision | undefined;
  try {
    for (const delivery of log.since(reported, internals.store)) {
      if (delivery.revision > through) break;
      const hit = delivery.changes.some((change) =>
        internals.matches(read.args, change, read.footprint),
      );
      if (hit) {
        missed = delivery.revision;
        break;
      }
    }
  } catch (error) {
    return error;
  }
  if (missed === undefined) return undefined;
  assertSometimes(
    env,
    true,
    "A store answers from before a change that hit the read",
  );
  return storeError({
    code: "STALE_ANSWER",
    store: internals.store,
    message:
      `${nameOf(
        read.view,
      )} answered at revision ${reported}, before the change at ` +
      `${missed} that its store matched against the read`,
  });
}
