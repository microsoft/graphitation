/* Model-based tests of a runtime over a fake feed, deciding reuse from every delivery since the start. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as fc from "fast-check";
import type { Ref, AnyView, PromiseOrValue, Revision } from "../../api.core";
import type { ExecutionState, ViewInstance } from "../../api.execution";
import { execute } from "../../execution/execute";
import type { CreateRuntimeFn, Runtime } from "../../api.runtime";
import type {
  ChangeFeed,
  StoreChange,
  StoreChangeListener,
  StoreViewContext,
} from "../../api.stores";
import { createJsonCodec } from "../../codec/json";
import { defaultEnvironment } from "../../env/environment";
import { isRefresherError } from "../../errors";
import { storeView, view } from "../../views/definitions";
import { createRef } from "../../views/ref";
import { createRuntime } from "../runtime";

const IMPLEMENTATIONS: readonly (readonly [string, CreateRuntimeFn])[] = [
  ["createRuntime", createRuntime],
];

const KEYS = 3;

type FakeFeed = ChangeFeed & {
  deliver(changes: readonly StoreChange[], revision: Revision): void;
  readonly listeners: number;
};

/** A feed announcing `revision` on subscribe, unless `announces` is false. */
function feedAt(revision: Revision, announces = true): FakeFeed {
  const listeners = new Set<StoreChangeListener>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      if (announces) listener([], revision);
      return () => void listeners.delete(listener);
    },
    deliver(changes, at) {
      for (const listener of listeners) listener(changes, at);
    },
    get listeners() {
      return listeners.size;
    },
  };
}

/** A memoized view over one cell of the "cells" store, counting its runs per key. */
function cellsOf(runs: number[]): AnyView {
  const cell = storeView({
    store: "cells",
    name: "cell",
    resolve: (key: number, { store }: StoreViewContext) =>
      (store as ReadonlyMap<number, number>).get(key),
    matches: (key: number, change: StoreChange) => change.value === key,
  });
  return view({
    name: "memoCell",
    memo: true,
    resolve: (key: number, context) => {
      runs[key] = (runs[key] ?? 0) + 1;
      return context.read(cell, key);
    },
  });
}

/** Runs `refs` as the only wave, with everything else the runtime lends. */
function executeIn(
  runtime: Runtime,
  refs: readonly Ref[],
): PromiseOrValue<ExecutionState> {
  return execute({
    latestRevision: runtime.latestRevision,
    env: runtime.env,
    codec: runtime.codec,
    store: runtime.store,
    viewCache: runtime.viewCache,
    signal: runtime.signal,
    refs,
  });
}

/**
 * Runs `root` with `key` as the only wave, which must settle in the calling task, and
 * returns the execution with its instance.
 */
function runOnce(
  runtime: Runtime,
  root: AnyView,
  key: number,
): [ExecutionState, ViewInstance] {
  const state = executeIn(runtime, [createRef(root, key)]);
  assert.ok(!(state instanceof Promise), "settled in a later task");
  assert.equal(state.waves.length, 1);
  return [state, state.waves[0]!.evaluated[0]!];
}

function isSessionError(error: unknown, code: string): boolean {
  return (
    isRefresherError(error) && error.kind === "session" && error.code === code
  );
}

type Model = {
  revision: Revision;
  tail: Revision;
  disposed: boolean;
  readonly caches: boolean;
  /** The revisions each key changed at. */
  readonly changedAt: Revision[][];
  /** The revision each key's memoized instance last ran at. */
  readonly ranAt: Map<number, Revision>;
};
type Real = {
  readonly runtime: Runtime;
  readonly feed: FakeFeed;
  readonly cells: Map<number, number>;
  readonly runs: number[];
  readonly root: AnyView;
};
type Command = fc.Command<Model, Real>;

const deliverArb = fc
  .record({
    gap: fc.integer({ min: 1, max: 2 }),
    keys: fc.uniqueArray(fc.nat(KEYS - 1), { maxLength: 1 }),
  })
  .map(
    ({ gap, keys }): Command => ({
      check: () => true,
      run(model, real) {
        const revision = model.revision + gap;
        for (const key of keys) real.cells.set(key, revision);
        real.feed.deliver(
          keys.map((key) => ({ store: "cells", operation: "put", value: key })),
          revision,
        );
        model.revision = revision;
        for (const key of keys) model.changedAt[key]!.push(revision);
        if (!model.disposed)
          assert.equal(real.runtime.latestRevision(), revision, "revision");
      },
      toString: () => `deliver(+${gap}, ${JSON.stringify(keys)})`,
    }),
  );

const runArb = fc.nat(KEYS - 1).map(
  (key): Command => ({
    check: () => true,
    run(model, real) {
      if (model.disposed) {
        assert.throws(
          () => runOnce(real.runtime, real.root, key),
          (error) => isSessionError(error, "DISPOSED"),
        );
        return;
      }
      const before = real.runs[key] ?? 0;
      const [state, instance] = runOnce(real.runtime, real.root, key);
      assert.equal(state.startedAt, model.revision, "startedAt");
      assert.equal(instance.status, "settled");
      assert.equal(instance.data, real.cells.get(key), "data");
      const ranAt = model.ranAt.get(key);
      const reruns =
        !model.caches ||
        ranAt === undefined ||
        model.changedAt[key]!.some((revision) => revision > ranAt);
      assert.equal((real.runs[key] ?? 0) - before, reruns ? 1 : 0, "runs");
      if (reruns) model.ranAt.set(key, model.revision);
    },
    toString: () => `run(${key})`,
  }),
);

/** Trims to a fraction of the window: before it when below 0, past the latest revision above 1. */
const trimArb = fc.integer({ min: -2, max: 6 }).map(
  (quarters): Command => ({
    check: () => true,
    run(model, real) {
      const revision =
        quarters < 0
          ? model.tail + quarters
          : model.tail +
            Math.floor((quarters / 4) * (model.revision - model.tail));
      real.runtime.trim(revision);
      if (!model.disposed)
        model.tail = Math.max(model.tail, Math.min(revision, model.revision));
    },
    toString: () => `trim(${quarters / 4})`,
  }),
);

const disposeArb = fc.constant<Command>({
  check: () => true,
  run(model, real) {
    real.runtime.dispose();
    real.runtime.dispose();
    model.disposed = true;
    assert.equal(real.feed.listeners, 0, "still attached to the feed");
  },
  toString: () => "dispose()",
});

/** Disposing ends what the rest can show, so it comes rarely. */
const commandsArb = fc.commands(
  [
    fc.oneof(
      { arbitrary: deliverArb, weight: 6 },
      { arbitrary: runArb, weight: 8 },
      { arbitrary: trimArb, weight: 5 },
      { arbitrary: disposeArb, weight: 1 },
    ),
  ],
  { maxCommands: 50, size: "max" },
);

for (const [name, create] of IMPLEMENTATIONS) {
  describe(`${name}: generated deliveries, executions and trims`, () => {
    it("follows its feed, and reuses a memoized instance until a change hits it", () => {
      fc.assert(
        fc.property(
          fc.nat(5),
          fc.boolean(),
          commandsArb,
          (revision, caches, commands) => {
            fc.modelRun(() => {
              const feed = feedAt(revision);
              const cells = new Map<number, number>();
              for (let key = 0; key < KEYS; key++) cells.set(key, 0);
              const runs: number[] = [];
              const runtime = create({
                env: defaultEnvironment,
                feed,
                store: () => cells,
                viewCache: caches,
              });
              assert.equal(runtime.latestRevision(), revision);
              assert.equal(feed.listeners, 1);
              const changedAt = Array.from(
                { length: KEYS },
                (): Revision[] => [],
              );
              return {
                model: {
                  revision,
                  tail: revision,
                  disposed: false,
                  caches,
                  changedAt,
                  ranAt: new Map(),
                },
                real: { runtime, feed, cells, runs, root: cellsOf(runs) },
              };
            }, commands);
          },
        ),
      );
    });
  });

  describe(`${name}: cases`, () => {
    it("starts at revision 0 without a feed", () => {
      const runs: number[] = [];
      const runtime = create({
        env: defaultEnvironment,
        store: () => new Map([[1, 7]]),
      });
      assert.equal(runtime.latestRevision(), 0);
      const [state, instance] = runOnce(runtime, cellsOf(runs), 1);
      assert.equal(state.startedAt, 0);
      assert.equal(instance.status, "settled");
    });

    it("names instances with its codec, the one given or its own", () => {
      const given = createJsonCodec();
      assert.equal(
        create({ env: defaultEnvironment, codec: given }).codec,
        given,
      );
      const runs: number[] = [];
      const root = cellsOf(runs);
      for (const runtime of [
        create({
          env: defaultEnvironment,
          codec: given,
          store: () => new Map(),
        }),
        create({ env: defaultEnvironment, store: () => new Map() }),
      ]) {
        const [, instance] = runOnce(runtime, root, 1);
        assert.equal(instance.id, runtime.codec.instanceKey(root, 1));
      }
    });

    it("throws and detaches when its feed announces no revision", () => {
      const feed = feedAt(3, false);
      assert.throws(
        () => create({ env: defaultEnvironment, feed }),
        (error) => isSessionError(error, "FEED_NOT_ANNOUNCED"),
      );
      assert.equal(feed.listeners, 0);
    });

    it("aborts its signal when disposed: executions in flight reject, and new ones throw", async () => {
      const pending = storeView({
        store: "slow",
        name: "pending",
        resolve: () => new Promise<number>(() => undefined),
        matches: () => true,
      });
      const root = view({
        name: "slowRoot",
        resolve: (key: number, context) => context.read(pending, key),
      });
      const runtime = create({ env: defaultEnvironment, store: () => ({}) });
      const disposed = Promise.resolve(
        executeIn(runtime, [createRef(root, 1)]),
      );
      runtime.dispose();
      await assert.rejects(disposed, (error) =>
        isSessionError(error, "DISPOSED"),
      );
      assert.equal(runtime.viewCache, undefined);
      assert.throws(
        () => executeIn(runtime, [createRef(root, 1)]),
        (error) => isSessionError(error, "DISPOSED"),
      );
    });
  });
}
