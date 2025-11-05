import type {
  HistoryEntry,
  IndexedTree,
  UpdateTreeResult,
  HistoryChange,
  ForestEnv,
} from "../forest/types";
import type { NodeDifferenceMap } from "../diff/types";

import { getDataPathForDebugging, createParentLocator } from "../values";

export class HistoryArray {
  public items: HistoryEntry[] = [];
  private head = 0;
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  push(entry: HistoryEntry | undefined): void {
    if (this.maxSize === 0 || !entry) {
      return;
    }

    if (this.items.length < this.maxSize) {
      this.items.push(entry);
    } else {
      this.items[this.head] = entry;
      this.head = (this.head + 1) % this.maxSize;
    }
  }
}

function getChunkPath(
  currentTree: IndexedTree,
  chunk: any,
  enableRichHistory: boolean,
): (string | number)[] {
  if (!enableRichHistory) {
    return ["Enable enableRichHistory for full path"];
  }
  const findParent = createParentLocator(currentTree.dataMap);
  return getDataPathForDebugging({ findParent }, chunk);
}

export function createRegularHistoryEntry(
  currentTree: IndexedTree,
  updatedTree: UpdateTreeResult,
  incomingTree: IndexedTree | undefined,
  env: ForestEnv,
): HistoryEntry | undefined {
  if (currentTree.operation.historySize) {
    const changedFields: HistoryChange[] = [];

    for (const [chunk, fieldChanges] of updatedTree.changes) {
      const chunkPath = getChunkPath(
        currentTree,
        chunk,
        env.enableRichHistory ?? false,
      );

      for (const fieldChange of fieldChanges) {
        const { fieldInfo, ...restOfFieldChange } = fieldChange;
        changedFields.push({
          path: [...chunkPath, fieldInfo.dataKey],
          ...restOfFieldChange,
        });
      }
    }

    return {
      kind: "Regular",
      missingFields: updatedTree.missingFields,
      changes: changedFields,
      timestamp: Date.now(),
      modifyingOperation: {
        name: incomingTree?.operation?.debugName ?? "Anonymous Operation",
        variables: incomingTree?.operation?.variables || {},
      },
      data: env.enableRichHistory
        ? {
            current: currentTree.result,
            incoming: incomingTree?.result,
            updated: updatedTree.updatedTree.result,
          }
        : undefined,
    };
  }
}

export function createOptimisticHistoryEntry(
  currentTree: IndexedTree,
  nodeDiffs: NodeDifferenceMap,
  incomingTree: IndexedTree | undefined,
  updatedNodes: string[],
  env: ForestEnv,
): HistoryEntry | undefined {
  if (currentTree.operation.historySize) {
    return {
      kind: "Optimistic",
      nodeDiffs: env.enableRichHistory ? nodeDiffs : undefined,
      updatedNodes,
      timestamp: Date.now(),
      modifyingOperation: {
        name: incomingTree?.operation?.debugName ?? "Anonymous Operation",
        variables: incomingTree?.operation?.variables || {},
      },
      data: env.enableRichHistory
        ? {
            current: currentTree.result,
            incoming: incomingTree?.result,
            updated: undefined,
          }
        : undefined,
    };
  }
}
