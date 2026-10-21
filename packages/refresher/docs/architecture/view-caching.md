# View caching

See the [architecture overview](overview.md) for the broader system context,
[Views](views.md) for view instances and determinism, and
[Invalidation](invalidation.md) for the matching caching relies on.

View caching keeps view results, in memory by default, so a view whose inputs are unchanged
answers without running its `resolve`. It is optional and orthogonal to everything
else: results, updates, and their causality are the same with caching on or
off, and only the work spent to produce them differs. Live queries need no cache
to stay live; they keep only what each instance read. See
[Memory at each stage](lifecycles.md#memory-at-each-stage).

For a React developer, a cached view is a session-wide `useMemo` keyed by the
view's arguments that outlives unmount, with no dependency array: the session
records what the view read, and when the result is needed again, checks it
against what changed since.

## What is cached

Caching is per view: a view opts in with `memo`. Like `React.memo`, a memoized
instance whose inputs are unchanged skips running `resolve`; like `useMemo`, its result
is kept, here keyed by arguments and shared by every caller. Only memoized
views get entries, and the rest cost the cache nothing.

A cache entry belongs to one instance of a memoized view, a view and its
arguments, in one session. It holds:

- the instance's **result**: a plain value, with refs where it delegated to
  other instances;
- the instance's **recorded reads**, which it holds anyway: its own, and those
  of every view it read inline, memoized or not;
- the **revisions** it is valid between: the one it was computed at, and the
  latest it is known valid at, moved forward each time it is validated.

A result holds refs, never what they lead to, so each instance is cached on its
own. A cached parent stays valid while a child behind one of its refs changes,
as a React parent doesn't re-render when a child's own state changes.

A memoized view read inline is cached under its own identity too, so a caller
that reruns may take its result from the cache and skip running it. A view read
inline that is not memoized counts as part of its caller, like a plain function
call, and has no entry of its own. Either way, the caller's entry records every
read behind its result, so validating it checks its own reads alone. See
[Inlined reads](invalidation.md#inlined-reads).

An entry holds no other entry, so evicting one never keeps another alive.

## When a cached result is used

An execution that needs an instance with a cache entry first
[validates](#validation) the entry at the execution's revision. A valid entry is
taken as if its `resolve` had just run, with the same
[consistency](consistency.md) guarantees.

That happens whenever an instance is needed again:

- a caller reruns and reads it inline;
- a driver follows a ref to it, for example when a component mounts a root again;
- a one-shot query runs again;
- a live query that was released restarts.

Only results of [deterministic](views.md#determinism) views are cached, since
only their inputs determine their result.

## Validation

A cache entry is checked when it is used, against what changed since it was
current. To validate an entry current at revision `R` for an execution at
revision `C`, the session matches the changes in its [change log](#the-change-log)
for `(R, C]` against the entry's recorded reads, with the same matching as a
live instance:

- **No hit.** The entry is current at `C`. The revision it is known valid at
  moves to `C`, and its result is used.
- **A hit.** The entry goes stale and stays, and the view runs.
- **Outside the window.** The log no longer holds every change since `R`, so
  the entry can't be confirmed. It goes stale too, and the view runs.

An entry newer than `C` reflects no change after `C` it should miss, and is
used as is, unless every read it made was answered by a store
[keeping history](stores.md#reading). Those stores can answer as of `C`, so the
view runs at `C` and the execution stays a [snapshot](consistency.md). A store
reading its current state can't, and running the view again gains nothing.

```ts
// Pseudo-implementation: validating a cached instance on use.
function validate(instance, revision) {
  if (instance.status === "stale") return undefined;
  if (instance.revision > revision) {
    // Settled stale: valid at no revision up to `revision`.
    if (instance.validThrough < instance.revision) return undefined;
    if (
      instance.storeReads.length > 0 &&
      instance.storeReads.every((read) => read.exact)
    ) {
      return undefined; // every store keeps history: read again as of `revision`
    }
  }
  if (instance.validThrough >= revision) return instance;
  if (!changeLog.covers(instance.validThrough)) {
    instance.status = "stale"; // stays cached
    return undefined;
  }
  for (const change of changeLog.between(instance.validThrough, revision)) {
    if (
      instance.storeReads.some((read) =>
        read.view.matches(read.args, change, read.footprint),
      )
    ) {
      instance.status = "stale"; // stays cached
      return undefined;
    }
  }
  instance.validThrough = revision;
  return instance;
}
```

The application writes no invalidation or refetch logic, and over stores whose
change feeds report every change, a validated result is always current.

An entry that nothing uses costs no work as changes arrive: its reads are
matched only when it is needed again, and only against the changes since. An
entry a live query uses is kept current by that live query, whose instances are
matched as each change arrives. See [Invalidation](invalidation.md).

### Stale entries

A stale entry stays in the cache until it is evicted. An execution never uses
one, but it is still a result as of its `validThrough`, and the
[remotes controller](lifecycles.md#controllers) may answer another session with
it while the view runs again: stale-while-revalidate across sessions. See
[Stale answers](federation.md#stale-answers).

An instance that [settled stale](consistency.md#stale-answers), having read a
stale answer, is kept the same way. Once the view runs again and settles, the
new entry replaces the stale one.

## The change log

The session keeps the changes its feed delivered, each with its revision, for a
recent window. The log is in memory and belongs to the session. Its window is a
[policy](configuration.md): it may keep changes for a time, up to a size, or
both.

A wider window lets older entries be validated and costs the memory of the
changes it holds. An entry older than the window is recomputed, so the window
affects only the work done, never results.

Before the window moves past a revision, the session validates every entry last
known valid before it, all against the same changes. Each one is either current
again or goes stale, so moving the window loses no entry that is still valid.

> **TODO.** A persisted change log, which would let a
> [persisted cache](#persisted-caches) be validated after a reload.

## Lifetime

An execution adds the memoized instances a wave reached once the wave settles.
A settled instance replaces a stale one under the same id; otherwise the newer
one stays. An entry stays while a [controller](lifecycles.md#controllers) holds
it: the host for what executions and live queries use, the remotes controller
for what it may answer other sessions with. Once nothing holds it, the
session's **eviction policy** decides when it goes. The policy is separate from
caching and still open: it may keep entries for a time, keep those used most
recently within a budget, or combine both. A stale entry, or one older than the
change log's window, can no longer be used by an execution, so the policy may
drop it straight away unless it is held.

Eviction is invisible to results. An evicted entry is recomputed when it is
needed again, and only costs the work to do so.

## Persisted caches

A cache may also be persisted and outlive the session that filled it. A
persisted entry is validated like any other, so it needs every change since its
revision. A new session's change log starts empty, so a persisted entry is
usable only when nothing changed since it was persisted. For a persistent store
such as IndexedDB, that holds when nothing writes to the store between sessions.
A reload then starts from the persisted cache with no recomputation.

## Limits

- **One session by default.** An in-memory cache belongs to the session that
  filled it, and a new session, for example after a reload, starts empty. See
  [Persisted caches](#persisted-caches).
- **Only what Refresher can see.** A cached result is current only as far as the
  change feed reports changes. A feed that misses a change leaves a stale entry,
  the same way it leaves a stale live result. See
  [The application's side](consistency.md#the-applications-side).
- **Federated results.** A remote session's views reach this session through a
  [remote store](federation.md), whose store views follow the same rules: their
  results are cached here, and validated against the remote session's changes.
