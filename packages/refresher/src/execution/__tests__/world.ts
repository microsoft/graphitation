/**
 * Generated worlds of views and store views for execution tests, and a model of what an
 * execution of one settles to.
 *
 * View `i` reads store views and views `j > i` inline, and refs views `j > i`, so a world
 * has no cycles. Every view takes a small number and returns the list of what it read, in
 * order. The model evaluates the same steps by plain recursion.
 */
import assert from "node:assert/strict";
import * as fc from "fast-check";
import type {
  Ref,
  AnyView,
  PromiseOrValue,
  RefMeta,
  ResolveContext,
} from "../../api.core";
import type { Codec } from "../../api.codec";
import type { ViewInstance } from "../../api.execution";
import type { ViewInstanceDescriptor } from "../../api.invalidation";
import type { GetStoreFn, StoreRead } from "../../api.stores";
import { createJsonCodec } from "../../codec/json";
import { storeView, view } from "../../views/definitions";
import { createRef, isViewRef } from "../../views/ref";

/** The codec every execution in these tests shares, so instance ids agree across them. */
export const codec: Codec = createJsonCodec();

export const ARGS = 3;

export type StoreSpec = { readonly batch: boolean; readonly async: boolean };

export type Step = {
  readonly kind: "store" | "inline" | "ref";
  readonly target: number;
  readonly shift: number;
  /** A read the view does not wait for: it adds nothing to the result, and its failure none. */
  readonly detached: boolean;
};

export type ViewSpec = {
  readonly memo: boolean;
  readonly async: boolean;
  readonly throws: boolean;
  readonly steps: readonly Step[];
};

export type WorldSpec = {
  readonly stores: readonly StoreSpec[];
  readonly views: readonly ViewSpec[];
  readonly asyncHandles: boolean;
  readonly waitsBetweenWaves: boolean;
  readonly roots: readonly (readonly [number, number])[];
};

const rarely = (): fc.Arbitrary<boolean> =>
  fc.oneof(
    { weight: 3, arbitrary: fc.constant(false) },
    { weight: 1, arbitrary: fc.constant(true) },
  );

function stepArb(
  index: number,
  views: number,
  stores: number,
): fc.Arbitrary<Step> {
  const shift = fc.nat(ARGS - 1);
  const detached = rarely();
  const store = fc.record({
    kind: fc.constant("store" as const),
    target: fc.nat(stores - 1),
    shift,
    detached,
  });
  if (index === views - 1) return store;
  const later = fc.integer({ min: index + 1, max: views - 1 });
  return fc.oneof(
    store,
    fc.record({
      kind: fc.constant("inline" as const),
      target: later,
      shift,
      detached,
    }),
    fc.record({
      kind: fc.constant("ref" as const),
      target: later,
      shift,
      detached: fc.constant(false),
    }),
  );
}

export const worldArb: fc.Arbitrary<WorldSpec> = fc
  .record({
    stores: fc.array(fc.record({ batch: fc.boolean(), async: rarely() }), {
      minLength: 1,
      maxLength: 3,
    }),
    views: fc.integer({ min: 1, max: 5 }),
  })
  .chain(({ stores, views }) =>
    fc.record({
      stores: fc.constant(stores),
      views: fc.tuple(
        ...Array.from({ length: views }, (_, index) =>
          fc.record({
            memo: fc.boolean(),
            async: rarely(),
            throws: rarely(),
            steps: fc.array(stepArb(index, views, stores.length), {
              maxLength: 4,
            }),
          }),
        ),
      ),
      asyncHandles: rarely(),
      waitsBetweenWaves: rarely(),
      roots: fc.array(fc.tuple(fc.nat(views - 1), fc.nat(ARGS - 1)), {
        minLength: 1,
        maxLength: 4,
      }),
    }),
  );

export const argOf = (arg: number, shift: number): number =>
  (arg + shift) % ARGS;

export const keyOf = (index: number, arg: number): string => `${index}:${arg}`;

/** The view index and argument a view key names. */
export function parseKey(key: string): [number, number] {
  const [index, arg] = key.split(":");
  return [Number(index), Number(arg)];
}

export const storeAnswer = (store: number, arg: number): string =>
  `s${store}:${arg}`;

type LooseRead = (view: AnyView, args: unknown) => unknown;
type LooseRef = (view: AnyView, args: unknown, meta?: RefMeta) => Ref;

export const readOf = (context: ResolveContext): LooseRead => context.read;
export const refFnOf = (context: ResolveContext): LooseRef =>
  context.ref as unknown as LooseRef;

const matches = (): boolean => true;

/** Reads without waiting, and ignores how the read fails. */
function detach(read: LooseRead, target: AnyView, at: number): void {
  try {
    const answer = read(target, at);
    if (answer instanceof Promise) answer.catch(() => {});
  } catch {
    // A detached read's failure is the view's to ignore.
  }
}

export type StoreCall = {
  readonly store: number;
  readonly args: readonly number[];
};

export type World = {
  readonly spec: WorldSpec;
  readonly views: readonly AnyView[];
  readonly storeViews: readonly AnyView[];
  /** Whether a view's run waits: its `resolve` awaits, or it reads, even detached, what waits. */
  readonly waits: readonly boolean[];
  readonly calls: StoreCall[];
  readonly getStore: GetStoreFn;
  readonly indexOf: (view: AnyView) => number;
  readonly roots: readonly Ref[];
};

export function buildWorld(spec: WorldSpec): World {
  const calls: StoreCall[] = [];
  const storeViews = spec.stores.map((store, index): AnyView => {
    const options = { store: `store${index}`, name: `s${index}`, matches };
    if (store.batch) {
      return storeView({
        ...options,
        resolveBatch: (args: readonly number[]) => {
          calls.push({ store: index, args: [...args] });
          const answers = args.map((arg) => storeAnswer(index, arg));
          return store.async ? Promise.resolve(answers) : answers;
        },
      });
    }
    return storeView({
      ...options,
      resolve: (arg: number) => {
        calls.push({ store: index, args: [arg] });
        const answer = storeAnswer(index, arg);
        return store.async ? Promise.resolve(answer) : answer;
      },
    });
  });
  // A batched read answers once its round runs, which needs no wait while no instance waits.
  const storeWaits = spec.stores.map(
    (store) => store.async || spec.asyncHandles,
  );
  const storeLater = spec.stores.map(
    (store, index) => store.batch || storeWaits[index]!,
  );

  const views: AnyView[] = [];
  const awaiting: boolean[] = [];
  const waits: boolean[] = [];
  for (let index = spec.views.length - 1; index >= 0; index--) {
    const viewSpec = spec.views[index]!;
    const answersLater = (step: Step): boolean =>
      step.kind === "store"
        ? storeLater[step.target]!
        : step.kind === "inline" && awaiting[step.target]!;
    const stepWaits = (step: Step): boolean =>
      step.kind === "store"
        ? storeWaits[step.target]!
        : step.kind === "inline" && waits[step.target]!;
    const awaits =
      viewSpec.async ||
      viewSpec.steps.some((step) => !step.detached && answersLater(step));
    awaiting[index] = awaits;
    waits[index] = awaits || viewSpec.steps.some(stepWaits);
    const targetOf = (step: Step): AnyView =>
      step.kind === "store" ? storeViews[step.target]! : views[step.target]!;
    const finish = (out: unknown[]): unknown[] => {
      if (viewSpec.throws) throw new Error(`v${index}`);
      return out;
    };
    const resolve: (
      arg: number,
      context: ResolveContext,
    ) => PromiseOrValue<unknown[]> = awaits
      ? async (arg: number, context: ResolveContext): Promise<unknown[]> => {
          const read = readOf(context);
          const ref = refFnOf(context);
          if (viewSpec.async) await Promise.resolve();
          const out: unknown[] = [];
          for (const step of viewSpec.steps) {
            const target = targetOf(step);
            const at = argOf(arg, step.shift);
            if (step.detached) detach(read, target, at);
            else
              out.push(
                step.kind === "ref" ? ref(target, at) : await read(target, at),
              );
          }
          return finish(out);
        }
      : (arg: number, context: ResolveContext): unknown[] => {
          const read = readOf(context);
          const ref = refFnOf(context);
          const out: unknown[] = [];
          for (const step of viewSpec.steps) {
            const target = targetOf(step);
            const at = argOf(arg, step.shift);
            if (step.detached) detach(read, target, at);
            else
              out.push(
                step.kind === "ref" ? ref(target, at) : read(target, at),
              );
          }
          return finish(out);
        };
    views[index] = view({
      name: `v${index}`,
      memo: viewSpec.memo,
      access: { readable: true },
      resolve,
    });
  }

  const positions = new Map<AnyView, number>(
    views.map((each, index) => [each, index]),
  );
  return {
    spec,
    views,
    storeViews,
    waits,
    calls,
    getStore: (name) =>
      spec.asyncHandles ? Promise.resolve({ name }) : { name },
    indexOf: (each) => positions.get(each) ?? -1,
    roots: spec.roots.map(([index, arg]) => createRef(views[index]!, arg)),
  };
}

export type Outcome = {
  readonly failed: boolean;
  readonly data: readonly unknown[] | null;
  /** Store reads, its own and of every view read inline, recursively, as `store:arg`. */
  readonly reads: ReadonlySet<string>;
  /** Refs in `data`, depth first, as view keys. */
  readonly refs: readonly string[];
};

export type Model = {
  readonly evaluate: (index: number, arg: number) => Outcome;
  /** Every instance whose `resolve` ran, as view keys. */
  readonly ran: ReadonlySet<string>;
  /** Every store read issued, as `store:arg`. */
  readonly storeReads: ReadonlySet<string>;
};

export function modelOf(world: World): Model {
  const outcomes = new Map<string, Outcome>();
  const storeReads = new Set<string>();
  const evaluate = (index: number, arg: number): Outcome => {
    const key = keyOf(index, arg);
    const known = outcomes.get(key);
    if (known !== undefined) return known;
    const viewSpec = world.spec.views[index]!;
    const reads = new Set<string>();
    const refs: string[] = [];
    const data: unknown[] = [];
    let failed = viewSpec.throws;
    for (const step of viewSpec.steps) {
      const at = argOf(arg, step.shift);
      if (step.kind === "store") {
        reads.add(`${step.target}:${at}`);
        storeReads.add(`${step.target}:${at}`);
        if (!step.detached) data.push(storeAnswer(step.target, at));
      } else if (step.kind === "ref") {
        refs.push(keyOf(step.target, at));
        data.push(createRef(world.views[step.target]!, at));
      } else {
        const callee = evaluate(step.target, at);
        for (const read of callee.reads) reads.add(read);
        if (step.detached) continue;
        if (callee.failed) {
          failed = true;
          break;
        }
        refs.push(...callee.refs);
        data.push(callee.data);
      }
    }
    const outcome: Outcome = failed
      ? { failed, data: null, reads, refs: [] }
      : { failed, data, reads, refs };
    outcomes.set(key, outcome);
    return outcome;
  };
  return {
    evaluate,
    get ran() {
      return new Set(outcomes.keys());
    },
    storeReads,
  };
}

/** The refs in a value, depth first: bound, as no world view opens an input. */
export function refsIn(value: unknown, into: Ref[] = []): Ref[] {
  if (isViewRef(value)) {
    into.push(value as Ref);
  } else if (Array.isArray(value)) {
    for (const item of value) refsIn(item, into);
  }
  return into;
}

/** The view key a ref names. */
export function refKey(world: World, ref: Ref): string {
  return keyOf(world.indexOf(ref.view), ref.args as number);
}

/** A settled instance. */
export type SettledInstance = ViewInstance & {
  readonly descriptor: ViewInstanceDescriptor;
};

/** The instance, settled and valid at its revision; any other fails the test. */
export function settledOf(instance: ViewInstance | undefined): SettledInstance {
  assert.ok(instance !== undefined, "no instance");
  assert.ok(isSettled(instance), `${instance.id} runs`);
  assert.ok(
    instance.descriptor.validThrough >= instance.revision,
    `${instance.id} settled stale`,
  );
  return instance;
}

/** A settled instance's store reads, in the order its stores were first read. */
export function readsOf(instance: ViewInstance | undefined): StoreRead[] {
  return [...settledOf(instance).descriptor.storeReads.values()].flat();
}

export function isSettled(instance: ViewInstance): instance is SettledInstance {
  return instance.status === "settled" && instance.descriptor !== undefined;
}
