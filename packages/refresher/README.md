# Refresher

**React-like composition for reactive reads over data you already own.**

A view returns data instead of UI. Its arguments act like props, `read` inlines
another view, and `ref` describes a child with its own cache, update, and error
boundary. Queries materialize the graph; live queries refresh affected parts
when your application reports changes.

Refresher is a read runtime, **not a store or write framework**. Your application
owns records, indexes, connections, writes, transactions, persistence, and
background work. Refresher borrows a handle to your data and retains only active
dependencies and derived results.

**Reads use current data, not a pinned snapshot.** Separate reads may observe
different states, even within one query. `result.revision` is the session's
notification sequence at execution start, not a database version.

## Two entry points

`@graphitation/refresher` is the engine: views, refs, queries, live queries, sessions, and
`storeView` for custom read providers. It knows nothing about keys, ranges, or
record shapes.

`@graphitation/refresher/stores` is one way to reach data from a view — an object store over a
host-supplied provider, related to `@graphitation/refresher` the way `react-dom` relates to
`react`. Its key and range vocabulary comes from that separate entry point.

## Runtime and TypeScript requirements

The source exports use ES2022 `Error` causes and `Object.hasOwn`. Each public
entry point declares the narrow `es2022.error` and `es2022.object` library
references, preserving them in declaration output. Consumers may keep an ES2021
compilation target and base library; these declarations describe runtime
requirements and do not install polyfills. Browser hosts must provide those APIs
(Chromium/Edge 94+, Firefox 92+, Safari 15.4+, or Node.js 16.9+).

## Quick start

This small host owns its data in a JavaScript map. The provider deliberately
supports point reads only; unsupported range reads reject rather than silently
scanning the map.

```ts
import { createSession, query, view } from "@graphitation/refresher";
import {
  objectStore,
  type ObjectStoreChangeListener,
  type ObjectStoreProvider,
} from "@graphitation/refresher/stores";

type Item = { id: string; title: string };

const rows = new Map<string, Item>([["a", { id: "a", title: "First item" }]]);
const listeners = new Set<ObjectStoreChangeListener>();
let revision = 0;

const provider: ObjectStoreProvider = {
  get(store, key) {
    if (store !== "items" || typeof key !== "string") {
      throw new Error("Unsupported store or key");
    }
    return rows.get(key);
  },
  range() {
    throw new Error("This host supports point reads only");
  },
  subscribe(listener) {
    listeners.add(listener);
    // Announce the current revision; every later delivery is stamped with the next.
    listener([], revision);
    return () => {
      listeners.delete(listener);
    };
  },
};

// This is application code, not a Refresher write operation.
function putItem(input: Item) {
  const value = structuredClone(input);
  rows.set(value.id, value);
  revision++;
  for (const listener of listeners) {
    listener([{ operation: "put", store: "items", value }], revision);
  }
}

const items = objectStore<Item>({ name: "items", primaryKeyPath: "id" });
const item = view({
  deterministic: true,
  async resolve(id: string, { read }) {
    const entry = await read(items.record, id);
    return entry.present ? entry.value : null;
  },
});

const session = createSession({
  feed: provider,
  store: () => provider,
  views: { ItemV1: item },
});
try {
  const itemQuery = query(item, "a", { session });
  console.log((await itemQuery.run()).data);
  putItem({ id: "a", title: "Changed by the application" });
  console.log((await itemQuery.run()).data);
} finally {
  await session.dispose();
}
```

`objectStore` creates a read-only binding, not the `rows` map. Disposing the
session detaches its listener without deleting records or closing host resources.
`feed` and `store` are optional for pure graphs that never reach a store view.

## Views, reads, and refs

```ts
const itemPair = view({
  deterministic: true,
  resolve(_: void, { ref }) {
    return { first: ref(item, "a"), second: ref(item, "b") };
  },
});
```

The standard query driver follows returned refs and materializes their values.
A child can refresh without rerunning the parent that returned its address.
Equal arguments to the same definition identify a shareable instance within a
session.

- `read(view, args)` inlines the callee's value, reads, and failures into the
  caller's update unit. Refs inside that value remain unresolved until cascade.
- `ref(view, args)` captures an opaque child address without running it.
- Derived views default to referenceable, not readable. Set
  `access: { readable: true }` when a view should also support `read`.
- Store views default to readable, not referenceable. Binding `access` can
  override individual read views.
- `resolve` must be side-effect-free. No writes, network effects, timers, or
  untracked mutable host reads belong there.

Views are deterministic unless they declare `deterministic: false`. A
deterministic view asserts equal results for equal arguments and observed inputs,
and may consume only deterministic views. This enables reuse, not snapshots.
Non-deterministic nodes rerun when reached in an active pass, even when their
previous dependencies remain valid. This does not create a timer or poller.

## Bind an existing store

### Custom provider views

Use `storeView` from `"@graphitation/refresher"` when the host already has its own read API.
No `"@graphitation/refresher/stores"` dependency or object-store adapter is required:

```ts
import {
  createSession,
  storeView,
  view,
  type ChangeFeed,
} from "@graphitation/refresher";

type Item = { id: string; title: string };
type ItemStore = {
  readItem(id: string, signal: AbortSignal): Promise<Item | undefined>;
};

const itemRecord = storeView<string, Item | undefined, ItemStore>({
  store: "items",
  displayName: "itemRecord",
  resolve: (id, { store, signal }) => store.readItem(id, signal),
  matches: (id, change) => change.operation === "reset" || change.value === id,
});

const item = view({
  deterministic: true,
  resolve: (id: string, { read }) => read(itemRecord, id),
});

function openItems(feed: ChangeFeed, items: ItemStore) {
  return createSession({ feed, store: () => items, views: { ItemV1: item } });
}
```

This host reports puts and deletions with
`{ store: "items", operation: "put" | "delete", value: id }`, and a conservative
reset with `{ store: "items", operation: "reset", value: undefined }`.
Those labels and payloads are this example's contract, not built-in operations.
The runtime only calls `matches` for changes to the declared store. The predicate
must return true whenever the result might change, including resets or unknown
affected keys.

The factory and its options are typed as:

```ts
type StoreViewFn = <
  Args,
  Result,
  Handle = StoreHandle,
  const DeclaredAccess extends Partial<AccessConfig> = Record<string, never>,
>(
  options: StoreViewOptions<Args, Result, Handle> & {
    readonly access?: DeclaredAccess;
  },
) => StoreView<Args, Result, DeclaredAccess>;

type StoreViewOptions<Args, Result, Handle = StoreHandle> = {
  readonly store: string;
  readonly displayName?: string;
  readonly access?: Partial<AccessConfig>;
  readonly resolve: (
    args: Args,
    context: StoreViewContext<Handle>,
  ) => PromiseOrValue<Result>;
  readonly matches: (args: Args, change: StoreChange) => boolean;
  readonly prepare?: (
    args: readonly Args[],
    context: StoreViewContext<Handle>,
  ) => PromiseOrValue<void>;
};
```

`StoreViewContext` supplies `{ store, signal, revision }`. `store` is the handle
the session's `store(name)` returned for the view's own store, never a global or
an argument. The session asks for it on the first read that reaches the store,
and may receive a promise, so a store can open lazily. `Handle` describes the
application's required capabilities and is not runtime-checked. Change
notifications arrive separately, through `feed`. Separate sessions using the same
definition never share handles or cached data.

Each successful invocation records a dependency on its captured arguments, even
when the result is `undefined` or `null`. Arguments are JSON values with the
session codec's canonical identity; functions and providers are not legal arguments.
Multiple custom views can address the same store while keeping distinct
definition identities. Store views are deterministic leaves: their results must
depend only on arguments and provider state covered by `matches`, not on
`revision`, time, or unreported changes. The revision is a notification sequence,
not a data snapshot.

Custom leaves default to readable and non-referenceable. `access` overrides use
the same rules as other views; explicit generic arguments require a fourth access
type argument when overriding those defaults. `prepare` is optional batched
prefetch, records no dependencies, and must not change the answer. It receives
the same provider context. Only store views prefetch; derived views have no
`prepare`.

Missing providers fail with `MISSING_PROVIDER`; thrown or rejected read and
preparation failures reject the operation with `READ_FAILED`, rather than becoming
nullable view results. Pass `signal` into host I/O and settle promptly on
cancellation. A result arriving after cancellation is not published. Provider
records pass through the normal result codec before publication.

### Object-store bindings

A binding names the host collection, its primary key, and existing native indexes:

```ts
type Message = { id: string; room: string; sentAt: number; body: string };
const indexes = { byRoom: { keyPath: ["room", "sentAt"] } } as const;
const messages = objectStore<Message, typeof indexes>({
  name: "messages",
  primaryKeyPath: "id",
  indexes,
});

const roomMessages = view({
  deterministic: true,
  resolve(room: string, { read }) {
    return read(messages.byRoom.range, {
      low: [room],
      high: [room],
      direction: "descending",
      limit: 50,
    });
  },
});
```

This separate example requires a provider for `"messages"` and its `"byRoom"`
index, with support for compound-prefix bounds. It does not add capabilities to
the point-only quick-start provider. Providers that cannot honor the requested
native bounds must reject.

Bindings expose `record`, plus `range`, `keys`, and `count` on `primary` and each
named index. `record` returns `{ present: false }` or `{ present: true, value }`;
range views return full records, and keys views return primary keys in index
order. Optional `validate` checks provider records, not external writes.

Zero-offset keys views retain each observed row's relevant index positions.
A put with identical positions does not invalidate the key list for a body-only
change, allowing deterministic parents to be reused. Non-deterministic parents
still rerun when reached. Full-record ranges invalidate relevant puts, while
positive-offset pages remain conservative on every put to their store.

Range queries accept `low`, `high`, exclusive flags, `direction`, `offset`, and
`limit`. Partial compound bounds select a whole prefix. The provider receives
normalized direction, offset, and a finite limit. Ties use primary-key order.
Index configuration describes host indexes; it does not create or maintain them.

### Provider contract

The public `ObjectStoreProvider` is declared in
[`src/stores/api.object-store.ts`](src/stores/api.object-store.ts):

| Method                                  | Contract                                                                                                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `get(store, key, options)`              | Complete current record, or `undefined` if absent                                                                                                                                          |
| `range(store, index, query, options)`   | Full records in native index order with primary-key ties                                                                                                                                   |
| `count?(store, index, bounds, options)` | Optional native aggregate; absent means unsupported                                                                                                                                        |
| `prepare?(store, reads, options)`       | Optional prefetch, without dependency registration                                                                                                                                         |
| `subscribe(listener)`                   | Announce the current revision with `listener([], revision)`, then deliver `listener(changes, revision)` with strictly increasing revisions; return a function detaching only this listener |

Every read's `options` is `{ signal?, revision }`. The revision is the one the
execution reads at, the same for all of its reads. A host without history reads
its latest state; a host that keeps versions may read as of it.

Read and preparation methods may answer synchronously or asynchronously.
Unsupported requests reject;
Refresher does not supply a whole-store scan or an in-memory mirror as a fallback.
An absent native `count` rejects with `UNSUPPORTED_QUERY`. Provider `prepare`
failures reject explicitly rather than being ignored. Only `undefined` from
`get` means missing; every other point result and every range row must be a full
record carrying its primary key. Multi-entry range, keys, and count views use
native index entries: a record/key can repeat when distinct matching index keys
refer to it. Repeated identical index keys within one record count only once.
Returned pages must admit the requested native direction and primary-key tie
order; duplicate entries and impossible ordering reject rather than being
silently sorted or discarded. The host owns any native I/O caches.
External provider read failures surface as `StoreError` with `code: "READ_FAILED"`,
not nullable view errors.

### Report changes after successful visibility

- A put reports `{ operation: "put", store, value: completeNewRecord }`.
- A delete reports `{ operation: "delete", store, value: completeRemovedRecord }`.
- Primary keys stay stable; changing one is a delete plus a put.
- Notify after reads can observe the change and it cannot still fail or roll
  back. Failed and rolled-back operations emit nothing.
- Report every relevant writer, including other tabs or services.

Refresher subscribes before reads begin and consumes each notification
synchronously to intersect active read sets. It retains neither notification
payloads nor notification history. Any notification during asynchronous live work
conservatively schedules another pass because new reads may not yet be known.
This includes notifications during materialization and before a late read has
registered its dependency.

Bounded ranges retain observed primary keys to detect a put moving an existing
row out of range; new index values detect arrivals. Every put to a store
invalidates its tracked positive-offset windows and native counts conservatively,
regardless of the new value's bounds, because old positions are unavailable.

## One-shot and live queries

`query(view, args, { session, signal? })` is bound to its session and inert
until `run()`; its arguments are checked when it is created. The result contains complete `data`, path-qualified
`errors`, and the starting notification `revision`. One-shot work retains no
dependencies after completion.

A `Query` is a reusable request, not a persistent result cache. Each run starts
a fresh execution whose store reads go to the provider. It neither borrows
active live-cache results nor adds entries to that cache. This avoids stale
one-shot data when notification delivery lags read visibility. Ref nodes can
still share within that fresh execution.

`liveQuery(view, args, { session, signal? })` creates a lazy handle:

```ts
import { liveQuery } from "@graphitation/refresher";

const live = liveQuery(item, "a", { session });
const unsubscribe = live.listen(() => {
  const state = live.getSnapshot();
  if (state.status === "ready") console.log(state.update.data);
  if (state.status === "failed") console.error(state.error);
});

// Later, when this consumer no longer needs updates:
unsubscribe();
await live.stop();
```

Use a still-active session for this snippet. `listen` / `getSnapshot` support
React's `useSyncExternalStore`; `getSnapshot()` is referentially stable between
publications and lifecycle changes. Here "snapshot" names handle state, not a
database snapshot. Async iteration is supported too.

Each `QueryUpdate` includes full data and errors, plus:

- `changes`: structural differences, or `null` on reset. An empty array means
  unchanged output.
- `reason`: `"initial"` or `"restart"` exactly when `changes` is `null`.
- `causedBy`: coalesced external `{ revision, store, operation }` metadata,
  keeping the latest triggering cause per store in delivery order, not a complete
  history of changes. `operation` is the label the reporting store published,
  repeated verbatim; the runtime never interprets it.
- `changedBy`: available per-instance explanations. These can be incomplete when
  a notification arrived before in-flight work discovered all its reads.

An `invalidated` reason's `via` preserves the nested inlined instance chain,
outermost first. It explains how a read reached its owner without adding ref
boundaries to those inlined calls.

Losing the last subscriber releases unshared work; resubscription restarts from
current data. `stop()` is terminal for one handle. Shared instances remain active
while another root needs them. Provider reads shared by a live pass are signalled
to abort only when no live participant needs them; stopping one participant does
not cancel another's reads. Cancellation never closes the host data source.
`stop()` waits only for cooperative completion of a pass made abandoned by the
release; it does not wait for still-needed shared work or unrelated live passes.
Slow iterators may coalesce complete updates, so always using the full result
is safe.

Publication is complete per query, but neither a single root nor shared execution
creates a cross-read or cross-store snapshot.

## Values, errors, and limits

View arguments are JSON values or Dates. The built-in codec uses them as passed,
or deep-frozen with `createJsonCodec({ freezeArgs: true })`, and identifies them
by canonical JSON with sorted object keys. A Date is identified by its ISO string
and reaches a remote executor as that string. Any other argument is rejected with
`INVALID_ARGUMENT`. Records and results are published as produced,
neither copied nor frozen, and rely on their readonly types. Hosts must replace
records rather than mutate them. `createSession({ codec })` accepts a custom
`Codec`, for example a schema-aware one
that validates arguments and results.

Federated answers travel as JSON, with each ref written as
`{"$ref": view, "args": args}`. Properties set to `undefined` are dropped, and
Blobs and other non-JSON values are rejected. Native Blobs can still occur in
provider records and in results consumed within one session.

Value failures appear as `null` at the affected boundary plus path-qualified
errors. Provider, cancellation, and resource failures reject instead.
`isRefresherError` supports structural narrowing by `kind` and `code`.
A failed live refresh preserves its last good update in the failed handle state.
An infrastructure failure clears the old read filter: while the handle remains
observed, any later provider notification can conservatively trigger a retry.
The failed pass may have discovered reads absent from the last successful graph.

Session defaults are `maxInstances: 10000`, `maxDepth: 64`,
`defaultPageSize: 100`, `maxPageSize: 10000`, and `maxDependencies: 10000`.
Override them under `limits`; invalid or exhausted limits reject rather than
returning partial results. `await session.dispose()` cancels runtime work and
detaches its listener, without closing the provider's host resources.

## Documentation and development

- [Architecture overview](docs/architecture/overview.md): canonical semantics.
- [Documentation index](docs/README.md): current architecture.

The package entry point is TypeScript source during development and is built to
`lib/` on publish. In this monorepo, use the package scripts:

```sh
yarn build
yarn types
yarn lint
yarn test
```

`yarn test:watch` reruns tests on changes and `yarn test:stress` runs more
property-test iterations. Tests use native `node:test` and `fast-check` models.
