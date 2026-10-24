/* Pins: their types, and a live query keeping a pin's answer while its target stays live. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as fc from "fast-check";
import type {
  AnyView,
  ChangeFeed,
  DriverContext,
  ExecutionState,
  ExecutionWave,
  PinFn,
  PromiseOrValue,
  QueryableView,
  QueryDriver,
  QueryPayload,
  Ref,
  ResultOf,
  Revision,
  StoreChange,
  StoreChangeListener,
  ViewFn,
  ViewInstance,
} from "../index";
import {
  createRuntime,
  defaultEnvironment,
  pin,
  storeView,
  view,
} from "../index";
import { isRefresherError } from "../errors";
import {
  createSimpleDriver,
  type SimpleDriverOutput,
} from "../queries/simpleDriver";

type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y
  ? 1
  : 2
  ? true
  : false;
const equal = <X, Y>(same: Equal<X, Y>): boolean => same;

type Entry = { readonly id: number; readonly value: number | null };

/** Compile-time checks; `yarn types` runs them, nothing calls them. */
function pinChecks(define: ViewFn, definePin: PinFn): readonly AnyView[] {
  const entry = define({
    resolve: (id: number): Entry => ({ id, value: null }),
  });
  const asView = define({
    access: { queryable: true },
    resolve: (_args: undefined, { ref }) =>
      Math.random() > 0.5 ? ref(entry, 1) : null,
  });
  const asPin = definePin({
    target: entry,
    access: { queryable: true },
    resolve: (_args: undefined, { ref }) =>
      Math.random() > 0.5 ? ref(entry, 1) : null,
  });
  const asyncPin = definePin({
    target: entry,
    resolve: async (_args: undefined, { ref }) => ref(entry, 1),
  });
  // A pin's result is a view's returning the same refs: its consumers do not change.
  equal<ResultOf<typeof asPin>, ResultOf<typeof asView>>(true);
  equal<ResultOf<typeof asPin>, Ref<Entry, number> | null>(true);
  equal<ResultOf<typeof asyncPin>, Ref<Entry, number>>(true);
  equal<(typeof asPin)["target"], typeof entry>(true);
  const root: QueryableView = asPin;

  const other = define({ resolve: (id: string) => id });
  definePin({
    target: entry,
    // @ts-expect-error -- a pin answers with a ref to its target, and no other.
    resolve: (_args: undefined, { ref }) => ref(other, "x"),
  });
  // @ts-expect-error -- or `null`: never data.
  definePin({ target: entry, resolve: () => 1 });
  // @ts-expect-error -- a pin is never readable.
  definePin({ target: entry, access: { readable: true }, resolve: () => null });
  // @ts-expect-error -- a pin's target is a view, never a pin.
  definePin({ target: asPin, resolve: () => null });
  define({
    // @ts-expect-error -- so nothing reads it.
    resolve: (_args: undefined, { read }) => read(asPin),
  });
  return [asView, asPin, asyncPin, root];
}

const ITEMS = 3;
/** The cell holding the newest item's id, `0` for none; items are the cells `1..ITEMS`. */
const NEWEST = 0;

type Cells = Map<number, number>;

type FakeFeed = ChangeFeed & {
  deliver(changes: readonly StoreChange[], at: Revision): void;
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

/** Waits for the microtask queue and one task. */
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

async function settle(): Promise<void> {
  for (let round = 0; round < 5; round++) {
    await tick();
  }
}

/** A cell, an item, and the newest item's pin over them, counting the pin's runs. */
function graph(async: boolean) {
  const runs = { pin: 0 };
  const cell = storeView<number, PromiseOrValue<number | undefined>, Cells>({
    store: "cells",
    name: "cell",
    resolve: (key, { store }) =>
      async ? Promise.resolve(store.get(key)) : store.get(key),
    matches: (key, change) => change.value === key,
  });
  const item = view({
    name: "item",
    resolve: async (id: number, { read }): Promise<Entry> => ({
      id,
      value: (await read(cell, id)) ?? null,
    }),
  });
  const newest = pin({
    target: item,
    name: "newest",
    access: { queryable: true },
    resolve: async (_args: undefined, { read, ref }) => {
      runs.pin++;
      const id = (await read(cell, NEWEST)) ?? 0;
      return id === 0 ? null : ref(item, id, { tags: ["item"] });
    },
  });
  return { runs, item, newest };
}

function isPinTarget(error: unknown): boolean {
  return isRefresherError(error) && error.code === "PIN_TARGET";
}

/** Runs the query's roots again on every restart, keeping nothing itself. */
function createRerunDriver(): QueryDriver<SimpleDriverOutput, never, never> {
  return {
    start: ({ roots, context }) => rerun(roots, context),
    restart: ({ descriptor, context }) => rerun(descriptor.roots, context),
  };
}

function rerun(
  roots: readonly Ref[],
  context: DriverContext,
): PromiseOrValue<QueryPayload<SimpleDriverOutput, never>> {
  const started = context.execute({ refs: roots });
  return started instanceof Promise
    ? started.then(rerunPayload)
    : rerunPayload(started);
}

function rerunPayload(
  state: ExecutionState,
): QueryPayload<SimpleDriverOutput, never> {
  const wave = state.waves[0]!;
  const instances = new Map<string, ViewInstance>();
  for (const instance of [...wave.evaluated, ...wave.pinned.evaluated]) {
    instances.set(instance.id, instance);
  }
  return { output: { roots: wave.evaluated, instances }, waves: state.waves };
}

/** Drivers following the pin's ref, following no ref, and rerunning the pin on every restart. */
const drivers = {
  tagged: () => createSimpleDriver(["item"]),
  untagged: () => createSimpleDriver(),
  rerun: createRerunDriver,
};
const driverNames = ["tagged", "untagged", "rerun"] as const;

const writes = fc.array(
  fc.oneof(
    fc.record({ key: fc.constant(NEWEST), value: fc.nat(ITEMS) }),
    fc.record({ key: fc.integer({ min: 1, max: ITEMS }), value: fc.nat(9) }),
  ),
  { maxLength: 8 },
);

void describe("pins", () => {
  void it("are checked at compile time", () => {
    assert.equal(typeof pinChecks, "function");
  });

  void it("keeps a pin's ref in a live query, never running it again, while its target stays live", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.nat(ITEMS),
        fc.array(fc.nat(9), { minLength: ITEMS, maxLength: ITEMS }),
        fc.boolean(),
        writes,
        fc.constantFrom(...driverNames),
        async (first, values, async, steps, driverName) => {
          const cells: Cells = new Map([[NEWEST, first]]);
          values.forEach((value, index) => cells.set(index + 1, value));
          let revision = 1;
          const feed = feedAt(revision);
          const runtime = createRuntime({
            env: defaultEnvironment,
            feed,
            store: () => cells,
          });
          const { runs, item, newest } = graph(async);
          const driver = drivers[driverName]();
          /** A pin answering with a ref runs its target in the same wave, reported apart. */
          const checkWaves = (waves: readonly ExecutionWave[]) => {
            for (const wave of waves) {
              assert.equal(wave.evaluated.length, wave.refs.length);
              const { pinned } = wave;
              assert.equal(pinned.evaluated.length, pinned.refs.length);
              const pinRefs = wave.evaluated.flatMap((instance) =>
                instance.view === newest && instance.data !== null
                  ? [instance.data]
                  : [],
              );
              assert.deepEqual(pinned.refs, pinRefs);
              for (const [index, target] of pinned.evaluated.entries()) {
                assert.equal(target.view, item);
                assert.equal(target.args, pinned.refs[index]!.args);
                assert.equal(target.status, "settled");
              }
            }
          };
          const result = await runtime.query(newest, undefined, driver);
          assert.ok("output" in result);
          checkWaves(result.waves);
          const latest = new Map<string, ViewInstance>(result.output.instances);
          let restarts = 0;
          const subscription = result.subscribe({
            next(restart) {
              assert.ok("output" in restart);
              checkWaves(restart.waves);
              restarts++;
              for (const [id, instance] of restart.output.instances)
                latest.set(id, instance);
            },
            error: (error) => assert.fail(String(error)),
          });

          // The model: the pin answers at start, and again only while it answered `null`.
          let pinned = first === 0 ? undefined : first;
          let pinRuns = 1;
          let expectedRestarts = 0;
          const check = () => {
            assert.equal(runs.pin, pinRuns);
            assert.equal(restarts, expectedRestarts);
            const root = [...latest.values()].find(
              (instance) => instance.view === newest,
            )!;
            assert.deepEqual(root.errors, []);
            if (pinned === undefined) {
              assert.equal(root.data, null);
              return;
            }
            assert.deepEqual(Reflect.get(Object(root.data), "args"), pinned);
            assert.equal(root.descriptor?.storeReads.size, 0);
            const target = [...latest.values()].find(
              (instance) => instance.view === item && instance.args === pinned,
            );
            assert.deepEqual(target?.data, {
              id: pinned,
              value: cells.get(pinned),
            });
          };
          check();

          for (const { key, value } of steps) {
            revision++;
            cells.set(key, value);
            feed.deliver(
              [{ store: "cells", operation: "put", value: key }],
              revision,
            );
            if (key === NEWEST && pinned === undefined) {
              pinRuns++;
              expectedRestarts++;
              pinned = value === 0 ? undefined : value;
            } else if (key === pinned) {
              expectedRestarts++;
            }
            await settle();
            check();
          }

          // Another query asks again.
          const fresh = await runtime.query(newest, undefined, driver);
          assert.ok("output" in fresh);
          const newestNow = cells.get(NEWEST) ?? 0;
          const data = fresh.output.roots[0]?.data;
          if (newestNow === 0) assert.equal(data, null);
          else assert.equal(Reflect.get(Object(data), "args"), newestNow);
          subscription.unsubscribe();
          runtime.dispose();
        },
      ),
      { numRuns: 60 },
    );
  });

  void it("fails a pin answering with a ref to another view, or leaving inputs open", async () => {
    const runtime = createRuntime({
      env: defaultEnvironment,
      feed: feedAt(1),
      store: () => {},
    });
    const item = view({ resolve: (id: number) => id });
    const other = view({ resolve: (id: number) => id });
    const page = view({
      resolve: (args: { readonly first: number }) => args.first,
    });
    const wrong = pin({
      target: item,
      access: { queryable: true },
      resolve: (_args: undefined, { ref }) =>
        ref(other, 1) as unknown as Ref<number, number>,
    });
    const open = pin({
      target: page,
      access: { queryable: true },
      resolve: (_args: undefined, { ref, input }) =>
        ref(page, { first: input("first") }) as unknown as Ref<
          number,
          { first: number }
        >,
    });
    const driver = createSimpleDriver();
    for (const [failing, code] of [
      [wrong, "PIN_TARGET"],
      [open, "OPEN_INPUT"],
    ] as const) {
      const result = await runtime.query(failing, undefined, driver);
      assert.ok("output" in result);
      const root = result.output.roots[0]!;
      assert.equal(root.data, null);
      assert.deepEqual(
        root.errors.map((error) => error.code),
        [code],
      );
    }
    runtime.dispose();
  });

  void it("throws when its target is itself a pin", () => {
    const item = view({ resolve: (id: number) => id });
    const first = pin({ target: item, resolve: () => null });
    // As an untyped caller would: the types reject a pin as a target.
    const untyped: (options: {
      readonly target: AnyView;
      readonly resolve: () => null;
    }) => AnyView = pin;
    assert.throws(
      () => untyped({ target: first, resolve: () => null }),
      isPinTarget,
    );
  });
});
