import type {
  ChangeFeed,
  Revision,
  StoreChangeListener,
} from "../../../src/index";
import type { HybridClock } from "./clock";

/**
 * One feed for several sources, as a runtime follows only one. Each delivery from any source
 * is the next revision of `clock`, and the sources' own revisions are dropped. Subscribes to
 * the sources once, when created.
 */
export function mergeFeeds(
  sources: readonly ChangeFeed[],
  clock: HybridClock,
): ChangeFeed {
  const listeners = new Set<StoreChangeListener>();
  let revision: Revision = clock.tick();
  let ready = false;
  for (const source of sources) {
    source.subscribe((changes) => {
      // Each source announces its own revision as it is subscribed: nothing changed yet.
      if (!ready) return;
      revision = clock.tick();
      for (const listener of listeners) listener(changes, revision);
    });
  }
  ready = true;
  return {
    subscribe(listener) {
      listeners.add(listener);
      listener([], revision);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
