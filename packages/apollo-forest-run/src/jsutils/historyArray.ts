import type {
  HistoryEntry,
  IndexedTree,
  UpdateTreeResult,
} from "../forest/types";

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
}
