/* Model-based tests of the change log against a plain list of every delivery appended. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as fc from "fast-check";
import type { Revision, StoreName } from "../../api.core";
import type {
  ChangeLog,
  CreateChangeLogFn,
  Delivery,
} from "../../api.invalidation";
import type { StoreChange } from "../../api.stores";
import { defaultEnvironment } from "../../env/environment";
import { createChangeLog } from "../changeLog";

const IMPLEMENTATIONS: readonly (readonly [string, CreateChangeLogFn])[] = [
  ["createChangeLog", createChangeLog],
];

type Model = {
  tail: Revision;
  head: Revision;
  readonly deliveries: Delivery[];
};
type Real = { readonly log: ChangeLog };
type Command = fc.Command<Model, Real>;

const STORES: readonly StoreName[] = ["a", "b", "c"];

/** A fraction of the window, in quarters. */
const fractionArb = fc.nat(4).map((quarters) => quarters / 4);

/** The changes of a delivery, each to the store at its index in `STORES`. */
const storesArb = fc.array(fc.nat(STORES.length - 1), { maxLength: 3 });

function deliveryOf(revision: Revision, stores: readonly number[]): Delivery {
  const made: StoreChange[] = stores.map((store, index) => ({
    store: STORES[store]!,
    operation: "put",
    value: index,
  }));
  return { revision, changes: made };
}

/** The revision `fraction` of the way through the window. */
const within = (model: Model, fraction: number): Revision =>
  model.tail + Math.floor(fraction * (model.head - model.tail));

function checkWindow(model: Model, real: Real): void {
  assert.equal(real.log.tail, model.tail, "tail");
  assert.equal(real.log.head, model.head, "head");
  let size = 0;
  for (const delivery of model.deliveries) size += delivery.changes.length;
  assert.equal(real.log.size, size, "size");
}

function append(model: Model, real: Real, delivery: Delivery): void {
  real.log.append(delivery);
  model.head = delivery.revision;
  model.deliveries.push(delivery);
}

const appendArb = fc
  .record({ gap: fc.integer({ min: 1, max: 3 }), stores: storesArb })
  .map(
    ({ gap, stores }): Command => ({
      check: () => true,
      run(model, real) {
        append(model, real, deliveryOf(model.head + gap, stores));
        checkWindow(model, real);
      },
      toString: () => `append(+${gap}, [${stores.join(",")}])`,
    }),
  );

/** Enough deliveries at once that trimming them drops many. */
const appendManyArb = fc
  .record({
    count: fc.integer({ min: 1, max: 100 }),
    store: fc.nat(STORES.length - 1),
  })
  .map(
    ({ count, store }): Command => ({
      check: () => true,
      run(model, real) {
        for (let index = 0; index < count; index++) {
          append(model, real, deliveryOf(model.head + 1, [store]));
        }
        checkWindow(model, real);
      },
      toString: () => `appendMany(${count}, ${store})`,
    }),
  );

const trimArb = fractionArb.map(
  (fraction): Command => ({
    check: () => true,
    run(model, real) {
      const through = within(model, fraction);
      real.log.trim(through);
      model.tail = through;
      let dropped = 0;
      while (
        dropped < model.deliveries.length &&
        model.deliveries[dropped]!.revision <= through
      ) {
        dropped++;
      }
      model.deliveries.splice(0, dropped);
      checkWindow(model, real);
    },
    toString: () => `trim(${fraction})`,
  }),
);

/**
 * A scan from a revision in the window, of every store or one, read in full or abandoned
 * after `stop` deliveries.
 */
const scanArb = fc
  .record({
    fraction: fractionArb,
    store: fc.option(fc.nat(STORES.length - 1), { nil: undefined }),
    stop: fc.option(fc.nat(3), { nil: undefined }),
  })
  .map(
    ({ fraction, store, stop }): Command => ({
      check: () => true,
      run(model, real) {
        const after = within(model, fraction);
        const name = store === undefined ? undefined : STORES[store]!;
        const scanned: { revision: Revision; changes: StoreChange[] }[] = [];
        for (const delivery of real.log.since(after, name)) {
          if (stop !== undefined && scanned.length === stop) break;
          // A scan may reuse what it yields: copied as read.
          scanned.push({
            revision: delivery.revision,
            changes: [...delivery.changes],
          });
        }
        const expected = new Map<Revision, readonly StoreChange[]>();
        for (const delivery of model.deliveries) {
          if (delivery.revision <= after) continue;
          const changes =
            name === undefined
              ? delivery.changes
              : delivery.changes.filter((change) => change.store === name);
          expected.set(delivery.revision, changes);
        }
        let previous = after;
        for (const delivery of scanned) {
          assert.ok(
            delivery.revision > previous,
            "out of order, or before the start",
          );
          const changes = expected.get(delivery.revision);
          assert.ok(
            changes !== undefined,
            "not a delivery appended after the start",
          );
          assert.ok(
            changes.length === delivery.changes.length &&
              changes.every(
                (change, index) => change === delivery.changes[index],
              ),
            `delivery ${delivery.revision} holds other changes than asked`,
          );
          previous = delivery.revision;
        }
        const through = stop === undefined ? model.head : previous;
        for (const [revision, changes] of expected) {
          if (revision > through || changes.length === 0) continue;
          assert.ok(
            scanned.some((delivery) => delivery.revision === revision),
            `delivery ${revision} left out`,
          );
        }
        checkWindow(model, real);
      },
      toString: () => `scan(${fraction}, store ${store}, stop ${stop})`,
    }),
  );

const commandsArb = fc.commands([appendArb, appendManyArb, trimArb, scanArb], {
  maxCommands: 50,
  size: "max",
});

for (const [name, create] of IMPLEMENTATIONS) {
  describe(`${name}: generated appends, trims and scans`, () => {
    it("holds every delivery in its window, in order", () => {
      fc.assert(
        fc.property(fc.nat(5), commandsArb, (revision, commands) => {
          fc.modelRun(
            () => ({
              model: { tail: revision, head: revision, deliveries: [] },
              real: { log: create({ env: defaultEnvironment, revision }) },
            }),
            commands,
          );
        }),
      );
    });
  });
}
