# `@defer` non-blocking semantics

This document describes how `@defer` was handled in the supermassive executor
before this change, what was changed, and why.

## Background

`@defer` lets a client mark part of a query as non-critical. The intent of this
change is "do not wait on" rather than "delay execution of": a slow deferred
field must never gate the initial response, but if it happens to be ready by
the time critical fields are done, it should ride along on the initial payload
instead of being streamed as a separate chunk.

## Previous execution flow

Selection sets were collected with `collectFields` / `collectSubfields`, which
already split fields into two buckets: the critical `groupedFieldSet` and a
list of deferred `patches` (one per `@defer` fragment).

At every selection set the executor did the following:

1. Run all critical fields with `executeFields`.
2. Iterate `patches` and schedule each one through `executeDeferredFragment`,
   which created a `DeferredFragmentRecord`, added it to
   `exeContext.subsequentPayloads`, and started executing the deferred fields.
3. Return the critical result.

Once the root selection set's promise resolved, `buildResponse` inspected
`subsequentPayloads`. If it was non-empty, the response became an incremental
result with `hasNext: true` and a `subsequentResults` async generator
(`yieldSubsequentPayloads`) that awaited every pending record and emitted them
as separate payloads as they completed.

```
                collectFields
                      │
                      ▼
  ┌────────────── selection set ──────────────┐
  │                                           │
  │   critical fields            deferred     │
  │   (executeFields)            patches      │
  │        │                        │         │
  │        ▼                        ▼         │
  │   resolved data       executeDeferredFragment
  │        │                        │         │
  │        │                        ▼         │
  │        │              subsequentPayloads  │
  │        │              (always queued)     │
  └────────┼────────────────────────┬─────────┘
           │                        │
           ▼                        ▼
      buildResponse ─── if size>0 ──► incremental result
                                      (initial + stream)
```

Consequences:

- A deferred fragment that completed before or together with the critical
  fields was still emitted as a separate `subsequentResults` chunk, even
  though the client could just have received it inline.
- The "critical fields respond as soon as available" guarantee already held
  for the simple case (critical fields don't await deferred work), but the
  shape of the response was always incremental whenever any `@defer` was
  present, regardless of timing.

## What changed

The defer handling is now part of selection-set execution rather than a
post-processing step in `buildResponse`.

A new helper `executeFieldsAndPatches` replaces the two-step "executeFields
then schedule patches" pattern at both call sites that actually support
defer:

- the root `query` operation in `executeOperation`
- nested object selection sets in `collectAndExecuteSubfields`

Inside `executeFieldsAndPatches`:

1. Critical fields are executed via `executeFields` exactly as before, so
   the returned promise still settles the moment every critical field is
   ready.
2. Each `@defer` patch is scheduled through `executeDeferredFragment`,
   which still creates a `DeferredFragmentRecord` and registers it in
   `subsequentPayloads`. The reference is also kept locally.
3. When the critical result settles, `includeCompletedDeferredFragmentsInResult`
   walks the locally tracked records and, for any record that is already
   completed at that moment, merges its data into the critical result at
   the deferred fragment's path (relative to the current selection set) and
   removes the record from `subsequentPayloads`. Errors collected on the
   record are promoted to `exeContext.errors`. Records that are still
   pending stay in `subsequentPayloads` and continue streaming through the
   existing `yieldSubsequentPayloads` machinery.

### Inclusion is decided by timing, not by synchronous resolvers

The signal for "include this deferred fragment inline" is purely **whether
it has already completed by the time the critical fields are ready** - never
whether its resolvers happened to be synchronous.

Two things make this work:

- `executeDeferredFragment` always schedules the deferred selection set on a
  microtask (`Promise.resolve().then(() => executeFields(...))`) instead of
  running it inline. A deferred fragment therefore never executes on the
  critical path, so even a fully synchronous - but potentially expensive -
  resolver cannot delay the critical fields or the construction of the
  initial response.
- `DeferredFragmentRecord.addData` no longer flips `isCompleted` synchronously
  for non-promise data. Completion is only observed when the deferred data
  settles. An earlier iteration marked synchronous deferred data complete
  immediately, which forced every synchronous deferred fragment to be
  piggybacked onto the initial response - exactly the behavior `@defer` is
  meant to avoid for heavy synchronous fields.

The practical outcomes:

- Critical fields ready first, deferred still pending → deferred streams.
- Deferred completes before the critical fields (e.g. a fast async field
  while a critical field is slow) → deferred is included inline.
- Critical fields ready synchronously while a deferred field is also
  synchronous → the deferred field still streams, because it has not been
  given the chance to complete before the (synchronous) critical result is
  finalized. `@defer` is honored rather than collapsed away.

`buildResponse` is back to its original responsibility - deciding between a
plain `{ data }` result and an incremental result based on whatever is
still queued in `subsequentPayloads` after execution.

```
                collectFields
                      │
                      ▼
  ┌──────────── selection set ────────────┐
  │                                       │
  │ executeFieldsAndPatches               │
  │ ├─ executeFields (critical)           │
  │ ├─ executeDeferredFragment (each      │
  │ │  patch → DeferredFragmentRecord     │
  │ │  in subsequentPayloads; the         │
  │ │  deferred selection set runs on     │
  │ │  a microtask, off the critical      │
  │ │  path)                              │
  │ └─ when critical settles:             │
  │    for each already-completed record: │
  │       merge data into result at path  │
  │       drop record from subsequent     │
  │       payloads                        │
  └───────────────────┬───────────────────┘
                      │
                      ▼
               buildResponse
                      │
       ┌──────────────┴──────────────┐
       │                             │
  no pending records          pending records
       │                             │
       ▼                             ▼
  { data }                  initial + stream
```

The mutation branch keeps iterating its root patches, and subscriptions still
disallow defer, but those patches now also run on a microtask via the shared
`executeDeferredFragment`, so no defer work runs on a critical path anywhere.

## Why this shape

- Defer scheduling is unchanged - the same `DeferredFragmentRecord` machinery
  drives both the inline case and the streamed case, so streaming, error
  filtering (`filterSubsequentPayloads`), and `yieldSubsequentPayloads` all
  keep working without parallel code paths.
- The decision "include now vs. stream later" is made at the selection set
  that owns the deferred fragment. That is the only place that has both the
  resolved critical data and the deferred record, which keeps the merge
  shallow and avoids walking the full response tree from `buildResponse`.
- Critical execution never awaits deferred work: it only synchronously
  inspects `record.isCompleted` and merges what is already there. A deferred
  fragment that is still pending stays in `subsequentPayloads` and is
  delivered as a streamed chunk.
- Running the deferred selection set on a microtask means the cost of a
  deferred field - whether it is paid by an awaited promise or by a heavy
  synchronous resolver - is kept off the critical path. The initial response
  is shaped from the critical fields alone, and a deferred field is only
  pulled forward into it when it genuinely finished first. This is what makes
  `@defer` meaningful for synchronous-but-expensive fields, which previously
  were always executed inline and merged into the initial response.

## Relationship to graphql-js and tests

graphql-js does not implement non-blocking `@defer`: it always delivers a
deferred fragment as a separate `incremental` payload, regardless of whether
the fragment finished before the critical fields. The supermassive executor
intentionally diverges whenever a deferred fragment completes before an
**asynchronous** critical sibling - in that case the fragment (and any errors
it produced) is piggybacked onto the initial response instead of being
streamed.

This is observable in `executeIncrementally.graphql17.test.ts`:

- The strict parity suites (`executeWithSchema` and
  `executeWithoutSchema - minimal viable schema annotation`) assert
  byte-for-byte equality with graphql-js. Cases that exercise the divergence
  are flagged with `divergesFromGraphQLJs` and excluded from these suites via
  `comparableTestCases`, because requiring graphql-js parity there would
  contradict the intended behavior. The `@stream/defer errors` case is the
  current example: its deferred `bubblingError` fragment settles before the
  asynchronous `bubblingListError @stream` critical sibling, so it is inlined.
- The graphql-js snapshot suite still runs every case (including the diverging
  ones) so the graphql-js reference behavior remains documented.
- The `@defer non-blocking semantics` suite asserts the supermassive behavior
  directly, including that a piggybacked deferred field's errors surface at the
  top level (mirroring how they would appear had the field never been
  deferred).
