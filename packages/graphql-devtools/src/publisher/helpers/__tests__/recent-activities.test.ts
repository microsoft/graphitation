import { getRecentActivities } from "../recent-activities";
import { RECENT_DATA_CHANGES_TYPES } from "../../../consts";

jest.mock("uid", () => ({ uid: () => "test" }));

describe(".getRecentActivities", () => {
  it("get list of recent activities", () => {
    expect(
      getRecentActivities(
        ["test1", "test3", "test4", "test5"],
        ["test3", "test5", "test6"]
      )
    ).toEqual([
      { change: RECENT_DATA_CHANGES_TYPES.ADDED, data: "test1", id: "test" },
      { change: RECENT_DATA_CHANGES_TYPES.ADDED, data: "test4", id: "test" },
      { change: RECENT_DATA_CHANGES_TYPES.REMOVED, data: "test6", id: "test" },
    ]);
    expect(
      getRecentActivities(
        ["test2", "test3", "test4"],
        ["test1", "test2", "test3", "test4"]
      )
    ).toEqual([
      { change: RECENT_DATA_CHANGES_TYPES.REMOVED, data: "test1", id: "test" },
    ]);
    expect(getRecentActivities(["test1", "test3"], ["test3", "test5"])).toEqual(
      [
        { change: RECENT_DATA_CHANGES_TYPES.ADDED, data: "test1", id: "test" },
        {
          change: RECENT_DATA_CHANGES_TYPES.REMOVED,
          data: "test5",
          id: "test",
        },
      ]
    );

    expect(getRecentActivities(["test1", "test5"], ["test1", "test5"])).toEqual(
      []
    );

    expect(getRecentActivities(["test1"], ["test1", "test5"])).toEqual([
      { change: RECENT_DATA_CHANGES_TYPES.REMOVED, data: "test5", id: "test" },
    ]);

    expect(getRecentActivities(["test1", "test5"], ["test1"])).toEqual([
      { change: RECENT_DATA_CHANGES_TYPES.ADDED, data: "test5", id: "test" },
    ]);

    expect(getRecentActivities(["test1"], ["test3"])).toEqual([
      { change: RECENT_DATA_CHANGES_TYPES.ADDED, data: "test1", id: "test" },
      { change: RECENT_DATA_CHANGES_TYPES.REMOVED, data: "test3", id: "test" },
    ]);
  });
});
