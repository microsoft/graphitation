import { HistoryArray } from "../jsutils/historyArray";
import type { HistoryEntry } from "../forest/types";

describe("HistoryArray", () => {
  const makeEntry = (timestamp: number): HistoryEntry => ({
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
    const history = new HistoryArray(2);

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

  test("should skip storing undefined entries", () => {
    const history = new HistoryArray(2);

    history.push(undefined);

    expect(history.items).toHaveLength(0);
  });

  test("should skip storing entries when maximum size is zero", () => {
    const history = new HistoryArray(0);

    history.push(makeEntry(1));

    expect(history.items).toHaveLength(0);
  });
});
