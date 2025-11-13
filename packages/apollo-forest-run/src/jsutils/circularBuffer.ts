export class CircularBuffer<TItem> implements Iterable<TItem> {
  public items: TItem[] = [];
  private head = 0;
  // Total number of entries ever added (including overwritten ones)
  public totalEntries = 0;
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  push(entry: TItem): void {
    if (this.maxSize === 0) {
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

  *[Symbol.iterator](): Iterator<TItem> {
    for (let i = 0; i < this.items.length; i++) {
      yield this.items[(this.head + i) % this.items.length];
    }
  }
}
