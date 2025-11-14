import type { ListItemChange } from "../../../../history/types";
import { ItemChangeKind } from "../../../../history/types";

export interface IndexItem {
  index: number;
  state: "added" | "removed" | "moved" | "updated" | "unchanged";
  data?: unknown;
  oldIndex?: number; // for moved items
  newIndex?: number; // for moved items
}

export const formatValueForDisplay = (value: unknown): string => {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export const formatDataPreview = (data: unknown): string => {
  if (data === null) return "null";
  if (data === undefined) return "undefined";
  if (typeof data === "string") {
    return data.length > 15 ? `"${data.slice(0, 15)}..."` : `"${data}"`;
  }
  if (typeof data === "object") {
    try {
      const str = JSON.stringify(data);
      return str.length > 15 ? str.slice(0, 15) + "..." : str;
    } catch {
      return String(data);
    }
  }
  return String(data);
};

export const getSummary = (itemChanges: ListItemChange[]): string => {
  const stats = { added: 0, removed: 0, moved: 0 };
  itemChanges.forEach((change) => {
    if (!change) return;

    switch (change.kind) {
      case ItemChangeKind.ItemAdd:
        stats.added++;
        break;
      case ItemChangeKind.ItemRemove:
        stats.removed++;
        break;
      case ItemChangeKind.ItemIndexChange:
        stats.moved++;
        break;
    }
  });
  const parts: string[] = [];
  if (stats.added > 0) parts.push(`${stats.added} added`);
  if (stats.removed > 0) parts.push(`${stats.removed} removed`);
  if (stats.moved > 0) parts.push(`${stats.moved} moved`);
  return parts.join(", ");
};

export const getListItemChangeDescription = (
  change: ListItemChange,
): string => {
  if (!change) return "Item changed";

  switch (change.kind) {
    case ItemChangeKind.ItemAdd:
      return `Item added at index ${change.index}`;
    case ItemChangeKind.ItemRemove:
      return `Item removed from index ${change.oldIndex}`;
    case ItemChangeKind.ItemIndexChange:
      return `Item moved from index ${change.oldIndex} to ${change.index}`;
    default:
      return "Item changed";
  }
};

export const buildIndexItems = (
  itemChanges: ListItemChange[],
  previousLength?: number,
  currentLength?: number,
): { oldItems: IndexItem[]; newItems: IndexItem[] } => {
  const oldItems: IndexItem[] = [];
  const newItems: IndexItem[] = [];

  // Create a map of changes by index for quick lookup
  const oldChangesMap = new Map<number, ListItemChange>();
  const newChangesMap = new Map<number, ListItemChange>();

  itemChanges.forEach((change) => {
    if (!change) return;

    if (
      change.kind === ItemChangeKind.ItemRemove &&
      change.oldIndex !== undefined
    ) {
      oldChangesMap.set(change.oldIndex, change);
    } else if (change.kind === ItemChangeKind.ItemIndexChange) {
      if (change.oldIndex !== undefined) {
        oldChangesMap.set(change.oldIndex, change);
      }
      if (change.index !== undefined) {
        newChangesMap.set(change.index, change);
      }
    } else if (
      change.kind === ItemChangeKind.ItemAdd &&
      change.index !== undefined
    ) {
      newChangesMap.set(change.index, change);
    }
  });

  // Build old items - only include items that have changes
  oldChangesMap.forEach((change, index) => {
    if (!change) return;

    if (change.kind === ItemChangeKind.ItemRemove) {
      oldItems.push({
        index,
        state: "removed",
        data: change.data,
      });
    } else if (change.kind === ItemChangeKind.ItemIndexChange) {
      oldItems.push({
        index,
        state: "moved",
        data: change.data,
        newIndex: change.index,
      });
    }
  });

  // Build new items - only include items that have changes
  newChangesMap.forEach((change, index) => {
    if (!change) return;

    if (change.kind === ItemChangeKind.ItemAdd) {
      newItems.push({
        index,
        state: "added",
        data: change.data,
      });
    } else if (change.kind === ItemChangeKind.ItemIndexChange) {
      newItems.push({
        index,
        state: "moved",
        data: change.data,
        oldIndex: change.oldIndex,
      });
    }
  });

  return { oldItems, newItems };
};

export const addGaps = (
  items: IndexItem[],
  totalLength: number,
): (IndexItem | "gap")[] => {
  if (totalLength === 0) return [];

  const result: (IndexItem | "gap")[] = [];
  const itemsMap = new Map(items.map((item) => [item.index, item]));

  let i = 0;
  while (i < totalLength) {
    const item = itemsMap.get(i);

    if (item) {
      // This index has a change, add it
      result.push(item);
      i++;
    } else {
      // This index is unchanged, count consecutive unchanged items
      let unchangedCount = 0;
      let startIdx = i;
      while (i < totalLength && !itemsMap.has(i)) {
        unchangedCount++;
        i++;
      }

      // If there are 3 or more unchanged items, collapse them
      if (unchangedCount >= 3) {
        // Show first unchanged item
        result.push({
          index: startIdx,
          state: "unchanged",
          data: undefined,
        });
        // Add gap indicator
        result.push("gap");
        // Show last unchanged item
        result.push({
          index: i - 1,
          state: "unchanged",
          data: undefined,
        });
      } else {
        // Show all unchanged items
        for (let j = startIdx; j < i; j++) {
          result.push({
            index: j,
            state: "unchanged",
            data: undefined,
          });
        }
      }
    }
  }

  return result;
};
