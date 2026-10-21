/**
 * The contract of `@graphitation/refresher/stores`: keys, ranges, the provider that answers them, and
 * the `objectStore` builder that declares them.
 *
 * This is one store implementation, not the engine. It sits on the far side of the store
 * boundary the way a renderer sits on the far side of a runtime: it is written in
 * `../api.core` and `../api.stores` vocabulary, and nothing under `../api.core`, `../api.stores`, `../api.execution`,
 * `../tracking`, `../execution`, `../runtime`, or `../operations` may name anything here.
 * A change reaches a read through `StoreViewOptions.matches`, which is opaque, so the
 * engine never learns what an interval or a filter means — only that a read has a test,
 * and that a change carries a store, a label, and a payload it does not read.
 *
 * These shapes exist because `objectStore` is a generic builder that cannot read anything
 * itself, so it must publish the query shapes it sends and the addressing it sends them
 * in. A directly declared store view reads through its own host handle and owns both, so
 * the whole file goes with the builder.
 *
 * One of the contract files, with `../api.core`, `../api.stores`, `../api.codec`, `../api.execution`, and `../api.env`, which
 * are the only place a public type may be declared. Between them they name nothing but
 * each other and the host types enlisted in `../api.external`.
 */

import type {
  AccessConfig,
  PromiseOrValue,
  Revision,
  StoreName,
} from "../api.core";
import type { Store, StoreChange, StoreView } from "../api.stores";

// Changes

/**
 * A change as this store reports it, narrowing the engine's opaque label to the two
 * operations an object store has.
 *
 * Puts carry the complete new record; deletes the complete removed record. Primary keys
 * must remain stable; a key change is a delete and a put.
 */
export type ObjectStoreChange = StoreChange & {
  readonly operation: "put" | "delete";
};

/**
 * One atomic delivery of object-store changes.
 *
 * A key change is a delete and a put, and those belong in the same call: delivered
 * separately they are two events, and a read of the old key can refresh between them.
 * Stamped like every delivery; see StoreChangeListener.
 */
export type ObjectStoreChangeListener = (
  changes: readonly ObjectStoreChange[],
  revision: Revision,
) => void;

// Keys and ranges

export type KeyComponent = string | number | Date;
export type Key = KeyComponent | readonly KeyComponent[];
export type KeyPath = string | readonly string[];

export type RecordEntry<T> =
  | { readonly present: false }
  | { readonly present: true; readonly value: T };

/** Partial compound bounds select the entire matching prefix. */
export type RangeBounds = {
  readonly low?: Key;
  readonly high?: Key;
  readonly lowExclusive?: boolean;
  readonly highExclusive?: boolean;
};

export type RangeDirection = "ascending" | "descending";

export type RangeQuery = RangeBounds & {
  readonly direction?: RangeDirection;
  /** Omitted uses the runtime's finite default page size. */
  readonly limit?: number;
  readonly offset?: number;
};

// The provider

/** The normalized, bounded request sent to a provider. Index "primary" names the key. */
export type ProviderRangeQuery = RangeBounds & {
  readonly direction: RangeDirection;
  readonly limit: number;
  readonly offset: number;
};

export type ProviderRead =
  | { readonly kind: "record"; readonly key: Key }
  | {
      readonly kind: "range";
      readonly index: string;
      readonly query: ProviderRangeQuery;
    }
  | {
      readonly kind: "count";
      readonly index: string;
      readonly query: RangeBounds;
    };

/**
 * The lifetime and revision of one provider read. A provider keeping history answers as
 * of 
evision; one that does not answers from current state.
 */
export type ProviderReadOptions = {
  readonly signal?: AbortSignal;
  readonly revision: Revision;
};

/**
 * The host owns data, connections, writes, transactions, indexes, and any I/O caches.
 * Refresher borrows reads and a notification subscription; disposal only unsubscribes.
 * Read results are captured before being exposed to views.
 *
 * Range reads must honor bounds, direction, offset and limit, ordering ties by primary
 * key. Multi-entry ranges and counts operate on index entries, so the same record
 * may appear more than once. An unsupported request must reject, never silently scan or return a partial
 * answer. Every read in one execution carries the same revision; unless the provider
 * answers as of it, those reads may observe different external states.
 */
export type ObjectStoreProvider = {
  /** Undefined means the key is absent. Every present value is a full keyed record. */
  get(
    store: StoreName,
    key: Key,
    options: ProviderReadOptions,
  ): PromiseOrValue<unknown>;
  range(
    store: StoreName,
    index: string,
    query: ProviderRangeQuery,
    options: ProviderReadOptions,
  ): PromiseOrValue<readonly unknown[]>;
  /** Optional native aggregate. Without it, count reads reject as unsupported. */
  count?(
    store: StoreName,
    index: string,
    query: RangeBounds,
    options: ProviderReadOptions,
  ): PromiseOrValue<number>;
  /**
   * Must be attached before reads begin. Announces the current revision with an empty
   * delivery before returning. The returned function detaches only this listener.
   */
  subscribe(listener: ObjectStoreChangeListener): () => void;
};

// Object store bindings
//
// The declaration side: it names indexes so the provider's `index` argument has
// something to say.

export type AccessFor<Access, Name extends string> = Access extends Readonly<
  Record<Name, infer Declared>
>
  ? Declared
  : Record<string, never>;

/** Describes an existing index. Refresher never creates or maintains it. */
export type IndexConfig = {
  readonly keyPath: KeyPath;
  readonly unique?: boolean;
  readonly multiEntry?: boolean;
};

export type IndexConfigs = Readonly<Record<string, IndexConfig>>;

export type ObjectIndexAccess = {
  readonly range?: Partial<AccessConfig>;
  readonly keys?: Partial<AccessConfig>;
  readonly count?: Partial<AccessConfig>;
};

export type ObjectStoreAccess<
  I extends IndexConfigs = Readonly<Record<never, never>>,
> = {
  readonly record?: Partial<AccessConfig>;
} & {
  readonly [K in (keyof I & string) | "primary"]?: ObjectIndexAccess;
};

/** A declaration of the externally owned records and indexes a view can read. */
export type ObjectStoreConfig<
  T,
  I extends IndexConfigs,
  Access extends ObjectStoreAccess<I> = ObjectStoreAccess<I>,
> = {
  readonly name: StoreName;
  readonly primaryKeyPath: KeyPath;
  readonly indexes?: I;
  readonly access?: Access;

  /** Optional validation of records returned by the provider, not of external writes. */
  readonly validate?: (value: unknown) => value is T;
};

export type ObjectIndexViews<T, Access = Record<string, never>> = {
  readonly range: StoreView<
    RangeQuery,
    readonly T[],
    AccessFor<Access, "range">
  >;
  readonly keys: StoreView<
    RangeQuery,
    readonly Key[],
    AccessFor<Access, "keys">
  >;
  readonly count: StoreView<RangeBounds, number, AccessFor<Access, "count">>;
};

export type ObjectStore<
  T,
  I extends IndexConfigs,
  Access extends ObjectStoreAccess<I> = ObjectStoreAccess<I>,
> = Store & {
  readonly [K in keyof I]: ObjectIndexViews<T, AccessFor<Access, K & string>>;
} & {
  readonly record: StoreView<Key, RecordEntry<T>, AccessFor<Access, "record">>;
  readonly primary: ObjectIndexViews<T, AccessFor<Access, "primary">>;
};

export type ObjectStoreFn = <
  T,
  const I extends IndexConfigs = Readonly<Record<string, never>>,
  const Access extends ObjectStoreAccess<I> = Readonly<Record<never, never>>,
>(
  config: ObjectStoreConfig<T, I, Access>,
) => ObjectStore<T, I, Access>;
