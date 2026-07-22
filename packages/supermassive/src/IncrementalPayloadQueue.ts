/**
 * Tracks payloads in registration order and delivers completed prefixes.
 */
export class IncrementalPayloadQueue<T extends { promise: Promise<void> }> {
  private readonly entries = new Map<T, { isCompleted: boolean }>();
  private nextRequest:
    | ((result: IteratorResult<ReadonlyArray<T>, void>) => void)
    | undefined;
  private isClosed = false;
  private isFlushScheduled = false;

  add(payload: T): void {
    if (this.isClosed) {
      return;
    }

    const entry = { isCompleted: false };
    this.entries.set(payload, entry);
    Promise.resolve().then(() => {
      payload.promise.then(() => {
        if (this.entries.get(payload) !== entry) {
          return;
        }

        entry.isCompleted = true;
        if (this.nextRequest) {
          this.scheduleFlush();
        }
      });
    });
  }

  get size(): number {
    return this.entries.size;
  }

  delete(payload: T): boolean {
    const isDeleted = this.entries.delete(payload);
    if (isDeleted && this.nextRequest) {
      this.scheduleFlush();
    }
    return isDeleted;
  }

  forEach(callback: (payload: T) => void): void {
    this.entries.forEach((_entry, payload) => callback(payload));
  }

  next(): Promise<IteratorResult<ReadonlyArray<T>, void>> {
    if (this.nextRequest) {
      return Promise.reject(
        new Error(
          "Only one pending next() call is supported by IncrementalPayloadQueue.",
        ),
      );
    }

    if (this.isClosed) {
      return Promise.resolve({ value: undefined, done: true });
    }

    const completed = this.drainCompleted();
    if (completed.length > 0) {
      return Promise.resolve({ value: completed, done: false });
    }

    return new Promise((resolve) => {
      this.nextRequest = resolve;
    });
  }

  return(): Promise<IteratorResult<ReadonlyArray<T>, void>> {
    this.isClosed = true;
    if (this.nextRequest) {
      const resolve = this.nextRequest;
      this.nextRequest = undefined;
      resolve({ value: undefined, done: true });
    }
    return Promise.resolve({ value: undefined, done: true });
  }

  private scheduleFlush(): void {
    if (this.isFlushScheduled) {
      return;
    }

    this.isFlushScheduled = true;
    Promise.resolve().then(() => {
      this.isFlushScheduled = false;
      this.flush();
    });
  }

  private flush(): void {
    if (!this.nextRequest) {
      return;
    }

    const completed = this.drainCompleted();
    if (completed.length === 0 && this.entries.size > 0) {
      return;
    }

    const resolve = this.nextRequest;
    this.nextRequest = undefined;
    resolve({ value: completed, done: false });
  }

  private drainCompleted(): Array<T> {
    const completed: Array<T> = [];
    for (const [payload, entry] of this.entries) {
      if (!entry.isCompleted) {
        break;
      }
      this.entries.delete(payload);
      completed.push(payload);
    }
    return completed;
  }
}
