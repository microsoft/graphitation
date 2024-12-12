import { NormalizedCacheObject, ApolloClient } from "@apollo/client";
import { RemplWrapper } from "../rempl-wrapper";
import {
  ClientObject,
  ForestRunStoreObject,
  WrapperCallbackParams,
} from "../../types";

export class ApolloCachePublisher {
  private apolloPublisher;
  private remplWrapper: RemplWrapper;
  private activeClient: ClientObject | null = null;
  private lastCacheHistory: NormalizedCacheObject = {};
  private lastForestRunCacheHistory: Record<string, ForestRunStoreObject> = {};

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
  }

  private getForrestRunCache(client: any) {
    const { dataForest } = client.cache.store;

    const output: Record<string, ForestRunStoreObject> = {};
    for (const [_, value] of dataForest.trees.entries()) {
      output[`${value.operation.debugName}:${value.operation.id}`] = {
        id: value.operation.id,
        data: value.result?.data,
        variables: value.operation.variables,
      };
    }

    return output;
  }

  private isForestRunCache(cache: any): cache is unknown {
    return !!(cache as any)?.store?.dataForest;
  }

  private getCache(client: ApolloClient<NormalizedCacheObject>) {
    if (this.isForestRunCache(client.cache)) {
      return this.getForrestRunCache(client);
    } else {
      return (client.cache as ApolloClient<NormalizedCacheObject>).extract();
    }
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
      !this.isForestRunCache(this.activeClient.client.cache) &&
      !this.hasCacheChanged(this.lastCacheHistory, serializedCacheObject)
    ) {
      return;
    } else if (
      this.isForestRunCache(this.activeClient.client.cache) &&
      !this.hasForestRunCacheChanged(
        this.lastForestRunCacheHistory,
        serializedCacheObject as Record<string, ForestRunStoreObject>,
      )
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

  private hasForestRunCacheChanged(
    lastCacheHistory: Record<string, ForestRunStoreObject>,
    currentCache: Record<string, ForestRunStoreObject>,
  ) {
    const cacheKeys = Object.keys(currentCache);
    if (Object.keys(lastCacheHistory).length !== cacheKeys.length) {
      return true;
    }

    return cacheKeys.some((key) => {
      return currentCache[key]?.id !== lastCacheHistory[key]?.id;
    });
  }

  public publishCache(cacheObject: NormalizedCacheObject) {
    this.apolloPublisher.ns("apollo-cache").publish(cacheObject);
    this.apolloPublisher
      .ns("apollo-cache-count")
      .publish(Object.values(cacheObject).length);
  }
}
