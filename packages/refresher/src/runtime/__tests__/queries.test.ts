/* Model-based tests of a runtime's queries: runs, subscriptions and passes, over a fake feed. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as fc from "fast-check";
import type {
  AnyView,
  PromiseOrValue,
  QueryableView,
  ReferenceableView,
  Revision,
} from "../../api.core";
import type { Environment } from "../../api.env";
import type { ViewInstanceDescriptor } from "../../api.invalidation";
import type { QueryDriver, QueryPayload, QueryResult } from "../../api.queries";
import type {
  CreateRuntimeFn,
  QuerySubscription,
  RunResult,
  Runtime,
} from "../../api.runtime";
import type {
  ChangeFeed,
  StoreChange,
  StoreChangeListener,
  StoreViewContext,
} from "../../api.stores";
import {
  createMainThreadEnvironment,
  defaultEnvironment,
} from "../../env/environment";
import { isRefresherError } from "../../errors";
import {
  createSimpleDriver,
  type SimpleDriverOutput,
} from "../../queries/simpleDriver";
import { storeView, view } from "../../views/definitions";
import { createRef } from "../../views/ref";
import { createRuntime } from "../runtime";

const IMPLEMENTATIONS: readonly (readonly [string, CreateRuntimeFn])[] = [
  ["createRuntime", createRuntime],
];

const KEYS = 3;

type Output = SimpleDriverOutput;
type Result = RunResult<Output, Output, never>;

type FakeFeed = ChangeFeed & {
  deliver(changes: readonly StoreChange[], revision: Revision): void;
};

function feedAt(revision: Revision): FakeFeed {
  const listeners = new Set<StoreChangeListener>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      listener([], revision);
      return () => void listeners.delete(listener);
    },
    deliver(changes, at) {
      for (const listener of listeners) listener(changes, at);
    },
  };
}

/** An environment whose deferred work runs only when flushed. */
type ManualEnvironment = Environment & {
  readonly queue: (() => void)[];
  flush(): void;
};

function manualEnvironment(): ManualEnvironment {
  const queue: (() => void)[] = [];
  return {
    ...defaultEnvironment,
    queue,
    scheduleReadRound: (callback) => void queue.push(callback),
    scheduleUpdatePass: (callback) => void queue.push(callback),
    flush() {
      while (queue.length > 0) queue.shift()!();
    },
  };
}

/** A memoized view over one cell of the "cells" store, answered at once or in a microtask. */
function cellsOf(async: boolean): AnyView {
  const cell = storeView({
    store: "cells",
    name: "cell",
    resolve: (key: number, { store }: StoreViewContext) => {
      const value = (store as ReadonlyMap<number, number>).get(key);
      return async ? Promise.resolve(value) : value;
    },
    matches: (key: number, stored: StoreChange) => stored.value === key,
  });
  return view({
    name: "memoCell",
    memo: true,
    resolve: (key: number, context) => context.read(cell, key),
  });
}

function isError(error: unknown, kind: string, code: string): boolean {
  return isRefresherError(error) && error.kind === kind && error.code === code;
}

const isDisposed = (error: unknown) => isError(error, "session", "DISPOSED");

/** Each root's value in a whole result, by key. */
function valuesOf(result: QueryResult<Output, Output>): Map<number, unknown> {
  assert.ok(!("initialResult" in result), "delivered incrementally");
  const values = new Map<number, unknown>();
  for (const instance of result.output.roots)
    values.set(instance.args as number, instance.data);
  return values;
}

/** Waits for the microtask queue and one task: what a promise settled in a microtask needs. */
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

type Query = {
  readonly keys: readonly number[];
  readonly requestedAt: Revision;
  readonly immediate: boolean;
  /** Its first result is known to have arrived. */
  arrived: boolean;
  /** Its run rejected. */
  failed: boolean;
  subscribed: boolean;
  /** Subscribed, and not ended. */
  live: boolean;
  /** The value of each key as its results told, through the last check. */
  seen: Map<number, unknown>;
  /** Whether a trim may have left its views unverifiable: a redundant restart is allowed. */
  unverified: boolean;
  /** Subscribed with no keys: it completes once its run has. */
  completes: boolean;
};

type Model = {
  revision: Revision;
  tail: Revision;
  disposed: boolean;
  readonly async: boolean;
  /** Whether runs deliver their roots after the first as a later part. */
  readonly split: boolean;
  /** Whether a run may still be in flight: one was asked for, or a step happened, since everything last settled. */
  inFlight: boolean;
  /** The revisions each key changed at, ascending: its value is the last one, or 0. */
  readonly changedAt: Revision[][];
  readonly queries: Query[];
};

type Observed = {
  /** The first result, once it has arrived. */
  result: Result | undefined;
  error: unknown;
  /** Every root's value, once every part has arrived. */
  values: Map<number, unknown> | undefined;
  /** Whether a later part failed. */
  partFailed: boolean;
  /** Whether the run rejected, or every part arrived or failed. */
  settled: boolean;
  subscription: QuerySubscription | undefined;
  readonly nexts: QueryResult<Output, Output>[];
  /** How many of `nexts` the model has checked. */
  read: number;
  /** `nexts.length` when unsubscribed. */
  frozen: number | undefined;
  readonly errors: unknown[];
  completed: number;
};

type Real = {
  readonly runtime: Runtime;
  readonly env: ManualEnvironment;
  readonly feed: FakeFeed;
  readonly cells: Map<number, number>;
  readonly root: AnyView;
  readonly driver: QueryDriver<Output, Output, never>;
  readonly queries: Observed[];
};

type Command = fc.AsyncCommand<Model, Real>;

function valueAt(model: Model, key: number, revision: Revision): number {
  const changed = model.changedAt[key]!;
  for (let index = changed.length - 1; index >= 0; index--) {
    if (changed[index]! <= revision) return changed[index]!;
  }
  return 0;
}

function matchesAt(
  model: Model,
  query: Query,
  values: Map<number, unknown>,
  at: Revision,
) {
  return query.keys.every((key) => values.get(key) === valueAt(model, key, at));
}

/** The index of the `index`-th query, round the list, that `which` admits; -1 for none. */
function pick(
  model: Model,
  index: number,
  which: (query: Query) => boolean,
): number {
  const admitted: number[] = [];
  model.queries.forEach((query, at) => {
    if (which(query)) admitted.push(at);
  });
  return admitted.length === 0 ? -1 : admitted[index % admitted.length]!;
}

/** Records a run's first result as it arrives, then reads every later part. */
function observe(observed: Observed, result: PromiseOrValue<Result>) {
  void Promise.resolve(result).then(
    (arrived) => collect(observed, arrived),
    (error: unknown) => {
      observed.error = error;
      observed.settled = true;
    },
  );
}

async function collect(observed: Observed, arrived: Result) {
  observed.result = arrived;
  if ("initialResult" in arrived) {
    const values = valuesOf(arrived.initialResult);
    try {
      for await (const part of arrived.subsequentResults) {
        for (const [key, value] of valuesOf(part)) values.set(key, value);
      }
    } catch {
      observed.partFailed = true;
    }
    observed.values = values;
  } else {
    observed.values = valuesOf(arrived);
  }
  observed.settled = true;
}

function newObserved(): Observed {
  return {
    result: undefined,
    error: undefined,
    values: undefined,
    partFailed: false,
    settled: false,
    subscription: undefined,
    nexts: [],
    read: 0,
    frozen: undefined,
    errors: [],
    completed: 0,
  };
}

const deliverArb = fc
  .record({
    gap: fc.integer({ min: 1, max: 2 }),
    keys: fc.uniqueArray(fc.nat(KEYS - 1), { maxLength: 2 }),
  })
  .map(
    ({ gap, keys }): Command => ({
      check: () => true,
      async run(model, real) {
        const revision = model.revision + gap;
        for (const key of keys) real.cells.set(key, revision);
        real.feed.deliver(
          keys.map((key) => ({ store: "cells", operation: "put", value: key })),
          revision,
        );
        model.revision = revision;
        for (const key of keys) model.changedAt[key]!.push(revision);
        await Promise.resolve();
      },
      toString: () => `deliver(+${gap}, ${JSON.stringify(keys)})`,
    }),
  );

const runArb = fc
  .record({
    keys: fc.uniqueArray(fc.nat(KEYS - 1), { maxLength: 2 }),
    immediate: fc.boolean(),
  })
  .map(
    ({ keys, immediate }): Command => ({
      check: () => true,
      async run(model, real) {
        const roots = keys.map((key) => createRef(real.root, key));
        const observed = newObserved();
        real.queries.push(observed);
        const query: Query = {
          keys,
          requestedAt: model.revision,
          immediate,
          arrived: false,
          failed: false,
          subscribed: false,
          live: false,
          seen: new Map(),
          unverified: false,
          completes: false,
        };
        model.queries.push(query);
        const args = { driver: real.driver, roots, immediate };
        if (immediate && model.disposed) {
          assert.throws(() => real.runtime.run(args), isDisposed);
          query.failed = true;
          observed.settled = true;
          return;
        }
        const result = real.runtime.run(args);
        if (immediate && !model.async && !model.split) {
          assert.ok(
            !(result instanceof Promise),
            "an immediate run of a synchronous driver",
          );
          observed.result = result;
          observed.settled = true;
          const values = valuesOf(result);
          assert.ok(matchesAt(model, query, values, model.revision), "values");
          query.arrived = true;
          query.seen = values;
          return;
        }
        observe(observed, result);
        model.inFlight = true;
        await Promise.resolve();
      },
      toString: () =>
        `run(${JSON.stringify(keys)}${immediate ? ", immediate" : ""})`,
    }),
  );

/** Subscribes to a run whose first result has arrived: a no-op if it hasn't yet. */
const subscribeArb = fc.nat().map(
  (index): Command => ({
    check: (model) =>
      pick(model, index, (query) => !query.failed && !query.subscribed) >= 0,
    async run(model, real) {
      const at = pick(
        model,
        index,
        (query) => !query.failed && !query.subscribed,
      );
      const query = model.queries[at]!;
      const observed = real.queries[at]!;
      const result = observed.result;
      if (result === undefined) return;
      query.subscribed = true;
      observed.subscription = result.subscribe({
        next: (next) => void observed.nexts.push(next),
        error: (error) => void observed.errors.push(error),
        complete: () => void observed.completed++,
      });
      assert.throws(
        () => result.subscribe({ next: () => undefined }),
        (error) => isError(error, "operation", "ALREADY_SUBSCRIBED"),
      );
      if (query.keys.length === 0) {
        query.completes = true;
        if (observed.settled)
          assert.equal(observed.completed, 1, "completes without views");
      } else if (model.disposed) {
        assert.equal(observed.errors.length, 1);
        assert.ok(isDisposed(observed.errors[0]));
      } else {
        query.live = true;
        assert.equal(observed.completed + observed.errors.length, 0, "ended");
      }
      await Promise.resolve();
    },
    toString: () => `subscribe(${index})`,
  }),
);

const unsubscribeArb = fc.nat().map(
  (index): Command => ({
    check: (model) => pick(model, index, (query) => query.live) >= 0,
    async run(model, real) {
      const at = pick(model, index, (query) => query.live);
      const observed = real.queries[at]!;
      observed.subscription!.unsubscribe();
      observed.subscription!.unsubscribe();
      observed.frozen = observed.nexts.length;
      model.queries[at]!.live = false;
      await Promise.resolve();
    },
    toString: () => `unsubscribe(${index})`,
  }),
);

/** Trims to a fraction of the window, as in the runtime's own tests. */
const trimArb = fc.integer({ min: -1, max: 5 }).map(
  (quarters): Command => ({
    check: () => true,
    async run(model, real) {
      const revision =
        quarters < 0
          ? model.tail + quarters
          : model.tail +
            Math.floor((quarters / 4) * (model.revision - model.tail));
      real.runtime.trim(revision);
      const tail = Math.max(model.tail, Math.min(revision, model.revision));
      if (!model.disposed && tail > model.tail) {
        model.tail = tail;
        for (const query of model.queries) {
          if (!query.subscribed || model.inFlight) query.unverified = true;
        }
      }
      await Promise.resolve();
    },
    toString: () => `trim(${quarters / 4})`,
  }),
);

/** Starts what the runtime deferred, once, leaving what that defers in turn. */
const stepArb = fc.constant<Command>({
  check: () => true,
  async run(model, real) {
    real.env.flush();
    model.inFlight = true;
    await Promise.resolve();
  },
  toString: () => "step()",
});

const settleArb = fc.constant<Command>({
  check: () => true,
  async run(model, real) {
    await settle(real);
    check(model, real);
  },
  toString: () => "settle()",
});

const disposeArb = fc.constant<Command>({
  check: () => true,
  async run(model, real) {
    real.runtime.dispose();
    real.runtime.dispose();
    model.disposed = true;
    model.queries.forEach((query, at) => {
      if (!query.live) return;
      const observed = real.queries[at]!;
      assert.equal(observed.errors.length, 1, "a subscriber is told");
      assert.ok(isDisposed(observed.errors[0]));
      query.live = false;
    });
    await Promise.resolve();
  },
  toString: () => "dispose()",
});

async function settle(real: { readonly env: ManualEnvironment }) {
  for (let round = 0; round < 1000; round++) {
    real.env.flush();
    await tick();
    if (real.env.queue.length === 0) return;
  }
  assert.fail("never settled");
}

/** What a settled runtime must show: every run arrived, every subscriber up to date. */
function check(model: Model, real: Real) {
  model.queries.forEach((query, at) => {
    const observed = real.queries[at]!;
    if (!query.arrived && !query.failed) {
      assert.ok(observed.settled, "a run never arrived");
      if (observed.result === undefined) {
        assert.ok(model.disposed && isDisposed(observed.error), "rejected");
        query.failed = true;
      } else if (observed.partFailed) {
        assert.ok(model.disposed, "a later part failed");
        query.arrived = true;
      } else {
        const values = observed.values!;
        const allowed = query.immediate
          ? matchesAt(model, query, values, query.requestedAt)
          : Array.from(
              { length: model.revision - query.requestedAt + 1 },
              (_, offset) =>
                matchesAt(model, query, values, query.requestedAt + offset),
            ).some(Boolean);
        assert.ok(allowed, "values at no revision since the run was asked for");
        query.arrived = true;
        query.seen = values;
      }
    }
    assert.ok(observed.errors.length + observed.completed <= 1, "ended twice");
    if (query.completes) {
      assert.equal(
        observed.completed + observed.errors.length,
        1,
        "completes without views",
      );
      assert.ok(
        observed.completed === 1 || model.disposed,
        "completes without views",
      );
    }
    if (observed.frozen !== undefined) {
      assert.equal(
        observed.nexts.length,
        observed.frozen,
        "a restart after unsubscribing",
      );
    }
    if (!query.live) return;
    assert.equal(
      observed.errors.length + observed.completed,
      0,
      "a live query ended",
    );
    const nexts = observed.nexts.slice(observed.read);
    observed.read = observed.nexts.length;
    if (
      matchesAt(model, query, query.seen, model.revision) &&
      !query.unverified
    ) {
      assert.equal(nexts.length, 0, "restarted with nothing changed");
    }
    for (const next of nexts) {
      for (const [key, value] of valuesOf(next)) {
        assert.ok(
          query.keys.includes(key),
          "restarted an instance it never read",
        );
        query.seen.set(key, value);
      }
    }
    assert.ok(
      matchesAt(model, query, query.seen, model.revision),
      "a subscriber behind",
    );
    query.unverified = false;
  });
  model.inFlight = false;
}

const commandsArb = fc.commands(
  [
    fc.oneof(
      { arbitrary: deliverArb, weight: 6 },
      { arbitrary: runArb, weight: 5 },
      { arbitrary: subscribeArb, weight: 5 },
      { arbitrary: unsubscribeArb, weight: 1 },
      { arbitrary: trimArb, weight: 3 },
      { arbitrary: stepArb, weight: 3 },
      { arbitrary: settleArb, weight: 4 },
      { arbitrary: disposeArb, weight: 1 },
    ),
  ],
  { maxCommands: 40, size: "max" },
);

/** Steps of the oracle property: runs subscribed once they arrive, deliveries, and settling. */
const oracleStepArb = fc.oneof(
  fc.record({
    kind: fc.constant("run" as const),
    keys: fc.uniqueArray(fc.nat(KEYS - 1), { minLength: 1 }),
  }),
  fc.record({
    kind: fc.constant("deliver" as const),
    keys: fc.uniqueArray(fc.nat(KEYS - 1)),
  }),
  fc.record({ kind: fc.constant("settle" as const) }),
);

/** A runtime over cells 0 to `KEYS - 1`, each 0, at `revision`. */
function setup(
  create: CreateRuntimeFn,
  env: Environment,
  revision: Revision,
  async: boolean,
  viewCache: boolean,
) {
  const feed = feedAt(revision);
  const cells = new Map<number, number>();
  for (let key = 0; key < KEYS; key++) cells.set(key, 0);
  const runtime = create({ env, feed, store: () => cells, viewCache });
  return { runtime, feed, cells, root: cellsOf(async) };
}

/**
 * A driver delivering its first root at once, and the others as one later part, a round
 * later: both are read at start, as the fake store only answers at its latest revision.
 */
function splitDriver(
  inner: QueryDriver<Output, never, never>,
): QueryDriver<Output, Output, never> {
  return {
    async start({ roots, context }) {
      const later = Promise.resolve(
        inner.start({ roots: roots.slice(1), context }),
      );
      later.catch(() => undefined);
      const initialResult = (await inner.start({
        roots: roots.slice(0, 1),
        context,
      })) as QueryPayload<Output, never>;
      async function* rest() {
        await new Promise<void>((resolve) =>
          context.env.scheduleReadRound(resolve),
        );
        yield (await later) as QueryPayload<Output, never>;
      }
      return { initialResult, subsequentResults: rest() };
    },
    restart: (args) => inner.restart(args),
  };
}

async function until(done: () => boolean) {
  for (let round = 0; round < 100 && !done(); round++) {
    await tick();
  }
  assert.ok(done(), "never happened");
}

function change(
  feed: FakeFeed,
  cells: Map<number, number>,
  key: number,
  revision: Revision,
) {
  cells.set(key, revision);
  feed.deliver([{ store: "cells", operation: "put", value: key }], revision);
}

for (const [name, create] of IMPLEMENTATIONS) {
  void describe(`${name}: generated runs, subscriptions, deliveries and trims`, () => {
    void it("runs each query at a revision since it was asked for, and keeps each subscriber up to date, restarting only on a change", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.nat(5),
          fc.boolean(),
          fc.boolean(),
          fc.boolean(),
          commandsArb,
          async (revision, async, split, viewCache, commands) => {
            await fc.asyncModelRun(() => {
              const env = manualEnvironment();
              const { runtime, feed, cells, root } = setup(
                create,
                env,
                revision,
                async,
                viewCache,
              );
              return {
                model: {
                  revision,
                  tail: revision,
                  disposed: false,
                  async,
                  split,
                  inFlight: false,
                  changedAt: Array.from({ length: KEYS }, (): Revision[] => []),
                  queries: [],
                },
                real: {
                  runtime,
                  env,
                  feed,
                  cells,
                  root,
                  driver: split
                    ? splitDriver(createSimpleDriver())
                    : createSimpleDriver(),
                  queries: [],
                },
              };
            }, commands);
          },
        ),
      );
    });
  });

  void describe(`${name}: what a restart is told is stale`, () => {
    void it("tells each restart exactly the views a delivered change hit since they were read", async () => {
      let restarts = 0;
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(),
          fc.boolean(),
          fc.array(oracleStepArb, { maxLength: 30 }),
          async (async, viewCache, steps) => {
            const env = manualEnvironment();
            const { runtime, feed, cells, root } = setup(
              create,
              env,
              1,
              async,
              viewCache,
            );
            const delivered: {
              readonly revision: Revision;
              readonly keys: readonly number[];
            }[] = [];
            /** Whether a change to one of `read`'s keys was delivered after it, through `head`. */
            const hit = (descriptor: ViewInstanceDescriptor, head: Revision) =>
              [...descriptor.storeReads.values()]
                .flat()
                .some((read) =>
                  delivered.some(
                    ({ revision, keys }) =>
                      revision > read.revision &&
                      revision <= head &&
                      keys.includes(read.args as number),
                  ),
                );
            const inner = createSimpleDriver();
            const driver: QueryDriver<Output, never, never> = {
              start: (args) => inner.start(args),
              restart(args) {
                restarts++;
                const head = args.context.revision;
                const told = new Set<ViewInstanceDescriptor>();
                for (const { descriptor, reason } of args.invalidated.stale) {
                  assert.ok(!told.has(descriptor), "told twice");
                  told.add(descriptor);
                  assert.equal(
                    args.descriptor.views.get(descriptor.id),
                    descriptor,
                    "not current",
                  );
                  assert.equal(
                    reason.kind,
                    "hit",
                    "unverifiable with nothing trimmed",
                  );
                  if (reason.kind !== "hit") continue;
                  assert.ok(
                    [...descriptor.storeReads.values()]
                      .flat()
                      .includes(reason.read),
                    "a read it never made",
                  );
                  assert.ok(
                    reason.revision > reason.read.revision,
                    "a change before the read",
                  );
                  assert.ok(
                    reason.revision <= head,
                    "a change after the restart's revision",
                  );
                  assert.equal(
                    reason.change.value,
                    reason.read.args,
                    "a change that misses",
                  );
                }
                for (const descriptor of args.descriptor.views.values()) {
                  assert.equal(
                    told.has(descriptor),
                    hit(descriptor, head),
                    "stale views differ",
                  );
                }
                return inner.restart(args);
              },
            };
            let revision = 1;
            for (const step of steps) {
              if (step.kind === "run") {
                const roots = step.keys.map((key) => createRef(root, key));
                void Promise.resolve(runtime.run({ driver, roots })).then(
                  (result) => result.subscribe({ next: () => undefined }),
                );
              } else if (step.kind === "deliver") {
                revision++;
                for (const key of step.keys) cells.set(key, revision);
                delivered.push({ revision, keys: step.keys });
                feed.deliver(
                  step.keys.map((key) => ({
                    store: "cells",
                    operation: "put",
                    value: key,
                  })),
                  revision,
                );
              } else {
                await settle({ env });
              }
            }
            await settle({ env });
          },
        ),
      );
      assert.ok(restarts > 0, "no run restarted");
    });
  });

  void describe(`${name}: queries`, () => {
    void it("runs a query from a root: at once, or in the pending pass", async () => {
      const { runtime, root } = setup(
        create,
        defaultEnvironment,
        1,
        false,
        true,
      );
      const driver = createSimpleDriver();
      const now = runtime.immediateQuery(
        root as QueryableView<number>,
        1,
        driver,
      );
      assert.ok(!(now instanceof Promise));
      assert.deepEqual([...valuesOf(now)], [[1, 0]]);
      const later = runtime.query(root as QueryableView<number>, 2, driver);
      assert.ok(later instanceof Promise);
      assert.deepEqual([...valuesOf(await later)], [[2, 0]]);
    });

    void it("restarts on a synchronous write before any later task, when passes run in a microtask", async () => {
      const env = createMainThreadEnvironment();
      const { runtime, feed, cells, root } = setup(create, env, 1, false, true);
      const result = await runtime.run({
        driver: createSimpleDriver(),
        roots: [createRef(root, 0)],
      });
      const log: unknown[] = [];
      result.subscribe({
        next: (next) => void log.push([...valuesOf(next)]),
      });
      const later = new Promise<void>((resolve) => setTimeout(resolve, 0)).then(
        () => void log.push("task"),
      );
      change(feed, cells, 0, 2);
      await later;
      assert.deepEqual(log, [[[0, 2]], "task"]);
    });

    void it("rejects a run, or throws an immediate one, when the driver throws on start", async () => {
      const { runtime } = setup(create, defaultEnvironment, 1, false, true);
      const failure = new Error("start");
      const driver: QueryDriver = {
        start: () => {
          throw failure;
        },
        restart: () => {
          throw failure;
        },
      };
      assert.throws(
        () => runtime.run({ driver, roots: [], immediate: true }),
        failure,
      );
      await assert.rejects(
        Promise.resolve(runtime.run({ driver, roots: [] })),
        failure,
      );
    });

    void it("ends a subscription through `error` when a restart throws", async () => {
      const { runtime, feed, cells, root } = setup(
        create,
        defaultEnvironment,
        1,
        false,
        true,
      );
      const inner = createSimpleDriver();
      const failure = new Error("restart");
      const driver: QueryDriver<Output, never, never> = {
        start: (args) => inner.start(args),
        restart: () => Promise.reject(failure),
      };
      const result = await runtime.run({ driver, roots: [createRef(root, 0)] });
      const errors: unknown[] = [];
      let nexts = 0;
      result.subscribe({
        next: () => void nexts++,
        error: (error) => void errors.push(error),
      });
      change(feed, cells, 0, 2);
      await until(() => errors.length > 0);
      change(feed, cells, 0, 3);
      await tick();
      await tick();
      assert.deepEqual(errors, [failure]);
      assert.equal(nexts, 0);
    });

    void it("reads a run's later parts whether or not its consumer does, and restarts from them", async () => {
      const { runtime, feed, cells, root } = setup(
        create,
        defaultEnvironment,
        1,
        true,
        true,
      );
      const driver = splitDriver(createSimpleDriver());
      const result = await runtime.run({
        driver,
        roots: [createRef(root, 0), createRef(root, 1)],
      });
      assert.ok("initialResult" in result);
      assert.deepEqual([...valuesOf(result.initialResult)], [[0, 0]]);
      const nexts: QueryResult<Output, Output>[] = [];
      result.subscribe({ next: (next) => void nexts.push(next) });
      // The pass waits for the later part, which nothing reads: the next one still runs.
      const other = await runtime.run({
        driver: createSimpleDriver(),
        roots: [],
      });
      assert.ok(!("initialResult" in other));
      change(feed, cells, 1, 2);
      await until(() => nexts.length > 0);
      assert.deepEqual(
        [...valuesOf(nexts[0] as QueryResult<Output, never>)],
        [[1, 2]],
      );
      const parts: QueryPayload<Output>[] = [];
      for await (const part of result.subsequentResults) parts.push(part);
      assert.deepEqual([...valuesOf(parts[0]!)], [[1, 0]]);
    });

    void it("keeps subscribed exactly what its roots reach through the edges its results traversed, as its graph is rewired", async () => {
      const NODES = 6;
      const NEXT = "next";
      const targetsArb = fc.array(fc.nat(NODES - 1), { maxLength: 3 });
      await fc.assert(
        fc.asyncProperty(
          fc.array(targetsArb, { minLength: NODES, maxLength: NODES }),
          fc.array(fc.tuple(fc.nat(NODES - 1), targetsArb), { maxLength: 12 }),
          async (initial, rewirings) => {
            const env = manualEnvironment();
            const feed = feedAt(1);
            const links = new Map(
              initial.map((targets, node) => [node, targets]),
            );
            const runtime = create({ env, feed, store: () => links });
            const linksOf = storeView({
              store: "links",
              name: "links",
              resolve: (node: number, { store }: StoreViewContext) =>
                (store as ReadonlyMap<number, readonly number[]>).get(node),
              matches: (node: number, stored: StoreChange) =>
                stored.value === node,
            });
            const node: AnyView = view({
              name: "node",
              resolve: (at: number, context) =>
                (context.read(linksOf, at) as readonly number[]).map((target) =>
                  context.ref(node as ReferenceableView<number>, target, {
                    tags: [NEXT],
                  }),
                ),
            });
            const reachable = () => {
              const reached = new Set<number>();
              const stack = [0];
              for (let at = stack.pop(); at !== undefined; at = stack.pop()) {
                if (reached.has(at)) continue;
                reached.add(at);
                stack.push(...links.get(at)!);
              }
              return reached;
            };
            const inner = createSimpleDriver([NEXT]);
            let views: ReadonlyMap<unknown, ViewInstanceDescriptor> | undefined;
            let restarts = 0;
            const driver: QueryDriver<Output, never, never> = {
              start: (args) => inner.start(args),
              restart: (args) => {
                restarts++;
                views = args.descriptor.views;
                return inner.restart(args);
              },
            };
            const result = runtime.run({
              driver,
              roots: [createRef(node, 0)],
              immediate: true,
            });
            assert.ok(!(result instanceof Promise));
            result.subscribe({ next: () => undefined });
            let revision = 1;
            for (const [rewired, targets] of rewirings) {
              const reached = reachable().has(rewired);
              const before = restarts;
              links.set(rewired, targets);
              feed.deliver(
                [{ store: "links", operation: "put", value: rewired }],
                ++revision,
              );
              env.flush();
              assert.equal(restarts - before, reached ? 1 : 0);
              if (views === undefined) continue;
              const subscribed = [...views.values()].map(
                ({ args }) => args as number,
              );
              assert.deepEqual(new Set(subscribed), reachable());
            }
            runtime.dispose();
          },
        ),
      );
    });

    void it("completes a subscription at once when its run evaluated nothing", async () => {
      const { runtime } = setup(create, defaultEnvironment, 1, false, true);
      const result = runtime.run({
        driver: createSimpleDriver(),
        roots: [],
        immediate: true,
      });
      assert.ok(!(result instanceof Promise));
      let completed = 0;
      result.subscribe({
        next: () => assert.fail("restarted"),
        complete: () => void completed++,
      });
      assert.equal(completed, 1);
    });

    void it("rejects runs, and tells subscribers, once disposed", async () => {
      const { runtime, root } = setup(
        create,
        defaultEnvironment,
        1,
        false,
        true,
      );
      const driver = createSimpleDriver();
      const live = await runtime.run({ driver, roots: [createRef(root, 0)] });
      const errors: unknown[] = [];
      live.subscribe({
        next: () => undefined,
        error: (error) => void errors.push(error),
      });
      const pending = runtime.run({ driver, roots: [createRef(root, 1)] });
      runtime.dispose();
      assert.equal(errors.length, 1);
      assert.ok(isDisposed(errors[0]));
      await assert.rejects(Promise.resolve(pending), isDisposed);
      assert.throws(
        () => runtime.run({ driver, roots: [], immediate: true }),
        isDisposed,
      );
      await assert.rejects(
        Promise.resolve(runtime.run({ driver, roots: [] })),
        isDisposed,
      );
    });
  });
}
