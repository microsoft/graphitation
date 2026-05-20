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

  [Symbol.iterator](): Iterator<TItem> {
    let i = 0;
    const items = this.items;
    const head = this.head;
    const len = items.length;
    return {
      next(): IteratorResult<TItem> {
        if (i < len) {
          return { value: items[(head + i++) % len], done: false };
        }
        return { value: undefined as any, done: true };
      },
    };
  }
}
