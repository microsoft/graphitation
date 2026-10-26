/**
 * `createChangeLog`: the runtime's change log, following `../api.invalidation`.
 *
 * Deliveries sit in one track, an array from `start` on, in revision order; each store has
 * its own track of the deliveries that changed it, holding only its changes, filled as they
 * are appended. A delivery that changed one store is shared by both tracks. Trimming moves
 * each track's `start` and compacts once most of it is dropped, so neither appending nor
 * trimming copies per call; a store whose track empties is forgotten. A delivery that
 * changed nothing is not kept. One iterator serves every scan.
 */
import type { StoreName } from "../api.core";
import type { CreateChangeLogFn, Delivery } from "../api.invalidation";
import type { Environment } from "../api.env";
import type { StoreChange } from "../api.stores";
import { assertAlways, assertSometimes } from "../env/assert";

/** Below this many dropped slots, trimming never compacts. */
const COMPACT_AFTER = 64;

const DONE: IteratorReturnResult<undefined> = Object.freeze({
  done: true,
  value: undefined,
});

/** Deliveries in revision order, from `start` on: those before it are dropped. */
type Track = {
  readonly deliveries: (Delivery | undefined)[];
  start: number;
};

const newTrack = (): Track => ({ deliveries: [], start: 0 });

/** Drops every delivery of `track` at or before `through`, and how many changes they held. */
function trimTrack(env: Environment, track: Track, through: number): number {
  const { deliveries } = track;
  let dropped = 0;
  let start = track.start;
  while (start < deliveries.length && deliveries[start]!.revision <= through) {
    dropped += deliveries[start]!.changes.length;
    deliveries[start++] = undefined;
  }
  if (start >= COMPACT_AFTER && start * 2 >= deliveries.length) {
    assertSometimes(env, true, "A change log compacts");
    deliveries.copyWithin(0, start);
    deliveries.length -= start;
    start = 0;
  }
  track.start = start;
  return dropped;
}

/** The index of the first delivery of `track` after `after`. */
function firstAfter(track: Track, after: number): number {
  const { deliveries } = track;
  let low = track.start;
  let high = deliveries.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (deliveries[middle]!.revision > after) high = middle;
    else low = middle + 1;
  }
  return low;
}

export const createChangeLog: CreateChangeLogFn = ({ env, revision }) => {
  const all = newTrack();
  const byStore = new Map<StoreName, Track>();
  const none = newTrack();
  let tail = revision;
  let head = revision;
  let size = 0;

  let source = all;
  let cursor = 0;
  let scanning = false;
  const step: { done: false; value: Delivery } = {
    done: false,
    value: Object.freeze({ revision, changes: [] }),
  };
  const scan: IterableIterator<Delivery> = {
    next: () => {
      if (cursor < source.deliveries.length) {
        scanning = true;
        step.value = source.deliveries[cursor++]!;
        return step;
      }
      scanning = false;
      return DONE;
    },
    return: () => {
      scanning = false;
      return DONE;
    },
    [Symbol.iterator]: () => scan,
  };

  const trackOf = (store: StoreName): Track => {
    let track = byStore.get(store);
    if (track === undefined) {
      track = newTrack();
      byStore.set(store, track);
    }
    return track;
  };

  /** Files each change of `delivery` in its store's track, split from the others'. */
  const fileByStore = (delivery: Delivery) => {
    const { changes } = delivery;
    const first = changes[0]!.store;
    let index = 1;
    while (index < changes.length && changes[index]!.store === first) index++;
    if (index === changes.length) {
      trackOf(first).deliveries.push(delivery);
      return;
    }
    assertSometimes(env, true, "A delivery changes several stores");
    const splits = new Map<StoreName, StoreChange[]>();
    for (const change of changes) {
      const split = splits.get(change.store);
      if (split === undefined) splits.set(change.store, [change]);
      else split.push(change);
    }
    for (const [store, split] of splits) {
      trackOf(store).deliveries.push({
        revision: delivery.revision,
        changes: split,
      });
    }
  };

  return {
    get tail() {
      return tail;
    },
    get head() {
      return head;
    },
    get size() {
      return size;
    },
    since: (after, store) => {
      assertAlways(
        env,
        !scanning,
        "A change log is scanned while another scan is under way",
      );
      assertAlways(
        env,
        tail <= after && after <= head,
        "A scan starts outside the window",
      );
      source = store === undefined ? all : byStore.get(store) ?? none;
      assertAlways(env, none.deliveries.length === 0);
      cursor = firstAfter(source, after);
      return scan;
    },
    append: (delivery) => {
      assertAlways(env, !scanning, "A change log is appended to during a scan");
      assertAlways(
        env,
        delivery.revision > head,
        "A delivery comes after the log's head",
      );
      head = delivery.revision;
      if (delivery.changes.length === 0) return;
      all.deliveries.push(delivery);
      size += delivery.changes.length;
      fileByStore(delivery);
    },
    trim: (through) => {
      assertAlways(env, !scanning, "A change log is trimmed during a scan");
      assertAlways(
        env,
        tail <= through && through <= head,
        "A trim lies outside the window",
      );
      tail = through;
      const dropped = trimTrack(env, all, through);
      size -= dropped;
      let droppedByStore = 0;
      for (const [store, track] of byStore) {
        droppedByStore += trimTrack(env, track, through);
        if (track.start === track.deliveries.length) byStore.delete(store);
      }
      assertAlways(
        env,
        droppedByStore === dropped,
        "Store tracks drop the changes the log drops",
      );
    },
  };
};
