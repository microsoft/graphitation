/**
 * The state of one execution, after graphql-js `ExecutionContext`: what `execute` was
 * given, and the records it keeps while waves run. Built by `buildExecutionContext` when
 * an execution starts, kept for each call that continues it, and threaded through every
 * function of `./execute`.
 */
import type {
  AnyRef,
  AnyView,
  Revision,
  StoreName,
  ValueError,
  ViewInstanceId,
} from "../api.core";
import type { Codec } from "../api.codec";
import type { Environment } from "../api.env";
import type {
  ExecutionWave,
  LatestRevisionFn,
  NewExecutionArgs,
  ViewCache,
  ViewInstance,
} from "../api.execution";
import type { GetStoreFn, StoreViewContext } from "../api.stores";
import { assertAlways } from "../env/assert";

export const DEFAULT_MAX_WAVES = 1000;
export const DEFAULT_MAX_INSTANCES = 10_000;
export const DEFAULT_MAX_DEPTH = 64;

// Records

/**
 * A store as one execution sees it, opened once: opening while its handle arrives, then
 * open with the context its views read in, or failed. Each phase replaces the last.
 */
export type StorePhase = OpeningStore | OpenStore | FailedStore;

export type OpeningStore = {
  readonly status: "opening";
  /** The phase that follows, once the handle arrives or fails to. */
  readonly opened: Promise<OpenStore | FailedStore>;
};

export type OpenStore = {
  readonly status: "open";
  readonly context: StoreViewContext;
};

export type FailedStore = {
  readonly status: "failed";
  /** What each read of the store fails with. */
  readonly failure: unknown;
};

/** Store reads issued since the last round, in issue order. */
export type Round = {
  /** The instance each read runs for, which delivering its answer settles. */
  readonly reads: ViewInstance[];
  /** For each read, the answer its `resolve` promised when it was issued; none when batched. */
  readonly promised: (PromiseLike<unknown> | undefined)[];
};

export function emptyRound(): Round {
  return { reads: [], promised: [] };
}

/** What readers waiting on a running instance hold. */
export type Waiters = NonNullable<ViewInstance["settled"]>;

export type ExecutionContext = {
  readonly env: Environment;
  readonly codec: Codec;
  readonly latestRevision: LatestRevisionFn;
  readonly startedAt: Revision;
  readonly viewCache: ViewCache | undefined;
  /** The pins kept for whoever runs the execution; a pin is added once it answers with a ref. */
  readonly pins: Map<ViewInstanceId, ViewInstance> | undefined;
  readonly getStore: GetStoreFn | undefined;
  readonly maxWaves: number;
  readonly maxInstances: number;
  readonly maxDepth: number;
  readonly controller: AbortController;
  /** The caller's signal, listened to while a wave runs. */
  readonly signal: AbortSignal | undefined;
  /** The latest revision when its last wave settled. */
  settledAt: Revision;
  /** Every wave it has run, in order; each state it returns shares it. */
  readonly waves: ExecutionWave[];
  /** Every instance it resolved; each state it returns shares it. */
  readonly instances: Map<ViewInstanceId, ViewInstance>;
  /** What a reader's `read` throws, for each instance that failed or was built for a cached failure. */
  failures: Map<ViewInstanceId, unknown> | undefined;
  /**
   * The instances each settled instance read inline, for those that read any. What a
   * settled wave follows to the memoized views among them, to keep in the view cache.
   */
  readonly inlineReads: Map<ViewInstance, ReadonlySet<ViewInstance>>;
  /** Instances that settled while an instance they read still ran. */
  incomplete: Set<ViewInstance> | undefined;
  /** Each store the execution has read, in its current phase. */
  readonly stores: Map<StoreName, StorePhase>;
  /** The store reads waiting for the next round. */
  round: Round;
  /**
   * What the pins the running wave reached answered with, and the instances it led to, in
   * order, each instance once.
   */
  pinned:
    | { readonly refs: AnyRef[]; readonly evaluated: ViewInstance[] }
    | undefined;
  /** Running instances whose `resolve` returned a promise that has not settled. */
  waitingInstances: number;
  ran: number;
  /** While a call's wave runs. */
  running: boolean;
  stopped: boolean;
  failure: unknown;
  halted: Promise<never> | undefined;
  halt: ((error: unknown) => void) | undefined;
  progress: (() => void) | undefined;
  /** Stops listening to the caller's `signal`, once the wave settles or fails. */
  detach: (() => void) | undefined;
};

/** The context of a new execution. */
export function buildExecutionContext(
  args: NewExecutionArgs,
): ExecutionContext {
  const env = args.env;
  // A chain of inline reads `maxDepth` deep runs one instance more than that.
  assertAlways(env, DEFAULT_MAX_DEPTH < DEFAULT_MAX_INSTANCES);
  const limits = args.limits;
  const maxWaves = limits?.maxWaves ?? DEFAULT_MAX_WAVES;
  const maxInstances = limits?.maxInstances ?? DEFAULT_MAX_INSTANCES;
  const maxDepth = limits?.maxDepth ?? DEFAULT_MAX_DEPTH;
  assertAlways(env, maxWaves > 0);
  assertAlways(env, maxInstances >= 0);
  assertAlways(env, maxDepth >= 0);
  const startedAt = args.asOf ?? args.latestRevision();
  return {
    codec: args.codec,
    env,
    latestRevision: args.latestRevision,
    startedAt,
    viewCache: args.viewCache,
    pins: args.pins,
    getStore: args.store,
    maxWaves,
    maxInstances,
    maxDepth,
    controller: new AbortController(),
    signal: args.signal,
    settledAt: startedAt,
    waves: [],
    instances: new Map(),
    failures: undefined,
    inlineReads: new Map(),
    incomplete: undefined,
    stores: new Map(),
    round: emptyRound(),
    pinned: undefined,
    waitingInstances: 0,
    ran: 0,
    running: false,
    stopped: false,
    failure: undefined,
    halted: undefined,
    halt: undefined,
    progress: undefined,
    detach: undefined,
  };
}

export const NO_ERRORS: readonly ValueError[] = Object.freeze([]);

export function noop(): void {}

export function deferred(): Waiters {
  let resolve: (value: unknown) => void = noop;
  let reject: (error: unknown) => void = noop;
  const promise = new Promise<unknown>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

export function isPromiseLike<T>(
  value: T | PromiseLike<T>,
): value is PromiseLike<T> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    typeof Reflect.get(value, "then") === "function"
  );
}

/** How failures name a view. */
export function nameOf(view: AnyView): string {
  const label = view.name ?? view.id;
  return label === undefined ? "The view" : `"${label}"`;
}
