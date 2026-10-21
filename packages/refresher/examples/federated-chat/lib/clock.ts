import type { Revision } from "../../../src/index";

/**
 * A hybrid logical clock: revisions are milliseconds since the epoch, each later than every
 * one the clock issued or observed before. Runtimes on clocks like it, on one machine, stamp
 * revisions a reader can put on one time axis, and a revision received from another runtime
 * orders before every one issued after it.
 */
export type HybridClock = {
  /** The next revision: the wall clock, or one past the latest issued or observed. */
  tick(): Revision;
  /** The wall clock, or the latest revision issued or observed if later: without issuing one. */
  now(): number;
  /** Takes in another clock's revision, as a message stamped with it arrives. */
  observe(revision: Revision): void;
};

export function createHybridClock(now: () => number = Date.now): HybridClock {
  let latest = 0;
  return {
    tick: () => (latest = Math.max(latest + 1, now())),
    now: () => Math.max(latest, now()),
    observe(revision) {
      if (revision > latest) latest = revision;
    },
  };
}
