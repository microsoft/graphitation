import { NormalizedCacheObject, StoreObject } from "@apollo/client";
import isEqual from "lodash.isequal";
import { CacheDuplicates, ApolloKeyFields } from "../../types";

function getObjectWithoutKeyFields(
  cacheItem: StoreObject,
  keyFields?: string[]
): StoreObject {
  const cacheItemWithoutKeyFields: StoreObject = {};
  for (const [key, value] of Object.entries(cacheItem)) {
    if (keyFields && keyFields.includes(key)) {
      continue;
    } else if (!keyFields && key === "id") {
      continue;
    }

    cacheItemWithoutKeyFields[key] = value;
  }

  return cacheItemWithoutKeyFields;
}

function getObjectTypeDuplicates(
  objectTypeItems: Record<string, StoreObject>,
  keyFields?: string[]
) {
  const duplicateItems = [];
  const cacheItemKeys = new Set(Object.keys(objectTypeItems));

  for (const cacheItemKey of cacheItemKeys) {
    const keySet = new Set<string>();

    for (const cacheItemKey2 of cacheItemKeys) {
      if (
        cacheItemKey !== cacheItemKey2 &&
        isEqual(
          getObjectWithoutKeyFields(objectTypeItems[cacheItemKey], keyFields),
          getObjectWithoutKeyFields(objectTypeItems[cacheItemKey2], keyFields)
        )
      ) {
        keySet.add(cacheItemKey);
        keySet.add(cacheItemKey2);
        cacheItemKeys.delete(cacheItemKey2);
      }
    }

    cacheItemKeys.delete(cacheItemKey);

    if (keySet.size > 1) {
      const objectDuplicates = Object.create(null);

      for (const key of keySet) {
        objectDuplicates[key] = objectTypeItems[key];
      }

      duplicateItems.push(objectDuplicates);
    }
  }

  return duplicateItems;
}

export function getClientCacheDuplicates(
  cache: NormalizedCacheObject,
  apolloKeyFields?: ApolloKeyFields
): CacheDuplicates {
  const groupedItems = groupByType(cache);
  const duplicateItems = [];

  for (const objectType of Object.keys(groupedItems)) {
    if (Object.keys(groupedItems[objectType]).length > 1) {
      const keyFields = apolloKeyFields && apolloKeyFields[objectType];

      const objectTypeDuplicates = getObjectTypeDuplicates(
        groupedItems[objectType],
        keyFields
      );

      for (const duplicates of objectTypeDuplicates) {
        duplicateItems.push({ type: objectType, duplicates });
      }
    }
  }

  return duplicateItems;
}

function groupByType(cache: NormalizedCacheObject) {
  const groupedItems: { [key: string]: { [key: string]: StoreObject } } = {};
  for (const [cacheItemKey, value] of Object.entries(cache)) {
    const objectType = cacheItemKey.split(":")[0];

    if (value === undefined) {
      continue;
    }

    if (!groupedItems[objectType]) {
      groupedItems[objectType] = Object.create(null);
    }

    groupedItems[objectType][cacheItemKey] = value;
  }

  return groupedItems;
}
