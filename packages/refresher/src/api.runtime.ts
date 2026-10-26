/**
 * Runtimes: what the executions in one share. Built on `./api.execution`, which starts from
 * any refs and has no knowledge of anything here. Consumers read through a query driver.
 */
import type {
  ArgsOf,
  BindFn,
  PromiseOrValue,
  QueryableView,
  Ref,
  RefFor,
  Revision,
} from "./api.core";
import type { Codec } from "./api.codec";
import type { Environment } from "./api.env";
import type { LatestRevisionFn, ViewCache } from "./api.execution";
import type { QueryDriver, QueryResult } from "./api.queries";
import type { ChangeFeed, GetStoreFn } from "./api.stores";

/** A new runtime, attached to its feed before it returns. */
export type CreateRuntimeFn = (args: RuntimeArgs) => Runtime;

export type RuntimeArgs = {
  /** Schedules what the runtime's executions defer, and receives their asserts. */
  readonly env: Environment;

  /**
   * The change notifications the runtime follows. Subscribed on creation: the revision it
   * announces starts the runtime's clock. Without one, the clock stays at 0, as for a
   * graph of derived views that reads no store.
   */
  readonly feed?: ChangeFeed;

  /** Each store's handle, lent to its store views. */
  readonly store?: GetStoreFn;

  /**
   * Names instances and captures values in every execution of the runtime. Defaults to a
   * JSON codec of the runtime's own.
   */
  readonly codec?: Codec;

  /** Whether memoized instances are kept across executions. Defaults to `true`. */
  readonly viewCache?: boolean;
};

/**
 * One Refresher runtime instance: what the executions in it share. It follows one change
 * feed, logs the changes it delivers, and keeps memoized instances across executions. Query
 * drivers run executions with what it lends. The data stays in its stores. See
 * docs/architecture/session.md.
 */
export type Runtime = {
  /** The latest revision the feed delivered: the clock of its executions. */
  readonly latestRevision: LatestRevisionFn;

  /** Schedules what its executions defer, and receives their asserts. */
  readonly env: Environment;

  /** Names instances and captures values in its executions: the one given, or its own. */
  readonly codec: Codec;

  /** Each store's handle, as given. */
  readonly store: GetStoreFn | undefined;

  /**
   * The memoized instances it keeps across executions: valid ones are reused, and those an
   * execution reaches are kept. `undefined` when it keeps none, and once disposed.
   */
  readonly viewCache: ViewCache | undefined;

  /**
   * Aborted with a `SessionError` once disposed. Executions in the runtime run with it, so
   * that those in flight reject, and new ones throw.
   */
  readonly signal: AbortSignal;

  /**
   * Maintenance: lets go of the changes at or before `revision`, after validating every
   * kept instance that still needs them, so nothing valid is lost. Capped at the latest
   * revision; one at or before what is already trimmed does nothing. Subscribed queries
   * are validated too; a run not yet subscribed, or a result still in flight, is not, and
   * restarts once subscribed as if changed. Keep a window behind the latest revision for
   * runs to subscribe in.
   */
  trim(revision: Revision): void;

  /**
   * Detaches from the feed, drops what the runtime keeps, and aborts its `signal`. Calling
   * it again does nothing.
   */
  dispose(): void;

  /** Makes the root an execution starts from. */
  readonly root: RootFn;

  /**
   * Binds a template's open inputs to the values given, capturing them with its codec, as
   * a runner binds an action ref before running its action. See
   * docs/architecture/variables.md.
   */
  readonly bind: BindFn;

  /**
   * Runs a query once: in the pending pass, batched with the other queries in it, or at
   * once when `immediate`. Its result can subscribe to the query's restarts. Rejects, or
   * throws when immediate, if the driver does.
   */
  run<Output, Increment, Footprint>(
    args: QueryArgs<Output, Increment, Footprint>,
  ): PromiseOrValue<RunResult<Output, Increment, Footprint>>;

  /** Runs a query from `root(view, args)` in the pending pass, as `run` does. */
  query<V extends QueryableView, Output, Increment, Footprint>(
    view: V,
    args: ArgsOf<V>,
    driver: QueryDriver<Output, Increment, Footprint>,
  ): Promise<RunResult<Output, Increment, Footprint>>;

  /**
   * Runs a query from `root(view, args)` at once, as `run` does when `immediate`: its result
   * is synchronous if the driver's is.
   */
  immediateQuery<V extends QueryableView, Output, Increment, Footprint>(
    view: V,
    args: ArgsOf<V>,
    driver: QueryDriver<Output, Increment, Footprint>,
  ): PromiseOrValue<RunResult<Output, Increment, Footprint>>;
};

/** One run of a query. */
export type QueryArgs<
  Output = unknown,
  Increment = unknown,
  Footprint = unknown,
> = {
  /** Runs the query, configured as it was made. */
  readonly driver: QueryDriver<Output, Increment, Footprint>;

  /** The refs the query starts from, made with `root`, read together. May be empty. */
  readonly roots: readonly Ref[];

  /**
   * Runs it at once, at the latest revision, outside the pending pass, and synchronously if
   * the driver does. Defaults to `false`.
   */
  readonly immediate?: boolean;
};

/**
 * A query's first result, from which it can be subscribed. View failures are values in its
 * output, as in a GraphQL result, not errors.
 */
export type RunResult<
  Output = unknown,
  Increment = unknown,
  Footprint = unknown,
> = QueryResult<Output, Increment, Footprint> & {
  /**
   * Delivers each restart's result, once a change reaches what the query's runs read,
   * changes since this run included. A change it can no longer rule out, as the changes
   * since were trimmed, counts as one. Callable once, also before the run's last result.
   * Completes once that result arrives if the run evaluated no instance: nothing could
   * restart it. A driver that throws or rejects, and the runtime's disposal, end it through
   * `error`.
   */
  subscribe(
    observer: QueryObserver<Output, Increment, Footprint>,
  ): QuerySubscription;
};

/** Receives a subscribed query's restarts. */
export type QueryObserver<
  Output = unknown,
  Increment = unknown,
  Footprint = unknown,
> = {
  next(result: QueryResult<Output, Increment, Footprint>): void;

  /** Ends the subscription: the driver threw or rejected, or the runtime was disposed. */
  error?(error: unknown): void;

  /** Ends the subscription: nothing could restart the query. */
  complete?(): void;
};

export type QuerySubscription = {
  /** Stops the restarts and aborts one in flight. Calling it again does nothing. */
  unsubscribe(): void;
};

/**
 * A ref to an instance of a queryable view, with its arguments captured by the runtime's
 * codec: the root an execution starts from. Only a queryable view may be one; naming
 * another is an error at the call site. See docs/architecture/views.md#access. Arguments
 * that may be `undefined` may be left out; arguments leaving an input open are a value error.
 */
export type RootFn = <V extends QueryableView>(
  view: V,
  ...args: undefined extends ArgsOf<V> ? [args?: ArgsOf<V>] : [args: ArgsOf<V>]
) => RefFor<V>;
