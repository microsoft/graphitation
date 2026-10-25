/**
 * Executions: running waves of view instances from refs, any refs at all, for whichever
 * driver reads them, a GraphQL executor, a component tree, or a federation host. See
 * docs/architecture/execution.md. Runtimes and queries build on them, in `./api.runtime`.
 *
 * Shaped after graphql-js `execute`: one call takes everything as one object and returns
 * its result, synchronously when every view it runs answered synchronously. One call runs
 * one wave. The driver continues the execution with another call, given the state the last
 * one returned, for as many waves as it needs, whenever it chooses.
 *
 * Execution runs whatever refs it is asked for and has no opinion about how they were
 * chosen; choosing them, and turning them into output, is the driver's. Refs arrive linked
 * and valid, checked when made. It runs each instance once however many refs, inline reads
 * and waves lead to it, and stops at every ref a view returns: the referenced view runs only
 * when a later wave asks for it. A pin is the exception: the wave that asks for it runs its
 * target too, reported apart from the refs it was asked for, and a pin kept for whoever runs
 * the execution answers without running. See docs/architecture/pins.md.
 *
 * Within a wave, reads are batched in rounds, with no prefetch declaration and no timer.
 * Every running instance runs until it returns or waits only on reads it issued; the
 * pending reads form the round, each store receives its share as one batch, and the
 * answers are delivered together, in the order the reads were issued. Given the same refs
 * for each wave and the same answers, an execution issues the same reads in the same rounds
 * and order.
 *
 * Driver-author vocabulary, separate from the consumer contract in `./api.core`.
 */
import type {
  AccessConfig,
  AnyRef,
  AnyView,
  PromiseOrValue,
  ReadonlyResult,
  Ref,
  Revision,
  ValueError,
  View,
  ViewInstanceId,
} from "./api.core";
import type { Codec } from "./api.codec";
import type { Environment } from "./api.env";
import type { ChangeLog, ViewInstanceDescriptor } from "./api.invalidation";
import type { GetStoreFn } from "./api.stores";

/**
 * The latest revision the change feed has delivered. Never goes backwards. Read when an
 * execution starts, as the default for `asOf`, and when it settles.
 */
export type LatestRevisionFn = () => Revision;

/**
 * The settled instances kept across executions, so one whose reads no change has hit is
 * reused in place of running its view. It decides what it keeps, and validates an instance
 * against the changes since before handing it out, moving one a change hit to `stale`. A
 * stale instance stays until it is replaced or deleted: still a result as of the revision
 * it was valid through, for whoever may show it while the view runs again.
 */
export type ViewCache = {
  /**
   * Whether it keeps instances of `view`: a deterministic view declared `memo`. Only their
   * inputs determine their result.
   */
  cacheable(view: AnyView): boolean;

  /**
   * The instance kept under `id`, matched against every change it knows: its
   * `matchedThrough` advanced when no change since hit its reads. One a change hit, or one
   * too old to match, moves to `stale` instead, and is returned as it is, as is one
   * already stale.
   *
   * Execution never reuses a stale instance, nor one that settled stale, one of its store
   * reads answered from state older than asked: its result misses what its store had not
   * caught up with. It
   * reuses one matched through the execution's `startedAt`, newer than asked included: a
   * store reading current state would answer that newer state anyway. It runs the view
   * again when the instance started after the execution and every store read it made was
   * answered exactly as of when it was asked: those stores keep history, and answer as of
   * the execution's `startedAt` instead.
   */
  get(id: ViewInstanceId): ViewInstance | undefined;

  /**
   * Keeps a settled instance of a cacheable view under its id, and says whether it did.
   * A settled one replaces a stale one, and one valid at its `startedAt` replaces one that
   * settled stale; otherwise the newer one stays, so an older instance never displaces a
   * newer one, which more executions can use.
   */
  keep(instance: ViewInstance): boolean;

  /** Drops what is kept under `id`, and says whether anything was. */
  delete(id: ViewInstanceId): boolean;

  /**
   * Matches every instance it keeps whose `matchedThrough` is below `before`, as `get`
   * does: each is matched through the latest change it knows, or moved to `stale`; one
   * already stale is left as it is. Runtime
   * maintenance calls it before trimming the change log to `before`, so that what it keeps
   * stays verifiable.
   */
  validate(before: Revision): void;

  /** How many instances it keeps. */
  readonly size: number;
};

/** An empty view cache, validating against `changes`. */
export type CreateViewCacheFn = (args: CreateViewCacheArgs) => ViewCache;

export type CreateViewCacheArgs = {
  readonly env: Environment;

  /** The runtime's change log, which the cache validates against and never changes. */
  readonly changes: ChangeLog;
};

/**
 * A view instance: one view with one set of arguments, named by `id`. One object for its
 * whole life, moved in place, so whoever holds it sees each move. Execution creates it
 * running and settles it, setting its `descriptor` and its result. Running a view again
 * makes a new instance under the same id, with its own `startedAt`.
 *
 * Settled, no change after `startedAt` through `descriptor.matchedThrough` hit its reads,
 * so it reflects every change through `matchedThrough`. One that settled stale, a store
 * answering one of its reads from state older than asked (`StoreRead.reported` below
 * `StoreRead.startedAt`), reflects only the changes through the oldest such answer, and
 * stays so: its result misses what the store had not caught up with, until a change the
 * store registers hits the read, and whoever holds it runs the view again.
 *
 * Also what the view cache keeps for a memoized view. Settled, it holds no other instance,
 * so keeping one keeps nothing else. Which refs led to it is the driver's to know.
 *
 * In-process only: it holds definitions and live values, and never crosses a boundary.
 */
export type ViewInstance<Args = unknown, Result = unknown> = {
  /** The definition the ref linked to. */
  readonly view: View<Args, Result, AccessConfig>;

  /** The arguments as given. */
  readonly args: Args;

  readonly id: ViewInstanceId;

  /**
   * The `startedAt` of the execution that runs it: the revision every store read it makes is
   * asked at, and the earliest its result is known to hold at. Known when it is created and
   * fixed for its whole life.
   */
  readonly startedAt: Revision;

  /**
   * How many inline reads deep it ran: 0 for an instance a ref leads to. A store read
   * runs at the depth of the reader that issued it.
   */
  readonly depth: number;

  /**
   * Moves forward only, `running` to `settled` to `stale`:
   *
   * - `running`: its view runs in one execution. Waves deliver no running instance.
   * - `settled`: it holds its result and its `descriptor`. One that settled stale is
   *   `settled` too, until a change hits its reads.
   * - `stale`: a change after `descriptor.matchedThrough` reached its reads, or they can no
   *   longer be checked against the changes since. Set by whoever matches it, such as
   *   the view cache. Its result still reflects at least the state it was valid through,
   *   but execution never reuses it.
   */
  status: "running" | "settled" | "stale";

  /**
   * Undefined while it runs; set when it settles. What invalidation matches changes
   * against, what the view cache validates, and what a subscription keeps in place of the
   * instance: it holds no result, and no status. A pin that answered with a ref holds no
   * store reads: its answer is kept, so no change invalidates it. See
   * docs/architecture/pins.md.
   */
  descriptor: ViewInstanceDescriptor | undefined;

  /**
   * Once settled: the result with refs left standing, or `null` when the view failed
   * without a fallback. A failed view with a fallback holds the fallback result alongside
   * its errors. `null` while it runs.
   */
  data: ReadonlyResult<Result> | null;

  /**
   * Once settled: failures of this instance and its inline reads, error paths starting at
   * `data`. Empty on success; alongside `data` when a fallback answered.
   */
  errors: readonly ValueError[];

  /**
   * Hints the instance left for whatever handles it next, such as an effect to run or a
   * telemetry event to record. Opaque to execution.
   */
  extensions?: unknown;

  /**
   * While it runs: every instance it has read inline, in the order first read; a store
   * read reads none. While one of them runs, this instance waits on it: an edge of the
   * graph inline-read cycles are found in. Undefined once it settles.
   */
  reads: Set<ViewInstance> | undefined;

  /**
   * While it runs: what readers waiting on it hold, resolved with its data, or rejected
   * with what their `read` throws, once it is delivered. Made for the first reader that
   * waits.
   */
  settled:
    | {
        readonly promise: Promise<unknown>;
        readonly resolve: (value: unknown) => void;
        readonly reject: (error: unknown) => void;
      }
    | undefined;
};

// Executions

/**
 * The first wave of a new execution, at `asOf` or the latest revision. The dependencies,
 * `latestRevision` to `codec`, and the limits are the execution's, for all its waves.
 */
export type NewExecutionArgs = {
  /**
   * Pins the revision every read is asked at, such as the revision of a delivery a pass
   * answers, or one several executions must share. Without it, reads are asked at the
   * latest revision when the execution starts.
   *
   * A store that cannot read as of the revision answers from current state, or, acting as
   * a cache, from older state it reports, never from before a change that hit the read;
   * the caller, which follows the feed, matches the changes that landed meanwhile against
   * the reads it gets back. A store read that reports no revision of its own reflects
   * `asOf`.
   */
  readonly asOf?: Revision | undefined;

  /** Only when continuing an execution; see `ContinuedExecutionArgs`. */
  readonly state?: undefined;

  /** The feed's clock. Read when the execution starts, as the default for `asOf`, and when each wave settles. */
  readonly latestRevision: LatestRevisionFn;

  /**
   * The refs the wave reads together. Their arguments must already be captured by `codec`,
   * as in refs a view's `ref` or a runtime with the same codec made; the execution names
   * their instances without capturing them again. Each is bound: a template is bound
   * before it is followed. See docs/architecture/variables.md.
   */
  readonly refs: readonly Ref[];

  /** Kept as the wave's `meta`, as given: what the caller ran it for, such as a deferred fragment's label. */
  readonly meta?: unknown;

  /**
   * Memoized instances to use as if their views had just run, when valid at the
   * execution's revision. A live-update pass offers every instance it keeps and none it
   * reruns. Each wave, once settled, has it keep every memoized instance the wave reached.
   */
  readonly viewCache?: ViewCache | undefined;

  /**
   * The pins kept for whoever runs the execution, such as a query, by id: each answered with
   * a ref to its target. A ref to one gets the kept instance in place of running the pin.
   * Each wave, once settled, adds every pin it ran that answered with a ref.
   */
  readonly pins?: Map<ViewInstanceId, ViewInstance> | undefined;

  /** Each store's handle, lent to its store views. Required once a ref reaches a store view. */
  readonly store?: GetStoreFn | undefined;

  /**
   * Captures the arguments of the inline reads and refs that views make, and names
   * instances through `instanceKey`: an instance is a view and an arguments key. Values
   * pass through as given. Executions whose instances meet, through a view cache, share one
   * codec, so that instance ids agree.
   */
  readonly codec: Codec;

  /** Schedules what the execution defers: the end of each round. */
  readonly env: Environment;

  /**
   * Stops the execution when it aborts: the wave running rejects with every read in flight
   * aborted, and later calls throw. Listened to only while a wave runs, and checked when
   * each call starts.
   */
  readonly signal?: AbortSignal | undefined;

  /** Counted across all the execution's waves. */
  readonly limits?: {
    /** Waves one execution may run. */
    readonly maxWaves?: number;
    /** Instances one execution may run, inline reads included. */
    readonly maxInstances?: number;
    /** How deep inline reads may nest. */
    readonly maxDepth?: number;
  };
};

/** The next wave of the execution `state` is, with everything it started with. */
export type ContinuedExecutionArgs = {
  /**
   * The execution to continue, as a call of `execute` returned it, the last or an earlier
   * one. This call runs the next wave at its `startedAt`, reusing every instance it
   * resolved, and returns a new state of it. Its last wave must have settled, and none may
   * have failed.
   */
  readonly state: ExecutionState;

  /** The refs the wave reads together, as for `NewExecutionArgs.refs`. */
  readonly refs: readonly Ref[];

  /** Kept as the wave's `meta`, as for `NewExecutionArgs.meta`. */
  readonly meta?: unknown;
};

/** One wave of an execution: the first of a new one, or the next of `state`. */
export type ExecutionArgs = NewExecutionArgs | ContinuedExecutionArgs;

declare const executionContext: unique symbol;

/** The key an `ExecutionState` holds its execution under. A type only: no value has it outside `execute`. */
export type ExecutionStateKey = typeof executionContext;

/**
 * What one execution resolved, as one call left it: every wave it has run, and every
 * instance they resolved.
 *
 * Each call returns a new state. `startedAt` and `settledAt` are as of the call; `waves` and
 * `instances` are the execution's own, shared by every state it returns, and grow as later
 * calls continue it. Only `execute` changes them. Copy what must stay as it is now.
 *
 * Opaque beyond its fields: only `execute` makes one, and a copy of one continues the same
 * execution.
 */
export type ExecutionState = {
  /** The execution, for later calls to continue. Never read it. */
  readonly [executionContext]: unknown;

  /** The revision every read of the execution is asked at: `asOf`, or the latest when it started. */
  readonly startedAt: Revision;

  /**
   * The latest revision when its last wave settled. The caller matches the changes after
   * `startedAt` up to it against the reads of the instances it keeps, as it matches any
   * later delivery; with no hit, they are valid as of it.
   */
  readonly settledAt: Revision;

  /** Every wave it has run, in order. Shared and live: each call appends its own. */
  readonly waves: readonly ExecutionWave[];

  /**
   * Every instance its waves resolved, by id: those their refs led to, and those read
   * inline while running them, store reads included, memoized or not. An instance taken
   * from `viewCache` ran in no execution here, so nothing it read inline is added
   * through it.
   *
   * Shared and live: every wave adds to it, and a ref or inline read in a later wave
   * reaching an instance resolved here gets that same object.
   */
  readonly instances: ReadonlyMap<ViewInstanceId, ViewInstance>;
};

/** One wave of an execution: one call's refs, answered. */
export type ExecutionWave = {
  /** The latest revision when the wave settled. */
  readonly settledAt: Revision;

  /** The refs, as given. */
  readonly refs: readonly Ref[];

  /** The call's `meta`, as given; `undefined` without one. */
  readonly meta: unknown;

  /**
   * One per ref, in order, run or reused, each settled when delivered. Refs naming one
   * instance get the same object, and so does a ref to an instance an earlier wave resolved.
   */
  readonly evaluated: readonly ViewInstance[];

  /**
   * What the pins among `evaluated` answered with, and where it led. The wave ran these too,
   * whether or not any ref named them. Empty without a pin answering with a ref. See
   * docs/architecture/pins.md.
   */
  readonly pinned: {
    /** The refs the pins answered with, in order, one per instance they lead to. */
    readonly refs: readonly AnyRef[];

    /** One per pinned ref, in order, settled; as in the wave's, the same object for one instance. */
    readonly evaluated: readonly ViewInstance[];
  };
};

/**
 * Runs one wave of an execution, which starts at one revision, `asOf` or the latest, and
 * keeps it: the call that starts it and each that continues it, given it as `state`. Each
 * instance runs at most once per execution: a ref or
 * inline read in a later wave that reaches an instance an earlier wave resolved gets that
 * same instance. A view's failure is part of its instance's result.
 *
 * A wave settles synchronously when every instance it reaches answered synchronously: a
 * view whose `resolve` returned its result itself, a store view whose store answered at
 * once, or an instance from `viewCache`. Execution adds no asynchrony of its own; between
 * waves, the driver waits for whatever it chooses.
 *
 * Exhausting a limit or aborting throws, or rejects when the wave went asynchronous, and
 * fails the execution: a later call throws the same, and its state may hold instances
 * that never settled. A call while the execution's wave still runs throws without failing
 * it.
 */
export type ExecuteFn = (args: ExecutionArgs) => PromiseOrValue<ExecutionState>;
