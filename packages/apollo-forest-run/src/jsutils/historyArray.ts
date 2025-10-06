import type {
  ChangedChunksMap,
  HistoryEntry,
  IndexedTree,
  UpdateTreeResult,
} from "../forest/types";
import type { VariableValues } from "../descriptor/types";
import type { MissingFieldsMap } from "../values/types";

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
    const item: HistoryEntry = {
      timestamp: Date.now(),
      missingFields: updatedTree.missingFields,
      current: {
        result: this.isDataHistoryEnabled ? currentTree.result : undefined,
      },
      incoming: {
        result: this.isDataHistoryEnabled ? incomingResult?.result : undefined,
        operation: incomingResult?.operation,
      },
      updated: {
        result: this.isDataHistoryEnabled
          ? updatedTree.updatedTree.result
          : undefined,
        changes: updatedTree.changes,
      },
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
      changes: ChangedChunksMap;
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
        changes: change.updated?.changes || [],
      });
    }

    return summaryArray;
  }
}
