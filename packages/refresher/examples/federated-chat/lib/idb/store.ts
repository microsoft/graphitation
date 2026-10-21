/**
 * A generic IndexedDB object store: a store view for each read IndexedDB offers, by primary key
 * and by each index, and the writes that report what they change.
 *
 * Its views match changes themselves, so the views that read them never write `matches`. A
 * change carries the record before and after it; a read is hit when either one's key falls in
 * the range it read. A read with a `limit` that filled it records its far edge, and only
 * changes up to that edge hit it.
 */
import { storeView } from "../../../../src/index";
import type {
  AnnotatedResult,
  StoreChange,
  StoreView,
} from "../../../../src/index";
import { request, walk } from "./requests";

/** A part of a compound key. */
export type KeyPart = string | number | Date;

/**
 * A key IndexedDB orders, as view arguments can carry it: arrays nest two deep, and binary
 * keys are left out. Not recursive, as view results are typed through.
 */
export type IdbKey = KeyPart | readonly (KeyPart | readonly KeyPart[])[];

/** A property, dotted for a nested one, or several making a compound key. */
export type KeyPath = string | readonly string[];

/** Keys from `from`, included, up to `to`, left out: unbounded where omitted. */
export type KeyRange = { readonly from?: IdbKey; readonly to?: IdbKey };

/** A range read: in key order, back from the end if `prev`, at most `limit` entries. */
export type RangeQuery = KeyRange & {
  readonly direction?: "next" | "prev";
  readonly limit?: number;
};

export type IndexConfig = {
  readonly keyPath: KeyPath;
  readonly unique?: boolean;
  readonly multiEntry?: boolean;
};

/**
 * An object store with in-line keys. Its primary key and each index are key paths it names:
 * `{ primaryKey: { byId: "id" }, indexes: { byChat: … } }` gives `store.byId` to get a record,
 * and `store.range.byChat` to read a range of them.
 */
export type IdbStoreConfig<P extends string, I extends string> = {
  readonly name: string;
  /** The primary key, under the one name records are got by. */
  readonly primaryKey: Readonly<Record<P, KeyPath>>;
  /** Each index, by its name: its key path, or its key path and options. */
  readonly indexes?: Readonly<Record<I, KeyPath | IndexConfig>>;
};

/** What one write did to the record under `key`: `undefined` where there was none. */
export type IdbChange<T> = {
  readonly key: IdbKey;
  readonly before: T | undefined;
  readonly after: T | undefined;
};

/** A read of the store: its handle is the database. */
export type IdbRead<Args, Result> = StoreView<
  Args,
  Result,
  Record<string, never>,
  Promise<Result>
>;

/** The store's writes within one transaction. */
export type IdbWrites<T, K extends string> = {
  get(key: IdbKey): Promise<T | undefined>;
  put(record: T): void;
  delete(key: IdbKey): void;
  /** Deletes every record whose key by `path` is in `range`. */
  deleteAll(path: K, range: KeyRange): Promise<void>;
};

/**
 * An object store of `T` records: got by the primary key `P` names, a member of its own, and
 * read in ranges by `P` and each index `I` names.
 */
export type IdbStore<T, P extends string, I extends string> = Readonly<
  Record<P, IdbRead<IdbKey, T | undefined>>
> &
  IdbStoreMembers<T, P | I>;

/** A store's members besides its primary key. */
export type IdbStoreMembers<T, K extends string> = {
  readonly name: string;
  /** Every record, in primary key order. */
  readonly all: IdbRead<undefined, readonly T[]>;
  /** The records in a range of each key path, in its order. */
  readonly range: Readonly<Record<K, IdbRead<RangeQuery, readonly T[]>>>;
  /** The primary keys of the records in a range of each key path, in its order. */
  readonly keyRange: Readonly<
    Record<K, IdbRead<RangeQuery, readonly IdbKey[]>>
  >;
  /** How many records a range of each key path holds. */
  readonly count: Readonly<Record<K, IdbRead<KeyRange, number>>>;
  /** A record's primary key. */
  readonly keyOf: (record: T) => IdbKey;
  /** Creates the object store and its indexes, as the database is created or upgraded. */
  readonly create: (database: IDBDatabase) => void;
  /** The store's writes in `transaction`, each telling `changed` what it changed. */
  readonly writes: (
    transaction: IDBTransaction,
    changed: (change: StoreChange) => void,
  ) => IdbWrites<T, K>;
};

/** Members the primary key can't be named after. */
const RESERVED = new Set([
  "name",
  "all",
  "range",
  "keyRange",
  "count",
  "keyOf",
  "create",
  "writes",
]);

/**
 * Declares an object store of `T` records. Curried, so `T` is named and the key paths' names
 * are inferred: `idbStore<Message>()({ name, primaryKey: { byId: "id" }, indexes })`.
 */
export const idbStore =
  <T>() =>
  <const P extends string, const I extends string = never>(
    config: IdbStoreConfig<P, I>,
  ): IdbStore<T, P, I> => {
    const { name } = config;
    const primary = Object.entries<KeyPath>(config.primaryKey);
    const [first] = primary;
    if (first === undefined || primary.length !== 1) {
      throw new TypeError(
        `${name} names one primary key, not ${primary.length}`,
      );
    }
    const [primaryName, keyPath] = first;
    if (RESERVED.has(primaryName)) {
      throw new TypeError(`${name} can't name its primary key ${primaryName}`);
    }
    const indexes = Object.entries<KeyPath | IndexConfig>(
      config.indexes ?? {},
    ).map(([indexName, index]): readonly [string, IndexConfig] => [
      indexName,
      isIndexConfig(index) ? index : { keyPath: index },
    ]);
    const range: Record<string, IdbRead<RangeQuery, readonly unknown[]>> = {};
    const keyRange: Record<string, IdbRead<RangeQuery, readonly IdbKey[]>> = {};
    const count: Record<string, IdbRead<KeyRange, number>> = {};
    const paths: readonly (readonly [string, IndexConfig | undefined])[] = [
      [primaryName, undefined],
      ...indexes,
    ];
    for (const [path, index] of paths) {
      if (Object.hasOwn(range, path))
        throw new TypeError(`${name} names ${path} twice`);
      const views = pathViews(name, path, index);
      range[path] = views.range;
      keyRange[path] = views.keyRange;
      count[path] = views.count;
    }
    const keyOf = (record: unknown): IdbKey => {
      const [key] = indexKeys(record, keyPath, false);
      if (key === undefined)
        throw new TypeError(`A ${name} record has no valid key`);
      return key;
    };
    // Built over `unknown`: a store view's answer types do not resolve over a type parameter.
    const members: IdbStoreMembers<unknown, string> = {
      name,
      all: storeView<undefined, Promise<readonly unknown[]>, IDBDatabase>({
        store: name,
        name: `${name} all`,
        resolve: async (_args, { store: database }) =>
          (await read(objectStoreOf(database, name), {}, true)).values,
        // Every change is to one of its records.
        matches: () => true,
      }),
      range,
      keyRange,
      count,
      keyOf,
      create(database) {
        const created = database.createObjectStore(name, {
          keyPath: toKeyPath(keyPath),
        });
        for (const [indexName, index] of indexes) {
          created.createIndex(indexName, toKeyPath(index.keyPath), {
            unique: index.unique ?? false,
            multiEntry: index.multiEntry ?? false,
          });
        }
      },
      writes: (transaction, changed) =>
        writes(transaction.objectStore(name), primaryName, keyOf, changed),
    };
    const get = storeView<IdbKey, Promise<unknown>, IDBDatabase>({
      store: name,
      name: `${name} ${primaryName}`,
      resolve: (key, { store: database }) =>
        request<unknown>(objectStoreOf(database, name).get(toValidKey(key))),
      matches: (key, change) => cmp(changeOf(change).key, key) === 0,
    });
    const store = { [primaryName]: get, ...members };
    return store as unknown as IdbStore<T, P, I>;
  };

function isIndexConfig(index: KeyPath | IndexConfig): index is IndexConfig {
  return typeof index === "object" && "keyPath" in index;
}

/** The key of a record's string `id`, as most stores key by it. */
export function stringKey(key: IdbKey): string {
  if (typeof key !== "string") throw new TypeError("Expected a string key");
  return key;
}

/** The range reads by one key path: the primary key's if `index` is `undefined`. */
function pathViews(
  store: string,
  path: string,
  index: IndexConfig | undefined,
): {
  readonly range: IdbRead<RangeQuery, readonly unknown[]>;
  readonly keyRange: IdbRead<RangeQuery, readonly IdbKey[]>;
  readonly count: IdbRead<KeyRange, number>;
} {
  /** The keys a record is in range by: its primary key, or its index entries. */
  const keysOf = (
    change: IdbChange<unknown>,
    record: unknown,
  ): readonly IdbKey[] => {
    if (record === undefined) return [];
    if (index === undefined) return [change.key];
    return indexKeys(record, index.keyPath, index.multiEntry ?? false);
  };
  /** Whether a change may alter what a read in `query` up to `edge` holds. */
  const hits = (
    query: RangeQuery,
    edge: IdbKey | undefined,
    change: IdbChange<unknown>,
    contents: boolean,
  ): boolean => {
    const before = keysOf(change, change.before);
    const after = keysOf(change, change.after);
    // A read of keys alone misses a change that leaves them as they were.
    if (!contents && sameKeys(before, after)) return false;
    for (const key of before) if (covers(query, edge, key)) return true;
    for (const key of after) if (covers(query, edge, key)) return true;
    return false;
  };
  const sourceOf = (database: IDBDatabase): IDBObjectStore | IDBIndex => {
    const objectStore = objectStoreOf(database, store);
    return index === undefined ? objectStore : objectStore.index(path);
  };

  return {
    range: storeView<
      RangeQuery,
      Promise<AnnotatedResult<readonly unknown[], IdbKey>>,
      IDBDatabase
    >({
      store,
      name: `${store} range ${path}`,
      resolve: async (query, { store: database, annotate }) => {
        const { values, edge } = await read(sourceOf(database), query, true);
        return annotate<readonly unknown[], IdbKey>(
          edge === undefined
            ? { data: values }
            : { data: values, footprint: edge },
        );
      },
      matches: (query, change, edge) =>
        hits(query, edge, changeOf(change), true),
    }),
    keyRange: storeView<
      RangeQuery,
      Promise<AnnotatedResult<readonly IdbKey[], IdbKey>>,
      IDBDatabase
    >({
      store,
      name: `${store} keyRange ${path}`,
      resolve: async (query, { store: database, annotate }) => {
        const { primaryKeys, edge } = await read(
          sourceOf(database),
          query,
          false,
        );
        return annotate<readonly IdbKey[], IdbKey>(
          edge === undefined
            ? { data: primaryKeys }
            : { data: primaryKeys, footprint: edge },
        );
      },
      matches: (query, change, edge) =>
        hits(query, edge, changeOf(change), false),
    }),
    count: storeView<KeyRange, Promise<number>, IDBDatabase>({
      store,
      name: `${store} count ${path}`,
      resolve: (range, { store: database }) => {
        if (isEmpty(range)) return Promise.resolve(0);
        return request(sourceOf(database).count(toIdbRange(range)));
      },
      matches: (range, change) =>
        hits(range, undefined, changeOf(change), false),
    }),
  };
}

type Found = {
  readonly keys: IdbKey[];
  readonly primaryKeys: IdbKey[];
  readonly values: unknown[];
  /** The last key read, when the read stopped at its limit rather than the range's end. */
  readonly edge: IdbKey | undefined;
};

async function read(
  source: IDBObjectStore | IDBIndex,
  query: RangeQuery,
  values: boolean,
): Promise<Found> {
  const limit = query.limit ?? Infinity;
  if (!(limit > 0))
    throw new RangeError("A range read's limit must be positive");
  const found: Found = {
    keys: [],
    primaryKeys: [],
    values: [],
    edge: undefined,
  };
  if (isEmpty(query)) return found;
  await walk(
    source,
    toIdbRange(query),
    query.direction ?? "next",
    values,
    (cursor) => {
      found.keys.push(fromValidKey(cursor.key));
      found.primaryKeys.push(fromValidKey(cursor.primaryKey));
      if ("value" in cursor) found.values.push(cursor.value);
      return found.keys.length < limit;
    },
  );
  const edge = found.keys.length === limit ? found.keys.at(-1) : undefined;
  return { ...found, edge };
}

function writes(
  objectStore: IDBObjectStore,
  primaryName: string,
  keyOf: (record: unknown) => IdbKey,
  changed: (change: StoreChange) => void,
): IdbWrites<unknown, string> {
  const store = objectStore.name;
  const announce = (
    operation: "put" | "delete",
    value: IdbChange<unknown>,
  ): void => changed({ store, operation, value });
  return {
    get: (key) => request<unknown>(objectStore.get(toValidKey(key))),
    put(record) {
      const key = keyOf(record);
      // Requests in a transaction run in order: this reads the record the put replaces.
      const replaced = objectStore.get(toValidKey(key));
      objectStore.put(record);
      replaced.addEventListener("success", () => {
        const before: unknown = replaced.result;
        announce("put", { key, before, after: record });
      });
    },
    delete(key) {
      const removed = objectStore.get(toValidKey(key));
      objectStore.delete(toValidKey(key));
      removed.addEventListener("success", () => {
        const before: unknown = removed.result;
        if (before !== undefined)
          announce("delete", { key, before, after: undefined });
      });
    },
    async deleteAll(path, range) {
      if (isEmpty(range)) return;
      const source =
        path === primaryName ? objectStore : objectStore.index(path);
      await walk(source, toIdbRange(range), "next", true, (cursor) => {
        if (!("value" in cursor)) return false;
        const before: unknown = cursor.value;
        announce("delete", {
          key: fromValidKey(cursor.primaryKey),
          before,
          after: undefined,
        });
        cursor.delete();
        return true;
      });
    },
  };
}

// Keys

const changeOf = (change: StoreChange): IdbChange<unknown> =>
  change.value as IdbChange<unknown>;

const cmp = (a: IdbKey, b: IdbKey): number =>
  indexedDB.cmp(toValidKey(a), toValidKey(b));

const toValidKey = (key: IdbKey): IDBValidKey => key as IDBValidKey;

const fromValidKey = (key: IDBValidKey): IdbKey => key as IdbKey;

const toKeyPath = (keyPath: KeyPath): string | string[] =>
  typeof keyPath === "string" ? keyPath : [...keyPath];

function isKey(value: unknown, depth = 0): value is IdbKey {
  if (typeof value === "string") return true;
  if (typeof value === "number") return !Number.isNaN(value);
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  return (
    depth < 2 &&
    Array.isArray(value) &&
    value.every((part) => isKey(part, depth + 1))
  );
}

function valueAt(record: unknown, path: string): unknown {
  let value = record;
  if (path === "") return value;
  for (const step of path.split(".")) {
    if (typeof value !== "object" || value === null) return undefined;
    const next: unknown = Reflect.get(value, step);
    value = next;
  }
  return value;
}

/** The keys a record is in an index by: none if it lacks one, several if multi-entry. */
function indexKeys(
  record: unknown,
  keyPath: KeyPath,
  multiEntry: boolean,
): readonly IdbKey[] {
  if (typeof keyPath !== "string") {
    const key: unknown[] = keyPath.map((path) => valueAt(record, path));
    return isKey(key) ? [key] : [];
  }
  const value = valueAt(record, keyPath);
  if (multiEntry && Array.isArray(value))
    return value.filter((entry) => isKey(entry));
  return isKey(value) ? [value] : [];
}

function sameKeys(a: readonly IdbKey[], b: readonly IdbKey[]): boolean {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index++)
    if (cmp(a[index]!, b[index]!) !== 0) return false;
  return true;
}

/** Whether `key` is in `range`, and no further than `edge` in the read's direction. */
function covers(
  query: RangeQuery,
  edge: IdbKey | undefined,
  key: IdbKey,
): boolean {
  if (query.from !== undefined && cmp(key, query.from) < 0) return false;
  if (query.to !== undefined && cmp(key, query.to) >= 0) return false;
  if (edge === undefined) return true;
  const order = cmp(key, edge);
  return query.direction === "prev" ? order >= 0 : order <= 0;
}

/** Whether a range holds no key: IndexedDB rejects such a range rather than reading none. */
function isEmpty({ from, to }: KeyRange): boolean {
  return from !== undefined && to !== undefined && cmp(from, to) >= 0;
}

function toIdbRange({ from, to }: KeyRange): IDBKeyRange | undefined {
  if (from !== undefined && to !== undefined)
    return IDBKeyRange.bound(toValidKey(from), toValidKey(to), false, true);
  if (from !== undefined) return IDBKeyRange.lowerBound(toValidKey(from));
  if (to !== undefined) return IDBKeyRange.upperBound(toValidKey(to), true);
  return undefined;
}

function objectStoreOf(database: IDBDatabase, name: string): IDBObjectStore {
  return database.transaction(name, "readonly").objectStore(name);
}
