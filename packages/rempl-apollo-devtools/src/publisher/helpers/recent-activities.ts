import { v4 as uid } from "uuid";
import {
  RecentActivityRaw,
  WatchedQuery,
  Mutation,
  RecentActivity,
  CacheStoreObject,
} from "../../types";
import { RECENT_DATA_CHANGES_TYPES, ACTIVITY_TYPE } from "../../consts";
import { NormalizedCacheObject } from "@apollo/client";

export function getRecentOperationsActivity(
  items: WatchedQuery[] | Mutation[],
  lastIterationItems: WatchedQuery[] | Mutation[],
): RecentActivityRaw[] | null {
  if (!lastIterationItems.length || !items.length) {
    return null;
  }

  const result = [];
  for (const value of items) {
    const searchedValueIndex = lastIterationItems.indexOf(value as any);
    if (searchedValueIndex === -1) {
      result.push({
        change: RECENT_DATA_CHANGES_TYPES.ADDED,
        id: uid(),
        type: ACTIVITY_TYPE.OPERATION,
        data: value,
      });
      continue;
    } else {
      if (searchedValueIndex > 0) {
        result.push(
          ...lastIterationItems
            .slice(0, searchedValueIndex)
            .map((data: WatchedQuery | Mutation) => ({
              id: uid(),
              change: RECENT_DATA_CHANGES_TYPES.REMOVED,
              type: ACTIVITY_TYPE.OPERATION,
              data,
            })),
        );
      }

      lastIterationItems.splice(0, searchedValueIndex + 1);
    }
  }
  result.push(
    ...lastIterationItems.map((data) => ({
      id: uid(),
      change: RECENT_DATA_CHANGES_TYPES.REMOVED,
      type: ACTIVITY_TYPE.OPERATION,
      data,
    })),
  );

  return result;
}

const IGNORED_KEYS = new Map([["__META", true]]);

export function getRecentCacheActivity(
  cache: NormalizedCacheObject,
  previousCache: NormalizedCacheObject,
): RecentActivity<CacheStoreObject>[] | null {
  if (!Object.keys(cache).length || !Object.keys(previousCache).length) {
    return null;
  }

  const cacheEntries = Object.entries(cache);
  const previousCacheMap = new Map(Object.entries(previousCache));
  const previousCacheValues = Object.values(previousCache);

  const result = [];

  for (const [key, value] of cacheEntries) {
    if (IGNORED_KEYS.has(key)) {
      if (previousCacheMap.has(key)) {
        previousCacheMap.delete(key);
      }
      continue;
    }

    const searchedValueIndex = previousCacheValues.indexOf(value);
    if (searchedValueIndex === -1) {
      if (previousCacheMap.has(key)) {
        previousCacheMap.delete(key);
        result.push({
          id: uid(),
          change: RECENT_DATA_CHANGES_TYPES.CHANGED,
          type: ACTIVITY_TYPE.CACHE,
          data: { __activity_key: key, cacheValue: value },
        });
        continue;
      }
      result.push({
        id: uid(),
        change: RECENT_DATA_CHANGES_TYPES.ADDED,
        type: ACTIVITY_TYPE.CACHE,
        data: { __activity_key: key, cacheValue: value },
      });
    } else {
      previousCacheMap.delete(key);
    }
  }

  for (const [key, value] of previousCacheMap.entries()) {
    result.push({
      id: uid(),
      change: RECENT_DATA_CHANGES_TYPES.REMOVED,
      type: ACTIVITY_TYPE.CACHE,
      data: { __activity_key: key, cacheValue: value },
    });
  }

  return result;
}
