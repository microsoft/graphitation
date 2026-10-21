/* Model-based tests of the view cache, deciding validity from every delivery since the start. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as fc from "fast-check";
import type { AnyView, Revision } from "../../api.core";
import type {
  CreateViewCacheFn,
  ViewCache,
  ViewInstance,
} from "../../api.execution";
import type {
  ChangeLog,
  Delivery,
  ViewInstanceDescriptor,
} from "../../api.invalidation";
import type { StoreChange, StoreRead } from "../../api.stores";
import { defaultEnvironment } from "../../env/environment";
import { createChangeLog } from "../../invalidation/changeLog";
import { storeView, view } from "../../views/definitions";
import { createViewCache } from "../viewCache";

const IMPLEMENTATIONS: readonly (readonly [string, CreateViewCacheFn])[] = [
  ["createViewCache", createViewCache],
];

const STORES = ["a", "b"] as const;
const KEYS = 4;
const IDS = ["i0", "i1", "i2"] as const;

/** A store view over `store` whose read of `keys` is hit by a change to any of them. */
function keyedView(store: string): AnyView {
  return storeView({
    store,
    name: `keys:${store}`,
    resolve: () => null,
    matches: (keys: readonly number[], change: StoreChange) =>
      keys.includes(change.value as number),
  });
}

const STORE_VIEWS = STORES.map(keyedView);

const resolve = (): null => null;
const VIEWS: readonly (readonly [AnyView, boolean])[] = [
  [view({ name: "memo", memo: true, resolve }), true],
  [
    view({
      name: "deterministicMemo",
      memo: true,
      deterministic: true,
      resolve,
    }),
    true,
  ],
  [view({ name: "plain", resolve }), false],
  [view({ name: "notMemo", memo: false, resolve }), false],
  [
    view({
      name: "nondeterministicMemo",
      memo: true,
      deterministic: false,
      resolve,
    }),
    false,
  ],
];

type Model = {
  tail: Revision;
  head: Revision;
  /** Every delivery since the start, trimmed or not. */
  readonly deliveries: Delivery[];
  readonly kept: Map<string, ViewInstance>;
  /** The instances a change hit, or that could no longer be checked, once kept. */
  readonly stale: Set<ViewInstance>;
};
type Real = { readonly changes: ChangeLog; readonly cache: ViewCache };
type Command = fc.Command<Model, Real>;

/** A fraction of the window, in quarters. */
const fractionArb = fc.nat(4).map((quarters) => quarters / 4);

/** Whether a change after `start` hits `read`. */
function hitAfter(model: Model, read: StoreRead, start: Revision): boolean {
  const store = STORES[STORE_VIEWS.indexOf(read.view)];
  const keys = read.args as readonly number[];
  return model.deliveries.some(
    (delivery) =>
      delivery.revision > start &&
      delivery.changes.some(
        (change) =>
          change.store === store && keys.includes(change.value as number),
      ),
  );
}

function descriptorOf(instance: ViewInstance): ViewInstanceDescriptor {
  assert.ok(
    instance.descriptor !== undefined,
    "the model keeps no running instance",
  );
  return instance.descriptor;
}

/** Whether an instance, valid through `validThrough` when last checked, is valid through the head. */
function validNow(
  model: Model,
  instance: ViewInstance,
  validThrough: Revision,
): boolean {
  return (
    validThrough >= model.head ||
    (validThrough >= model.tail &&
      !descriptorOf(instance).storeReads.some((read) =>
        hitAfter(model, read, Math.max(read.revision, validThrough)),
      ))
  );
}

/**
 * Checks a kept instance the cache validated, not stale and valid through `validThrough`
 * before: valid through the head, or stale, as the model then is.
 */
function checkValidated(
  model: Model,
  instance: ViewInstance,
  validThrough: Revision,
): void {
  const after = descriptorOf(instance).validThrough;
  if (validNow(model, instance, validThrough)) {
    assert.ok(after >= model.head, "not validated through the head");
    return;
  }
  assert.equal(after, validThrough, "a stale instance was validated");
  model.stale.add(instance);
}

/** Checks `get(id)` against the model, which validates what it keeps under `id` unless stale. */
function checkGet(model: Model, real: Real, id: string): void {
  const kept = model.kept.get(id);
  const validThrough =
    kept === undefined ? undefined : descriptorOf(kept).validThrough;
  const got = real.cache.get(id);
  assert.equal(got, kept, "handed out");
  if (kept !== undefined && validThrough !== undefined) {
    if (model.stale.has(kept)) {
      assert.equal(
        descriptorOf(kept).validThrough,
        validThrough,
        "a stale instance was validated",
      );
    } else {
      checkValidated(model, kept, validThrough);
    }
  }
  checkKept(model, real);
}

/** Whether it is valid at its own revision: it did not settle stale, or was validated since. */
function isCurrent(instance: ViewInstance): boolean {
  return descriptorOf(instance).validThrough >= instance.revision;
}

/**
 * Whether `keep` takes `instance` over `kept`: one not stale, else one valid at its revision,
 * else the newer one.
 */
function displaces(
  model: Model,
  kept: ViewInstance | undefined,
  instance: ViewInstance,
): boolean {
  if (kept === undefined || kept === instance) return true;
  const keptStale = model.stale.has(kept);
  if (keptStale !== model.stale.has(instance)) return keptStale;
  if (isCurrent(kept) !== isCurrent(instance)) return isCurrent(instance);
  return kept.revision <= instance.revision;
}

/** Checks the size, and which kept instances are marked stale. */
function checkKept(model: Model, real: Real): void {
  assert.equal(real.cache.size, model.kept.size, "size");
  for (const kept of model.kept.values()) {
    assert.equal(
      kept.status,
      model.stale.has(kept) ? "stale" : "settled",
      "status",
    );
  }
}

const appendArb = fc
  .record({
    gap: fc.integer({ min: 1, max: 2 }),
    changes: fc.array(
      fc.record({ store: fc.nat(STORES.length - 1), key: fc.nat(KEYS - 1) }),
      {
        maxLength: 2,
      },
    ),
  })
  .map(
    ({ gap, changes }): Command => ({
      check: () => true,
      run(model, real) {
        const delivery: Delivery = {
          revision: model.head + gap,
          changes: changes.map(
            (change): StoreChange => ({
              store: STORES[change.store]!,
              operation: "put",
              value: change.key,
            }),
          ),
        };
        real.changes.append(delivery);
        model.head = delivery.revision;
        model.deliveries.push(delivery);
        checkKept(model, real);
      },
      toString: () => `append(+${gap}, ${JSON.stringify(changes)})`,
    }),
  );

const trimArb = fractionArb.map(
  (fraction): Command => ({
    check: () => true,
    run(model, real) {
      model.tail += Math.floor(fraction * (model.head - model.tail));
      real.changes.trim(model.tail);
      checkKept(model, real);
    },
    toString: () => `trim(${fraction})`,
  }),
);

const cacheableArb = fc.nat(VIEWS.length - 1).map(
  (index): Command => ({
    check: () => true,
    run(_model, real) {
      const [each, cacheable] = VIEWS[index]!;
      assert.equal(
        real.cache.cacheable(each),
        cacheable,
        `cacheable(${each.name})`,
      );
    },
    toString: () => `cacheable(${VIEWS[index]![0].name})`,
  }),
);

/**
 * An instance settled `back` revisions before the head and valid `ahead` revisions after
 * its own, reading keys at or before its revision; or one settled stale; marked `stale` or
 * not.
 */
const keepArb = fc
  .record({
    id: fc.constantFrom(...IDS),
    view: fc.nat(VIEWS.length - 1),
    settledStale: fc.boolean(),
    stale: fc.boolean(),
    back: fc.nat(4),
    ahead: fc.nat(3),
    reads: fc.array(
      fc.record({
        view: fc.nat(STORE_VIEWS.length - 1),
        keys: fc.uniqueArray(fc.nat(KEYS - 1), { maxLength: 2 }),
        back: fc.nat(2),
      }),
      { maxLength: 3 },
    ),
  })
  .map(
    (spec): Command => ({
      check: () => true,
      run(model, real) {
        const [each, cacheable] = VIEWS[spec.view]!;
        const revision = Math.max(0, model.head - spec.back);
        const storeReads = spec.reads.map(
          (read): StoreRead => ({
            view: STORE_VIEWS[read.view]! as StoreRead["view"],
            args: read.keys,
            revision: Math.max(0, revision - read.back),
            exact: false,
          }),
        );
        const validThrough = spec.settledStale
          ? revision - 1
          : revision + spec.ahead;
        const instance: ViewInstance = {
          view: each,
          args: null,
          id: spec.id,
          revision,
          depth: 0,
          descriptor: {
            view: each,
            args: null,
            id: spec.id,
            storeReads,
            validThrough,
          },
          status: spec.stale ? "stale" : "settled",
          data: null,
          errors: [],
          reads: undefined,
          settled: undefined,
        };
        if (spec.stale) model.stale.add(instance);
        const keeps =
          cacheable && displaces(model, model.kept.get(spec.id), instance);
        assert.equal(real.cache.keep(instance), keeps, "keep");
        if (keeps) model.kept.set(spec.id, instance);
        checkKept(model, real);
      },
      toString: () => `keep(${JSON.stringify(spec)})`,
    }),
  );

const getArb = fc.constantFrom(...IDS).map(
  (id): Command => ({
    check: () => true,
    run: (model, real) => checkGet(model, real, id),
    toString: () => `get(${id})`,
  }),
);

const deleteArb = fc.constantFrom(...IDS).map(
  (id): Command => ({
    check: () => true,
    run(model, real) {
      assert.equal(real.cache.delete(id), model.kept.delete(id), "delete");
      assert.equal(real.cache.get(id), undefined, "kept after it was deleted");
      checkKept(model, real);
    },
    toString: () => `delete(${id})`,
  }),
);

/** Validates ahead of a trim to `before`, a fraction of the window, and trims when `trims`. */
const validateArb = fc
  .record({ fraction: fractionArb, trims: fc.boolean() })
  .map(
    ({ fraction, trims }): Command => ({
      check: () => true,
      run(model, real) {
        const before =
          model.tail + Math.floor(fraction * (model.head - model.tail));
        const due: (readonly [ViewInstance, Revision])[] = [];
        const untouched: (readonly [ViewInstance, Revision])[] = [];
        for (const kept of model.kept.values()) {
          const validThrough = descriptorOf(kept).validThrough;
          const isDue = validThrough < before && !model.stale.has(kept);
          (isDue ? due : untouched).push([kept, validThrough]);
        }
        real.cache.validate(before);
        for (const [kept, validThrough] of due)
          checkValidated(model, kept, validThrough);
        for (const [kept, validThrough] of untouched) {
          assert.equal(
            descriptorOf(kept).validThrough,
            validThrough,
            "one not due was validated",
          );
        }
        checkKept(model, real);
        if (!trims) return;
        model.tail = before;
        real.changes.trim(before);
        for (const kept of model.kept.values()) {
          if (!model.stale.has(kept)) {
            assert.ok(
              descriptorOf(kept).validThrough >= before,
              "lost to the trim",
            );
          }
          checkGet(model, real, kept.id);
        }
      },
      toString: () => `validate(${fraction}${trims ? ", trim" : ""})`,
    }),
  );

const commandsArb = fc.commands(
  [
    appendArb,
    trimArb,
    cacheableArb,
    keepArb,
    keepArb,
    getArb,
    getArb,
    deleteArb,
    validateArb,
  ],
  { maxCommands: 50, size: "max" },
);

for (const [name, create] of IMPLEMENTATIONS) {
  describe(`${name}: generated changes and cache use`, () => {
    it("hands out what it keeps, marked stale once a change hits it", () => {
      fc.assert(
        fc.property(fc.nat(5), commandsArb, (revision, commands) => {
          fc.modelRun(() => {
            const changes = createChangeLog({
              env: defaultEnvironment,
              revision,
            });
            return {
              model: {
                tail: revision,
                head: revision,
                deliveries: [],
                kept: new Map(),
                stale: new Set<ViewInstance>(),
              },
              real: {
                changes,
                cache: create({ env: defaultEnvironment, changes }),
              },
            };
          }, commands);
        }),
      );
    });
  });
}
