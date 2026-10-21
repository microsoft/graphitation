/**
 * Store reads: opens each store once per execution and answers the reads of its store
 * views by calling their `resolve` or `resolveBatch`. It only answers; `./execute` settles
 * each read with its answer and delivers it.
 *
 * A read of a store view with `resolve` answers as it is issued: at once when its store is
 * open and its `resolve` does, else with a promise. A read of one with `resolveBatch` waits
 * for a round, which answers it with the other reads of that store view in one batch. A
 * round returns its answers in the order its reads were issued: at once when every read
 * answered at once, else as a promise.
 */
import type { StoreName } from "../api.core";
import { assertAlways, assertSometimes } from "../env/assert";
import { storeError } from "../errors";
import { annotate, internalsOf } from "../views/definitions";
import type { StoreViewInternals } from "../views/definitions";
import { isPromiseLike, nameOf } from "./context";
import type {
  ExecutionContext,
  FailedStore,
  OpenStore,
  Round,
  StorePhase,
} from "./context";

/** Whether reads of the store view wait for a round, which answers them in one batch. */
export function isBatched(internals: StoreViewInternals): boolean {
  return internals.resolve === undefined;
}

/**
 * The answers of a round, in the order its reads were issued: each read's value, or its
 * failure where `failed` marks it.
 */
export type RoundAnswers = {
  readonly values: unknown[];
  failed: boolean[] | undefined;
};

/**
 * Answers a read of a store view that is not batched as it is issued, opening its store on
 * the first read: its value, or a promise of it. Throws the read's failure.
 */
export function readStore(
  context: ExecutionContext,
  internals: StoreViewInternals,
  args: unknown,
): unknown {
  const resolve = internals.resolve;
  assertAlways(context.env, resolve !== undefined);
  const store = storeOf(context, internals.store);
  if (store.status === "failed") throw store.failure;
  if (store.status === "open") return resolve(args, store.context);
  return store.opened.then((opened) => {
    if (context.stopped) return undefined;
    return readOpened(resolve, args, opened);
  });
}

/** A read issued while its store opened, once it has. */
function readOpened(
  resolve: NonNullable<StoreViewInternals["resolve"]>,
  args: unknown,
  store: OpenStore | FailedStore,
): unknown {
  if (store.status === "failed") throw store.failure;
  return resolve(args, store.context);
}

/** Answers the reads of a round. */
export function answerRound(
  context: ExecutionContext,
  round: Round,
): RoundAnswers | Promise<RoundAnswers> {
  const reads = round.reads;
  const promised = round.promised;
  assertAlways(context.env, reads.length > 0);
  assertAlways(context.env, promised.length === reads.length);
  const answers: RoundAnswers = {
    values: Array.from({ length: reads.length }),
    failed: undefined,
  };
  let batches: Map<StoreViewInternals, number[]> | undefined;
  let later: PromiseLike<void>[] | undefined;
  for (let index = 0; index < reads.length; index++) {
    const read = reads[index];
    assertAlways(context.env, read !== undefined);
    const internals = internalsOf(read.view);
    assertAlways(context.env, internals?.kind === "store");
    const answer = promised[index];
    if (answer === undefined) {
      assertAlways(context.env, internals.resolveBatch !== undefined);
      batches = addToBatch(batches, internals, index);
    } else {
      later = addLater(later, answerRead(answers, index, answer));
    }
  }
  if (batches !== undefined) {
    for (const [internals, indexes] of batches) {
      const store = storeOf(context, internals.store);
      later = addLater(
        later,
        answerBatch(context, answers, internals, round, indexes, store),
      );
    }
  }
  if (later === undefined) return answers;
  return Promise.all(later).then(() => answers);
}

function addToBatch(
  batches: Map<StoreViewInternals, number[]> | undefined,
  internals: StoreViewInternals,
  index: number,
): Map<StoreViewInternals, number[]> {
  const map = batches ?? new Map<StoreViewInternals, number[]>();
  const batch = map.get(internals);
  if (batch === undefined) map.set(internals, [index]);
  else batch.push(index);
  return map;
}

function addLater(
  later: PromiseLike<void>[] | undefined,
  answer: PromiseLike<void> | undefined,
): PromiseLike<void>[] | undefined {
  if (answer === undefined) return later;
  if (later === undefined) return [answer];
  later.push(answer);
  return later;
}

function record(answers: RoundAnswers, index: number, value: unknown): void {
  answers.values[index] = value;
}

function fail(answers: RoundAnswers, index: number, error: unknown): void {
  answers.values[index] = error;
  (answers.failed ??= [])[index] = true;
}

function failAll(
  answers: RoundAnswers,
  indexes: readonly number[],
  error: unknown,
): void {
  for (const index of indexes) fail(answers, index, error);
}

/** Answers a read with what its `resolve` promised when it was issued. */
function answerRead(
  answers: RoundAnswers,
  index: number,
  promised: PromiseLike<unknown>,
): Promise<void> {
  return Promise.resolve(promised).then(
    (value) => record(answers, index, value),
    (error: unknown) => fail(answers, index, error),
  );
}

/** Answers a batch once its store is open. Returns a promise when it answers later. */
function answerBatch(
  context: ExecutionContext,
  answers: RoundAnswers,
  internals: StoreViewInternals,
  round: Round,
  indexes: readonly number[],
  store: StorePhase,
): PromiseLike<void> | undefined {
  assertAlways(context.env, indexes.length > 0);
  if (store.status === "opening") {
    return store.opened.then((opened) => {
      if (context.stopped) return undefined;
      return answerBatch(context, answers, internals, round, indexes, opened);
    });
  }
  if (store.status === "failed") {
    failAll(answers, indexes, store.failure);
    return undefined;
  }
  assertSometimes(
    context.env,
    indexes.length > 1,
    "A batch carries several reads",
  );
  assertAlways(context.env, internals.resolveBatch !== undefined);
  const args: unknown[] = [];
  for (const index of indexes) {
    const read = round.reads[index];
    assertAlways(context.env, read !== undefined);
    args.push(read.args);
  }
  let slots: unknown;
  try {
    slots = internals.resolveBatch(args, store.context);
  } catch (error) {
    failAll(answers, indexes, error);
    return undefined;
  }
  if (!isPromiseLike(slots)) {
    fillBatch(context, answers, internals, round, indexes, slots);
    return undefined;
  }
  return Promise.resolve(slots).then(
    (values) => fillBatch(context, answers, internals, round, indexes, values),
    (error: unknown) => failAll(answers, indexes, error),
  );
}

/** Spreads a batch's slots over its reads: an `Error` slot fails its read. */
function fillBatch(
  context: ExecutionContext,
  answers: RoundAnswers,
  internals: StoreViewInternals,
  round: Round,
  indexes: readonly number[],
  slots: unknown,
): void {
  if (!Array.isArray(slots) || slots.length !== indexes.length) {
    const first = round.reads[indexes[0] ?? -1];
    assertAlways(context.env, first !== undefined);
    const error = storeError({
      code: "INVALID_BATCH",
      message: `A batch of ${indexes.length} reads of ${nameOf(
        first.view,
      )} must answer with as many slots`,
      store: internals.store,
    });
    failAll(answers, indexes, error);
    return;
  }
  const values: readonly unknown[] = slots;
  for (let slot = 0; slot < indexes.length; slot++) {
    const index = indexes[slot];
    if (index === undefined) continue;
    const value = values[slot];
    if (value instanceof Error) fail(answers, index, value);
    else record(answers, index, value);
  }
}

// Stores

/** The store in its current phase, opening it the first time the execution reads it. */
function storeOf(context: ExecutionContext, name: StoreName): StorePhase {
  const known = context.stores.get(name);
  if (known !== undefined) return known;
  const store = openStore(context, name);
  context.stores.set(name, store);
  return store;
}

function openStore(context: ExecutionContext, name: StoreName): StorePhase {
  const getStore = context.getStore;
  if (getStore === undefined) return failedStore(unknownStore(name));
  let handle: unknown;
  try {
    handle = getStore(name);
  } catch (error) {
    return failedStore(unavailable(name, error));
  }
  if (!isPromiseLike(handle)) return openedStore(context, name, handle);
  assertSometimes(context.env, true, "A store handle arrives later");
  return {
    status: "opening",
    opened: Promise.resolve(handle).then(
      (later) => replaceStore(context, name, openedStore(context, name, later)),
      (error: unknown) =>
        replaceStore(context, name, failedStore(unavailable(name, error))),
    ),
  };
}

/** Moves an opening store to the phase that follows. */
function replaceStore(
  context: ExecutionContext,
  name: StoreName,
  store: OpenStore | FailedStore,
): OpenStore | FailedStore {
  assertAlways(context.env, context.stores.get(name)?.status === "opening");
  context.stores.set(name, store);
  return store;
}

function openedStore(
  context: ExecutionContext,
  name: StoreName,
  handle: unknown,
): OpenStore | FailedStore {
  if (handle === undefined) return failedStore(unknownStore(name));
  const storeContext = Object.freeze({
    store: handle,
    signal: context.controller.signal,
    revision: context.startedAt,
    annotate,
  });
  return { status: "open", context: storeContext };
}

function failedStore(failure: unknown): FailedStore {
  return { status: "failed", failure };
}

function unknownStore(name: StoreName): unknown {
  return storeError({
    code: "UNKNOWN_STORE",
    message: `No handle for store "${name}"`,
    store: name,
  });
}

function unavailable(name: StoreName, cause: unknown): unknown {
  return storeError(
    {
      code: "STORE_UNAVAILABLE",
      message: `Store "${name}" could not be opened`,
      store: name,
    },
    cause,
  );
}
