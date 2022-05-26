import React from "react";
import { NormalizedCacheObject } from "@apollo/client/cache";
import { ClientCacheObject } from "../../types";
import { remplSubscriber } from "../rempl";

export type ApolloCacheContextType = {
  removeCacheItem: (key: string) => void;
  recordRecentCacheChanges: (shouldRecord: boolean) => void;
  clearRecentCacheChanges: () => void;
  cacheObjects: ClientCacheObject;
} | null;

export const ApolloCacheContext =
  React.createContext<ApolloCacheContextType>(null);

export const ApolloCacheContextWrapper = ({
  children,
}: {
  children: JSX.Element;
}) => {
  const [cacheObjects, setCacheObjects] = React.useState<ClientCacheObject>({
    recentCache: {},
    cache: {},
  });

  React.useEffect(() => {
    remplSubscriber
      .ns("apollo-cache")
      .subscribe(function (data: ClientCacheObject) {
        if (data) {
          setCacheObjects(data);
        }
      });
  }, []);

  const removeCacheItem = React.useCallback(
    (key: string) => {
      const cacheObjectsToModify = {
        ...cacheObjects,
        cache: removeKeyFromCacheState(key, cacheObjects.cache),
      };

      setCacheObjects(cacheObjectsToModify);
      remplSubscriber.callRemote("removeCacheKey", key);
    },
    [cacheObjects]
  );

  const clearRecentCacheChanges = React.useCallback(() => {
    const cacheObjectsToModify = {
      ...cacheObjects,
      recentCache: {},
    };

    setCacheObjects(cacheObjectsToModify);
    remplSubscriber.callRemote("clearRecent");
  }, [cacheObjects]);

  const recordRecentCacheChanges = React.useCallback(
    (shouldRecord: boolean) => {
      remplSubscriber.callRemote("recordRecent", {
        shouldRecord,
      });
    },
    [cacheObjects]
  );

  return (
    <ApolloCacheContext.Provider
      value={{
        cacheObjects,
        removeCacheItem,
        clearRecentCacheChanges,
        recordRecentCacheChanges,
      }}
    >
      {children}
    </ApolloCacheContext.Provider>
  );
};

function removeKeyFromCacheState(
  key: string,
  cacheState: NormalizedCacheObject
): NormalizedCacheObject {
  return Object.keys(cacheState)
    .filter((cacheKey: string) => cacheKey !== key)
    .reduce((acc: NormalizedCacheObject, key: string) => {
      acc[key] = cacheState[key];
      return acc;
    }, {});
}
