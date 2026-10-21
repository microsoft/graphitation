/**
 * The external types the public contract is allowed to name.
 *
 * A contract file writes `Promise`, `Date`, or `IDBDatabase` directly — these are not
 * Refresher's to define or to rename, and an alias would only put a second name on
 * something the reader already knows. What is Refresher's is the decision to depend on
 * them at all: the list below is closed, and a contract must not name an external type
 * without enlisting it here.
 *
 * The decision each entry records is availability. Refresher runs in a worker, so a
 * contract naming a main-thread-only type (`Window`, `HTMLElement`, `Document`) would be
 * one no worker could honour. Adding a name here says it exists wherever Refresher runs:
 * the compiler checks that the name resolves, and the reviewer checks that claim.
 *
 * Type arguments below are placeholders. Enlistment is per type, not per instantiation.
 */

/** Present in any host that runs JavaScript. */
export type StandardLibrary = [
  Promise<unknown>,
  Iterable<unknown>,
  AsyncIterable<unknown>,
  Error,
  Date,
  Blob,
  ReadonlyMap<unknown, unknown>,
  ReadonlySet<unknown>,
  Set<unknown>,
  Map<unknown, unknown>,
];

/**
 * TypeScript's own utility types. These are the one group with nothing to be available:
 * they erase, so enlisting one asks only that a consumer compiles with a lib recent
 * enough to declare it.
 */
export type TypeSystem = [
  Readonly<unknown>,
  Record<string, unknown>,
  NonNullable<unknown>,
  Partial<unknown>,
  NoInfer<unknown>,
];

/**
 * The half of the web platform a worker also gets. `indexedDB` and `AbortSignal` reach
 * a worker; most of the DOM does not, and nothing from it belongs here.
 */
export type WorkerPlatform = [AbortSignal, IDBDatabase];
