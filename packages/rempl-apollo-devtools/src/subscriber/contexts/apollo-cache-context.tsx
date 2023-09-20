import React from "react";
import { NormalizedCacheObject } from "@apollo/client/cache";
import { remplSubscriber } from "../rempl";

export type ApolloCacheContextType = {
  removeCacheItem: (key: string) => void;
  cache: NormalizedCacheObject;
} | null;

export const ApolloCacheContext =
  React.createContext<ApolloCacheContextType>(null);

export const ApolloCacheContextWrapper = ({
  children,
}: {
  children: JSX.Element;
}) => {
  const [cache, setCache] = React.useState<NormalizedCacheObject>({});

  React.useEffect(() => {
    remplSubscriber
      .ns("apollo-cache")
      .subscribe(function (data: NormalizedCacheObject) {
        if (data) {
          setCache(data);
        }
      });
  }, []);

  const removeCacheItem = React.useCallback(
    (key: string) => {
      setCache(removeKeyFromCacheState(key, cache));
      remplSubscriber.callRemote("removeCacheKey", key);
    },
    [cache],
  );

  return (
    <ApolloCacheContext.Provider
      value={{
        cache,
        removeCacheItem,
      }}
    >
      {children}
    </ApolloCacheContext.Provider>
  );
};

function removeKeyFromCacheState(
  key: string,
  cacheState: NormalizedCacheObject,
): NormalizedCacheObject {
  return Object.keys(cacheState)
    .filter((cacheKey: string) => cacheKey !== key)
    .reduce((acc: NormalizedCacheObject, key: string) => {
      acc[key] = cacheState[key];
      return acc;
    }, {});
}
