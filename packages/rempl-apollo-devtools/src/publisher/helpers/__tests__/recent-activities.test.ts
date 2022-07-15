import {
  getRecentOperationsActivity,
  getRecentCacheActivity,
} from "../recent-activities";
import { RECENT_DATA_CHANGES_TYPES, ACTIVITY_TYPE } from "../../../consts";

jest.mock("uuid", () => ({ v4: () => "test" }));

describe(".getRecentOperationsActivity", () => {
  test("get list of recent Activity", () => {
    expect(
      getRecentOperationsActivity(
        ["test1", "test3", "test4", "test5"] as any[],
        ["test3", "test5", "test6"] as any[],
      ),
    ).toEqual([
      {
        type: ACTIVITY_TYPE.OPERATION,
        change: RECENT_DATA_CHANGES_TYPES.ADDED,
        data: "test1",
        id: "test",
      },
      {
        type: ACTIVITY_TYPE.OPERATION,
        change: RECENT_DATA_CHANGES_TYPES.ADDED,
        data: "test4",
        id: "test",
      },
      {
        type: ACTIVITY_TYPE.OPERATION,
        change: RECENT_DATA_CHANGES_TYPES.REMOVED,
        data: "test6",
        id: "test",
      },
    ]);
    expect(
      getRecentOperationsActivity(
        ["test2", "test3", "test4"] as any[],
        ["test1", "test2", "test3", "test4"] as any[],
      ),
    ).toEqual([
      {
        type: ACTIVITY_TYPE.OPERATION,
        change: RECENT_DATA_CHANGES_TYPES.REMOVED,
        data: "test1",
        id: "test",
      },
    ]);
    expect(
      getRecentOperationsActivity(
        ["test1", "test3"] as any[],
        ["test3", "test5"] as any[],
      ),
    ).toEqual([
      {
        type: ACTIVITY_TYPE.OPERATION,
        change: RECENT_DATA_CHANGES_TYPES.ADDED,
        data: "test1",
        id: "test",
      },
      {
        type: ACTIVITY_TYPE.OPERATION,
        change: RECENT_DATA_CHANGES_TYPES.REMOVED,
        data: "test5",
        id: "test",
      },
    ]);

    expect(
      getRecentOperationsActivity(
        ["test1", "test5"] as any[],
        ["test1", "test5"] as any[],
      ),
    ).toEqual([]);

    expect(
      getRecentOperationsActivity(
        ["test1"] as any[],
        ["test1", "test5"] as any[],
      ),
    ).toEqual([
      {
        type: ACTIVITY_TYPE.OPERATION,
        change: RECENT_DATA_CHANGES_TYPES.REMOVED,
        data: "test5",
        id: "test",
      },
    ]);

    expect(
      getRecentOperationsActivity(
        ["test1", "test5"] as any[],
        ["test1"] as any[],
      ),
    ).toEqual([
      {
        type: ACTIVITY_TYPE.OPERATION,
        change: RECENT_DATA_CHANGES_TYPES.ADDED,
        data: "test5",
        id: "test",
      },
    ]);

    expect(
      getRecentOperationsActivity(["test1"] as any[], ["test3"] as any[]),
    ).toEqual([
      {
        type: ACTIVITY_TYPE.OPERATION,
        change: RECENT_DATA_CHANGES_TYPES.ADDED,
        data: "test1",
        id: "test",
      },
      {
        type: ACTIVITY_TYPE.OPERATION,
        change: RECENT_DATA_CHANGES_TYPES.REMOVED,
        data: "test3",
        id: "test",
      },
    ]);
  });
});

describe(".getRecentCacheActivity", () => {
  test("when caches are the same the result should be empty", () => {
    const cache = {
      "car:123": { id: 123, name: "mercedes" },
    };
    expect(getRecentCacheActivity(cache, cache)).toEqual([]);
  });
  test("when caches are the same the result should be empty", () => {
    const cache = {
      "car:123": { id: 123, name: "mercedes" },
    };
    const oldCache = {
      "car:789": { id: 789, name: "audi" },
    };
    expect(getRecentCacheActivity(cache, oldCache)).toEqual([
      {
        type: ACTIVITY_TYPE.CACHE,
        change: "added",
        data: {
          cacheValue: {
            id: 123,
            name: "mercedes",
          },
          key: "car:123",
        },
        id: "test",
      },
      {
        type: ACTIVITY_TYPE.CACHE,
        change: "removed",
        data: {
          cacheValue: {
            id: 789,
            name: "audi",
          },
          key: "car:789",
        },
        id: "test",
      },
    ]);

    expect(getRecentCacheActivity({ ...cache, ...oldCache }, oldCache)).toEqual(
      [
        {
          type: ACTIVITY_TYPE.CACHE,
          change: "added",
          data: {
            cacheValue: {
              id: 123,
              name: "mercedes",
            },
            key: "car:123",
          },
          id: "test",
        },
      ],
    );
  });
});
