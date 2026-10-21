import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as fc from "fast-check";
import type { AnyView, Revision } from "../../api.core";
import type {
  ChangeLog,
  Delivery,
  InvalidateFn,
  Invalidated,
  ViewInstanceDescriptor,
} from "../../api.invalidation";
import type { StoreChange, StoreRead } from "../../api.stores";
import { defaultEnvironment } from "../../env/environment";
import { storeView, view } from "../../views/definitions";
import { createChangeLog } from "../changeLog";
import { invalidate } from "../invalidate";

const IMPLEMENTATIONS: readonly (readonly [string, InvalidateFn])[] = [
  ["invalidate", invalidate],
];

const STORES = ["a", "b"] as const;
const KEYS = 5;

/** A store view over `store` whose read of `keys` is hit by a change to any of them. */
function keyedView(store: string, index: number): AnyView {
  return storeView({
    store,
    name: `keys${index}`,
    resolve: () => null,
    matches: (keys: readonly number[], change: StoreChange) =>
      keys.includes(change.value as number),
  });
}

const STORE_VIEWS = [keyedView("a", 0), keyedView("a", 1), keyedView("b", 2)];
const VIEW_STORES = ["a", "a", "b"];

/** The view each descriptor is an instance of: invalidation looks only at its reads. */
const OWNER = view({ name: "owner", resolve: () => null });

type ReadSpec = {
  readonly view: number;
  readonly keys: readonly number[];
  readonly revision: number;
};
type DescriptorSpec = {
  readonly reads: readonly number[];
  readonly validThrough: number;
};
type ChangeSpec = { readonly store: number; readonly key: number };
type WorldSpec = {
  readonly tail: number;
  readonly span: number;
  readonly deliveries: readonly (readonly ChangeSpec[] | null)[];
  readonly reads: readonly ReadSpec[];
  readonly descriptors: readonly DescriptorSpec[];
  readonly order: readonly number[];
};

const keysArb = fc.uniqueArray(fc.nat(KEYS - 1), { maxLength: 3 });
const worldArb: fc.Arbitrary<WorldSpec> = fc
  .record({
    tail: fc.nat(6),
    span: fc.nat(8),
    reads: fc.array(
      fc.record({
        view: fc.nat(STORE_VIEWS.length - 1),
        keys: keysArb,
        revision: fc.nat(12),
      }),
      { minLength: 1, maxLength: 6 },
    ),
  })
  .chain(({ tail, span, reads }) =>
    fc
      .record({
        deliveries: fc.array(
          fc.option(
            fc.array(
              fc.record({
                store: fc.nat(STORES.length - 1),
                key: fc.nat(KEYS - 1),
              }),
              {
                maxLength: 3,
              },
            ),
            { nil: null },
          ),
          { minLength: span, maxLength: span },
        ),
        descriptors: fc.array(
          fc.record({
            reads: fc.uniqueArray(fc.nat(reads.length - 1), { maxLength: 4 }),
            validThrough: fc.nat(16),
          }),
          { minLength: 1, maxLength: 6 },
        ),
      })
      .chain(({ deliveries, descriptors }) =>
        fc
          .array(fc.nat(descriptors.length - 1), { maxLength: 8 })
          .map((order) => ({
            tail,
            span,
            deliveries,
            reads,
            descriptors,
            order,
          })),
      ),
  );

type World = {
  readonly log: ChangeLog;
  readonly deliveries: readonly Delivery[];
  readonly descriptors: readonly ViewInstanceDescriptor[];
  readonly given: readonly ViewInstanceDescriptor[];
  /** A copy of each, to check nothing given is changed. */
  readonly copies: ReadonlyMap<ViewInstanceDescriptor, ViewInstanceDescriptor>;
};

/** A log of `deliveries` with the window `(tail, head]`, which rejects a scan outside it. */
function logOf(
  tail: Revision,
  head: Revision,
  deliveries: readonly Delivery[],
): ChangeLog {
  const log = createChangeLog({ env: defaultEnvironment, revision: tail });
  for (const delivery of deliveries) log.append(delivery);
  if (log.head < head) log.append({ revision: head, changes: [] });
  return log;
}

function buildWorld(spec: WorldSpec): World {
  const head = spec.tail + spec.span;
  const deliveries: Delivery[] = [];
  for (const [offset, changes] of spec.deliveries.entries()) {
    if (changes === null) continue;
    deliveries.push({
      revision: spec.tail + offset + 1,
      changes: changes.map((change) => ({
        store: STORES[change.store]!,
        operation: "put",
        value: change.key,
      })),
    });
  }
  const reads = spec.reads.map(
    (read): StoreRead => ({
      view: STORE_VIEWS[read.view]! as StoreRead["view"],
      args: read.keys,
      revision: read.revision,
      exact: false,
    }),
  );
  const copies = new Map<ViewInstanceDescriptor, ViewInstanceDescriptor>();
  const descriptors = spec.descriptors.map(
    (each, index): ViewInstanceDescriptor => {
      const storeReads = each.reads.map((read) => reads[read]!);
      const id = `owner:${index}`;
      const made = {
        view: OWNER,
        args: index,
        id,
        storeReads,
        validThrough: each.validThrough,
      };
      copies.set(made, { ...made, storeReads: [...storeReads] });
      return made;
    },
  );
  const given = spec.order.map((index) => descriptors[index]!);
  return {
    log: logOf(spec.tail, head, deliveries),
    deliveries,
    descriptors,
    given,
    copies,
  };
}

/** Whether `change` hits `read`: a change to its store, of a key it read. */
function hits(read: StoreRead, change: StoreChange): boolean {
  const store = VIEW_STORES[STORE_VIEWS.indexOf(read.view)];
  return (
    change.store === store &&
    (read.args as readonly number[]).includes(change.value as number)
  );
}

/** Whether a change after `start` and before `until` hits `read`. */
function hitBetween(
  deliveries: readonly Delivery[],
  read: StoreRead,
  start: Revision,
  until: Revision,
): boolean {
  return deliveries.some(
    (delivery) =>
      delivery.revision > start &&
      delivery.revision < until &&
      delivery.changes.some((change) => hits(read, change)),
  );
}

function checkHit(
  world: World,
  descriptor: ViewInstanceDescriptor,
  invalidated: Invalidated<ViewInstanceDescriptor>,
): void {
  const reason = invalidated.reason;
  assert.equal(reason.kind, "hit");
  if (reason.kind !== "hit") return;
  assert.ok(
    descriptor.storeReads.includes(reason.read),
    "the hit read is not the descriptor's",
  );
  const start = Math.max(reason.read.revision, descriptor.validThrough);
  assert.ok(
    reason.revision > start,
    "the witness precedes what the read was valid at",
  );
  const delivery = world.deliveries.find(
    (each) => each.revision === reason.revision,
  );
  assert.ok(
    delivery?.changes.includes(reason.change),
    "the witness is not in its delivery",
  );
  assert.ok(
    hits(reason.read, reason.change),
    "the witness does not hit the read",
  );
  assert.ok(
    !hitBetween(world.deliveries, reason.read, start, reason.revision),
    "not the first",
  );
}

for (const [name, run] of IMPLEMENTATIONS) {
  describe(`${name}: generated logs and descriptors`, () => {
    it("decides each by its reads and the changes after them", () => {
      fc.assert(
        fc.property(worldArb, (spec) => {
          const world = buildWorld(spec);
          const { log } = world;
          const result = run({
            env: defaultEnvironment,
            changes: log,
            descriptors: world.given,
          });

          const reported = new Map<
            ViewInstanceDescriptor,
            Invalidated<ViewInstanceDescriptor>
          >();
          for (const invalidated of result.stale) {
            assert.ok(!reported.has(invalidated.descriptor), "reported twice");
            reported.set(invalidated.descriptor, invalidated);
          }
          const given = new Set(world.given);
          for (const each of world.descriptors) {
            assert.deepEqual(
              each,
              world.copies.get(each),
              "a given descriptor changed",
            );
            const invalidated = reported.get(each);
            if (!given.has(each)) {
              assert.equal(invalidated, undefined, "reported, but not given");
              continue;
            }
            const unverifiable = each.validThrough < log.tail;
            const hit = each.storeReads.some((read) =>
              hitBetween(
                world.deliveries,
                read,
                Math.max(read.revision, each.validThrough),
                Infinity,
              ),
            );
            if (!unverifiable && !hit) {
              assert.equal(invalidated, undefined, "valid, but reported");
              continue;
            }
            assert.ok(invalidated !== undefined, "stale, but not reported");
            if (unverifiable)
              assert.deepEqual(invalidated.reason, { kind: "unverifiable" });
            else checkHit(world, each, invalidated);
          }
        }),
      );
    });
  });
}
