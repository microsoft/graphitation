import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as fc from "fast-check";
import type {
  Ref,
  AnyView,
  PromiseOrValue,
  ResolveContext,
} from "../../api.core";
import type { AssertReport } from "../../api.env";
import type {
  ExecutionState,
  NewExecutionArgs,
  ViewCache,
  ViewInstance,
} from "../../api.execution";
import type { GetStoreFn, StoreRead, StoreViewContext } from "../../api.stores";
import { internalError, isRefresherError } from "../../errors";
import { storeView, view } from "../../views/definitions";
import { isActionRef, isRef, isViewRef } from "../../views/ref";
import { defaultEnvironment } from "../../env/environment";
import { createChangeLog } from "../../invalidation/changeLog";
import {
  isExact,
  settledStale,
  validThroughOf,
} from "../../invalidation/reads";
import { execute } from "../execute";
import { createViewCache } from "../viewCache";
import { codec, readOf, readsOf, refFnOf, refOf, settledOf } from "./world";

const matches = (): boolean => true;

/** A view cache that hands out whatever `get` answers, and keeps nothing it is given. */
function cacheOf(get: (id: string) => ViewInstance | undefined): ViewCache {
  return {
    cacheable: () => true,
    get,
    keep: () => false,
    delete: () => false,
    validate: () => undefined,
    size: 0,
  };
}
const handles: GetStoreFn = (name) => ({ name });

type Resolve = (
  arg: number,
  read: (view: AnyView, args: unknown) => unknown,
  context: ResolveContext,
) => unknown;

function define(
  resolve: Resolve,
  options: Partial<Pick<AnyView, "memo" | "deterministic" | "name">> & {
    readable?: boolean;
  } = {},
): AnyView {
  const { readable = true, ...rest } = options;
  return view({
    ...rest,
    access: { readable },
    resolve: (arg: number, context: ResolveContext) =>
      resolve(arg, readOf(context), context),
  });
}

function batched(
  calls: number[][],
  answer: (args: readonly number[], context: StoreViewContext) => unknown = (
    args,
  ) => args.map((arg) => arg * 10),
): AnyView {
  return storeView({
    store: "db",
    name: "batched",
    matches,
    resolveBatch: (args: readonly number[], context: StoreViewContext) => {
      calls.push([...args]);
      return answer(args, context) as readonly number[];
    },
  });
}

function single(
  answer: (arg: number, context: StoreViewContext) => unknown,
): AnyView {
  return storeView({
    store: "db",
    name: "single",
    matches,
    resolve: (arg: number, context: StoreViewContext) => answer(arg, context),
  });
}

/** The dependencies every call here shares, so that one can continue another's execution. */
const BASE = { codec, env: defaultEnvironment, latestRevision: () => 1 };

/** `meta` for a call, or none for `null`. */
const withMeta = (meta: unknown): { meta?: unknown } =>
  meta === null ? {} : { meta };

/** The last wave of an execution, with the execution. */
type Wave = {
  readonly instances: readonly ViewInstance[];
  readonly state: ExecutionState;
};

function lastWave(state: ExecutionState): Wave {
  const wave = state.waves[state.waves.length - 1];
  assert.ok(wave !== undefined);
  return { instances: wave.evaluated, state };
}

/** Executes `refs` as the first wave of a new execution. */
function runWave(
  refs: readonly Ref[],
  args: Partial<NewExecutionArgs>,
  store: GetStoreFn | null,
): PromiseOrValue<ExecutionState> {
  return execute({
    ...BASE,
    refs,
    ...(store === null ? {} : { store }),
    ...args,
  });
}

/** Continues `state` with a wave of `refs`. */
function continueWith(
  state: ExecutionState,
  refs: readonly Ref[],
): PromiseOrValue<ExecutionState> {
  return execute({ state, refs });
}

/** Runs one wave of `refs` and resolves with it, or with what the execution failed with. */
async function waveOf(
  refs: readonly Ref[],
  args: Partial<NewExecutionArgs> = {},
  store: GetStoreFn | null = handles,
): Promise<Wave> {
  return lastWave(await runWave(refs, args, store));
}

/** Runs one wave of `refs`, which must settle in the calling task. */
function syncWaveOf(
  refs: readonly Ref[],
  args: Partial<NewExecutionArgs> = {},
  store: GetStoreFn | null = handles,
): Wave {
  const state = runWave(refs, args, store);
  assert.ok(!(state instanceof Promise), "settled in a later task");
  return lastWave(state);
}

/** What an execution threw in the calling task; one that returns fails the test. */
function thrownBy(run: () => unknown): unknown {
  let result: unknown;
  try {
    result = run();
  } catch (error) {
    return error;
  }
  if (result instanceof Promise) result.catch(() => {});
  return assert.fail("did not throw in the calling task");
}

const SETTLED = Symbol("settled");

/** What an execution failed with: thrown in the calling task or rejected later. */
async function failureOf(run: () => unknown): Promise<unknown> {
  const failure = await Promise.resolve()
    .then(run)
    .then(
      () => SETTLED,
      (error: unknown) => error,
    );
  assert.notEqual(failure, SETTLED, "the execution settled");
  return failure;
}

function codeOf(instance: ViewInstance | undefined): string | undefined {
  assert.ok(instance !== undefined);
  assert.equal(settledOf(instance).data, null);
  assert.equal(settledOf(instance).errors.length, 1);
  return settledOf(instance).errors[0]!.code;
}

function assertOperation(error: unknown, code: string): void {
  assert.ok(isRefresherError(error), `not a refresher error: ${String(error)}`);
  assert.equal(error.kind, "operation");
  assert.equal((error as { code: string }).code, code);
}

describe("execute: rounds", () => {
  it("batches the reads of a round per store view, in the order they were issued", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.nat(5), { minLength: 1, maxLength: 8 }),
        async (args) => {
          const calls: number[][] = [];
          const store = batched(calls);
          const reader = define(async (arg, read) => [await read(store, arg)]);
          const wave = await waveOf(args.map((arg) => refOf(reader, arg)));
          assert.deepEqual(calls, [[...new Set(args)]]);
          assert.deepEqual(
            wave.instances.map((instance) => settledOf(instance).data),
            args.map((arg) => [arg * 10]),
          );
        },
      ),
    );
  });

  it("dispatches a read that depends on an answer in a later round", async () => {
    const calls: number[][] = [];
    const store = batched(calls, (args) => args.map((arg) => arg + 1));
    const chain = define(async (arg, read) => {
      let at = arg;
      for (let step = 0; step < 3; step++)
        at = (await read(store, at)) as number;
      return at;
    });
    const wave = await waveOf([refOf(chain, 0)]);
    assert.deepEqual(calls, [[0], [1], [2]]);
    assert.equal(settledOf(wave.instances[0]).data, 3);
  });

  it("forms a round once every instance has run as far as it can", async () => {
    const calls: number[][] = [];
    const store = batched(calls);
    const late = define(async (arg, read) => {
      for (let tick = 0; tick < 5; tick++) await Promise.resolve();
      return read(store, arg);
    });
    const early = define((arg, read) => read(store, arg));
    const wave = await waveOf([refOf(late, 1), refOf(early, 2)]);
    assert.deepEqual(calls, [[2, 1]]);
    assert.deepEqual(
      wave.instances.map((instance) => settledOf(instance).data),
      [10, 20],
    );
  });

  it("waits for instances that wait on something other than a read", async () => {
    const slow = define(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return "done";
    });
    const wave = await waveOf([refOf(slow, 0)]);
    assert.equal(settledOf(wave.instances[0]).data, "done");
  });
});

describe("execute: failures", () => {
  it("settles a failing view to null with the error at its root", async () => {
    const failing = define(() => {
      throw new Error("boom");
    });
    const wave = await waveOf([refOf(failing, 0)]);
    const instance = wave.instances[0]!;
    assert.equal(settledOf(instance).data, null);
    assert.equal(settledOf(instance).errors.length, 1);
    assert.equal(settledOf(instance).errors[0]!.kind, "value");
    assert.equal(settledOf(instance).errors[0]!.message, "boom");
    assert.deepEqual(settledOf(instance).errors[0]!.path, []);
  });

  it("fails a reader with what it read inline, unless it catches it", async () => {
    const failing = define(
      () => {
        throw new Error("inner");
      },
      { memo: true },
    );
    const plain = define((arg, read) => read(failing, arg));
    const careful = define((arg, read) => {
      try {
        return read(failing, arg);
      } catch {
        return "fallback";
      }
    });
    const wave = await waveOf([refOf(plain, 0), refOf(careful, 0)]);
    const [failed, caught] = wave.instances;
    assert.equal(settledOf(failed).data, null);
    assert.equal(settledOf(failed).errors[0]!.message, "inner");
    assert.equal(settledOf(caught).data, "fallback");
    assert.deepEqual(settledOf(caught).errors, []);
    const inner = [...wave.state.instances.values()].find(
      (each) => each.view === failing,
    );
    assert.equal(settledOf(inner).data, null);
  });

  it("keeps a reader whole when a view it refs fails", async () => {
    const failing = define(() => {
      throw new Error("later");
    });
    const reader = define((arg, _read, context) =>
      refFnOf(context)(failing, arg),
    );
    const first = await runWave([refOf(reader, 0)], {}, handles);
    const outer = first.waves[0]!.evaluated[0];
    assert.deepEqual(settledOf(outer).errors, []);
    const later = await continueWith(first, [settledOf(outer).data as Ref]);
    assert.equal(settledOf(later.waves[1]!.evaluated[0]).data, null);
  });

  it("fails an inline read that would wait on itself", async () => {
    let second: AnyView = define(() => null);
    const first = define((arg, read) => read(second, arg));
    second = define((arg, read) => read(first, arg));
    const self = define((arg, read) => read(self, arg));
    let laterSecond: AnyView = define(() => null);
    const laterFirst = define(async (arg, read) => {
      await Promise.resolve();
      return read(laterSecond, arg);
    });
    laterSecond = define(async (arg, read) => {
      await Promise.resolve();
      return read(laterFirst, arg);
    });
    const wave = await waveOf([
      refOf(first, 0),
      refOf(self, 0),
      refOf(laterFirst, 0),
    ]);
    for (const instance of wave.instances)
      assert.equal(codeOf(instance), "INLINE_CYCLE");
  });

  it("enforces access", async () => {
    const hidden = define(() => 1, { readable: false });
    const nondeterministic = define(() => Math.random(), {
      deterministic: false,
    });
    const store = single((arg) => arg);
    const readsHidden = define((arg, read) => read(hidden, arg));
    const refsStore = define((arg, _read, context) =>
      refFnOf(context)(store, arg),
    );
    const deterministicReader = define((arg, read) =>
      read(nondeterministic, arg),
    );
    const nondeterministicReader = define(
      (arg, read) => read(nondeterministic, arg),
      {
        deterministic: false,
      },
    );
    const wave = await waveOf(
      [readsHidden, refsStore, deterministicReader, nondeterministicReader].map(
        (each) => refOf(each, 0),
      ),
    );
    const [notReadable, notReferenceable, notDeterministic, allowed] =
      wave.instances;
    assert.equal(codeOf(notReadable), "NOT_READABLE");
    assert.equal(codeOf(notReferenceable), "NOT_REFERENCEABLE");
    assert.equal(codeOf(notDeterministic), "NOT_DETERMINISTIC");
    assert.equal(typeof settledOf(allowed).data, "number");
  });

  it("fails the reads of a store it cannot open", async () => {
    const store = single((arg) => arg);
    const reader = define((arg, read) => read(store, arg));
    const ref = refOf(reader, 0);
    const unknown = await waveOf([ref], { store: () => undefined });
    assert.equal(codeOf(unknown.instances[0]), "UNKNOWN_STORE");
    const none = await waveOf([ref], {}, null);
    assert.equal(codeOf(none.instances[0]), "UNKNOWN_STORE");
    const throwing = await waveOf([ref], {
      store: () => {
        throw new Error("down");
      },
    });
    assert.equal(codeOf(throwing.instances[0]), "STORE_UNAVAILABLE");
    const rejecting = await waveOf([ref], {
      store: () => Promise.reject(new Error("down")),
    });
    assert.equal(codeOf(rejecting.instances[0]), "STORE_UNAVAILABLE");
  });

  it("fails one read for an error in its slot, and every read for a bad batch", async () => {
    const reader = (store: AnyView): AnyView =>
      define(async (arg, read) => read(store, arg));
    const slots = reader(
      batched([], (args) =>
        args.map((arg) => (arg === 1 ? new Error("one") : arg)),
      ),
    );
    const slotWave = await waveOf([refOf(slots, 0), refOf(slots, 1)]);
    assert.equal(settledOf(slotWave.instances[0]).data, 0);
    assert.equal(settledOf(slotWave.instances[1]).errors[0]!.message, "one");

    const short = reader(batched([], () => []));
    const shortWave = await waveOf([refOf(short, 0), refOf(short, 1)]);
    for (const instance of shortWave.instances)
      assert.equal(codeOf(instance), "INVALID_BATCH");

    const rejecting = reader(
      batched([], () => Promise.reject(new Error("batch"))),
    );
    const rejectingWave = await waveOf([
      refOf(rejecting, 0),
      refOf(rejecting, 1),
    ]);
    for (const instance of rejectingWave.instances) {
      assert.equal(settledOf(instance).errors[0]!.message, "batch");
    }
  });
});

describe("execute: revisions", () => {
  it("records a store read at the revision the execution started at", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.option(fc.nat(20), { nil: undefined }),
        fc.nat(20),
        async (asOf, latest) => {
          const reader = define((arg, read) =>
            read(
              single((at) => at),
              arg,
            ),
          );
          const state = await execute({
            codec,
            env: defaultEnvironment,
            latestRevision: () => latest,
            ...(asOf === undefined ? {} : { asOf }),
            refs: [refOf(reader, 0)],
            store: handles,
          });
          const startedAt = asOf ?? latest;
          assert.equal(state.startedAt, startedAt);
          assert.equal(state.settledAt, latest);
          const instance = state.waves[0]!.evaluated[0]!;
          assert.equal(instance.startedAt, startedAt);
          assert.equal(readsOf(instance)[0]!.startedAt, startedAt);
        },
      ),
    );
  });

  it("keeps each call's meta on its wave, as given", async () => {
    const echo = define((arg) => arg);
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.option(fc.anything()), { minLength: 1, maxLength: 4 }),
        async (metas) => {
          let state = await execute({
            ...BASE,
            refs: [refOf(echo, 0)],
            ...withMeta(metas[0]),
          });
          for (const [index, meta] of metas.slice(1).entries()) {
            state = await execute({
              state,
              refs: [refOf(echo, index + 1)],
              ...withMeta(meta),
            });
          }
          assert.equal(state.waves.length, metas.length);
          for (const [index, wave] of state.waves.entries()) {
            assert.equal(
              wave.meta,
              metas[index] === null ? undefined : metas[index],
            );
          }
        },
      ),
    );
  });

  it("reads every wave at the revision the execution started at", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.nat(20),
        fc.array(fc.nat(5), { maxLength: 4 }),
        async (start, gaps) => {
          let latest = start;
          const latestRevision = (): number => latest;
          const reader = define((arg, read) =>
            read(
              single((at) => at),
              arg,
            ),
          );
          const dependencies = { ...BASE, latestRevision, store: handles };
          const state = await execute({
            ...dependencies,
            refs: [refOf(reader, 0)],
          });
          for (const [index, gap] of gaps.entries()) {
            latest += gap;
            const continued = await execute({
              state,
              refs: [refOf(reader, index + 1)],
            });
            assert.equal(continued.settledAt, latest);
            assert.equal(continued.waves, state.waves);
            assert.equal(state.waves[index + 1]!.settledAt, latest);
          }
          assert.equal(state.startedAt, start);
          assert.equal(state.waves.length, gaps.length + 1);
          for (const wave of state.waves) {
            const instance = wave.evaluated[0]!;
            assert.equal(instance.startedAt, start);
            assert.equal(readsOf(instance)[0]!.startedAt, start);
          }
        },
      ),
    );
  });

  it("records what a store read annotates", async () => {
    const store = single((arg, { annotate }) =>
      annotate({ data: `v${arg}`, revision: 3, footprint: { arg } }),
    );
    const plain = single((arg) => arg);
    const reader = define((arg, read) => [read(store, arg), read(plain, arg)]);
    const wave = await waveOf([refOf(reader, 4)]);
    const instance = wave.instances[0]!;
    assert.deepEqual(settledOf(instance).data, ["v4", 4]);
    const [annotated, bare] = readsOf(instance);
    assert.equal(annotated!.startedAt, 1);
    assert.equal(annotated!.reported, 3);
    assert.deepEqual(annotated!.footprint, { arg: 4 });
    assert.equal(isExact(annotated!), false);
    assert.equal(bare!.startedAt, 1);
    assert.equal(bare!.reported, undefined);
    assert.equal(isExact(bare!), false);
    assert.equal(bare!.footprint, undefined);
    assert.deepEqual(Object.keys(bare!), Object.keys(annotated!));

    const history = single((arg, { annotate, revision }) =>
      annotate({ data: arg, revision }),
    );
    const exact = await waveOf([
      refOf(
        define((arg, read) => read(history, arg)),
        4,
      ),
    ]);
    const [read] = readsOf(exact.instances[0]);
    assert.equal(read!.startedAt, 1);
    assert.equal(read!.reported, 1);
    assert.equal(isExact(read!), true);
  });

  it("settles stale every instance that reads, inline, a store answer older than asked", async () => {
    const STARTED = 10;
    const STORE_ARGS = 4;
    /** `lag` revisions behind the one asked, ahead when negative; none when unannotated. */
    const answerArb = fc.record({
      lag: fc.option(fc.integer({ min: -2, max: 3 }), { nil: undefined }),
      later: fc.boolean(),
    });
    const nodeArb = fc.record({
      stores: fc.uniqueArray(fc.nat(STORE_ARGS - 1), { maxLength: 2 }),
      inline: fc.uniqueArray(fc.nat(4), { maxLength: 2 }),
      refs: fc.uniqueArray(fc.nat(4), { maxLength: 2 }),
      waits: fc.boolean(),
    });
    await fc.assert(
      fc.asyncProperty(
        fc.array(answerArb, { minLength: STORE_ARGS, maxLength: STORE_ARGS }),
        fc.array(nodeArb, { minLength: 1, maxLength: 5 }),
        async (answers, nodes) => {
          const store = single((arg, { annotate, revision }) => {
            const { lag, later } = answers[arg]!;
            const answer =
              lag === undefined
                ? arg
                : annotate({ data: arg, revision: revision - lag });
            return later ? Promise.resolve(answer) : answer;
          });
          // Inline reads go to later nodes only, so they form no cycle.
          const inlineOf = (index: number): number[] =>
            nodes[index]!.inline.filter(
              (each) => each > index && each < nodes.length,
            );
          const node: AnyView = define((index, read, context) => {
            const spec = nodes[index]!;
            const pending = [
              ...spec.stores.map((arg) => read(store, arg)),
              ...inlineOf(index).map((each) => read(node, each)),
            ];
            const refs = spec.refs
              .filter((each) => each < nodes.length)
              .map((each) => refFnOf(context)(node, each));
            return spec.waits ? Promise.all(pending).then(() => refs) : refs;
          });
          /** The oldest revision a lagging answer it reads inline reflects, if any. */
          const oldestLagging = (index: number): number | undefined => {
            let oldest: number | undefined;
            for (const arg of nodes[index]!.stores) {
              const lag = answers[arg]!.lag;
              if (lag !== undefined && lag > 0)
                oldest = Math.min(oldest ?? STARTED, STARTED - lag);
            }
            for (const each of inlineOf(index)) {
              const inner = oldestLagging(each);
              if (inner !== undefined)
                oldest = Math.min(oldest ?? STARTED, inner);
            }
            return oldest;
          };
          const wave = await waveOf(
            nodes.map((_, index) => refOf(node, index)),
            { latestRevision: () => STARTED },
          );
          for (const [index, instance] of wave.instances.entries()) {
            const expected = oldestLagging(index);
            assert.equal(instance.status, "settled");
            assert.ok(instance.descriptor !== undefined);
            assert.equal(
              validThroughOf(instance.descriptor),
              expected ?? STARTED,
              `${index}`,
            );
            assert.equal(
              settledStale(instance.descriptor),
              expected !== undefined,
              `${index}`,
            );
            assert.equal(
              instance.descriptor.matchedThrough,
              STARTED,
              `${index}`,
            );
            assert.ok(instance.data !== null);
          }
        },
      ),
    );
  });
});

describe("execute: view cache", () => {
  it("uses a cached instance of a memoized view in place of running it", async () => {
    let runs = 0;
    const calls: number[] = [];
    const store = single((arg) => {
      calls.push(arg);
      return arg;
    });
    const memo = define(
      (arg, read) => {
        runs++;
        return read(store, arg);
      },
      { memo: true },
    );
    const reader = define((arg, read) => read(memo, arg));
    const first = await waveOf([refOf(reader, 1)]);
    const cached = [...first.state.instances.values()].find(
      (each) => each.view === memo,
    )!;
    assert.equal(cached.startedAt, 1);

    const viewCache = cacheOf((id) => {
      if (id !== cached.id) return undefined;
      settledOf(cached).descriptor.matchedThrough = 5;
      return cached;
    });
    const reports: AssertReport[] = [];
    const second = await waveOf([refOf(reader, 1), refOf(memo, 1)], {
      env: {
        ...defaultEnvironment,
        report: (report) => void reports.push(report),
      },
      latestRevision: () => 5,
      viewCache,
    });
    assert.equal(runs, 1);
    assert.deepEqual(calls, [1]);
    const [again, root] = second.instances;
    assert.equal(settledOf(again).data, 1);
    assert.deepEqual(
      settledOf(again).descriptor.storeReads,
      settledOf(cached).descriptor.storeReads,
    );
    assert.equal(readsOf(again)[0]!.startedAt, 1);
    assert.equal(second.state.instances.get(cached.id), cached);
    assert.equal(root, cached);
    assert.equal(again!.startedAt, 5);
    assert.ok(
      reports.some(
        (report) =>
          report.assert === "sometimes" &&
          report.message ===
            "An execution takes a cached instance in place of running it",
      ),
    );
    assert.ok(reports.every((report) => report.assert === "sometimes"));
  });

  it("reruns a cached instance stale, or not valid at the execution's revision or its own", async () => {
    let runs = 0;
    const memo = define(
      (arg) => {
        runs++;
        return arg;
      },
      { memo: true },
    );
    const first = await waveOf([refOf(memo, 1)]);
    const settled = settledOf(first.instances[0]);
    const rerun = async (cached: ViewInstance): Promise<void> => {
      const viewCache = cacheOf((id) =>
        id === cached.id ? cached : undefined,
      );
      const again = await waveOf([refOf(memo, 1)], {
        env: defaultEnvironment,
        latestRevision: () => 5,
        viewCache,
      });
      const instance = again.instances[0]!;
      assert.notEqual(instance, cached);
      assert.equal(instance.startedAt, 5);
    };
    await rerun(settled);
    // Newer than asked and matched through 7, but settled stale: valid at none.
    const lagging = storeView({
      store: "db",
      name: "lagging",
      matches,
      resolve: (arg: number) => arg,
    });
    await rerun({
      ...settled,
      startedAt: 7,
      descriptor: {
        ...settled.descriptor,
        storeReads: new Map([
          [
            "db",
            [
              {
                view: lagging as unknown as StoreRead["view"],
                args: 1,
                startedAt: 7,
                reported: 6,
                footprint: undefined,
              },
            ],
          ],
        ]),
        matchedThrough: 7,
      },
    });
    // Matched through 5, but a change after it reached its reads.
    await rerun({
      ...settled,
      descriptor: { ...settled.descriptor, matchedThrough: 5 },
      status: "stale",
    });
    assert.equal(runs, 4);
  });

  it("has the view cache keep every instance a settled wave reached", async () => {
    let runs = 0;
    const memo = define(
      (arg) => {
        runs++;
        return arg;
      },
      { memo: true },
    );
    const reader = define((arg, read) => read(memo, arg));
    const changes = createChangeLog({ env: defaultEnvironment, revision: 1 });
    const viewCache = createViewCache({ env: defaultEnvironment, changes });
    const first = await waveOf([refOf(reader, 1), refOf(memo, 2)], {
      viewCache,
    });
    const [root, ref] = first.instances;
    const inline = [...first.state.instances.values()].find(
      (each) => each.view === memo && each !== ref,
    )!;
    assert.equal(viewCache.size, 2);
    assert.equal(viewCache.get(inline.id), inline);
    assert.equal(viewCache.get(ref!.id), ref);
    assert.equal(viewCache.get(root!.id), undefined);

    const second = await waveOf([refOf(reader, 1), refOf(memo, 2)], {
      viewCache,
    });
    assert.equal(runs, 2);
    assert.equal(second.instances[1], ref);
    assert.notEqual(second.instances[0], root);
  });

  it("takes a cached instance newer than the execution unless every store read is exact", async () => {
    const check = async (
      answer: (arg: number, context: StoreViewContext) => unknown,
      taken: boolean,
    ): Promise<void> => {
      let runs = 0;
      const store = single(answer);
      const memo = define(
        (arg, read) => {
          runs++;
          return read(store, arg);
        },
        { memo: true },
      );
      const first = await waveOf([refOf(memo, 1)], { latestRevision: () => 5 });
      const cached = first.instances[0]!;
      assert.equal(cached.startedAt, 5);
      const viewCache = cacheOf((id) =>
        id === cached.id ? cached : undefined,
      );
      const again = await waveOf([refOf(memo, 1)], {
        latestRevision: () => 5,
        asOf: 2,
        viewCache,
      });
      const instance = again.instances[0]!;
      assert.equal(instance === cached, taken);
      assert.equal(runs, taken ? 1 : 2);
      if (!taken) assert.equal(instance.startedAt, 2);
    };
    await check((arg) => arg, true);
    await check(
      (arg, { annotate }) => annotate({ data: arg, revision: 7 }),
      true,
    );
    await check(
      (arg, { annotate, revision }) => annotate({ data: arg, revision }),
      false,
    );
  });
});

describe("execute: rejections", () => {
  const forever = define(() => 0);

  it("rejects past maxWaves, counting the waves it continues", async () => {
    const limits = { maxWaves: 3 };
    const refs = [refOf(forever, 0)];
    const state = await runWave(refs, { limits }, handles);
    await continueWith(state, refs);
    await continueWith(state, refs);
    assertOperation(
      await failureOf(() => continueWith(state, refs)),
      "MAX_WAVES",
    );
  });

  it("rejects past maxDepth and maxInstances", async () => {
    const deep = define((arg, read) => (arg >= 20 ? arg : read(deep, arg + 1)));
    const depth = await failureOf(() =>
      waveOf([refOf(deep, 0)], { limits: { maxDepth: 5 } }),
    );
    assertOperation(depth, "MAX_DEPTH");
    const wide = define((arg, read) =>
      arg > 0
        ? arg
        : Array.from({ length: 20 }, (_, index) => read(wide, index + 1)),
    );
    const instances = await failureOf(() =>
      waveOf([refOf(wide, 0)], { limits: { maxInstances: 5 } }),
    );
    assertOperation(instances, "MAX_INSTANCES");
  });

  it("rejects with an internal error a view throws, never settling it as a value", async () => {
    const internal = internalError({ code: "ASSERTION", message: "broken" });
    const throws = define(() => {
      throw internal;
    });
    const rejects = define(() => Promise.reject(internal));
    const failures = await Promise.all(
      [throws, rejects].map((failing) => {
        const reader = define((arg, read) => read(failing, arg));
        return failureOf(() => waveOf([refOf(reader, 0)]));
      }),
    );
    assert.deepEqual(failures, [internal, internal]);
  });

  it("aborts with the signal, and aborts the reads in flight", async () => {
    const before = new AbortController();
    before.abort(new Error("before"));
    const early = await failureOf(() =>
      waveOf([refOf(forever, 0)], { signal: before.signal }),
    );
    assertOperation(early, "ABORTED");

    const during = new AbortController();
    let storeSignal: AbortSignal | undefined;
    const hanging = single((_arg, { signal }) => {
      storeSignal = signal;
      setTimeout(() => during.abort(new Error("during")), 1);
      return new Promise(() => {});
    });
    const reader = define((arg, read) => read(hanging, arg));
    const late = await failureOf(() =>
      waveOf([refOf(reader, 0)], { signal: during.signal }),
    );
    assertOperation(late, "ABORTED");
    assert.equal(storeSignal?.aborted, true);
  });
});

describe("execute: in the calling task", () => {
  it("settles a wave whose reads all answer at once, batched ones included", () => {
    fc.assert(
      fc.property(
        fc.array(fc.nat(5), { minLength: 1, maxLength: 8 }),
        (args) => {
          const calls: number[][] = [];
          const store = batched(calls);
          const each = single((arg) => arg + 1);
          const prefetch = define((arg, read) => {
            void read(store, arg + 10);
            return read(each, arg);
          });
          const wave = syncWaveOf(
            args.flatMap((arg) => [refOf(store, arg), refOf(prefetch, arg)]),
          );
          assert.deepEqual(calls, [
            [...new Set(args.flatMap((arg) => [arg, arg + 10]))],
          ]);
          assert.deepEqual(
            wave.instances.map((instance) => settledOf(instance).data),
            args.flatMap((arg) => [arg * 10, arg + 1]),
          );
        },
      ),
    );
  });

  it("settles every wave synchronously when every read answers at once", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 6 }), (length) => {
        const calls: number[][] = [];
        const store = batched(calls);
        const chain = define((arg, _read, context) =>
          arg + 1 < length ? refFnOf(context)(chain, arg + 1) : arg,
        );
        const state = runWave([refOf(chain, 0)], {}, handles);
        assert.ok(!(state instanceof Promise), "settled in a later task");
        for (let index = 0; ; index++) {
          const data = settledOf(lastWave(state).instances[0]).data;
          if (!isViewRef(data)) break;
          const continued = continueWith(state, [
            data as Ref,
            refOf(store, index),
          ]);
          assert.ok(!(continued instanceof Promise), "settled in a later task");
        }
        assert.equal(state.startedAt, 1);
        assert.equal(state.settledAt, 1);
        assert.equal(state.waves.length, length);
        assert.deepEqual(
          calls,
          Array.from({ length: length - 1 }, (_, index) => [index]),
        );
      }),
    );
  });

  it("settles failures of views, reads, batches and stores", () => {
    const failing = define(() => {
      throw new Error("boom");
    });
    const careful = define((arg, read) => {
      try {
        return read(failing, arg);
      } catch {
        return "fallback";
      }
    });
    const [failed, caught] = syncWaveOf([
      refOf(failing, 0),
      refOf(careful, 0),
    ]).instances;
    assert.equal(settledOf(failed).errors[0]!.message, "boom");
    assert.equal(settledOf(caught).data, "fallback");

    const throwing = single(() => {
      throw new Error("read");
    });
    const read = syncWaveOf([refOf(throwing, 0)]).instances[0];
    assert.equal(settledOf(read).errors[0]!.message, "read");

    const slots = batched([], (args) =>
      args.map((arg) => (arg === 1 ? new Error("one") : arg)),
    );
    const slotWave = syncWaveOf([refOf(slots, 0), refOf(slots, 1)]);
    assert.equal(settledOf(slotWave.instances[0]).data, 0);
    assert.equal(settledOf(slotWave.instances[1]).errors[0]!.message, "one");
    const short = batched([], () => []);
    for (const instance of syncWaveOf([refOf(short, 0)]).instances) {
      assert.equal(codeOf(instance), "INVALID_BATCH");
    }
    const broken = batched([], () => {
      throw new Error("batch");
    });
    for (const instance of syncWaveOf([refOf(broken, 0), refOf(broken, 1)])
      .instances) {
      assert.equal(settledOf(instance).errors[0]!.message, "batch");
    }

    const reader = define((arg, readStore) =>
      readStore(
        single((each) => each),
        arg,
      ),
    );
    const ref = refOf(reader, 0);
    assert.equal(
      codeOf(syncWaveOf([ref], { store: () => undefined }).instances[0]),
      "UNKNOWN_STORE",
    );
    assert.equal(
      codeOf(syncWaveOf([ref], {}, null).instances[0]),
      "UNKNOWN_STORE",
    );
    const down = syncWaveOf([ref], {
      store: () => {
        throw new Error("down");
      },
    });
    assert.equal(codeOf(down.instances[0]), "STORE_UNAVAILABLE");
  });

  it("settles with a cached instance of a view that would wait", async () => {
    const memo = define(async (arg) => arg, { memo: true });
    const cached = (await waveOf([refOf(memo, 1)])).instances[0]!;
    const reader = define((arg, read) => read(memo, arg));
    const wave = syncWaveOf([refOf(memo, 1), refOf(reader, 1)], {
      viewCache: cacheOf((id) => (id === cached.id ? cached : undefined)),
    });
    const [root, read] = wave.instances;
    assert.equal(root, cached);
    assert.equal(settledOf(read).data, 1);
  });

  it("throws what would reject once something waits", () => {
    const forever = define(() => 0);
    const run = (args: Partial<NewExecutionArgs>) => () =>
      runWave([refOf(forever, 0)], args, handles);
    const once = runWave(
      [refOf(forever, 0)],
      { limits: { maxWaves: 1 } },
      handles,
    ) as ExecutionState;
    assertOperation(
      thrownBy(() => continueWith(once, [refOf(forever, 0)])),
      "MAX_WAVES",
    );

    const deep = define((arg, read) => (arg >= 20 ? arg : read(deep, arg + 1)));
    const depth = thrownBy(() =>
      runWave([refOf(deep, 0)], { limits: { maxDepth: 5 } }, handles),
    );
    assertOperation(depth, "MAX_DEPTH");
    const wide = define((arg, read) =>
      arg > 0
        ? arg
        : Array.from({ length: 20 }, (_, index) => read(wide, index + 1)),
    );
    const instances = thrownBy(() =>
      runWave([refOf(wide, 0)], { limits: { maxInstances: 5 } }, handles),
    );
    assertOperation(instances, "MAX_INSTANCES");

    const internal = internalError({ code: "ASSERTION", message: "broken" });
    const breaks = define(() => {
      throw internal;
    });
    const reader = define((arg, read) => read(breaks, arg));
    assert.equal(
      thrownBy(() => runWave([refOf(reader, 0)], {}, handles)),
      internal,
    );

    const before = new AbortController();
    before.abort(new Error("before"));
    assertOperation(thrownBy(run({ signal: before.signal })), "ABORTED");

    const during = new AbortController();
    let storeSignal: AbortSignal | undefined;
    const aborting = single((arg, { signal }) => {
      storeSignal = signal;
      during.abort(new Error("during"));
      return arg;
    });
    const aborted = define((arg, read) => read(aborting, arg));
    const late = thrownBy(() =>
      runWave([refOf(aborted, 0)], { signal: during.signal }, handles),
    );
    assertOperation(late, "ABORTED");
    assert.equal(storeSignal?.aborted, true);
  });
});

const send = (args: { readonly to: number }): number => args.to;

describe("execute: refs", () => {
  const metas = fc.option(
    fc.record({ tags: fc.array(fc.string(), { maxLength: 3 }) }),
    {
      nil: undefined,
    },
  );

  it("keeps a ref's view, arguments and meta, and leads refs differing in meta to one instance", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(metas, { minLength: 1, maxLength: 4 }),
        fc.nat(5),
        async (given, arg) => {
          const leaf = define((at) => at);
          const parent = define((at, _read, context) =>
            given.map((meta) => refFnOf(context)(leaf, at, meta)),
          );
          const first = await runWave([refOf(parent, arg)], {}, handles);
          const found = settledOf(first.waves[0]!.evaluated[0]).data as Ref[];
          const wave = lastWave(await continueWith(first, found));
          const refs = wave.state.waves[1]!.refs;
          assert.equal(refs.length, given.length);
          for (const [index, ref] of refs.entries()) {
            assert.ok(isRef(ref) && Object.isFrozen(ref));
            assert.equal(ref.view, leaf);
            assert.equal(ref.args, arg);
            assert.equal(ref.meta, given[index]);
          }
          assert.equal(new Set(wave.instances).size, 1);
          assert.equal(settledOf(wave.instances[0]).data, arg);
        },
      ),
    );
  });

  it("tells a ref from data shaped like one", () => {
    fc.assert(
      fc.property(metas, fc.nat(5), (meta, arg) => {
        const leaf = define((at) => at);
        const ref = refOf(leaf, arg, meta);
        assert.ok(isRef(ref));
        assert.ok(!isRef({ view: leaf, args: arg, meta }));
        assert.ok(!isRef(JSON.parse(JSON.stringify(ref))));
      }),
    );
  });

  it("makes an action ref, a frozen leaf holding the action, its arguments and meta", async () => {
    await fc.assert(
      fc.asyncProperty(metas, fc.nat(5), async (meta, arg) => {
        const offers = define((at, _read, context) =>
          context.action(send, { to: at }, meta),
        );
        const state = await runWave([refOf(offers, arg)], {}, handles);
        const data = settledOf(state.waves[0]!.evaluated[0]).data;
        assert.ok(
          isActionRef(data) &&
            isRef(data) &&
            !isViewRef(data) &&
            Object.isFrozen(data),
        );
        assert.equal(data.action, send);
        assert.deepEqual(data.args, { to: arg });
        assert.equal(data.meta, meta);
        assert.deepEqual(codec.findRefs(offers, data).refs, []);
      }),
    );
  });

  it("makes an action ref of any object that is not a view", async () => {
    const archive = { type: "archive" };
    const offers = define((at, _read, context) =>
      context.action(archive, { chat: at }),
    );
    const state = await runWave([refOf(offers, 1)], {}, handles);
    const data = settledOf(state.waves[0]!.evaluated[0]).data;
    assert.ok(isActionRef(data));
    assert.equal(data.action, archive);
    assert.deepEqual(data.args, { chat: 1 });
  });

  it("rejects action arguments the codec cannot key", async () => {
    const offers = define((at, _read, context) => {
      try {
        return context.action(send, { to: at === 0 ? Number.NaN : at });
      } catch (error) {
        return Reflect.get(Object(error), "code");
      }
    });
    const state = await runWave([refOf(offers, 0)], {}, handles);
    assert.equal(
      settledOf(state.waves[0]!.evaluated[0]).data,
      "INVALID_ARGUMENT",
    );
  });
});

describe("execute: one instance per id", () => {
  it("settles an instance once across the waves of an execution", async () => {
    let runs = 0;
    const leaf = define(() => ++runs);
    const state = await runWave([refOf(leaf, 0), refOf(leaf, 0)], {}, handles);
    await continueWith(state, [refOf(leaf, 0)]);
    await continueWith(state, [refOf(leaf, 0)]);
    assert.equal(runs, 1);
    const all = state.waves.flatMap((wave) => wave.evaluated);
    assert.equal(all.length, 4);
    for (const instance of all) assert.equal(instance, all[0]);
  });
});

describe("execute: continuing an execution", () => {
  const leaf = define((arg) => arg);

  it("returns a state sharing every wave so far, in order, and every instance", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.array(fc.nat(3), { maxLength: 3 }), {
          minLength: 1,
          maxLength: 4,
        }),
        async ([first, ...rest]) => {
          const refsOf = (args: number[]): Ref[] =>
            args.map((arg) => refOf(leaf, arg));
          const state = await runWave(refsOf(first!), {}, handles);
          for (const args of rest) {
            const continued = await continueWith(state, refsOf(args));
            assert.notEqual(continued, state);
            assert.equal(continued.waves, state.waves);
            assert.equal(continued.instances, state.instances);
          }
          const all = [first!, ...rest];
          assert.equal(state.waves.length, all.length);
          for (const [index, wave] of state.waves.entries()) {
            assert.deepEqual(
              wave.evaluated.map((instance) => settledOf(instance).data),
              all[index],
            );
            for (const instance of wave.evaluated) {
              assert.equal(state.instances.get(instance.id), instance);
            }
          }
          assert.equal(state.instances.size, new Set(all.flat()).size);
        },
      ),
    );
  });

  it("throws for a state execute did not return", async () => {
    const state = await runWave([refOf(leaf, 0)], {}, handles);
    const { startedAt, settledAt, waves, instances } = state;
    const forged = [
      { startedAt: 1, settledAt: 1, waves: [], instances: new Map() },
      { startedAt, settledAt, waves, instances },
    ];
    for (const each of forged) {
      assertOperation(
        // @ts-expect-error -- Only `execute` makes a state; this checks the runtime guard too.
        thrownBy(() => continueWith(each, [refOf(leaf, 1)])),
        "UNKNOWN_EXECUTION",
      );
    }
    assert.equal(state.waves.length, 1);
  });

  it("continues one execution from any state it returned", async () => {
    const first = await runWave([refOf(leaf, 0)], {}, handles);
    const second = await continueWith(first, [refOf(leaf, 1)]);
    const third = await continueWith(first, [refOf(leaf, 2)]);
    await continueWith({ ...second }, [refOf(leaf, 3)]);
    assert.equal(third.waves, first.waves);
    assert.deepEqual(
      first.waves.map((wave) => settledOf(wave.evaluated[0]).data),
      [0, 1, 2, 3],
    );
  });

  it("throws while the last wave runs, and continues once it settles", async () => {
    const slow = define(async (arg) => arg);
    const first = runWave([refOf(slow, 0)], {}, handles);
    assert.ok(first instanceof Promise);
    const state = await first;
    const second = continueWith(state, [refOf(slow, 1)]);
    assert.ok(second instanceof Promise);
    assertOperation(
      thrownBy(() => continueWith(state, [refOf(leaf, 0)])),
      "EXECUTION_RUNNING",
    );
    await second;
    await continueWith(state, [refOf(leaf, 0)]);
    assert.equal(state.waves.length, 3);
  });

  it("stays stopped once a wave fails or aborts, throwing what stopped it", async () => {
    const internal = internalError({ code: "ASSERTION", message: "broken" });
    const breaks = define(() => {
      throw internal;
    });
    const reader = define((arg, read) => read(breaks, arg));
    const failed = await runWave([refOf(leaf, 0)], {}, handles);
    assert.equal(
      await failureOf(() => continueWith(failed, [refOf(reader, 0)])),
      internal,
    );
    assert.equal(
      thrownBy(() => continueWith(failed, [refOf(leaf, 1)])),
      internal,
    );

    const controller = new AbortController();
    const hanging = single(() => new Promise(() => {}));
    const waits = define((arg, read) => read(hanging, arg));
    const aborted = await runWave(
      [refOf(leaf, 0)],
      { signal: controller.signal },
      handles,
    );
    const waiting = continueWith(aborted, [refOf(waits, 0)]);
    controller.abort(new Error("stop"));
    const error = await failureOf(() => waiting);
    assertOperation(error, "ABORTED");
    assert.equal(
      thrownBy(() => continueWith(aborted, [refOf(leaf, 1)])),
      error,
    );
  });

  it("stops when its signal aborts between waves", async () => {
    const controller = new AbortController();
    const state = await runWave(
      [refOf(leaf, 0)],
      { signal: controller.signal },
      handles,
    );
    controller.abort(new Error("between"));
    const error = thrownBy(() => continueWith(state, [refOf(leaf, 1)]));
    assertOperation(error, "ABORTED");
    assert.equal(
      thrownBy(() => continueWith(state, [refOf(leaf, 2)])),
      error,
    );
    assert.equal(state.waves.length, 1);
  });

  it("counts instances across its waves", async () => {
    const limits = { maxInstances: 3 };
    const state = await runWave(
      [refOf(leaf, 0), refOf(leaf, 1)],
      { limits },
      handles,
    );
    await continueWith(state, [refOf(leaf, 0), refOf(leaf, 2)]);
    assertOperation(
      await failureOf(() => continueWith(state, [refOf(leaf, 3)])),
      "MAX_INSTANCES",
    );
  });
});
