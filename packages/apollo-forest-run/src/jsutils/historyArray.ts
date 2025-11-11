import type { HistoryEntry } from "../forest/types";

export class HistoryArray {
  public items: HistoryEntry[] = [];
  private head = 0;
  // Total number of entries ever added (including overwritten ones)
  public totalEntries = 0;
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  push(entry: HistoryEntry | undefined): void {
    if (this.maxSize === 0 || !entry) {
      return;
    }

    this.totalEntries++;
    if (this.items.length < this.maxSize) {
      this.items.push(entry);
    } else {
      this.items[this.head] = entry;
      this.head = (this.head + 1) % this.maxSize;
    }
  }
}
