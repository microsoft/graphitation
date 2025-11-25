import { NormalizedCacheObject, ApolloClient } from "@apollo/client";
import { serializeHistory, ForestRun } from "@graphitation/apollo-forest-run";
import { RemplWrapper } from "../rempl-wrapper";
import { ClientObject, WrapperCallbackParams } from "../../types";

export class ApolloCachePublisher {
  private apolloPublisher;
  private remplWrapper: RemplWrapper;
  private activeClient: ClientObject | null = null;
  private lastCacheHistory: NormalizedCacheObject = {};

  constructor(remplWrapper: RemplWrapper) {
    this.remplWrapper = remplWrapper;
    this.remplWrapper.subscribeToRemplStatus(
      "apollo-cache",
      this.cachePublishHandler.bind(this),
      1500,
    );
    this.apolloPublisher = remplWrapper.publisher;
    this.attachMethodsToPublisher();
  }

  private attachMethodsToPublisher() {
    this.apolloPublisher.provide("removeCacheKey", (key: string) => {
      if (this.activeClient) {
        this.activeClient.client.cache.evict({ id: key });
      }
    });

    // Fetch history for a specific operation on-demand
    this.apolloPublisher.provide(
      "getOperationHistory",
      (operationKey: string) => {
        if (!this.activeClient) {
          return null;
        }

        try {
          const cacheInstance = this.activeClient.client.cache as ForestRun;

          // Check if this is ForestRun cache
          if (cacheInstance.store?.dataForest?.trees) {
            const trees = cacheInstance.store.dataForest.trees;

            // Find the matching tree
            for (const [, rawTree] of trees) {
              const tree = rawTree;
              const treeKey = `${tree.operation.debugName}:${tree.operation.id}`;
              if (
                treeKey === operationKey ||
                operationKey.startsWith(treeKey)
              ) {
                if (tree.history) {
                  const history = Array.from(tree.history);
                  if (history.length > 0) {
                    // Transform to JSON-friendly format and include tree operation data
                    return {
                      history: serializeHistory(history),
                      operation: {
                        name: tree.operation.debugName,
                        variables: tree.operation.variables || {},
                      },
                      totalCount: tree.history.totalEntries,
                    };
                  }
                }
              }
            }
          }
        } catch (e) {
          console.warn("Failed to get operation history:", e);
        }

        return null;
      },
    );
  }

  private getCache(client: ApolloClient<NormalizedCacheObject>) {
    return client.cache.extract(true);
  }

  private serializeCacheObject = (client?: ClientObject) => {
    if (!client) {
      return;
    }

    return this.getCache(client.client);
  };

  private cachePublishHandler({ activeClient }: WrapperCallbackParams) {
    if (!activeClient) {
      return;
    }

    const serializedCacheObject = this.serializeCacheObject(activeClient);

    if (!serializedCacheObject) {
      return;
    }

    if (this.activeClient?.clientId !== activeClient.clientId) {
      this.activeClient = activeClient;
    } else if (
      !this.hasCacheChanged(this.lastCacheHistory, serializedCacheObject)
    ) {
      return;
    }

    this.lastCacheHistory = serializedCacheObject;
    this.publishCache(serializedCacheObject);
  }

  private hasCacheChanged(
    lastCacheHistory: NormalizedCacheObject,
    currentCache: NormalizedCacheObject,
  ) {
    const cacheKeys = Object.keys(currentCache);
    if (Object.keys(lastCacheHistory).length !== cacheKeys.length) {
      return true;
    }

    return cacheKeys.some((key) => {
      if (key === "__META") {
        return false;
      }
      return currentCache[key] !== lastCacheHistory[key];
    });
  }

  public publishCache(cacheObject: NormalizedCacheObject) {
    this.apolloPublisher.ns("apollo-cache").publish(cacheObject);
    this.apolloPublisher
      .ns("apollo-cache-count")
      .publish(Object.values(cacheObject).length);
  }
}
