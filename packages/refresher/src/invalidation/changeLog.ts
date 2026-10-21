/**
 * `createChangeLog`: the runtime's change log, following `../api.invalidation`.
 *
 * Deliveries sit in one array from `start` on, in revision order; trimming moves `start`
 * and compacts once most of the array is dropped, so neither appending nor trimming copies
 * per call. A delivery that changed nothing is not kept. One iterator serves every scan.
 */
import type { CreateChangeLogFn, Delivery } from "../api.invalidation";
import { assertAlways, assertSometimes } from "../env/assert";

/** Below this many dropped slots, trimming never compacts. */
const COMPACT_AFTER = 64;

const DONE: IteratorReturnResult<undefined> = Object.freeze({
  done: true,
  value: undefined,
});

export const createChangeLog: CreateChangeLogFn = ({ env, revision }) => {
  const deliveries: (Delivery | undefined)[] = [];
  let start = 0;
  let tail = revision;
  let head = revision;
  let size = 0;

  let cursor = 0;
  let scanning = false;
  const step: { done: false; value: Delivery } = {
    done: false,
    value: Object.freeze({ revision, changes: [] }),
  };
  const scan: IterableIterator<Delivery> = {
    next: () => {
      if (cursor < deliveries.length) {
        scanning = true;
        step.value = deliveries[cursor++]!;
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

  /** The index of the first kept delivery after `after`. */
  function firstAfter(after: number): number {
    let low = start;
    let high = deliveries.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (deliveries[middle]!.revision > after) high = middle;
      else low = middle + 1;
    }
    return low;
  }

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
    since: (after) => {
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
      cursor = firstAfter(after);
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
      deliveries.push(delivery);
      size += delivery.changes.length;
    },
    trim: (through) => {
      assertAlways(env, !scanning, "A change log is trimmed during a scan");
      assertAlways(
        env,
        tail <= through && through <= head,
        "A trim lies outside the window",
      );
      tail = through;
      while (
        start < deliveries.length &&
        deliveries[start]!.revision <= through
      ) {
        size -= deliveries[start]!.changes.length;
        deliveries[start++] = undefined;
      }
      if (start >= COMPACT_AFTER && start * 2 >= deliveries.length) {
        assertSometimes(env, true, "A change log compacts");
        deliveries.copyWithin(0, start);
        deliveries.length -= start;
        start = 0;
      }
    },
  };
};
