# Native live queries (experimental)

## Status and stages

This design uses explicit live sources (Option C) and native Supermassive
execution from the first implementation. There is no link-side executor or
implicit store-read-tracking stage.

| Stage                                                       | Status in this change                                                                                                                                       |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generic source contract and native execution                | Implemented, including complete snapshots, dependency reconciliation, and cancellation.                                                                     |
| Resolver generation                                         | Implemented as an opt-in generator option and CLI flag.                                                                                                     |
| Apollo/ForestRun and narrow-fragment integration            | A focused test covers full native snapshots, unchanged fragment isolation, parent-driven renders, and listener cleanup.                                     |
| Host application adapter and pilot migration                | Remaining application work: consume the released native executor, inject scoped sources, configure observable query consumption, and migrate a small query. |
| Performance evaluation                                      | Remaining: measure source fan-out, execution/cache cost, retained memory, and teardown latency in the host application.                                     |
| Small delivery patches or field-level incremental execution | Deliberately deferred, independently of native support.                                                                                                     |

This is not a production rollout, a package release, or verification in a host
application. The draft PR spans the library stages and records downstream work
rather than claiming changes in another repository.

## Relationship to Relay live resolvers

The comparison below uses Relay v21.0.1 documentation and runtime source, not
just the shared `@live` spelling. **Relay's documented client-state `@live`
marks a resolver in a docblock; it is not the operation directive implemented
here.** A normal Relay query selecting that resolver becomes reactive through
Relay's store. This design instead lets a query opt into a native Supermassive
result stream.

Relay's producer contract is `LiveState<T>`: synchronous `read()` plus
`subscribe(callback): unsubscribe`, with value-less invalidation notifications.
That is the same producer shape selected here. Relay installs the listener
before the initial read, retains the handle and disposer, marks a cached
resolver dirty on notification, and re-reads the handle when needed. Its
resolver cache also tracks fragment dependencies so derived resolvers can
update transitively.

| Concern                        | Relay live resolver                                                                                | Supermassive in this change                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Producer                       | Structural `LiveState<T>` with `read` and `subscribe`                                              | Same method shape, explicitly wrapped with `createLiveSource`                                      |
| Activation                     | Resolver `@live` metadata compiled into `RelayLiveResolver` reader nodes                           | Executable `query @live`; disabled/ordinary operations take one snapshot                           |
| Value lookup                   | Subscribe before reading; notification means re-read, not a pushed payload                         | Same ordering and notification meaning                                                             |
| Synchronous setup notification | Initial read observes the latest value without an extra update                                     | Same; setup callbacks do not force a redundant revision                                            |
| Dependency identity            | Cached resolver record derived from parent record, field, and arguments; fragment dependency edges | Source object identity within one operation; dynamic source set reconciled per revision            |
| Update work                    | Re-read dirty live fields; invalidate dependent cached resolvers and notify affected store readers | Rerun the whole operation; Apollo/ForestRun separately decides which fragment observations changed |
| Resolver factory lifetime      | Cache the returned handle until resolver inputs invalidate it                                      | Factories can run each revision; return stable, owner-scoped handles                               |
| Ownership                      | Resolver cache records, with subscription replacement and store cleanup                            | Operation iterator, with dynamic-dependency cleanup and explicit `return()`                        |
| Batching                       | Store-level `batchLiveStateUpdates` combines publish/notify work                                   | Per-operation dirty flag coalesces pending invalidations; no cross-operation transaction/batch API |
| Loading                        | `read()` may return Relay's Suspense sentinel and consumers suspend                                | No Relay sentinel or Suspense semantics; model loading explicitly in GraphQL                       |
| Failure                        | Cache a `read()` error and allow a later invalidation to retry                                     | Normal GraphQL field errors/null propagation, with subscription retained for recovery              |

### Sharing a producer without depending on Relay

An application can expose a plain synchronous producer with Relay's method
shape and give it to either runtime:

```ts
const counterState = {
  read: () => counterStore.getCount(),
  subscribe: (invalidate: () => void) =>
    counterStore.onCountChanged(invalidate),
};

// Create this wrapper once per service/account/window owner.
const counterSource = createLiveSource(counterState);

const resolvers = {
  Query: {
    count: () => counterSource,
  },
};
```

In Relay the corresponding resolver is annotated `@live` and returns
`counterState`; in Supermassive it returns `counterSource` and the consumer
executes `query @live { count }`. An unwrapped structural object is intentionally
not auto-detected by Supermassive: unlike Relay's compiled live-resolver marker,
our general field boundary must distinguish a source from an ordinary GraphQL
object with `read`/`subscribe` properties. The library brand provides that
distinction without importing Relay or annotating every resolver.

This is producer-shape interoperability, **not** complete Relay `LiveState`
compatibility. Do not adapt a producer that returns Relay's Suspense sentinel
as an ordinary GraphQL scalar/object value. A loading-state adapter needs an
explicit schema representation, or a separately designed runtime protocol.

### Architectural decisions following the comparison

- Keep producer access, execution/dependency ownership, and cache/UI
  observation separate. `liveSource.ts` owns the producer contract;
  `executeLive.ts` owns operation scheduling and registrations; normal
  field completion owns GraphQL semantics; Apollo/ForestRun owns client
  cache observations. A link remains only a lifecycle/result adapter.
- Preserve subscribe-before-read, value-less notifications, recoverable read
  errors, retained stable handles, and disposer ownership. Synchronous setup
  notifications are already covered by the immediately following read;
  notifications during a subsequent read/execution still invalidate it.
  Producers should avoid notifying when the selected value has not changed.
- Do not describe full-snapshot delivery as Relay-style incremental execution.
  Narrow-fragment render isolation is tested, but it does not eliminate
  whole-query resolver/cache work. A future field-level executor should
  study Relay's parent/field/argument cache keys, dirty resolver records,
  fragment dependency graph, and normalization/reconciliation together.
- Keep field-level invalidation, shared resolver caches, store-wide batching,
  and Suspense as explicit future design work rather than silently claiming
  parity or adding an unrelated Relay dependency in this first native stage.
  Per-operation coalescing is not an atomic multi-source snapshot guarantee.

References:

- [Relay live fields and `LiveState`](https://relay.dev/docs/guides/relay-resolvers/live-fields/).
- [Derived fields and explicit root-fragment dependencies](https://relay.dev/docs/guides/relay-resolvers/derived-fields/).
- [Live resolver Suspense semantics](https://relay.dev/docs/guides/relay-resolvers/suspense/).
- [Relay v21.0.1 `LiveResolverCache`](https://github.com/facebook/relay/blob/v21.0.1/packages/relay-runtime/store/live-resolvers/LiveResolverCache.js):
  `readFromCacheOrEvaluate`, `_setLiveStateValue`, `_makeLiveStateHandler`,
  `batchLiveStateUpdates`, and `maybeUnsubscribeFromLiveState`.
- [Relay v21.0.1 structural source detection](https://github.com/facebook/relay/blob/v21.0.1/packages/relay-runtime/store/live-resolvers/isLiveStateValue.js).

## Resolver and source example

Declare the executable directive in the schema used by validation/codegen:

```graphql
directive @live(if: Boolean = true) on QUERY

type Query {
  counter: Counter!
}

type Counter {
  id: ID!
  count: Int!
  label: String!
}
```

Supermassive also exports `GraphQLLiveDirective`, its compact directive tuple
for schema-fragment tooling. Declaring a directive alone does not implement its
semantics; execution must use the upgraded native executor.

Create a source once within its service/account/window owner:

```ts
import { createLiveSource } from "@graphitation/supermassive";

const countSource = createLiveSource({
  read: () => counterStore.getCount(),
  subscribe: (invalidate) => counterStore.onCountChanged(invalidate),
});

const resolvers = {
  Query: {
    counter: () => ({ id: "counter:1", label: "Example" }),
  },
  Counter: {
    count: () => countSource,
  },
};
```

`counterStore` illustrates an application service. `onCountChanged` must return
a disposer. Constructing a source does not subscribe or start a producer.
Snapshot access and listening remain explicit:

```ts
interface ILiveSource<T> {
  // The actual interface also has a library-owned symbol brand.
  read(): T;
  subscribe(invalidate: () => void): () => void;
}
```

Use the factory instead of returning an unbranded object. A GraphQL object with
ordinary properties called `read` and `subscribe` is not a live source.
`createLiveSource` preserves the receiver of the supplied methods.

`read()` is synchronous, side-effect-free, and returns a current snapshot. It
may throw a field error. An asynchronous feed can keep a current snapshot and
notify when it changes; loading/error states can be modeled in the schema.
Resolver factories may be asynchronous and resolve to source handles. Async
source reads are not part of this initial contract.

Source snapshots may be scalar, object, or list values. Sources are recognized
at field resolver boundaries, including default property resolution. Do not
put handles directly inside a scalar list as an alternative to field resolution.
Normal GraphQL completion, aliases, fragments, abstract types, and nullability
apply to the unwrapped value; handles never enter the response.

### A different producer

The executor does not import stores, Apollo, or browser globals. For example,
a browser-only application can provide:

```ts
const onlineSource = createLiveSource({
  read: () => navigator.onLine,
  subscribe: (invalidate) => {
    window.addEventListener("online", invalidate);
    window.addEventListener("offline", invalidate);
    return () => {
      window.removeEventListener("online", invalidate);
      window.removeEventListener("offline", invalidate);
    };
  },
});
```

A `Boolean!` resolver can return this source. This signal describes browser
connectivity, not whether a particular service is reachable. Other adapters can
observe services, media queries, or local state through the same contract.

## Executing and cancelling

Both `executeWithSchema` and `executeWithoutSchema` handle:

```graphql
query CounterView($enabled: Boolean = true) @live(if: $enabled) {
  counter {
    id
    count
    label
  }
}
```

An active live query returns an async result iterator. Each result is a complete
GraphQL snapshot, not an incremental-delivery envelope:

```json
{ "data": { "counter": { "id": "counter:1", "count": 1, "label": "Example" } } }
```

After an invalidation:

```json
{ "data": { "counter": { "id": "counter:1", "count": 2, "label": "Example" } } }
```

Consume with `for await` or one outstanding `next()` at a time. Always call
`return()` when the consumer is cancelled; `for await` does so on early exit.
Acquisition is lazy: no field execution or source subscription starts before
the first `next()`. `return()` releases listeners and resolves a pending
invalidation wait without waiting for another producer event. It does not
forcibly abort arbitrary application promises; late results cannot acquire
listeners or publish snapshots.

Ordinary queries, `@live(if: false)`, and `@live(if: null)` read sources once
without subscribing. A mutation field may unwrap a source as a one-shot value,
but `@live` on mutations or subscriptions is rejected. An active live query
with no observed sources still stays open until cancelled.

Active `@defer`/`@stream` cannot be combined with live execution in this version.
Disabled incremental directives are permitted. Checks traverse reachable
fragments and honor skipped selections; this is not a replacement for full
GraphQL document validation.

## Resolver generation

Enable `liveResolverReturnTypes: true` in `generateTS`, or:

```sh
supermassive generate-interfaces schema.graphql --live-resolver-return-types
```

Field resolver return types use `LiveResolverResult<T>`:

```ts
type LiveResolverResult<T> = T | ILiveSource<T> | Promise<T | ILiveSource<T>>;
```

Models, resolver parent types, client payloads, and GraphQL SDL retain `T`.
Subscription source generation and legacy resolver generation are unchanged.
The option defaults to false so projects using older runtimes do not
accidentally generate types they cannot execute. Upgrade the executor before
enabling this generator option.

## Delivery patches versus execution patches

For the counter above, a proposed optional transport could send:

```json
{
  "executionId": "counter-view-1",
  "baseRevision": 0,
  "revision": 1,
  "patch": [{ "op": "replace", "path": "/data/counter/count", "value": 2 }]
}
```

This protocol is not implemented. A receiving link would apply the patch
immutably to its own previous complete result and pass a full snapshot to
Apollo. It must validate execution identity/base revision, resynchronize after
gaps or patch failure, preserve GraphQL errors/null propagation, and handle
list order. The shared cache must not be used as the patch base. Replacing a
changed list is safer initially than index-based edits across revisions.

Transport patches reduce payload size, not resolver execution or necessarily
rendering. The native implementation reruns the whole operation; true
field/subtree re-execution would require a persistent execution graph,
parent/argument tracking, list/runtime-type reconciliation, and correct error
and non-null propagation. Neither optimization is required for native liveness.
For same-process producers, diffing and reconstructing may cost more than
passing snapshots.

Full results do not inherently rerender every fragment consumer. Narrow
fragment observations react to their selected data. The integration test in
`apollo-react-relay-duct-tape` changes one source, emits a full result, and checks
that an unrelated compiled-fragment consumer does not render again. It also
demonstrates that explicitly rerendering the parent still renders both
unmemoized children: fragment observation is not `React.memo`.

## Decisions and operational contract

1. **Explicit sources, native semantics.** Option C is the public contract.
   There is no implicit interception of context stores, and links do not own
   source unwrapping, scheduling, or dependency tracking.
2. **Operation-level reruns first.** Reuse the normal executor for each
   revision. Source invalidation is a latest-state signal, not an event log;
   intermediate changes may be coalesced.
3. **Demand-driven and bounded.** There is at most one execution in flight
   and one outstanding iterator read. Concurrent `next()` calls reject rather
   than create an unbounded consumer queue. While the consumer is not reading,
   keep a dirty flag instead of executing or buffering revisions. Producer
   listeners remain active until cancellation.
4. **Operation-local dependency ownership.** Repeated uses of the same source
   object share a registration within an operation. Retain unchanged listeners
   and replace dynamic dependencies safely. A listener is installed before
   reading its snapshot. Source factories should return stable handles scoped
   to their actual owner; there is no global source registry or cross-operation
   subscription sharing.
5. **No stale publication.** Invalidations during execution mark its snapshot
   obsolete; rerun before publishing. Retired generations cannot acquire late
   sources after cancellation or early non-null failure. This does not provide
   atomic snapshots across multiple independent producers.
6. **Field errors can recover.** A throwing `read()` uses normal GraphQL error
   paths/null propagation, with its source retained for later invalidation.
   Each revision starts with a fresh error list. Failure to subscribe is
   terminal: reject the iterator and release other subscriptions instead of
   presenting an unobservable source as healthy.
7. **Cleanup is explicit.** A source must clean up its own partial acquisitions
   if `subscribe` throws. Executor cleanup attempts every registered disposer;
   explicit `return()` reports the first cleanup error. Execution failures
   retain their original error if cleanup also fails. Owners must cancel
   operations on account/window/service replacement, not just ignore callbacks.
8. **Hooks are per revision.** Existing before-operation, field, and response
   hooks still run; field hooks see snapshots rather than source handles.
   Reuse operation context and coerced variables, while isolating error and
   incremental bookkeeping for each revision and preserving lazy-loaded
   schema fragments. Host telemetry should distinguish first-result latency
   from the lifetime of an open live session.
9. **Apollo remains an adapter.** Use observable query consumption and a
   fetch policy that reaches the link on every activation; avoid demoting to
   warm `cache-first`. Promise APIs waiting for completion are not suitable for
   an endless live stream. Do not fake `hasNext: true` to alter deduplication.
10. **Not a consistency or rendering guarantee.** The source adapter determines
    invalidation granularity. Query resolvers must be safe to repeat.
    Whole-query CPU/cache cost, host-version compatibility, startup/bundle
    impact, error-policy behavior, and application lifetimes need pilot
    measurement. Per-source transactional consistency and parent-driven React
    rendering require their own contracts.

## Host integration checklist

- Upgrade all relevant executors before routing `@live` to them; reject
  unsupported routes rather than silently taking a one-shot path.
- Define sources with stable account/window/service ownership and lazy
  producer subscriptions. Cancel operations before disposing/replacing owners.
- Adapt the native iterator to an Observable, including cancellation before
  iterator creation and during an outstanding `next()`. Do not add a competing
  link-side scheduler.
- Configure observable-query fetch/next-fetch policies explicitly; test
  remount, variable changes, skip/standby, refetch, and error policies.
- Keep independent fragment subscriptions narrow, preserve entity identity,
  and separately account for parent-driven renders.
- Measure active operation/source counts, invalidation/rerun rate, resolver and
  cache-write time, retained snapshots, and listener teardown latency. Gate the
  application pilot and keep non-live execution available as a fallback.

## Validation recorded for this change

- Supermassive: 460 tests and 120 snapshots; the 57 focused live cases also
  passed after the Relay lifecycle alignment.
- ts-codegen: 88 tests and 168 snapshots, including generated-consumer
  compilation; CLI: 3 tests and 5 snapshots.
- Native Apollo/ForestRun/compiled-fragment React integration: 1 focused test.
- Supermassive, ts-codegen, and CLI builds and declaration generation passed.
  The integration package's declaration generation also passed after building
  its existing project references.
- Tested with GraphQL 15.8.0 and Apollo 3.6.10. GraphQL 16/17, other host Apollo
  versions, production application behavior, and performance remain unverified.
