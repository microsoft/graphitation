/// <reference lib="es2022.error" preserve="true" />
/// <reference lib="es2022.object" preserve="true" />

/**
 * `@graphitation/refresher/stores`: an object store binding, built on the `@graphitation/refresher` runtime.
 *
 * A separate entry point because it is a separate thing — one implementation of the
 * store boundary, the way a renderer is one implementation of a runtime's output. The
 * runtime does not import it, and an application that never reads records never loads
 * it. Its vocabulary is `./api.object-store`; the vocabulary that vocabulary is written
 * in is `../api.core` and `../api.stores`.
 */
export type {
  KeyComponent,
  Key,
  KeyPath,
  RecordEntry,
  IndexConfig,
  IndexConfigs,
  AccessFor,
  ObjectIndexAccess,
  ObjectStoreAccess,
  RangeBounds,
  RangeDirection,
  RangeQuery,
  ObjectIndexViews,
  ObjectStoreFn,
  ObjectStoreChange,
  ObjectStoreChangeListener,
  ProviderRangeQuery,
  ProviderRead,
  ProviderReadOptions,
  ObjectStoreProvider,
  ObjectStoreConfig,
  ObjectStore,
} from "./api.object-store";
