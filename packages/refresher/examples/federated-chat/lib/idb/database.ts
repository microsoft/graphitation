/**
 * An IndexedDB database of `idbStore`s: their handle as the runtime asks for it, a feed of the
 * changes its writes commit, and writes across every store in one transaction.
 */
import type {
  ChangeFeed,
  GetStoreFn,
  StoreChange,
  StoreChangeListener,
} from "../../../../src/index";
import type { HybridClock } from "../clock";
import { committed, request } from "./requests";
import type { IdbStoreMembers, IdbWrites } from "./store";

/** What a store needs of the database: to be created in it. */
export type IdbStoreSchema = {
  readonly name: string;
  readonly create: (database: IDBDatabase) => void;
};

/** One transaction across every store, as a write runs in it. */
export type IdbTransaction = {
  readonly writes: <T, K extends string>(
    store: IdbStoreMembers<T, K>,
  ) => IdbWrites<T, K>;
};

export type IdbDatabase = ChangeFeed & {
  /** The database itself, as every one of its stores' handle. */
  readonly store: GetStoreFn;
  /**
   * Runs `run` in one transaction across every store, and once it commits, announces what it
   * changed as one revision, if anything. If `run` throws, the transaction aborts and nothing
   * is announced.
   */
  write<T>(run: (transaction: IdbTransaction) => T | Promise<T>): Promise<T>;
};

export type IdbDatabaseConfig = {
  readonly name: string;
  readonly version: number;
  readonly stores: readonly IdbStoreSchema[];
  /** The feed's clock: each committed transaction that changed something is its next revision. */
  readonly clock: HybridClock;
  /** Fills a database just created, before the feed's first revision: nothing is announced. */
  readonly create?: (transaction: IdbTransaction) => void | Promise<void>;
};

/**
 * Opens the database. A new version starts over: every store is deleted and created again, so
 * a schema change needs no migration and keeps no data.
 */
export async function openIdb(config: IdbDatabaseConfig): Promise<IdbDatabase> {
  const names = config.stores.map((store) => store.name);
  const opening = indexedDB.open(config.name, config.version);
  let fresh = false;
  opening.addEventListener("upgradeneeded", () => {
    fresh = true;
    const database = opening.result;
    // A copy: the list is live, and shrinks as stores go.
    for (const name of Array.from(database.objectStoreNames))
      database.deleteObjectStore(name);
    for (const store of config.stores) store.create(database);
  });
  const database = await request(opening);
  const listeners = new Set<StoreChangeListener>();

  /** Runs `run` in a transaction, and answers its result and the changes it made, once committed. */
  const transact = async <T>(
    run: (transaction: IdbTransaction) => T | Promise<T>,
  ): Promise<readonly [T, readonly StoreChange[]]> => {
    const transaction = database.transaction(names, "readwrite");
    const changes: StoreChange[] = [];
    const changed = (change: StoreChange): void => {
      changes.push(change);
    };
    let result: T;
    try {
      result = await run({
        writes: (store) => store.writes(transaction, changed),
      });
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // Already finished: a failed request aborted it.
      }
      throw error;
    }
    // Writes report their changes as their requests succeed, all before the commit.
    await committed(transaction);
    return [result, changes];
  };

  // A fresh database has no reader yet: what fills it comes before the first revision.
  const create = config.create;
  if (fresh && create !== undefined) await transact(create);
  let revision = config.clock.tick();

  return {
    store(name) {
      if (!names.includes(name)) throw new Error(`No store named ${name}`);
      return database;
    },
    subscribe(listener) {
      listeners.add(listener);
      listener([], revision);
      return () => {
        listeners.delete(listener);
      };
    },
    async write(run) {
      const [result, changes] = await transact(run);
      if (changes.length > 0) {
        revision = config.clock.tick();
        for (const listener of listeners) listener(changes, revision);
      }
      return result;
    },
  };
}
