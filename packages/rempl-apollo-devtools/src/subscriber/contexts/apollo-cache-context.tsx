import * as React from "react";
import { NormalizedCacheObject } from "@apollo/client/cache";
import { remplSubscriber } from "../rempl";
import type { OperationHistoryResponse } from "../types";

export type ApolloCacheContextType = {
  removeCacheItem: (key: string) => void;
  getOperationHistory: (
    operationKey: string,
  ) => Promise<OperationHistoryResponse | null>;
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

  const getOperationHistory = React.useCallback(
    async (operationKey: string): Promise<OperationHistoryResponse | null> => {
      return new Promise((resolve) => {
        remplSubscriber.callRemote(
          "getOperationHistory",
          operationKey,
          (history: OperationHistoryResponse | null) => {
            resolve(history);
          },
        );
      });
    },
    [], // No dependencies - this function is stable
  );

  const contextValue = React.useMemo(
    () => ({
      cache,
      removeCacheItem,
      getOperationHistory,
    }),
    [cache, removeCacheItem, getOperationHistory],
  );

  return (
    <ApolloCacheContext.Provider value={contextValue}>
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
