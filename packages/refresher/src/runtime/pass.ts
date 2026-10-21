/**
 * Passes: how the runtime runs queries. A pass runs each of its queries through its driver,
 * every execution at the pass revision. The runtime keeps a `QueryDescriptor` per
 * subscribed query, and nothing else of its runs; it holds at most one running pass, and
 * the pending one that follows it.
 *
 * A query run with `runtime.run`, unless immediate, and every delivered revision, makes the
 * pending pass if there is none. It starts once no pass runs, where the environment's
 * `scheduleUpdatePass` calls back, never during a call to it: its revision is
 * fixed at the latest delivered, and `invalidate` matches the changes through it against
 * the views of every subscribed query. A query with a stale view restarts in it, given
 * those as invalidated; a new one starts; others do not run. A pass with nothing to run
 * settles as it starts. An immediate run takes no pass: it runs at the latest revision, and
 * once subscribed, the next pass matches its views as any other's.
 *
 * Every run fills a descriptor, which its result keeps until it is subscribed: an
 * unsubscribed one is never matched, and is collected with its result.
 *
 * A query runs in one pass at a time, and a pass waits for each of its queries' last
 * results, increments included: until then its `views` are incomplete, and matching them
 * could miss what the run is still reading. What arrives meanwhile goes to the pending
 * pass: a slow run, such as a streamed one, delays every query's next run.
 *
 * - The pass invalidates as its revision is fixed, so it matches changes through that
 *   revision, and advances the `validThrough` of every view descriptor no change reached to
 *   it.
 * - After a restart, every descriptor it was given as invalidated and that its run did not
 *   replace leaves `views`: nothing advances a stale descriptor, so it would be reported
 *   again on every pass.
 * - Before the change log is trimmed past a subscribed view's `validThrough`, the view is
 *   validated, as the view cache does; otherwise every query would restart as unverifiable.
 *
 * View failures are values in a run's output: a failed instance stays in `views`, and a
 * change to what it read restarts the query. A driver that throws or rejects fails only its
 * query: a failed start rejects the run, and a failed restart ends the subscription.
 * Unsubscribing removes the descriptor from both passes and aborts its run.
 */
import type { BindFn, PromiseOrValue, Revision } from "../api.core";
import type { Environment } from "../api.env";
import type {
  LatestRevisionFn,
  ViewCache,
  ViewInstance,
} from "../api.execution";
import type {
  ChangeLog,
  InvalidateResult,
  Invalidated,
  ViewInstanceDescriptor,
} from "../api.invalidation";
import type { Codec } from "../api.codec";
import type {
  DriverContext,
  QueryDescriptor,
  QueryPayload,
  QueryResult,
} from "../api.queries";
import type {
  QueryArgs,
  QueryObserver,
  QuerySubscription,
  RunResult,
  Runtime,
} from "../api.runtime";
import type { GetStoreFn } from "../api.stores";
import { assertAlways } from "../env/assert";
import { operationError } from "../errors";
import { execute } from "../execution/execute";
import { invalidate } from "../invalidation/invalidate";

/** What the runtime keeps of one run of `run`: its descriptor, and its subscription. */
export type QueryState = {
  readonly descriptor: QueryDescriptor;

  /** The revision its last run read at. */
  revision: Revision;

  /** While a run is in flight: what stops it. */
  controller: AbortController | undefined;

  /** Whether the run in flight is a restart. */
  restarting: boolean;

  /** While it waits in the pending pass: settles the promise `run` returned. */
  started: Deferred | undefined;

  /** Whether `subscribe` was called. */
  subscribed: boolean;

  /** Set once subscribed, until it ends. */
  observer: QueryObserver | undefined;

  /** It never runs again: it completed, failed or was unsubscribed. */
  ended: boolean;

  /** Why it ended before it was subscribed: kept to tell the subscriber. */
  failure: Failure | undefined;
};

type Deferred = {
  readonly resolve: (result: RunResult) => void;
  readonly reject: (error: unknown) => void;
};

type Failure = { readonly error: unknown };

/** The next pass: collects new queries until the running one settles. */
export type PendingPass = {
  /**
   * New queries to start, each with empty `views`. Subscribed ones are not listed: the
   * pass matches them as it starts.
   */
  readonly queries: Set<QueryState>;
};

/** The pass running its queries. */
export type RunningPass = {
  /** The revision every execution in it reads at: the latest delivered when it started. */
  readonly revision: Revision;

  /** Each query whose last result has not arrived yet. The pass settles once it is empty. */
  readonly running: Set<QueryState>;
};

export type PassesArgs = {
  readonly env: Environment;
  readonly changes: ChangeLog;
  readonly latestRevision: LatestRevisionFn;
  readonly codec: Codec;
  /** Binds templates with `codec`, lent to drivers. */
  readonly bind: BindFn;
  readonly store: GetStoreFn | undefined;
  readonly viewCache: () => ViewCache | undefined;
};

/** How a runtime runs queries: its `run`, and what it calls as its feed and trims move. */
export type Passes = {
  readonly run: Runtime["run"];

  /** A delivery arrived: subscribed queries may be stale. */
  changed(): void;

  /** Advances every subscribed view no change reached to the latest revision. */
  validate(): void;

  /** Fails every query, and aborts every run in flight, with `reason`. */
  dispose(reason: unknown): void;
};

export function createPasses(args: PassesArgs): Passes {
  const {
    env,
    changes: log,
    latestRevision,
    codec,
    bind,
    store,
    viewCache,
  } = args;
  let nextId = 0;
  let pending: PendingPass | undefined;
  let running: RunningPass | undefined;
  let scheduled = false;
  /** While `scheduleUpdatePass` runs: a pass started then would miss the query being added. */
  let scheduling = false;
  let disposal: Failure | undefined;
  /** Subscribed queries not ended. */
  const subscribed = new Set<QueryState>();
  /** Queries with a run in flight, in a pass or not. */
  const inFlight = new Set<QueryState>();

  const requestPass = (): PendingPass => {
    pending ??= { queries: new Set() };
    if (disposal !== undefined) return pending;
    if (running === undefined && !scheduled) {
      scheduled = true;
      scheduling = true;
      env.scheduleUpdatePass(startPass);
      scheduling = false;
    }
    return pending;
  };

  const startPass = () => {
    assertAlways(env, !scheduling);
    scheduled = false;
    if (
      disposal !== undefined ||
      running !== undefined ||
      pending === undefined
    )
      return;
    const { queries } = pending;
    pending = undefined;
    const revision = log.head;
    const pass: RunningPass = { revision, running: new Set() };
    running = pass;
    const restarts = match(revision, false);
    for (const state of queries) pass.running.add(state);
    for (const [state] of restarts) pass.running.add(state);
    for (const state of queries) startIn(state, revision);
    for (const [state, invalidated] of restarts)
      restartIn(state, revision, invalidated);
    if (running === pass && pass.running.size === 0) settle();
  };

  const settle = () => {
    running = undefined;
    if (pending !== undefined) requestPass();
  };

  const leavePass = (state: QueryState) => {
    if (running?.running.delete(state) === true && running.running.size === 0)
      settle();
  };

  /**
   * Matches the views of every subscribed query against the changes through the latest
   * revision, `invalidate` called once, and advances each view no change reached to it.
   * Returns the idle queries with stale views; `all` matches running ones too.
   */
  const match = (
    revision: Revision,
    all: boolean,
  ): (readonly [QueryState, InvalidateResult<ViewInstanceDescriptor>])[] => {
    const restarts: (readonly [
      QueryState,
      InvalidateResult<ViewInstanceDescriptor>,
    ])[] = [];
    const descriptors: ViewInstanceDescriptor[] = [];
    for (const state of subscribed) {
      if (!all && state.controller !== undefined) continue;
      for (const descriptor of state.descriptor.views.values())
        descriptors.push(descriptor);
    }
    if (descriptors.length === 0) return restarts;
    const { stale } = invalidate({ env, changes: log, descriptors });
    let staleBy:
      | Map<ViewInstanceDescriptor, Invalidated<ViewInstanceDescriptor>>
      | undefined;
    for (const invalidated of stale) {
      (staleBy ??= new Map()).set(invalidated.descriptor, invalidated);
    }
    for (const state of subscribed) {
      if (!all && state.controller !== undefined) continue;
      let invalidated: Invalidated<ViewInstanceDescriptor>[] | undefined;
      for (const descriptor of state.descriptor.views.values()) {
        const found = staleBy?.get(descriptor);
        if (found !== undefined) (invalidated ??= []).push(found);
        else if (descriptor.validThrough < revision)
          descriptor.validThrough = revision;
      }
      if (invalidated !== undefined && state.controller === undefined) {
        restarts.push([state, { stale: invalidated }]);
      }
    }
    return restarts;
  };

  /**
   * Runs the query, and hands its first result to `deliver` as it arrives: what is returned
   * is what `deliver` returns. Its views take every wave as results arrive, and once the
   * last one has, it is finished.
   */
  const launch = <T>(
    state: QueryState,
    revision: Revision,
    invalidated: InvalidateResult<ViewInstanceDescriptor> | undefined,
    deliver: (result: QueryResult<unknown>) => T,
  ): PromiseOrValue<T> => {
    const controller = new AbortController();
    state.controller = controller;
    state.restarting = invalidated !== undefined;
    state.revision = revision;
    inFlight.add(state);
    const { descriptor } = state;
    const cache = viewCache();
    const signal = controller.signal;
    const context: DriverContext = {
      revision,
      env,
      codec,
      bind,
      signal,
      execute: ({ state: continuing, refs, meta }) =>
        continuing !== undefined
          ? execute({ state: continuing, refs, meta })
          : execute({
              asOf: revision,
              latestRevision,
              env,
              codec,
              store,
              viewCache: cache,
              pins: descriptor.pins,
              signal,
              refs,
              meta,
            }),
    };
    let result: PromiseOrValue<QueryResult<unknown>>;
    try {
      result =
        invalidated === undefined
          ? descriptor.driver.start({ roots: descriptor.roots, context })
          : descriptor.driver.restart({ descriptor, invalidated, context });
    } catch (error) {
      finish(state, invalidated, { error });
      throw error;
    }
    if (!(result instanceof Promise))
      return arrive(state, invalidated, result, deliver);
    return result.then(
      (arrived) => arrive(state, invalidated, arrived, deliver),
      (error: unknown) => {
        finish(state, invalidated, { error });
        throw error;
      },
    );
  };

  const arrive = <T>(
    state: QueryState,
    invalidated: InvalidateResult<ViewInstanceDescriptor> | undefined,
    result: QueryResult<unknown>,
    deliver: (result: QueryResult<unknown>) => T,
  ): T => {
    if (!("initialResult" in result)) {
      absorb(state.descriptor, result);
      const delivered = deliver(result);
      finish(state, invalidated, undefined);
      return delivered;
    }
    absorb(state.descriptor, result.initialResult);
    const rest = createBuffer<QueryPayload<unknown>>();
    const delivered = deliver({
      initialResult: result.initialResult,
      subsequentResults: rest,
    });
    void pump(state.descriptor, result.subsequentResults, rest, (failure) =>
      finish(state, invalidated, failure),
    );
    return delivered;
  };

  /** The run's last result arrived, or it failed. */
  const finish = (
    state: QueryState,
    invalidated: InvalidateResult<ViewInstanceDescriptor> | undefined,
    failure: Failure | undefined,
  ) => {
    inFlight.delete(state);
    state.controller = undefined;
    const { views } = state.descriptor;
    if (failure === undefined && invalidated !== undefined) {
      for (const { descriptor } of invalidated.stale) {
        if (views.get(descriptor.id) === descriptor)
          views.delete(descriptor.id);
      }
    }
    if (!state.ended) {
      if (failure !== undefined || views.size === 0) end(state, failure);
      else if (
        state.observer !== undefined &&
        latestRevision() > state.revision
      )
        requestPass();
    }
    leavePass(state);
  };

  const end = (state: QueryState, failure: Failure | undefined) => {
    state.ended = true;
    subscribed.delete(state);
    const { observer } = state;
    if (observer === undefined) {
      state.failure = failure;
      return;
    }
    state.observer = undefined;
    tell(observer, failure);
  };

  const startIn = (state: QueryState, revision: Revision) => {
    const { started } = state;
    if (started === undefined) return;
    state.started = undefined;
    let result: PromiseOrValue<RunResult>;
    try {
      result = launch(state, revision, undefined, (first) =>
        withSubscribe(state, first),
      );
    } catch (error) {
      started.reject(error);
      return;
    }
    if (result instanceof Promise) result.then(started.resolve, started.reject);
    else started.resolve(result);
  };

  const restartIn = (
    state: QueryState,
    revision: Revision,
    invalidated: InvalidateResult<ViewInstanceDescriptor>,
  ) => {
    const next = (result: QueryResult<unknown>) => {
      const { observer } = state;
      if (observer !== undefined) notify(() => observer.next(result));
    };
    try {
      const result = launch(state, revision, invalidated, next);
      if (result instanceof Promise) result.catch(ignore);
    } catch {
      // Ended in `finish`, which told the observer.
    }
  };

  const withSubscribe = (
    state: QueryState,
    result: QueryResult<unknown>,
  ): RunResult => ({
    ...result,
    subscribe: (observer) => subscribe(state, observer),
  });

  const subscribe = (
    state: QueryState,
    observer: QueryObserver,
  ): QuerySubscription => {
    if (state.subscribed) {
      throw operationError({
        code: "ALREADY_SUBSCRIBED",
        message: "A query's result subscribes once",
      });
    }
    state.subscribed = true;
    const subscription: QuerySubscription = {
      unsubscribe: () => unsubscribe(state),
    };
    if (state.ended) {
      tell(observer, state.failure);
      state.failure = undefined;
      return subscription;
    }
    state.observer = observer;
    if (disposal !== undefined) {
      end(state, disposal);
      return subscription;
    }
    subscribed.add(state);
    if (state.controller === undefined && latestRevision() > state.revision)
      requestPass();
    return subscription;
  };

  const unsubscribe = (state: QueryState) => {
    state.observer = undefined;
    if (state.ended) return;
    state.ended = true;
    subscribed.delete(state);
    if (!state.restarting) return;
    state.controller?.abort(
      operationError({
        code: "UNSUBSCRIBED",
        message: "The query was unsubscribed",
      }),
    );
    leavePass(state);
  };

  const run = ({
    driver,
    roots,
    immediate = false,
  }: QueryArgs): PromiseOrValue<RunResult> => {
    if (disposal !== undefined) {
      if (immediate) throw disposal.error;
      return Promise.reject(disposal.error);
    }
    const state: QueryState = {
      descriptor: {
        id: nextId++,
        driver,
        roots,
        views: new Map(),
        pins: new Map(),
        footprint: undefined,
      },
      revision: log.head,
      controller: undefined,
      restarting: false,
      started: undefined,
      subscribed: false,
      observer: undefined,
      ended: false,
      failure: undefined,
    };
    if (immediate) {
      return launch(state, log.head, undefined, (first) =>
        withSubscribe(state, first),
      );
    }
    return new Promise<RunResult>((resolve, reject) => {
      state.started = { resolve, reject };
      requestPass().queries.add(state);
    });
  };

  return {
    run: run as Runtime["run"],
    changed() {
      if (subscribed.size > 0) requestPass();
    },
    validate() {
      if (subscribed.size > 0) match(log.head, true);
    },
    dispose(reason) {
      if (disposal !== undefined) return;
      disposal = { error: reason };
      if (pending !== undefined) {
        for (const state of pending.queries) state.started?.reject(reason);
      }
      pending = undefined;
      running = undefined;
      for (const state of inFlight) state.controller?.abort(reason);
      for (const state of subscribed) end(state, disposal);
    },
  };
}

/** Each payload's waves into `views`, what pins pinned included, and its footprint, as it arrives. */
function absorb(descriptor: QueryDescriptor, payload: QueryPayload<unknown>) {
  const { views } = descriptor;
  for (const wave of payload.waves) {
    for (const instance of wave.evaluated) keepDescriptor(views, instance);
    for (const target of wave.pinned.evaluated) keepDescriptor(views, target);
  }
  if (payload.footprint !== undefined) descriptor.footprint = payload.footprint;
}

function keepDescriptor(
  views: QueryDescriptor["views"],
  instance: ViewInstance,
): void {
  const evaluated = instance.descriptor;
  if (evaluated !== undefined) views.set(evaluated.id, evaluated);
}

/** Reads a run's later parts as they come, whether its consumer reads them or not. */
async function pump(
  descriptor: QueryDescriptor,
  results: AsyncIterable<QueryPayload<unknown>>,
  rest: Buffer<QueryPayload<unknown>>,
  finished: (failure: Failure | undefined) => void,
): Promise<void> {
  try {
    for await (const payload of results) {
      absorb(descriptor, payload);
      rest.push(payload);
    }
  } catch (error) {
    rest.fail(error);
    finished({ error });
    return;
  }
  rest.end();
  finished(undefined);
}

function tell(observer: QueryObserver, failure: Failure | undefined) {
  if (failure === undefined) notify(() => observer.complete?.());
  else notify(() => observer.error?.(failure.error));
}

/** Calls an observer; what it throws is rethrown in a microtask, never into the runtime. */
function notify(call: () => void) {
  try {
    call();
  } catch (error) {
    queueMicrotask(() => {
      throw error;
    });
  }
}

function ignore() {}

/** Payloads kept for one consumer until it reads them. */
type Buffer<T> = AsyncIterable<T> & {
  push(value: T): void;
  end(): void;
  fail(error: unknown): void;
};

function createBuffer<T>(): Buffer<T> {
  let values: T[] = [];
  let read = 0;
  let ended = false;
  let failure: Failure | undefined;
  let detached = false;
  let waiting:
    | {
        readonly resolve: (result: IteratorResult<T>) => void;
        readonly reject: (error: unknown) => void;
      }
    | undefined;
  const done: IteratorResult<T> = { done: true, value: undefined };

  const iterator: AsyncIterator<T> = {
    next() {
      if (read < values.length) {
        const value = values[read++]!;
        if (read === values.length) {
          values = [];
          read = 0;
        }
        return Promise.resolve({ done: false, value });
      }
      if (failure !== undefined) {
        const { error } = failure;
        failure = undefined;
        ended = true;
        return Promise.reject(error);
      }
      if (ended || detached) return Promise.resolve(done);
      return new Promise((resolve, reject) => {
        waiting = { resolve, reject };
      });
    },
    return() {
      detached = true;
      values = [];
      read = 0;
      return Promise.resolve(done);
    },
  };

  return {
    [Symbol.asyncIterator]: () => iterator,
    push(value) {
      if (detached || ended) return;
      if (waiting === undefined) {
        values.push(value);
        return;
      }
      const { resolve } = waiting;
      waiting = undefined;
      resolve({ done: false, value });
    },
    end() {
      ended = true;
      if (waiting === undefined) return;
      const { resolve } = waiting;
      waiting = undefined;
      resolve(done);
    },
    fail(error) {
      if (detached || ended) return;
      if (waiting === undefined) {
        failure = { error };
        return;
      }
      const { reject } = waiting;
      waiting = undefined;
      ended = true;
      reject(error);
    },
  };
}
