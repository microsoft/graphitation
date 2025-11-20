import { CircularBuffer } from "../jsutils/circularBuffer";
import type { HistoryChange } from "../forest/types";

describe("CircularBuffer", () => {
  const makeEntry = (timestamp: number): HistoryChange => ({
    kind: "Regular",
    changes: [],
    missingFields: new Map(),
    timestamp,
    modifyingOperation: {
      name: `operation-${timestamp}`,
      variables: {},
    },
    data: undefined,
  });

  test("should evict the oldest entry when capacity is exceeded", () => {
    const history = new CircularBuffer<HistoryChange>(2);

    const entry1 = makeEntry(1);
    const entry2 = makeEntry(2);
    const entry3 = makeEntry(3);
    const entry4 = makeEntry(4);

    history.push(entry1);
    history.push(entry2);
    history.push(entry3);
    history.push(entry4);

    expect(new Set(history.items)).toEqual(new Set([entry3, entry4]));
  });

  test("should skip storing entries when maximum size is zero", () => {
    const history = new CircularBuffer<HistoryChange>(0);

    history.push(makeEntry(1));

    expect(history.items).toHaveLength(0);
  });

  test("should be iterable and return items in chronological order", () => {
    const history = new CircularBuffer<HistoryChange>(3);

    const entry1 = makeEntry(1);
    const entry2 = makeEntry(2);
    const entry3 = makeEntry(3);
    const entry4 = makeEntry(4);

    history.push(entry1);
    history.push(entry2);
    history.push(entry3);

    // Before overflow
    expect([...history]).toEqual([entry1, entry2, entry3]);

    // After overflow - oldest entry (entry1) should be replaced
    history.push(entry4);
    expect([...history]).toEqual([entry2, entry3, entry4]);
  });

  test("should support Array.from() compatibility", () => {
    const history = new CircularBuffer<HistoryChange>(2);

    const entry1 = makeEntry(1);
    const entry2 = makeEntry(2);

    history.push(entry1);
    history.push(entry2);

    const array = Array.from(history);
    expect(array).toEqual([entry1, entry2]);
  });
});
