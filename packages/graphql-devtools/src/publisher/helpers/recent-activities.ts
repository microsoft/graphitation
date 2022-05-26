import { v4 as uid } from "uuid";
import { RecentActivityRaw } from "../../types";
import { RECENT_DATA_CHANGES_TYPES } from "../../consts";

export function getRecentActivities(
  items: unknown[],
  lastIterationItems: unknown[]
): RecentActivityRaw[] | null {
  if (!lastIterationItems.length || !items.length) {
    return null;
  }

  const result = [];
  for (const value of items) {
    const searchedValueIndex = lastIterationItems.indexOf(value);
    if (searchedValueIndex === -1) {
      result.push({
        change: RECENT_DATA_CHANGES_TYPES.ADDED,
        id: uid(),
        data: value,
      });
      continue;
    } else {
      if (searchedValueIndex > 0) {
        result.push(
          ...lastIterationItems.slice(0, searchedValueIndex).map((data) => ({
            id: uid(),
            change: RECENT_DATA_CHANGES_TYPES.REMOVED,
            data,
          }))
        );
      }

      lastIterationItems.splice(0, searchedValueIndex + 1);
    }
  }
  result.push(
    ...lastIterationItems.map((data) => ({
      id: uid(),
      change: RECENT_DATA_CHANGES_TYPES.REMOVED,
      data,
    }))
  );

  return result;
}
