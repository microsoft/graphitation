# Testing

See the [architecture overview](overview.md) for the broader system context,
[Guarantees](guarantees.md) for the propositions testing asserts, and
[Debugging](debugging.md) for the records it asserts on.

## What testing promises

Refresher's guarantees rest on the application keeping its side of the
[contract](guarantees.md#the-applications-side-of-the-contract): views are
side-effect-free and deterministic, store views catch every relevant change,
and change feeds report every change after it happens. A violation surfaces
late and far from its cause, as a stale result or a missing rerun. Testing
turns those violations into failures at the point where they are introduced.

Most of that testing is a by-product of describing the application. The
session already records what every view read and what every change touched, so
a harness can run workloads under a schedule it controls and check them against
answers the system produces itself. With runtime schemas, which state what a
legal value is, the harness can also build the workloads, with no hand-written
cases. See [What needs a schema](#what-needs-a-schema).

What that buys:

- **Defects found by search.** The cases that matter are the ones nobody thought
  to write down, and a generator has no such blind spot.
- **Every failure is a seed.** A run is a function of its seed, so a failure
  reproduces exactly, including the interleaving that caused it.
- **Coverage grows with machine time.** A campaign that runs overnight explores
  more than a suite written once.
- **The strongest checks need nothing declared.** Several hold on any workload,
  because they compare the system against a second answer it produced itself.
  See [What you get for free](#what-you-get-for-free).

A reported violation is real. Silence is evidence, never proof. See
[Limits](#limits).

## What needs a schema

The baseline needs no schema: arguments are JSON values, and their TypeScript
types exist only at compile time. A test runner can't generate a value from a
type it never sees, so by default it has no way to build inputs on its own.

| Available by default                                         | Needs runtime schemas                                   |
| ------------------------------------------------------------ | ------------------------------------------------------- |
| Seeded simulation of workloads the application writes        | Generated arguments, records, and writes                |
| [Built-in checks](#what-you-get-for-free) on those workloads | Unit tests that answer callees from their result shapes |
| Contracts and expectations as checks at every read           | Contracts that prune and steer generation               |
| Asserts and invariant views                                  | Campaigns and the [corpus](#the-corpus)                 |

The second column needs a [schema-aware codec](codec.md) whose schemas
are strict enough to generate from, as well as to validate with. Onboarding to
it is still to be designed, and the sections below that rely on it say so.

## Why this is possible

Refresher has a set of properties that are ordinary design choices on their
own, and together make reactive code simulable:

- **Views are deterministic.** Each is a function of its arguments and what it
  read, so any result can be produced a second, independent way and compared.
- **Views read through one door.** A view reads its arguments, store views, and
  other views, and nothing else, so its inputs are enumerable.
- **Everything is a definition with an identity.** Views and store views are
  named, so they can be recorded, substituted, and reported on individually.
- **Shapes can be declared.** With a schema-aware
  [codec](codec.md), arguments and results carry schemas, so inputs
  can be generated and outputs checked mechanically. See
  [What needs a schema](#what-needs-a-schema).
- **Equality is canonical.** The codec defines equality for the whole system,
  so comparisons need no bespoke matcher.
- **Stores are passive.** A store is read through store views and reports
  changes through a change feed. A simulated store is a legal store, so the
  harness can play the store's owner.
- **Reads are recorded.** Dependency tracking already knows which view read
  what, with which arguments: the raw material for contract checking.
- **The result graph is serializable.** A result can be encoded, moved, and
  materialized again, which makes the consumer boundary checkable.
- **What the session did is data.** [Debugging](debugging.md) records give an
  ordered account of deliveries, evaluations, and updates, so assertions can be
  made about behaviour as well as about published results.

## Deterministic simulation testing

Deterministic simulation testing runs a whole system in one process under a
scheduler the test controls. Every source of non-determinism, such as
concurrency, time, storage latency, faults, and message order, is supplied by a
pseudo-random generator seeded once at the start. The run is then a function of
its seed: the same seed produces the same execution, down to the order in which
a delivery and an execution interleaved.

Rare orderings become things to search for, and a failure is reported as a seed.
Reproduction costs one run.

The technique was pioneered for FoundationDB, see
[Simulation and Testing](https://apple.github.io/foundationdb/testing.html), and
is standard practice for systems with strong correctness requirements,
including TigerBeetle, Convex, and Turso.

Refresher is a library, so what is tested is mostly application code: views,
store views, change feeds, and query drivers. The properties above make the
runtime simulable, and the same properties make anything built on it simulable
too.

## How it works

A run is a loop, and every step is a function of the seed.

1. **A workload is constructed.** Writes to simulated stores, queries started
   and released, components mounting and unmounting roots. With schemas, they
   are drawn from declared shapes and started from a state the search already
   found interesting; without, the application writes them.
2. **It executes in a simulated session.** The harness owns the scheduler,
   when stores answer reads, when changes are delivered, which reads fail, and
   in which order messages between sessions arrive.
3. **Checks run throughout.** Contracts at every read, invariant views after
   every delivery, `always` assertions where they are written, and the built-in
   checks that need no declaration.
4. **A failure is reduced and reported.** The workload shrinks toward the
   smallest one that still fails, and is reported as a seed plus a trace. The
   seed reproduces the execution, and the trace explains it.
5. **A campaign summarizes and steers.** Across many runs, `sometimes` reports
   which interesting states were reached, and those states are kept to start
   from again. See [The corpus](#the-corpus).

## Determinism is a requirement

The application's side of the contract is what makes simulation work:

- A view is a deterministic function of its arguments and what it read, or
  declares itself non-deterministic.
- A store view decides whether a change hits a read from the change and the
  read alone.
- A change feed reports every change, after it happens.
- Results are serializable and compared by the codec.

Under simulation, these rules are enforced by **capability**. A view's context
carries reads and nothing else: time, randomness, and network access are absent
from the environment a view runs in. A view reaching for the clock fails
at the call, with a message naming the fix, and the failure points at the view.

Detecting misuse after the fact doesn't survive `await`: once a view suspends,
there is no dependable way to tell which code a continuation belongs to.
Expressing the rule as what a context holds sidesteps the question.

### The escape hatches

Some things are non-deterministic by nature, and each has a designated home:

- **Non-deterministic views** declare it, and their reruns are attributed to
  that declaration. See [Views](views.md#determinism).
- **Query drivers** are the consumer boundary. A driver turns a result graph
  into whatever the consumer needs, and is held to obligations: materializing
  the same graph twice yields the same output.
- **The data source** is the store's owner. Writes, sync, and external services
  live there. Under simulation the harness plays that part; with the
  transactional store, its own tools cover it. See
  [Two-component architecture](two-components.md).

## What you declare

Two kinds of declaration. A **contract** says what a view accepts and produces;
an **assert** says what must hold while it runs. Generators belong to the
schema, and are described below because they make the other two usable.

Nothing declares how the search spends its budget. Steering is derived from
what the asserts report.

### Contracts

A contract is a predicate describing what a view accepts, declared alongside it
and evaluated **before** `resolve`. Rejection is a returned verdict, which
matters because rejection is the common case during generation.

The same predicate means two things depending on where the input came from:

- The harness invented the arguments to drive the view as a root: rejection
  **prunes**. The harness evaluates views directly, below the query API, so it
  drives any view this way, queryable or not. The input was outside the declared domain, and nothing is wrong.
- Another view computed the arguments and read it: rejection is a **failure
  attributed to the caller**, which produced something the callee doesn't
  accept.

A contract may read state, since most interesting conditions are about more
than argument shape. Its reads are recorded like any other, and they tell the
generator what state must exist for an input to be legal, so it can build toward
that.

Pruning is a fallback. A generator that mostly produces illegal candidates
wastes the run and shrinks badly, so legality belongs in the producer wherever
it can be expressed there. Contracts catch what a producer can't encode, and
remain the check at every read either way.

The other direction is declared at the call site: a read may carry an
expectation about the result it needs, in the spirit of
`read(view, args, expected)`. The callee states what it accepts, the caller
states what it needs, and one execution of the caller checks both.

This is consumer-driven contract testing, with pairs discovered by running:
read tracking already records which view read which, and with what.

Because contracts are ordinary predicates, they are useful outside tests too,
where they turn an illegal read into an attributed error.

### Generating values

Generation needs runtime schemas; see [What needs a schema](#what-needs-a-schema).

A contract says which values are legal; a producer says how to build one. A
predicate can reject a value and can't be inverted into a generator, so
generation has to succeed by construction. That is three problems:

- **Well-formedness.** A value with structure, such as an identifier with a
  prefix or a code, is out of reach by generating its underlying type. Where
  the schema is declarative, such as a pattern, a range, or an enumeration, a
  producer is derived from it. Elsewhere a value type carries a producer of its
  own.
- **Existence.** Most arguments refer to something that already exists, and a
  well-formed id with nothing behind it makes every read return nothing found.
  Declaring an argument as a key into a store lets the generator draw from
  current state. A missing id then becomes a deliberate case, worth a
  `sometimes`.
- **Interestingness.** Which legal values are worth trying more often:
  collisions, boundaries, duplicates, the empty case. This belongs to the
  producer as well.

This places a requirement on the [codec](codec.md), whose schema
vocabulary is open: **the vocabulary has to be declarative enough to generate
from, as well as to validate with.**

Producers are written as the property-testing library's arbitraries, registered
apart from the declarations they serve, so nothing about generation reaches the
application bundle. The harness checks that every value a producer makes
satisfies its validator.

### Asserts

Three kinds. The first two fail the run that violates them; the third only
reports.

- `assertAlways(cond: boolean, message: string): asserts cond`: this holds
  whenever it is evaluated.
- `assertNever(value: never, message?: string): never`: control never reaches
  here. It takes the impossible value, so the compiler proves exhaustiveness,
  and the same call catches a value that arrived anyway, from a decoded payload
  or an older persisted record.
- `assertSometimes(cond: boolean, message: string): void`: this state is
  reached at all. It catches a suite that passes because it explored nothing.
  See Antithesis's
  [Sometimes Assertions](https://antithesis.com/docs/best_practices/sometimes_assertions/).

Only the first two narrow types. The `message` is the **identity of the property
across runs**: a campaign aggregates coverage and failures by it, so renaming
one starts a new property.

Asserts belong in `resolve`, next to the logic that knows a state is
interesting.

Refresher's own code uses the same asserts, so a simulation checks the runtime
along with the application. They report to the environment the driver supplies,
so a harness observes them without any global state. They are dense, in the
spirit of [TigerStyle](https://github.com/tigerbeetle/tigerbeetle/blob/main/docs/TIGER_STYLE.md):
preconditions, postconditions and invariants, each property checked both where it
is written and where it is read. Most carry no message; their call site identifies
them, filled in as a literal by the build.

#### Asserts record, then throw

A failing assert is **recorded before it throws**, so a caller that catches the
error acts on something already observed. A view may hold a child's failure as
data, see [Errors](errors.md), and recording first keeps that from hiding the
signal.

Throwing is what makes `asserts cond` sound, and a violated `always` means the
view is already wrong. **Recording is the semantics, throwing is a policy over
it.** Relaxing the policy later stops executions from failing and changes
nothing a test observes.

One piece of advice remains: **don't branch on a caught assert failure.** Code
that treats a failed assert as a condition behaves differently the day throwing
is relaxed.

#### What a `sometimes` is for

It has two consumers:

- A **manual test may require a named one to fire**, which proves reachability:
  the branch still exists, and a refactor didn't make it impossible.
- A **campaign reports whether generated workloads reached it on their own.**
  One that fires only in hand-written scenarios points at a producer or a
  contract narrower than reality.

Campaign coverage is a report. A `sometimes` that never fires is ambiguous
between a state the program can't reach and one the search couldn't find, and
failing builds on it teaches people to delete the declaration.

A quantity worth driving is written as a ladder of named situations, such as
`sometimes(unread > 2)` and `sometimes(unread > 8)`, each reported on its own.

### Invariant views

A condition across several records or stores, such as "every message belongs
to a chat that exists" or "a chat's unread count equals its unread messages", is
a property of no single value. It is a deterministic view returning a verdict.

Expressed as a view, it costs no new machinery. It is tracked and invalidated
like any other view, so checking it after a delivery costs what changed, and a
violation arrives attributed to the change that caused it.

An invariant may span the application's stores and a simulated outside world,
which is where the properties of a sync protocol live: "every message marked
synced equals the server's, or is pending" is checked after every delivery.

### Outside tests

Everything in this section is incremental, so it can run wherever its cost is
acceptable, including production, where it turns a silent defect into an
attributed failure.

| Declaration       | Evaluated      | Costs                                  |
| ----------------- | -------------- | -------------------------------------- |
| Contract          | Per read       | The arguments, plus any state it reads |
| Invariant view    | Per delivery   | What the delivery changed              |
| `always`, `never` | Per evaluation | The condition                          |
| `sometimes`       | Per evaluation | The condition, and a counter           |

Which of them run in an environment is a deployment decision. Contracts,
invariant views, and `sometimes` change only what is reported; a failing
`always` or `never` throws and so changes the result.

The checks in the next section need a second execution or a controlled
schedule, so their cost scales with total state. They belong to simulated runs.

## What you get for free

These checks need nothing declared. Each compares two answers the system
produced itself, so they apply to any workload.

**Recomputation.** At a revision, recompute every live instance from nothing and
compare with what the session maintained incrementally. Under the determinism
requirement they must be equal, so one comparison checks the whole incremental
machinery: invalidation, reuse, rebinding, sharing, and caching. A store view
that missed a change, or a change feed that dropped one, appears as a maintained
result that disagrees with the recomputed one.

**Matching soundness.** For every change a store view reported as missing a
read, read it again: the answer must be unchanged. This checks a store view's
`matches` on its own, and names the store view, the read, and the change.

**Differential replay.** Run the same logical workload twice, varying only what
the simulation injects: the seed, how long reads take, how deliveries interleave
with executions. Any divergence is a witness that a view consulted something
other than what it read, localized to the instance where the runs first
disagree. This catches module-level state and impure imported helpers.

**Prepare neutrality.** [Batched reads](views.md#batching-reads) change only how
many round trips a read takes. Run a workload with and without store views'
`prepare` and compare both results and recorded reads.

**Caching neutrality.** Results, updates, and their reasons are the same with
[view caching](view-caching.md) on or off, under any eviction, and with any
change-log window.

**Federation neutrality.** A view tree split across sessions through
[federation](federation.md) produces the results it produces in one session.

**Explanation agreement.** Invalidation and explanation run the same store view
over the same reads, so every rerun has a reason naming a hit read. See
[Invalidation](invalidation.md#what-is-guaranteed).

**Materialization purity and graph sufficiency.** Materializing a graph twice
yields the same output, and so does encoding it, decoding it, and materializing
the copy. The second shows a graph carries everything it needs to cross a
session boundary.

**Published-result laws.** An update applied to the previous result yields the
next one. An update other than a reset carries reasons. A live query's revision
never moves backwards.

## Simulated stores and the outside world

Stores are the only part of a test that stands for something outside Refresher,
and they need no mocks: a simulated store is a legal store with a legal change
feed. The harness plays the store's owner, generating writes and delivering
their changes.

Two layers cover what lies beyond the store:

- **Generated writes.** When a store declares a schema for its records, the
  harness can write legal values with no hand-written fixtures. Without one,
  the application supplies the writes.
- **A model.** When the outside world has invariants worth checking, such as a
  sync protocol, a cursor, or a paginated feed, the writes come from a model: a
  simplified implementation of that world which keeps its own state. An
  invariant view can then span both.

Faults are injected per store and per session: a read that fails, a read that
answers late, a delivery that arrives while an execution is waiting on a round,
a message between federated sessions that arrives out of order. Those orderings
are what a reactive defect usually needs, and the simulation produces them on
demand.

## Automatic tests

Three tiers, separated by how much of the system is real. Each is more expensive
and more revealing than the one before.

### Unit tests

One view. With schemas, callees are answered from their declared result
shapes, so only this view's logic is under test; without, they run for real. For a store view, its matching is checked against
generated changes and reads.

What it catches: a view that rejects an input its own contract accepts, a result
outside its declared shape, disagreement with itself across two runs, and a
reach for something ambient.

### Integration tests

Callees run for real, so the **pairs** come under test. Arguments recorded at
each read are checked against the callee's contract, and results against the
caller's expectation.

This is where contract mismatches surface: a caller passing an argument the
callee doesn't accept, a callee producing a shape its caller can't use, a ref
to a view that can't be referenced, or a declared argument domain wider than
the code behind it.

There is no scheduler, concurrency, or fault injection here, which keeps the
tier fast enough to run constantly.

### Full simulations

The whole session: seeded scheduling, writes and deliveries interleaved with
executions, live queries started and released, federated sessions, cache
eviction, and injected faults.

This is the only tier that finds ordering defects, and the only one where the
checks that need a controlled schedule apply.

## Manual tests

A manual test is the same machinery with a hand-written workload. Every
automatic check still applies: contracts, invariants, asserts, built-in checks,
and the trace.

Manual tests earn their place for scenarios generation can't construct, for
executable documentation, and for requiring a named `sometimes` to fire. A
property that generalizes is worth more as a contract, an invariant view, or an
assert, since those are checked against every generated input. A failure a
campaign found is best kept as a seed, which reproduces the original execution
exactly.

## Running tests

### Locally

Unit and integration tiers are cheap enough to run continuously, and catch the
contract-level defects that make up most of the day. Full simulations run
locally too, briefly.

### In CI

CI runs a fixed, versioned set of seeds, so a check is bounded and
reproducible:

- **Sanity seeds**, a small set that exercises the system broadly.
- **Regression seeds**, failures that actually happened. Each stays until the
  code that caused it is gone.

`sometimes` assertions are reported here and fail the build only where a manual
test requires one.

### Campaigns

Long runs, hours or days, on dedicated machines. A campaign produces new failing
seeds, which join the regression set; a coverage report of which `sometimes`
assertions generated workloads reached; and a corpus of the states behind them.

### The corpus

A campaign that starts every run from empty stores spends most of its budget
reaching states it already reached. When a `sometimes` fires, the harness
captures the simulated stores' contents. A later run, in a later process, starts
a new session from that state, so the corpus holds interesting **states**: a
fuzzer's corpus of interesting inputs, moved to where reactive defects live.

Rarity ranks it. A state reached by a `sometimes` that fired a handful of times
in ten thousand runs earns more budget than one reached constantly. That is the
whole of steering.

Two limits follow from the mechanism:

- **Only state is captured.** A forked run starts from the stores' contents
  with a fresh schedule and a fresh session, which compounds rare states.
  Rare interleavings are still reached by ordinary search.
- **An entry is re-admitted on load.** Each is checked against every invariant
  view and every contract it reaches. One that a code change made illegal fails
  admission and is dropped, so nothing needs version stamps.

## The trace

Assertions can be made against the records described in
[Debugging](debugging.md). Published results answer what the application saw;
the records answer what the session did, which is where most reactive defects
live. They are the only place where "this view didn't rerun" is a statement,
since a driver may skip publishing an unchanged result while the records keep
it.

The records name a stable vocabulary of facts, so an assertion written against
one implementation holds against another:

- a delivery, its revision, and its changes;
- an instance evaluated, and what it read;
- an instance reached by a change and left unchanged;
- an instance missed by a change, and the reads the change didn't hit;
- an update published, and its reasons;
- an assert that failed, its message, and the instance that raised it.

## Limits

A reported violation is real; silence is evidence, never proof.

- **Purity in general.** Removing ambient capabilities closes the common
  routes, and only consequences of module-level state or impure helpers are
  observed, and only those that change a result.
- **Hidden inputs that never vary.** An ambient value constant for a whole run
  produces no divergence.
- **Application intent.** Contracts and invariants are checked. Whether a view
  computes what the product needs is outside the model.
- **Wall-clock behaviour.** Simulated time is logical. Latency, memory growth,
  and collection pressure are outside what it reproduces.
- **Real stores.** A simulated store checks views and store views against the
  store contract. Whether a real database's change feed reports every change is
  a property of that database and its integration. Matching soundness and
  recomputation over a real store, outside simulation, are the checks that
  reach it.
- **Rules that exist only in types.** `assertNever` catches an impossible
  variant that arrives anyway; constraints with no runtime witness stay
  unchecked.
- **Exhaustive interleaving.** Simulation explores a function of the seed, and
  anything found reproduces exactly. Coverage grows with runs.

## Open questions

- **Onboarding to schemas.** How an application adopts a schema-aware codec
  incrementally, which schema vocabulary is strict enough to generate from, and
  how much of the second column a partial adoption unlocks.
- **Long runs.** What a simulation keeps when keeping every record isn't free,
  and which checks survive a truncated record.
- **Real store conformance.** How a production change feed is held to the
  contract outside simulation, where faults can't be injected on demand.
- **Reducing interleavings.** Shrinking a workload is well understood.
  Shrinking the schedule that exposed a failure is harder, and a reduced
  ordering may stop reproducing it.
- **Driver obligations.** Which properties a query driver must keep beyond
  materialization purity, such as publishing every changed result, and how a
  harness checks them for drivers it didn't write.
