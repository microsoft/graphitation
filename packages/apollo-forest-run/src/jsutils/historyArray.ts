import type {
  ChangedChunksMap,
  HistoryEntry,
  IndexedTree,
  UpdateTreeResult,
} from "../forest/types";
import type { VariableValues } from "../descriptor/types";
import type { MissingFieldsMap } from "../values/types";
import { getDataPathForDebugging, createParentLocator } from "../values";

export class HistoryArray {
  private items: HistoryEntry[] = [];
  private head = 0;
  private maxSize: number;
  private isEnabled: boolean;
  private isDataHistoryEnabled: boolean;

  constructor(
    maxSize: number,
    isEnabled = false,
    isDataHistoryEnabled = false,
  ) {
    this.maxSize = maxSize;
    this.isEnabled = isEnabled;
    this.isDataHistoryEnabled = isDataHistoryEnabled;
  }

  push(
    currentTree: IndexedTree,
    updatedTree: UpdateTreeResult,
    incomingResult?: IndexedTree,
  ): void {
    if (!this.isEnabled || this.maxSize <= 0) {
      return;
    }
    const changedFields: Array<any> = [];

    const findParent = createParentLocator(currentTree.dataMap);

    for (const [chunk, fieldChanges] of updatedTree.changes) {
      const chunkPath = getDataPathForDebugging({ findParent }, chunk);

      for (const fieldChange of fieldChanges) {
        const fieldPath = [
          ...chunkPath,
          fieldChange?.fieldInfo?.dataKey ?? fieldChange.index,
        ];

        changedFields.push({
          path: fieldPath,
          ...fieldChange,
        });
      }
    }

    const item: HistoryEntry = {
      timestamp: Date.now(),
      missingFields: updatedTree.missingFields,
      changes: changedFields,
      data: this.isDataHistoryEnabled
        ? {
            current: currentTree.result,
            incoming: incomingResult?.result,
            updated: updatedTree.updatedTree.result,
          }
        : undefined,
    };

    if (this.items.length <= this.maxSize) {
      this.items.push(item);
    } else {
      this.items[this.head] = item;
      this.head = (this.head + 1) % this.maxSize;
    }
  }

  getAll() {
    return this.items;
  }

  // TODO: Add some meaningful transformation
  get summary() {
    if (this.items.length === 0) {
      return null;
    }

    const summaryArray: {
      timestamp: number;
      operation: {
        debugName: string;
        variablesWithDefaults: VariableValues;
      };
      missingFields: MissingFieldsMap;
      changes: Array<{
        path: (string | number)[];
        fieldName: string;
        changeKind: "Replacement" | "Filler" | "CompositeListDifference";
      }>;
    }[] = [];

    for (const change of this.items) {
      summaryArray.push({
        timestamp: change.timestamp,
        operation: {
          debugName:
            change.incoming?.operation?.debugName || "Anonymous Operation",
          variablesWithDefaults:
            change.incoming?.operation?.variablesWithDefaults || {},
        },
        missingFields: change.missingFields,
        changes: change.updated.changes,
      });
    }

    return summaryArray;
  }
}
