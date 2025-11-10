import { NormalizedCacheObject, ApolloClient } from "@apollo/client";
import { RemplWrapper } from "../rempl-wrapper";
import { ClientObject, WrapperCallbackParams } from "../../types";
import type {
  HistoryEntry,
  NodeDiff,
  FieldState,
  MissingFieldInfo,
} from "../../history/types";

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
          const cacheInstance = this.activeClient.client.cache as any;

          // Check if this is ForestRun cache
          if (cacheInstance.store?.dataForest?.trees) {
            const trees = cacheInstance.store.dataForest.trees;

            // Find the matching tree
            for (const [, tree] of trees) {
              const treeKey = `${tree.operation.debugName}:${tree.operation.id}`;
              if (
                treeKey === operationKey ||
                operationKey.startsWith(treeKey)
              ) {
                if (tree.history) {
                  const history = tree.history.items.sort(
                    (a: any, b: any) => a.timestamp - b.timestamp,
                  );
                  if (history && history.length > 0) {
                    // Transform to JSON-friendly format and include tree operation data
                    return this.serializeHistory(history, tree.operation);
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

  /**
   * Serialize history entries from Forest Run to JSON-safe format
   * Forest Run already provides clean data structures, so minimal processing needed
   */
  private serializeHistory(
    history: any[],
    treeOperation?: any,
  ): HistoryEntry[] {
    return history.map((entry) => {
      const base = {
        timestamp: entry.timestamp,
        modifyingOperation: entry.modifyingOperation || {
          name: "Anonymous Operation",
          variables: {},
        },
        data: entry.data
          ? {
              current: entry.data.current,
              incoming: entry.data.incoming,
              updated: entry.data.updated,
            }
          : undefined,
        missingFields: this.serializeMissingFields(entry.missingFields),
      };

      if (entry.kind === "Regular") {
        return {
          ...base,
          kind: "Regular" as const,
          changes: this.serializeChanges(entry.changes),
        };
      } else {
        // Optimistic entry
        return {
          ...base,
          kind: "Optimistic" as const,
          nodeDiffs: this.serializeNodeDiffs(entry.nodeDiffs),
          updatedNodes: entry.updatedNodes || [],
        };
      }
    });
  }

  /**
   * Serialize field changes - already in good shape from Forest Run
   */
  private serializeChanges(changes: any[]): any[] {
    if (!Array.isArray(changes)) {
      return [];
    }

    return changes.map((change) => ({
      kind: change.kind,
      path: change.path || [],
      fieldInfo: change.fieldInfo,
      oldValue: change.oldValue,
      newValue: change.newValue,
      itemChanges: change.itemChanges,
    }));
  }

  /**
   * Serialize node diffs for optimistic updates
   */
  private serializeNodeDiffs(
    nodeDiffs: Map<string, any> | undefined,
  ): NodeDiff[] {
    if (!nodeDiffs) {
      return [];
    }

    const result: NodeDiff[] = [];
    nodeDiffs.forEach((diff, nodeKey) => {
      const fieldState: FieldState[] = [];

      if (diff.fieldState instanceof Map) {
        diff.fieldState.forEach((state: any, fieldKey: string) => {
          fieldState.push({
            fieldKey,
            kind: state.kind,
            oldValue: state.oldValue,
            newValue: state.newValue,
            fieldEntry: state.fieldEntry,
          });
        });
      }

      result.push({
        nodeKey,
        kind: diff.kind,
        complete: diff.complete,
        dirtyFields: diff.dirtyFields
          ? Array.from(diff.dirtyFields)
          : undefined,
        fieldState: fieldState.length > 0 ? fieldState : undefined,
      });
    });

    return result;
  }

  /**
   * Serialize missing fields information
   */
  private serializeMissingFields(
    missingFieldsMap: any,
  ): MissingFieldInfo[] | undefined {
    if (!missingFieldsMap || !(missingFieldsMap instanceof Map)) {
      return undefined;
    }

    const result: MissingFieldInfo[] = [];
    missingFieldsMap.forEach((fieldInfoSet: any, sourceObject: any) => {
      if (fieldInfoSet instanceof Set && fieldInfoSet.size > 0) {
        const fields = Array.from(fieldInfoSet).map((fieldInfo: any) => ({
          name: fieldInfo.name,
          dataKey: fieldInfo.dataKey,
        }));

        result.push({
          objectIdentifier: this.getObjectIdentifier(sourceObject),
          fields,
        });
      }
    });

    return result.length > 0 ? result : undefined;
  }

  /**
   * Get a human-readable identifier for a cache object
   */
  private getObjectIdentifier(obj: any): string {
    if (!obj || typeof obj !== "object") {
      return "unknown";
    }

    if (obj.__typename) {
      if (obj.id !== undefined) {
        return `${obj.__typename}:${obj.id}`;
      }
      if (obj.key !== undefined) {
        return `${obj.__typename}:${obj.key}`;
      }
      return obj.__typename;
    }

    const keys = Object.keys(obj).slice(0, 3).join(", ");
    return `{ ${keys} }`;
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
