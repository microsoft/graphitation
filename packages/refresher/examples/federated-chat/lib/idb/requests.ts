/** IndexedDB requests and transactions, as promises. */

export const request = <T>(pending: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    pending.addEventListener("success", () => resolve(pending.result), {
      once: true,
    });
    pending.addEventListener(
      "error",
      () => reject(pending.error ?? new Error("IndexedDB request failed")),
      { once: true },
    );
  });

/** Settles once `transaction` commits, or fails as it does. */
export const committed = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    const fail = (): void =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.addEventListener("error", fail, { once: true });
    transaction.addEventListener("abort", fail, { once: true });
  });

/**
 * Walks `source` with a cursor, calling `visit` with each entry until it answers `false` or
 * the cursor runs out. A key cursor unless `values`, so no record is loaded.
 */
export const walk = (
  source: IDBObjectStore | IDBIndex,
  range: IDBKeyRange | undefined,
  direction: IDBCursorDirection,
  values: boolean,
  visit: (cursor: IDBCursor | IDBCursorWithValue) => boolean,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const cursor = values
      ? source.openCursor(range, direction)
      : source.openKeyCursor(range, direction);
    cursor.addEventListener("success", () => {
      const at = cursor.result;
      if (at === null || !visit(at)) resolve();
      else at.continue();
    });
    cursor.addEventListener("error", () =>
      reject(cursor.error ?? new Error("IndexedDB cursor failed")),
    );
  });
