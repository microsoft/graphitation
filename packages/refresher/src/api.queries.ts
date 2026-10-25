/**
 * Queries: how a query runs. Built on `./api.execution`. A query is a driver and the roots it
 * runs from, as an instance is a view and its arguments. The driver holds whatever else it
 * needs, such as a GraphQL operation or a source of refs found later. A runtime starts the
 * query through its driver, and restarts it once a change reaches what it read. The driver
 * runs its executions itself and returns their waves, so their reads can be matched against
 * later changes.
 */
import type {
  BindFn,
  PromiseOrValue,
  Ref,
  Revision,
  ViewInstanceId,
} from "./api.core";
import type { Codec } from "./api.codec";
import type { Environment } from "./api.env";
import type {
  ExecutionState,
  ExecutionWave,
  ViewInstance,
} from "./api.execution";
import type {
  InvalidateResult,
  ViewInstanceDescriptor,
} from "./api.invalidation";

/** Names a query the runtime keeps, unique within the runtime. Assigned by the runtime. */
export type QueryId = number;

/**
 * A subscribed query without its output: which one it is, its driver and roots, the view
 * instances its runs evaluated, the pins they kept, and its footprint. What the runtime keeps
 * per subscription, matched against changes through `views`, and what a restart is given.
 *
 * The runtime fills `views` as each result arrives, from the instances its waves'
 * refs led to, and keeps it in place across runs; executions fill `pins`. Its fields are the
 * runtime's to change.
 */
export type QueryDescriptor<Footprint = unknown> = {
  readonly id: QueryId;

  /** Runs the query. */
  readonly driver: QueryDriver<unknown, unknown, Footprint>;

  /**
   * The refs the query starts from, read together, their arguments captured by the
   * runtime's codec, as in refs a view's `ref` makes. May be empty: the driver may find
   * every ref itself, or run nothing.
   */
  readonly roots: readonly Ref[];

  /**
   * Every instance a ref led to in the query's runs, under its id, without its result:
   * one descriptor per id, the latest. Instances read only inline are left out: their
   * reads are in their readers' `storeReads`. It grows during a run, as results arrive;
   * after a restart, what was invalidated and not run again is dropped, and once a run
   * finishes, what its roots no longer reach through the edges results reported `traversed`.
   */
  readonly views: Map<ViewInstanceId, ViewInstanceDescriptor>;

  /**
   * The pins the query keeps, under their ids: each answered with a ref to its target, which
   * every execution of its runs reuses in place of running the pin again. Pins belong to the
   * query: another query reaching the same pin asks again. See docs/architecture/pins.md.
   */
  readonly pins: Map<ViewInstanceId, ViewInstance>;

  /** The last footprint the query's runs returned; `undefined` before any. */
  footprint: Footprint | undefined;
};

/**
 * Runs queries of one kind, configured as it was made. It runs its executions through
 * `context.execute`, which runs each at `context.revision` with the runtime's dependencies,
 * signal, and the query's kept pins, and continues them with `context.execute({state, refs})`,
 * with refs found in their results or from a source of its own, until it returns its last
 * result, and never after. A template it finds is bound with
 * `context.bind` before it is followed, to values of its query's variables: how a query
 * gets them is open. See docs/architecture/variables.md.
 *
 * It returns one `QueryPayload`, or `IncrementalQueryResults` for output delivered in parts,
 * such as deferred or streamed ones: `Output` first, then each `Increment`. Aborting
 * `context.signal` stops every execution and ends the subsequent results.
 *
 * Every wave it runs is in the next result's `waves`; reads of any other are never matched,
 * so a change to them would not restart the query. How many executions it runs them in is
 * its own. Neither the runtime nor the driver keeps an execution past its run's last
 * result: a run knows of the runs before it only their footprint.
 *
 * Which instances the query still reaches, the runtime finds from the edges each result
 * reports `traversed`: once a run finishes, those its roots no longer reach leave `views`.
 * A driver that reports none keeps every instance its runs ever reached, at a cost that
 * grows with the query's life: every update pass matches them, and a change to one
 * restarts the query with output nothing refers to.
 */
export type QueryDriver<
  Output = unknown,
  Increment = unknown,
  Footprint = unknown,
> = {
  /** Runs the query for the first time, from its roots. */
  start(
    args: QueryStartArgs,
  ): PromiseOrValue<QueryResult<Output, Increment, Footprint>>;

  /**
   * Runs it again, once a change reached what an earlier run read. It may run just the
   * stale instances' refs, following only refs to instances not subscribed or stale, or walk
   * from `descriptor.roots` again, through valid instances by `edges`, running only the stale
   * ones the walk still reaches. Its output covers what it ran.
   */
  restart(
    args: QueryRestartArgs<Footprint>,
  ): PromiseOrValue<QueryResult<Output, Increment, Footprint>>;
};

export type QueryStartArgs = {
  /** The query's roots: the refs it starts from, read together. May be empty. */
  readonly roots: readonly Ref[];

  readonly context: DriverContext;
};

export type QueryRestartArgs<Footprint = unknown> = {
  /**
   * The query as its runs so far left it. An instance in `views` and not in `invalidated`
   * is valid: its data, and the refs in it, are as an earlier run left them.
   */
  readonly descriptor: QueryDescriptor<Footprint>;

  /**
   * The instances in `descriptor.views` a change reached, each once, with why: never
   * empty. Which of them run, and in which waves, is the driver's.
   */
  readonly invalidated: InvalidateResult<ViewInstanceDescriptor>;

  /**
   * The edges the query's results reported `traversed`, as the runtime keeps them: under the
   * id of an instance in `descriptor.views`, the ids its data leads to. A valid instance's
   * are as its data is, so a driver may walk through it without running it. `undefined`
   * once a result reported none. The runtime's own map: the run's results change it.
   */
  readonly edges:
    | ReadonlyMap<ViewInstanceId, readonly ViewInstanceId[]>
    | undefined;

  readonly context: DriverContext;
};

/** What the runtime gives a driver for one run of a query. */
export type DriverContext = {
  /** The revision every execution of the run reads at, as its `asOf`. */
  readonly revision: Revision;

  /** Schedules what the run defers. */
  readonly env: Environment;

  /** Names instances and captures values, and finds refs in results. */
  readonly codec: Codec;

  /** Binds a template's open inputs, capturing them with `codec`, before it is followed. */
  readonly bind: BindFn;

  /** Aborted when the run must stop: every execution it starts runs with it. */
  readonly signal: AbortSignal;

  /**
   * Runs one wave of a new execution of the query, or of `state`, one `execute` returned. A
   * new one reads at `revision`, with the runtime's store handles, view cache and signal, and
   * the pins the query keeps, adding those it settles to them.
   */
  readonly execute: DriverExecuteFn;
};

/** Runs one wave for a driver. See `DriverContext.execute`. */
export type DriverExecuteFn = (
  args: DriverExecutionArgs,
) => PromiseOrValue<ExecutionState>;

export type DriverExecutionArgs = {
  /** The execution to continue, as for `ContinuedExecutionArgs.state`; none starts a new one. */
  readonly state?: ExecutionState | undefined;

  /** The refs the wave reads together, as for `NewExecutionArgs.refs`. */
  readonly refs: readonly Ref[];

  /** Kept as the wave's `meta`, as for `NewExecutionArgs.meta`. */
  readonly meta?: unknown;
};

/** What a run returns: its whole output, or its output in parts. */
export type QueryResult<Output, Increment = unknown, Footprint = unknown> =
  | QueryPayload<Output, Footprint>
  | IncrementalQueryResults<Output, Increment, Footprint>;

/** A run's output, or one part of it, with the waves run for it. */
export type QueryPayload<Output, Footprint = unknown> = {
  readonly output: Output;

  /**
   * The waves run since the previous result, of any execution, in the order each settled:
   * every wave of the run when it is delivered whole. Their instances' store reads are what
   * the output read, inline reads included; the runtime takes them as the result arrives,
   * with each wave's refs to restart from, and keeps no wave. The array must not grow after
   * the result is returned: a driver that continues an execution returns a slice of its
   * `waves`, not the live array.
   */
  readonly waves: readonly ExecutionWave[];

  /**
   * What the query's runs covered, given whole: it replaces the footprint the runtime keeps,
   * and the next restart gets it. Usually given with a run's last payload. Without one, and
   * when the run fails, the kept one stays.
   */
  readonly footprint?: Footprint;

  /**
   * The edges the driver traversed since the previous result: under the id of each instance
   * it searched, the ids of those it leads to, by refs in its data the driver followed or
   * found already reached, and its target when it is a pin. The runtime keeps the arrays:
   * they must not change once returned.
   *
   * An instance `waves` evaluated loses the edges earlier results gave it, before these are
   * added; one not evaluated again keeps them, as its data is as it was. Once a run
   * finishes, every instance in `views` the roots no longer reach through edges leaves it,
   * so a change to it restarts nothing, such as one only a stale instance's old result led
   * to. A driver finding a ref elsewhere, such as from a source of its own, files it under
   * an instance whose loss should drop it, such as a root.
   *
   * A query whose results leave it out once is never collected again.
   */
  readonly traversed?: ReadonlyMap<ViewInstanceId, readonly ViewInstanceId[]>;
};

/**
 * A run's output delivered in parts: what is ready first, then each part still pending. How
 * the parts combine is the driver's to define.
 */
export type IncrementalQueryResults<
  Output,
  Increment = unknown,
  Footprint = unknown,
> = {
  readonly initialResult: QueryPayload<Output, Footprint>;

  /** Ends after the last part, or once `context.signal` aborts. */
  readonly subsequentResults: AsyncIterable<QueryPayload<Increment, Footprint>>;
};

// The simple driver

/**
 * Makes the simple driver: from its roots, it follows every ref whose meta holds one of
 * `tags`, wave by wave, breadth first, and returns the instances it reached. The roots run
 * regardless; without tags, it runs just the roots. It keeps no footprint.
 */
export type CreateSimpleDriverFn = (
  tags?: readonly string[],
) => QueryDriver<SimpleDriverOutput, never, never>;

export type SimpleDriverOutput = {
  /**
   * One per root, in order, or, for a restart, the instances of its first wave: refs naming
   * one instance get the same object.
   */
  readonly roots: readonly ViewInstance[];

  /**
   * Every instance the roots and the refs followed led to, the roots included, settled or
   * stale. A ref in their data leads to the instance under its id, when it was followed.
   */
  readonly instances: ReadonlyMap<ViewInstanceId, ViewInstance>;
};
