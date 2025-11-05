import type {
  HistoryEntry,
  RegularHistoryEntry,
  OptimisticHistoryEntry,
  IndexedTree,
  UpdateTreeResult,
  HistoryChange,
  ForestEnv,
} from "../forest/types";
import type { NodeDifferenceMap } from "../diff/types";
import type { OperationDescriptor } from "../descriptor/types";

import { getDataPathForDebugging, createParentLocator } from "../values";

export class HistoryArray {
  public items: HistoryEntry[] = [];
  private head = 0;
  private maxSize: number;
  private isEnabled: boolean;
  private isRichHistoryEnabled: boolean;

  constructor(operation: OperationDescriptor, env: ForestEnv) {
    const historySize = operation.historySize ?? env.defaultHistorySize ?? 0;

    this.maxSize = historySize;
    this.isEnabled = (env.enableRichHistory ?? false) && historySize > 0;
    this.isRichHistoryEnabled = env.enableRichHistory ?? false;
  }

  private pushHistoryEntry(
    baseEntry: RegularHistoryEntry | OptimisticHistoryEntry,
    currentTree: IndexedTree,
    incomingTree: IndexedTree | undefined,
    updatedTree?: UpdateTreeResult,
  ): void {
    const entry: HistoryEntry = {
      ...baseEntry,
      timestamp: Date.now(),
      modifyingOperation: {
        name: incomingTree?.operation?.debugName ?? "Anonymous Operation",
        variables: incomingTree?.operation?.variables || {},
      },
      data: this.isRichHistoryEnabled
        ? {
            current: currentTree.result,
            incoming: incomingTree?.result,
            updated: updatedTree?.updatedTree.result,
          }
        : undefined,
    };

    if (this.items.length < this.maxSize) {
      this.items.push(entry);
    } else {
      this.items[this.head] = entry;
      this.head = (this.head + 1) % this.maxSize;
    }
  }

  private getChunkPath(
    currentTree: IndexedTree,
    chunk: any,
  ): (string | number)[] {
    if (!this.isRichHistoryEnabled) {
      return ["Enable enableRichHistory for full path"];
    }
    const findParent = createParentLocator(currentTree.dataMap);
    return getDataPathForDebugging({ findParent }, chunk);
  }

  addHistoryEntry(
    currentTree: IndexedTree,
    updatedTree: UpdateTreeResult,
    incomingTree?: IndexedTree,
  ): void {
    if (!this.isEnabled) {
      return;
    }
    const changedFields: HistoryChange[] = [];

    for (const [chunk, fieldChanges] of updatedTree.changes) {
      const chunkPath = this.getChunkPath(currentTree, chunk);

      for (const fieldChange of fieldChanges) {
        const { fieldInfo, ...restOfFieldChange } = fieldChange;
        changedFields.push({
          path: [...chunkPath, fieldInfo.dataKey],
          ...restOfFieldChange,
        });
      }
    }

    const item: RegularHistoryEntry = {
      kind: "Regular",
      missingFields: updatedTree.missingFields,
      changes: changedFields,
    };

    this.pushHistoryEntry(item, currentTree, incomingTree, updatedTree);
  }

  addOptimisticHistoryEntry(
    currentTree: IndexedTree,
    nodeDiffs: NodeDifferenceMap,
    incomingResult: IndexedTree | undefined,
    updatedNodes: string[],
  ): void {
    if (!this.isEnabled) {
      return;
    }

    const item: OptimisticHistoryEntry = {
      kind: "Optimistic",
      nodeDiffs: this.isRichHistoryEnabled ? nodeDiffs : undefined,
      updatedNodes,
    };

    this.pushHistoryEntry(item, currentTree, incomingResult);
  }
}
