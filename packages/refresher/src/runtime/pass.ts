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
 * the views of subscribed queries. A query with a stale view restarts in it, given
 * those as invalidated; a new one starts; others do not run. A pass with nothing to run
 * settles as it starts. An immediate run takes no pass: it runs at the latest revision, and
 * once subscribed, the next pass matches its views as any other's.
 *
 * A pass matches only the queries that read a store changed since the last match, so its
 * cost follows what changed, not how many queries are subscribed. Only verified queries are
 * filed by the stores their views read: subscribed, idle, and with every change through
 * `cursor`, the last match's revision, matched against their views. So a match lifts a
 * filed query's views to `cursor` and reads the log only from there; the view cache,
 * sharing the descriptors, gains as much. A query leaves the files as it restarts or ends.
 * As it subscribes idle, or a subscribed run finishes, it is filed if its views are valid
 * through the latest revision; otherwise it is unverified, and the next match checks it
 * whatever changed, each view from its own `matchedThrough`. Lifting claims only what the log
 * holds: a store that stops observing says so with a change, which hits its reads.
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
 *   revision, and advances the `matchedThrough` of every view descriptor it matched and no
 *   change reached to it.
 * - After a restart, every descriptor it was given as invalidated and that its run did not
 *   replace leaves `views`: nothing advances a stale descriptor, so it would be reported
 *   again on every pass that matches it.
 * - The runtime keeps the edges results reported `traversed`. A run that lost one, as an
 *   instance with edges ran again or left `views`, is collected once it finishes: every
 *   view its roots no longer reach through edges leaves `views`, with its edges. Mark and
 *   sweep, at a cost of the views kept, only after a run that may have orphaned some.
 * - Before the change log is trimmed, a match moves `cursor` to the latest revision and
 *   checks the views of running subscribed queries too, as the view cache validates;
 *   otherwise every query would restart as unverifiable. It restarts nothing: a stale query
 *   waits unverified for the next pass.
 *
 * View failures are values in a run's output: a failed instance stays in `views`, and a
 * change to what it read restarts the query. A driver that throws or rejects fails only its
 * query: a failed start rejects the run, and a failed restart ends the subscription.
 * Unsubscribing removes the descriptor from both passes and aborts its run.
 */
import type {
  BindFn,
  PromiseOrValue,
  Revision,
  StoreName,
  ViewInstanceId,
} from "../api.core";
import type { Environment } from "../api.env";
import type {
  ExecutionState,
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
import { assertAlways, assertSometimes } from "../env/assert";
import { operationError } from "../errors";
import { execute } from "../execution/execute";
import { invalidate } from "../invalidation/invalidate";
import { failStaleAnswers } from "./staleAnswers";

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

  /** While filed: the stores its `views` read, it is filed under. */
  stores: Set<StoreName> | undefined;

  /** Set once subscribed, until it ends. */
  observer: QueryObserver | undefined;

  /** It never runs again: it completed, failed or was unsubscribed. */
  ended: boolean;

  /** Why it ended before it was subscribed: kept to tell the subscriber. */
  failure: Failure | undefined;

  /**
   * The edges its results reported `traversed`, each non-empty, under its source's id:
   * `undefined` once a result reported none, as it is never collected then.
   */
  edges: Map<ViewInstanceId, readonly ViewInstanceId[]> | undefined;

  /** Whether its run in flight lost an edge, so its roots may reach less: collected as it finishes. */
  lost: boolean;
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
  /** For each store, the filed queries whose `views` read it. */
  const readers = new Map<StoreName, Set<QueryState>>();
  /** Subscribed idle queries not filed: the next match checks each view from its own `matchedThrough`. */
  const unverified = new Set<QueryState>();
  /** Every change through it was matched against the views of every filed query. */
  let cursor = log.head;

  /** A subscribed query turned idle: filed if verified through the latest revision, unverified otherwise. */
  const admit = (state: QueryState) => {
    assertAlways(env, subscribed.has(state));
    assertAlways(env, state.controller === undefined);
    const head = log.head;
    for (const descriptor of state.descriptor.views.values()) {
      if (descriptor.matchedThrough >= head) continue;
      unverified.add(state);
      requestPass();
      return;
    }
    file(state);
  };

  /** Files a verified query under the stores its views read. */
  const file = (state: QueryState) => {
    assertAlways(env, state.stores === undefined);
    assertAlways(env, !unverified.has(state));
    const stores = new Set<StoreName>();
    for (const descriptor of state.descriptor.views.values()) {
      for (const name of descriptor.storeReads.keys()) stores.add(name);
    }
    for (const name of stores) {
      let found = readers.get(name);
      if (found === undefined) {
        found = new Set();
        readers.set(name, found);
      }
      found.add(state);
    }
    state.stores = stores;
  };

  /** Takes a query out of the files, or out of `unverified`: it restarts, or ends. */
  const unfile = (state: QueryState) => {
    unverified.delete(state);
    const { stores } = state;
    if (stores === undefined) return;
    for (const name of stores) {
      const found = readers.get(name);
      assertAlways(env, found !== undefined);
      const removed = found.delete(state);
      assertAlways(env, removed);
      if (found.size === 0) readers.delete(name);
    }
    state.stores = undefined;
  };

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
    const restarts = match(false);
    for (const state of queries) pass.running.add(state);
    for (const state of restarts.keys()) pass.running.add(state);
    for (const state of queries) startIn(state, revision);
    for (const [state, stale] of restarts)
      restartIn(state, revision, { stale });
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
   * Matches the changes through the latest revision, `invalidate` called once, against the
   * views of the filed queries reading a store changed since `cursor`, lifted to it first,
   * and of the unverified ones; `validating` adds running subscribed ones. Advances each view
   * no change reached to the latest revision, files each unverified query found valid, and
   * returns the queries to restart, each with its stale views. `validating` restarts none:
   * a stale query waits unverified for the next pass.
   */
  const match = (
    validating: boolean,
  ): Map<QueryState, Invalidated<ViewInstanceDescriptor>[]> => {
    const head = log.head;
    const previous = cursor;
    assertAlways(env, log.tail <= previous);
    assertAlways(env, previous <= head);
    cursor = head;
    let filed: ReadonlySet<QueryState> = NO_QUERIES;
    let merged: Set<QueryState> | undefined;
    if (previous < head) {
      let changed: Set<StoreName> | undefined;
      for (const delivery of log.since(previous)) {
        for (const change of delivery.changes) {
          if (changed?.has(change.store) === true) continue;
          (changed ??= new Set()).add(change.store);
          const found = readers.get(change.store);
          if (found === undefined) continue;
          // One store's readers are taken as they are: copied only to merge another's.
          if (filed.size === 0) {
            filed = found;
            continue;
          }
          if (merged === undefined) filed = merged = new Set(filed);
          for (const state of found) merged.add(state);
        }
      }
    }
    const descriptors: ViewInstanceDescriptor[] = [];
    for (const state of filed) {
      for (const descriptor of state.descriptor.views.values()) {
        // Every change through `previous` was matched against it.
        if (descriptor.matchedThrough < previous)
          descriptor.matchedThrough = previous;
        descriptors.push(descriptor);
      }
    }
    for (const state of unverified) {
      for (const descriptor of state.descriptor.views.values())
        descriptors.push(descriptor);
    }
    if (validating) {
      for (const state of inFlight) {
        if (!subscribed.has(state)) continue;
        for (const descriptor of state.descriptor.views.values())
          descriptors.push(descriptor);
      }
    }
    const restarts = new Map<
      QueryState,
      Invalidated<ViewInstanceDescriptor>[]
    >();
    if (descriptors.length === 0) return restarts;
    const { stale } = invalidate({ env, changes: log, descriptors });
    let staleBy:
      | Map<ViewInstanceDescriptor, Invalidated<ViewInstanceDescriptor>>
      | undefined;
    for (const invalidated of stale) {
      (staleBy ??= new Map()).set(invalidated.descriptor, invalidated);
    }
    /** Advances the query's views no change reached to `head`, and returns its stale ones. */
    const verify = (state: QueryState) => {
      let found: Invalidated<ViewInstanceDescriptor>[] | undefined;
      for (const descriptor of state.descriptor.views.values()) {
        const hit = staleBy?.get(descriptor);
        if (hit !== undefined) (found ??= []).push(hit);
        else if (descriptor.matchedThrough < head)
          descriptor.matchedThrough = head;
      }
      return found;
    };
    // `filed` may be a store's live readers: done before filing any unverified query into them.
    for (const state of filed) {
      const found = verify(state);
      if (found === undefined) continue;
      unfile(state);
      if (validating) unverified.add(state);
      else restarts.set(state, found);
    }
    for (const state of unverified) {
      const found = verify(state);
      if (found === undefined) {
        unverified.delete(state);
        file(state);
      } else if (!validating) {
        unverified.delete(state);
        restarts.set(state, found);
      }
    }
    if (validating) {
      for (const state of inFlight) if (subscribed.has(state)) verify(state);
    }
    assertSometimes(
      env,
      validating && unverified.size > 0,
      "Validating ahead of a trim finds a stale view",
    );
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
    const checked = new WeakSet<ViewInstance>();
    const check = (executed: ExecutionState): ExecutionState => {
      failStaleAnswers(env, log, executed, checked);
      return executed;
    };
    const context: DriverContext = {
      revision,
      env,
      codec,
      bind,
      signal,
      execute: ({ state: continuing, refs, meta }) => {
        const executed =
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
              });
        return executed instanceof Promise
          ? executed.then(check)
          : check(executed);
      },
    };
    let result: PromiseOrValue<QueryResult<unknown>>;
    try {
      result =
        invalidated === undefined
          ? descriptor.driver.start({ roots: descriptor.roots, context })
          : descriptor.driver.restart({
              descriptor,
              invalidated,
              edges: state.edges,
              context,
            });
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
      absorb(state, result);
      const delivered = deliver(result);
      finish(state, invalidated, undefined);
      return delivered;
    }
    absorb(state, result.initialResult);
    const rest = createBuffer<QueryPayload<unknown>>();
    const delivered = deliver({
      initialResult: result.initialResult,
      subsequentResults: rest,
    });
    void pump(state, result.subsequentResults, rest, (failure) =>
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
    const { edges } = state;
    if (failure === undefined && invalidated !== undefined) {
      for (const { descriptor } of invalidated.stale) {
        if (views.get(descriptor.id) !== descriptor) continue;
        views.delete(descriptor.id);
        if (edges?.delete(descriptor.id) === true) state.lost = true;
      }
    }
    if (failure === undefined && state.lost && edges !== undefined)
      collect(state, edges);
    state.lost = false;
    if (!state.ended) {
      if (failure !== undefined || views.size === 0) end(state, failure);
      else if (state.observer !== undefined) admit(state);
    }
    leavePass(state);
  };

  /** Drops every view the query's roots no longer reach through `edges`, with its edges. */
  const collect = (
    state: QueryState,
    edges: Map<ViewInstanceId, readonly ViewInstanceId[]>,
  ) => {
    const { views, roots } = state.descriptor;
    const reached = new Set<ViewInstanceId>();
    const stack: ViewInstanceId[] = [];
    for (const root of roots) stack.push(root.instanceId);
    for (let id = stack.pop(); id !== undefined; id = stack.pop()) {
      if (reached.has(id) || !views.has(id)) continue;
      reached.add(id);
      const targets = edges.get(id);
      if (targets !== undefined)
        for (const target of targets) stack.push(target);
    }
    const before = views.size;
    if (reached.size < views.size)
      for (const id of views.keys()) if (!reached.has(id)) views.delete(id);
    if (reached.size < edges.size)
      for (const id of edges.keys()) if (!reached.has(id)) edges.delete(id);
    assertAlways(env, views.size === reached.size);
    assertAlways(env, edges.size <= views.size);
    assertSometimes(
      env,
      views.size < before,
      "A collection drops a view its roots no longer reach",
    );
  };

  const end = (state: QueryState, failure: Failure | undefined) => {
    state.ended = true;
    if (subscribed.delete(state)) unfile(state);
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
    if (state.controller === undefined) admit(state);
    return subscription;
  };

  const unsubscribe = (state: QueryState) => {
    state.observer = undefined;
    if (state.ended) return;
    state.ended = true;
    if (subscribed.delete(state)) unfile(state);
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
      stores: undefined,
      observer: undefined,
      ended: false,
      failure: undefined,
      edges: new Map(),
      lost: false,
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
      match(true);
      if (unverified.size > 0) requestPass();
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

/**
 * Each payload's waves into `views`, what pins pinned included, each losing its edges, then
 * the edges it traversed, and its footprint, as it arrives.
 */
function absorb(state: QueryState, payload: QueryPayload<unknown>) {
  const { waves } = payload;
  for (let at = 0; at < waves.length; at++) {
    const { evaluated, pinned } = waves[at]!;
    for (let index = 0; index < evaluated.length; index++) {
      keepDescriptor(state, evaluated[index]!);
    }
    for (let index = 0; index < pinned.evaluated.length; index++) {
      keepDescriptor(state, pinned.evaluated[index]!);
    }
  }
  if (payload.footprint !== undefined)
    state.descriptor.footprint = payload.footprint;
  const { traversed } = payload;
  const { edges } = state;
  if (traversed === undefined) state.edges = undefined;
  else if (edges !== undefined) {
    // `forEach` makes no entry per edge, as iterating entries may.
    traversed.forEach((targets, id) => {
      if (targets.length === 0) return;
      const kept = edges.get(id);
      edges.set(id, kept === undefined ? targets : [...kept, ...targets]);
    });
  }
}

function keepDescriptor(state: QueryState, instance: ViewInstance): void {
  const evaluated = instance.descriptor;
  if (evaluated === undefined) return;
  state.descriptor.views.set(evaluated.id, evaluated);
  if (state.edges?.delete(evaluated.id) === true) state.lost = true;
}

/** Reads a run's later parts as they come, whether its consumer reads them or not. */
async function pump(
  state: QueryState,
  results: AsyncIterable<QueryPayload<unknown>>,
  rest: Buffer<QueryPayload<unknown>>,
  finished: (failure: Failure | undefined) => void,
): Promise<void> {
  try {
    for await (const payload of results) {
      absorb(state, payload);
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

const NO_QUERIES: ReadonlySet<QueryState> = new Set();

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
