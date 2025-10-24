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
                if (tree.history && typeof tree.history.getAll === "function") {
                  const history = tree.history.getAll();
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

  private serializeHistory(history: any[], treeOperation?: any): any[] {
    // Transform history entries to JSON-safe format
    return history.map((entry, index) => {
      const serialized: any = {
        timestamp: entry.timestamp,
        missingFields: this.serializeMissingFields(entry.missingFields),
        current: {
          result: entry.current?.result,
        },
        incoming: {
          result: entry.incoming?.result,
          operation: entry.incoming?.operation
            ? {
                debugName: entry.incoming.operation.debugName,
                definition: entry.incoming.operation.definition,
                variables: entry.incoming.operation.variables,
                variablesWithDefaults:
                  entry.incoming.operation.variablesWithDefaults,
              }
            : // Fallback to tree operation for the first entry if no incoming operation
            index === 0 && treeOperation
            ? {
                debugName: treeOperation.debugName,
                definition: treeOperation.definition,
                variables: treeOperation.variables,
                variablesWithDefaults: treeOperation.variablesWithDefaults,
              }
            : undefined,
        },
        updated: {
          result: entry.updated?.result,
          changes: this.serializeChanges(entry.updated?.changes),
        },
      };
      return serialized;
    });
  }

  private serializeMissingFields(missingFieldsMap: any): any {
    if (!missingFieldsMap || !(missingFieldsMap instanceof Map)) {
      return null;
    }

    // MissingFieldsMap is Map<SourceObject, Set<FieldInfo>>
    // Convert to array of { objectKey, fields }
    const result: any[] = [];
    missingFieldsMap.forEach((fieldInfoSet: any, sourceObject: any) => {
      if (fieldInfoSet instanceof Set && fieldInfoSet.size > 0) {
        const fields = Array.from(fieldInfoSet).map((fieldInfo: any) => ({
          name: fieldInfo.name,
          dataKey: fieldInfo.dataKey,
        }));

        // Try to identify the object (by __typename or first few fields)
        const objectIdentifier = this.getObjectIdentifier(sourceObject);

        result.push({
          objectIdentifier,
          fields,
        });
      }
    });

    return result.length > 0 ? result : null;
  }

  private getObjectIdentifier(obj: any): string {
    if (!obj || typeof obj !== "object") {
      return "unknown";
    }

    // Try __typename first
    if (obj.__typename) {
      // Try to include id or key if available
      if (obj.id !== undefined) {
        return `${obj.__typename}:${obj.id}`;
      }
      if (obj.key !== undefined) {
        return `${obj.__typename}:${obj.key}`;
      }
      return obj.__typename;
    }

    // Fallback to object keys
    const keys = Object.keys(obj).slice(0, 3).join(", ");
    return `{ ${keys} }`;
  }

  private serializeChanges(changesMap: any): any {
    if (!changesMap) {
      return null;
    }

    // Convert Map to array of serialized entries for JSON serialization
    if (changesMap instanceof Map) {
      const result: any[] = [];
      changesMap.forEach((value, key) => {
        // Key is ObjectChunk or CompositeListChunk - serialize relevant properties
        const serializedKey = {
          kind: key.kind,
          operation: key.operation?.debugName,
          key: key.key || undefined,
          type: key.type || undefined,
          missingItems: key.missingItems
            ? Array.from(key.missingItems)
            : undefined,
          partialItems: key.partialItems
            ? Array.from(key.partialItems)
            : undefined,
        };

        // Value is either FieldChange[] for objects or array with list item changes
        let serializedValue;
        if (Array.isArray(value)) {
          if (value.length > 0 && value[0]?.fieldInfo) {
            // Object changes: array of FieldChange with fieldInfo
            serializedValue = value.map((change: any) => ({
              kind: change.kind,
              fieldName: change.fieldInfo?.name,
              dataKey: change.fieldInfo?.dataKey,
              oldValue: this.serializeGraphValue(change.oldValue),
              newValue: this.serializeGraphValue(change.newValue),
              newSize: change.newSize,
            }));
          } else if (value.length > 0 && "index" in value[0]) {
            // List item changes: array of { index: number, data: ObjectDraft, missingFields?: MissingFieldsMap }
            serializedValue = value.map((item: any) => ({
              index: item.index,
              data: this.serializeObjectDraft(item.data),
              missingFields: item.missingFields
                ? this.serializeMissingFields(item.missingFields)
                : undefined,
            }));
          } else {
            // Empty array or unknown format
            serializedValue = value;
          }
        } else if (value === null) {
          // List layout change without specific items
          serializedValue = null;
        } else {
          serializedValue = value;
        }

        result.push({
          chunk: serializedKey,
          changes: serializedValue,
        });
      });
      return result;
    }

    return changesMap;
  }

  private serializeGraphValue(value: any): any {
    if (!value || typeof value !== "object") {
      return value;
    }

    // Handle GraphValue types (ObjectValue, CompositeListValue, etc.)
    if (value.kind !== undefined) {
      const result: any = {
        kind: value.kind,
      };

      if (value.data !== undefined) {
        // Try to safely serialize data, but avoid circular references
        try {
          result.data = JSON.parse(JSON.stringify(value.data));
        } catch {
          result.data = "[Circular or Complex Data]";
        }
      }

      if (value.key !== undefined && value.key !== false) {
        result.key = value.key;
      }

      if (value.type !== undefined && value.type !== false) {
        result.type = value.type;
      }

      return result;
    }

    // Fallback: try to serialize as-is
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return "[Complex Object]";
    }
  }

  private serializeObjectDraft(draft: any): any {
    if (!draft || typeof draft !== "object") {
      return draft;
    }

    // ObjectDraft is essentially a SourceObject (plain object with data)
    // Try to serialize it safely
    try {
      return JSON.parse(JSON.stringify(draft));
    } catch {
      return "[Circular Reference]";
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
