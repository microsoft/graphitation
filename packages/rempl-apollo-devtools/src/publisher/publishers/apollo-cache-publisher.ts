import { NormalizedCacheObject, ApolloClient } from "@apollo/client";
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
