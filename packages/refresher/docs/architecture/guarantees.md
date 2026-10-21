# Guarantees

See the [architecture overview](overview.md) for the broader system context,
[Consistency](consistency.md) for how revisions and snapshots work, and
[Testing](testing.md) for the tools that check the application's side of the
contract.

This document defines the intended guarantees of Refresher. It separates the
behavior application code may rely on from the internal invariants an
implementation must preserve, and states the contract application code keeps
in return.

The guarantees apply to both one-shot and live queries unless a section says
otherwise. They hold over any data source that keeps the contract below. A
source that does more, such as the transactional store, lets Refresher promise
more; see [With the transactional store](#with-the-transactional-store).

## The application's side of the contract

Refresher's guarantees rest on five assumptions about application code:

- **Views are side-effect-free.** A view reads views and returns values and
  refs, and does nothing else. Views are also deterministic unless they declare
  otherwise. See [Views](views.md#rules-for-resolve).
- **Values are immutable.** Values read from stores and values Refresher returns
  are never mutated in place; a store replaces a value to change it.
- **Store views catch every relevant change.** Given a change and a recorded
  read, a store view reports an intersection whenever the change could affect
  that read. It may conservatively over-match. See
  [Views](views.md#read-tracking).
- **Change feeds report every change after it happens.** A notification follows
  the change it reports, covers changes from every writer, carries a revision
  that only moves forward, and groups changes that belong to one atomic event.
  See [Stores and change feeds](stores.md).
- **Stores report how old an answer is.** An answer from state older than the
  revision asked reports that state's revision. See
  [Stale answers](consistency.md#stale-answers).

A violation usually surfaces later and far from its cause, as a stale result or
a missing rerun. The tools in [Testing](testing.md) check these assumptions in
application tests.

## Public guarantees

### Consistent executions

- One execution reads at one revision. Every read within it is tagged with that
  revision, so a store that keeps history answers them all as of the same point
  in time, and the result is a consistent snapshot.
- Over a store that holds only current state, a result may combine reads taken a
  moment apart. Every change that could affect it schedules another pass, so
  live results converge; see [Nothing missed](#nothing-missed).
- Queries started together run as one batch, in one execution that reads at
  one revision, so their results are consistent with each other.
- One live-update pass evaluates every affected view instance across every
  affected live query at one revision, including instances shared by several
  live queries. Their updates are published together.
- A federated result records the revision of each source it reflects. Each
  source is consistent on its own, and its revisions are independent of the
  others'.
- A settled result never reflects state older than its revision. An instance
  that read a stale answer, directly or inline, settles stale, so a stale result
  is always marked. See [Stale answers](consistency.md#stale-answers).

Related values that must stay consistent belong to the same query, or to live
queries that share passes in one session.

### Ordered live-query delivery

- Updates for one live query advance in revision order. Each update reflects
  data at least as new as the one before.
- Refresher may combine several changes into one update and skip intermediate
  states.
- Every update carries a complete result. A consumer that ignores everything
  else an update carries is still correct.
- An update states its causality: which views changed and which store changes
  caused it.
- When an update cannot be stated relative to the previous result — the live
  query has just started, or it restarted after being released — it says so with
  a reset reason, and its result replaces the previous one outright. Consumers
  handle this case.

### Nothing missed

A live query catches up from its previously published revision `Q` to a newer
revision `C` by matching every change its sources announced in the interval
`(Q, C]`. It needs no separate pass per change.

- A change that arrives while a result is being computed schedules another
  pass, and the subscriber sees its effect as a later update.
- A live query's first interval begins at the revision its initial execution
  read at. Changes announced between that execution and a subscriber attaching
  are delivered as that subscriber's first update.
- A change to a recorded read anywhere in `(Q, C]` is relevant, even when a
  later change restores the previous value. Refresher still emits an update
  that explains the invalidation and its causes.
- What counts as a change is the store's answer. A store that reports every
  write as a change turns a write of an identical value into a change as well.
- Once changes stop, every live query converges to the latest data.

### Granular invalidation

Invalidation is precise relative to recorded reads and the store views that
match against them:

- A view instance is invalidated when a store view reports that a change
  intersects one of its recorded reads, and only then. The precision of that
  answer is the store view's; see
  [Designing store views](views.md#designing-store-views).
- An invalidated instance reruns, and so does every view that read it inline,
  up to the nearest ref. Views across a ref boundary rerun only when their own
  reads are invalidated.
- Unaffected views neither rerun nor republish.

What happens after invalidation depends on determinism:

- If an instance's inputs at `C` differ from those at `Q`, it reruns.
- If its inputs changed during `(Q, C]` and are equal again at `C`, a
  deterministic instance may reuse its prior result.
- A non-deterministic instance reruns after any change to its inputs, including
  one that was later restored.

Reusing a result leaves the update and its causality metadata in place.

### Deterministic execution

- The same views over the same data produce the same result, the same refs, and
  the same update boundaries.
- Rounds are deterministic: a round's contents depend only on what views asked,
  and its answers are delivered in the order the reads were issued.
- Query drivers are invisible to views. A view's result depends only on its
  arguments and the data it read, so view instances are shared across queries
  regardless of the drivers that asked for them.

### Contained errors

> **Design in progress.** Error handling is still being designed and may
> change.

- Every error has a kind from a closed set, so a consumer can handle failures
  exhaustively.
- A failure travels up through inline reads to the nearest view with a fallback
  or the nearest ref, and stops there. A failure never crosses a ref.
- A ref without a fallback resolves to `null` with an error that carries the
  path to where it failed. Its parent and siblings are unaffected.
- Failures of the operation itself reject the operation, so a returned result
  can be trusted as a whole.
- A live query whose pass is rejected keeps its last good result and reports the
  failure alongside it.

See [Errors](errors.md).

### Static types, optional validation

- Views, refs, and query results are statically typed with TypeScript.
- Runtime validation is optional. A session using a strict, schema-aware value
  codec validates view arguments and outputs, and reports invalid values as
  errors with the value they belong to.

See [Codec](codec.md).

### Bounded work

- A session applies resource limits, such as the number of view instances, the
  depth of a result, and the size of a page. See
  [Configuration](configuration.md).
- Exhausting a limit rejects the operation. A limit never produces a partial
  result presented as a complete one.

### Live-query lifecycle

See [Lifecycles](lifecycles.md) for the stages these guarantees describe.

- A one-shot query publishes exactly one result and keeps nothing
  alive afterwards, apart from results kept by [view caching](view-caching.md).
- A live query subscribes to one root. Creating it starts no work; its first
  subscriber does.
- A live query is active while it has at least one subscriber, and every view
  instance it depends on is refreshed automatically for that whole time.
- Each live query has its own lifecycle. Stopping or unsubscribing one leaves
  every other live query's results and guarantees unchanged, including those
  that share view instances with it.
- When a live query loses its last subscriber, it is released along with the
  view instances and recorded reads no other live query needs, and a later
  subscriber restarts it with a reset.
- A live query's current state is referentially stable until it publishes or its
  lifecycle changes, so React can read it with `useSyncExternalStore`.
- Results already delivered to a consumer stay valid after the live query stops.

### Guarantees within a session

Revisions, recorded reads, and causality belong to the session that produced
them:

- A live query in a new session — for example, after a reload — starts with a
  reset. Incremental catch-up spans one session's lifetime.
- Causality is available only for changes the session observed.
- Anything that must survive a reload, such as a synchronization cursor, needs
  its own durable representation in a store.

## Internal invariants

### View-instance identity and dependencies

- A view instance is identified by its definition and its arguments, as compared
  by the session's codec, within one session. Its name combines the view's id
  and a key for its arguments, as the codec defines, and is compared only for
  equality.
- A ref always creates a distinct view-instance boundary.
- A view reaches store state only through store views. It may consume any view
  by reading it inline or by returning a ref to it. An inline read is part of
  the caller's instance and recomputes with it; a ref resolves as its own
  instance and refreshes independently of its parent.
- Every store view read is recorded against the view instance that performed
  it, including reads made through inline reads of other views.
- A recorded read holds what invalidation needs — its arguments and any
  metadata the read returned. Keeping the value it returned is the business of
  [view caching](view-caching.md).

### Pass boundaries

- An initial batch of queries executes in one execution at one revision.
- A live-update pass executes all affected view instances across all affected
  live queries in one execution at one revision. An instance shared by several
  live queries is evaluated once per pass.
- A pass publishes the updates of every affected live query together, after the
  whole pass completes.

### Execution

- Execution is a process over waves, driven by query drivers, which choose the
  order of traversal.
  Evaluation and following refs repeat until no driver has a new ref to follow;
  materialization then runs once over the resulting graph and never observes a
  partial one.
- Evaluation batches pending reads in rounds. Each store receives a round's
  reads as one batch, and answers are delivered in the order the reads were
  issued.
- The result graph represents refs explicitly and carries the revision,
  dependency, root, and causality metadata materialization needs.
- Evaluation never searches values for refs; only the refs a driver follows are
  linked. Evaluation runs each view instance once per execution, so a graph
  with cycles still materializes as trees.
- A query driver owns which refs to follow and when, the materializer that
  produces the consumer's representation, and how failures are presented.
  Drivers attach per query, so one execution can serve several drivers over one
  shared result graph.
- Running parts of the graph in a worker or on a compatible server preserves
  every public guarantee, with consistency stated per source.

See [Execution](execution.md).

### Determinism

- Views are deterministic by default. A view that reads a clock, a random
  source, or anything else outside its arguments and its reads declares
  `deterministic: false`.
- Deterministic views consume only deterministic views, by read or by ref. A
  view that consumes a non-deterministic view declares itself non-deterministic
  too.
- Only deterministic results are reused when their inputs are unchanged.
- Views remain side-effect-free whether or not they are deterministic.

## With the transactional store

The transactional store keeps enough history to answer reads as of a revision
and commits writes atomically. Paired with it, Refresher adds:

- **Snapshot consistency.** Every execution reads one committed snapshot across
  its complete view graph, so no published result combines values from
  different revisions.
- **Atomic visibility.** A write that spans several stores is committed as one
  revision and announced as one change event, so every result reflects it
  entirely or not at all.

These follow from the guarantees above applied to a source that keeps history
and commits atomically. Any other source with the same semantics gets the same
guarantees. See [Two-component architecture](two-components.md).
