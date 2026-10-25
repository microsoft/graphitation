/**
 * `execute`: evaluates one wave of view instances, of a new execution or of the one it
 * continues. It follows docs/architecture/execution.md: `runWave` evaluates the wave
 * (`evaluate`), which proceeds in rounds (`runRounds`, `runRound`), then records it.
 *
 * Everything runs in the calling task until something waits: a `resolve` that returns a
 * promise, a store read answered later, or a store handle that arrives later. The wave
 * then continues when it settles. A round forms once every
 * running instance has run as far as it can: at once when none waits on a promise its
 * `resolve` returned, else when the microtask queue drains. Its reads are dispatched together, one batch per store view, and their answers
 * are delivered together in the order the reads were issued.
 *
 * Each instance is one `ViewInstance`, keyed by its id, whichever ref, inline read or wave
 * reached it first. A store read is one too, of its store view, settled by its answer.
 * While an instance runs, it records the instances it read inline; settling collects
 * their store reads into its own. A reader of a running instance
 * is an edge of a wait-for graph, which is how an inline-read cycle is found before it
 * deadlocks.
 *
 * Store reads are answered by `./storeReads`; this module settles each with its answer
 * and delivers it.
 *
 * Every function takes the `ExecutionContext` of its call, as graphql-js does; see
 * `./context`. Rounds end where the environment's `scheduleReadRound` says.
 */
import type {
  AccessConfig,
  Action,
  ActionRef,
  AnyActionRef,
  AnyRef,
  AnyView,
  OpenInput,
  PromiseOrValue,
  Ref,
  RefMeta,
  ResolveContext,
  Revision,
  ValueError,
  View,
  ViewInstanceId,
  StoreName,
} from "../api.core";
import type {
  ExecuteFn,
  ExecutionState,
  ExecutionStateKey,
  ExecutionWave,
  ViewInstance,
} from "../api.execution";
import type { ViewInstanceDescriptor } from "../api.invalidation";
import type { StoreRead } from "../api.stores";
import { assertAlways, assertSometimes } from "../env/assert";
import {
  abortedBy,
  isInternalError,
  operationError,
  refError,
  valueError,
  valueErrorOf,
} from "../errors";
import { annotationOf, internalsOf } from "../views/definitions";
import { isExact, settledStale } from "../invalidation/reads";
import type {
  DerivedViewInternals,
  PinInternals,
  StoreViewInternals,
  ViewInternals,
} from "../views/definitions";
import { createInput, throwIfOpen } from "../views/input";
import { createActionRef, createRef, isViewRef } from "../views/ref";
import {
  NO_ERRORS,
  buildExecutionContext,
  deferred,
  emptyRound,
  isPromiseLike,
  nameOf,
  noop,
} from "./context";
import { answerRound, isBatched, readStore } from "./storeReads";
import type { RoundAnswers } from "./storeReads";
import type { ExecutionContext, Round } from "./context";

// Executions

/** Where a state `execute` returns holds its execution's context: the contract's key, at runtime. */
const CONTEXT: ExecutionStateKey = Symbol(
  "execution context",
) as ExecutionStateKey;

/**
 * Runs one wave of a new execution, or of `state`. The execution's signal, aborted by now,
 * stops it and throws here; aborting while the wave runs stops it too.
 */
export const execute: ExecuteFn = (args) => {
  const context =
    args.state === undefined
      ? buildExecutionContext(args)
      : continued(args.state);
  const signal = context.signal;
  if (signal?.aborted === true) {
    const error = abortedBy(signal);
    stop(context, error);
    throw error;
  }
  context.running = true;
  if (signal !== undefined) {
    const onAbort = (): void => stop(context, abortedBy(signal));
    signal.addEventListener("abort", onAbort, { once: true });
    context.detach = () => signal.removeEventListener("abort", onAbort);
  }
  let wave: PromiseOrValue<void>;
  try {
    wave = runWave(context, args.refs, args.meta);
  } catch (error) {
    fail(context, error);
    throw error;
  }
  if (isPromiseLike(wave)) {
    return wave.then(
      () => finishWave(context),
      (error: unknown) => {
        fail(context, error);
        throw error;
      },
    );
  }
  assertAlways(
    context.env,
    context.round.reads.length === 0 && context.waitingInstances === 0,
  );
  return finishWave(context);
};

/** The context of the execution `state` is, when a call may continue it. */
function continued(state: ExecutionState): ExecutionContext {
  const held = state[CONTEXT];
  if (held === undefined) {
    throw operationError({
      code: "UNKNOWN_EXECUTION",
      message: "`state` is not an execution state `execute` returned",
    });
  }
  const context = held as ExecutionContext;
  if (context.running) {
    throw operationError({
      code: "EXECUTION_RUNNING",
      message: "The execution's last wave has not settled",
    });
  }
  throwIfStopped(context);
  return context;
}

/** Ends the call's wave, and returns the execution's state as it left it. */
function finishWave(context: ExecutionContext): ExecutionState {
  context.running = false;
  context.detach?.();
  context.detach = undefined;
  return {
    startedAt: context.startedAt,
    settledAt: context.settledAt,
    waves: context.waves,
    instances: context.instances,
    [CONTEXT]: context,
  };
}

/** Evaluates `refs` as the execution's next wave. */
function runWave(
  context: ExecutionContext,
  refs: readonly Ref[],
  meta: unknown,
): PromiseOrValue<void> {
  throwIfStopped(context);
  const waves = context.waves.length;
  if (waves >= context.maxWaves) {
    throw limit(
      context,
      "MAX_WAVES",
      `The execution needs more than ${context.maxWaves} waves`,
    );
  }
  return evaluate(context, refs, meta);
}

/** Stops the execution: rejects whatever it awaits and aborts the reads in flight. */
function stop(context: ExecutionContext, error: unknown): void {
  if (context.stopped) return;
  context.stopped = true;
  context.failure = error;
  context.halt?.(error);
  context.controller.abort(error);
  assertAlways(context.env, context.controller.signal.aborted);
}

function fail(context: ExecutionContext, error: unknown): void {
  stop(context, error);
  context.running = false;
  context.detach?.();
  context.detach = undefined;
}

function limit(
  context: ExecutionContext,
  code: string,
  message: string,
): unknown {
  const error = operationError({ code, message });
  stop(context, error);
  return error;
}

function throwIfStopped(context: ExecutionContext): void {
  if (context.stopped) throw context.failure;
}

/** `value`, which also rejects when the execution stops. */
function guard<T>(
  context: ExecutionContext,
  value: PromiseLike<T>,
): Promise<T> {
  return Promise.race([value, context.halted ?? haltedOf(context)]);
}

/** Made the first time the execution waits: rejects when it stops, or has already. */
function haltedOf(context: ExecutionContext): Promise<never> {
  let halt: (error: unknown) => void = noop;
  const halted = new Promise<never>((_, reject) => {
    halt = reject;
  });
  void halted.catch(noop);
  context.halted = halted;
  context.halt = halt;
  if (context.stopped) halt(context.failure);
  return halted;
}

function notify(context: ExecutionContext): void {
  const progress = context.progress;
  if (progress !== undefined) {
    context.progress = undefined;
    progress();
  }
}

// Evaluation

/**
 * Evaluates a wave: runs its instances, in rounds while reads are pending, and returns it
 * once each has settled with every read it made.
 */
function evaluate(
  context: ExecutionContext,
  refs: readonly Ref[],
  meta: unknown,
): PromiseOrValue<void> {
  context.pinned = undefined;
  const instances: ViewInstance[] = [];
  for (const ref of refs) {
    const id = idOf(context, ref);
    let instance = context.instances.get(id);
    if (instance === undefined) {
      instance = enter(context, id, ref.view, ref.args, 0, true);
      // Runs the instance as far as it goes: the reads it issues join the round.
      start(context, instance);
    }
    // A pin already settled, kept or resolved by an earlier wave, leads to its target now.
    followPin(context, instance);
    instances.push(instance);
  }
  throwIfStopped(context);
  const rounds = runRounds(context);
  if (rounds === undefined) return evaluated(context, refs, meta, instances);
  return rounds.then(() => evaluated(context, refs, meta, instances));
}

/** The id of the instance `ref` names, which must be bound. */
function idOf(context: ExecutionContext, ref: AnyRef): ViewInstanceId {
  let id = context.refIds.get(ref);
  if (id === undefined) {
    throwIfOpen(
      ref.args,
      "A ref leaving inputs open is bound before it is followed",
    );
    id = context.codec.instanceKey(ref.view, ref.args);
    context.refIds.set(ref, id);
  }
  return id;
}

/**
 * For a pin that answered with a ref: keeps it, runs its target in the pin's wave unless the
 * execution has resolved it, and records the ref and the target among what the wave pinned.
 */
function followPin(context: ExecutionContext, pin: ViewInstance): void {
  const ref = pin.data;
  if (pin.status === "running" || ref === null) return;
  const internals = internalsOf(pin.view);
  if (internals?.kind !== "pin") return;
  assertAlways(context.env, isViewRef(ref));
  assertAlways(context.env, ref.view === internals.target);
  assertAlways(context.env, pin.descriptor?.storeReads.size === 0);
  const pins = context.pins;
  if (pins !== undefined) {
    assertAlways(context.env, (pins.get(pin.id) ?? pin) === pin);
    pins.set(pin.id, pin);
  }
  const id = idOf(context, ref);
  let target = context.instances.get(id);
  if (target === undefined) {
    assertSometimes(context.env, true, "A wave runs a pin's target");
    target = enter(context, id, ref.view, ref.args, 0, true);
    start(context, target);
  }
  const pinned = (context.pinned ??= { refs: [], evaluated: [] });
  if (pinned.evaluated.includes(target)) return;
  pinned.refs.push(ref);
  pinned.evaluated.push(target);
  assertAlways(context.env, pinned.refs.length === pinned.evaluated.length);
}

/**
 * Runs rounds until every instance of the wave has settled and every answer is delivered.
 * While no running instance waits on a promise its `resolve` returned, nothing can join a
 * round, so it runs at once; otherwise the rest continues once those instances progress.
 */
function runRounds(context: ExecutionContext): Promise<void> | undefined {
  for (;;) {
    throwIfStopped(context);
    assertAlways(context.env, context.waitingInstances >= 0);
    let later: Promise<void> | undefined;
    if (context.waitingInstances > 0) later = runRoundLater(context);
    else if (context.round.reads.length > 0)
      later = runRound(context, takeRound(context));
    else return undefined;
    if (later !== undefined) return later.then(() => runRounds(context));
  }
}

/** The reads issued so far, leaving an empty round for those issued while they run. */
function takeRound(context: ExecutionContext): Round {
  const round = context.round;
  context.round = emptyRound();
  return round;
}

/**
 * Runs the round once every running instance has run as far as it can, or waits for one
 * whose `resolve` returned a promise to progress.
 */
function runRoundLater(context: ExecutionContext): Promise<void> {
  const drained = new Promise<void>((done) =>
    context.env.scheduleReadRound(done),
  );
  return guard(context, drained).then(() => {
    throwIfStopped(context);
    if (context.round.reads.length > 0)
      return runRound(context, takeRound(context));
    if (context.waitingInstances === 0) return undefined;
    assertSometimes(
      context.env,
      true,
      "A wave waits on an instance that waits on no read",
    );
    return guard(
      context,
      new Promise<void>((progressed) => {
        context.progress = progressed;
      }),
    );
  });
}

/**
 * Records the settled wave, once its instances hold every read they made, with what its pins
 * pinned apart, and has the view cache keep the memoized instances it reached.
 */
function evaluated(
  context: ExecutionContext,
  refs: readonly Ref[],
  meta: unknown,
  instances: readonly ViewInstance[],
): void {
  assertAlways(context.env, instances.length === refs.length);
  completeReads(context);
  const pinned = context.pinned ?? NOTHING_PINNED;
  context.pinned = undefined;
  assertAlways(context.env, pinned.refs.length === pinned.evaluated.length);
  const viewCache = context.viewCache;
  if (viewCache !== undefined) {
    const reached = new Map<ViewInstanceId, ViewInstance>();
    for (const instance of instances) reach(context, reached, instance);
    for (const target of pinned.evaluated) reach(context, reached, target);
    assertAlways(context.env, reached.size <= context.instances.size);
    for (const instance of reached.values()) viewCache.keep(instance);
  }
  const settledAt = context.latestRevision();
  context.waves.push({ settledAt, refs, meta, evaluated: instances, pinned });
  context.settledAt = settledAt;
}

const NOTHING_PINNED: ExecutionWave["pinned"] = Object.freeze({
  refs: Object.freeze([]),
  evaluated: Object.freeze([]),
});

function reach(
  context: ExecutionContext,
  reached: Map<ViewInstanceId, ViewInstance>,
  instance: ViewInstance,
): void {
  if (reached.has(instance.id)) return;
  reached.set(instance.id, instance);
  reachInline(context, reached, new Set(), instance);
}

/** Adds the memoized views `instance` read inline, directly or through views that are not. */
function reachInline(
  context: ExecutionContext,
  reached: Map<ViewInstanceId, ViewInstance>,
  seen: Set<ViewInstance>,
  instance: ViewInstance,
): void {
  const reads = context.inlineReads.get(instance);
  if (reads === undefined || seen.has(instance)) return;
  seen.add(instance);
  for (const callee of reads) {
    if (isMemo(callee.view)) reach(context, reached, callee);
    else reachInline(context, reached, seen, callee);
  }
}

/**
 * Completes the store reads of instances that settled while an instance they read was
 * still incomplete. By the end of a wave every instance has settled, so each completes
 * once those it read have.
 */
function completeReads(context: ExecutionContext): void {
  const incomplete = context.incomplete;
  if (incomplete === undefined) return;
  for (const instance of incomplete)
    completeReadsOf(context, incomplete, instance);
  assertAlways(context.env, incomplete.size === 0);
  context.incomplete = undefined;
}

function completeReadsOf(
  context: ExecutionContext,
  incomplete: Set<ViewInstance>,
  instance: ViewInstance,
): void {
  if (!incomplete.delete(instance)) return;
  const reads = context.inlineReads.get(instance);
  assertAlways(context.env, reads !== undefined);
  for (const callee of reads) completeReadsOf(context, incomplete, callee);
  assertAlways(context.env, readsComplete(context, reads));
  const storeReads = collectReads(context, reads);
  applyOutcome(context, instance, storeReads, instance.data, instance.errors);
}

/** Whether every instance an instance read inline has settled, its own reads complete. */
function readsComplete(
  context: ExecutionContext,
  reads: ReadonlySet<ViewInstance>,
): boolean {
  for (const callee of reads) {
    if (callee.status === "running" || context.incomplete?.has(callee) === true)
      return false;
  }
  return true;
}

/**
 * The store reads of the instances an instance read inline that have settled, grouped by
 * store, each once. When they are all one instance's, that instance's are returned as they
 * are: a descriptor's are never changed once made.
 */
function collectReads(
  context: ExecutionContext,
  reads: ReadonlySet<ViewInstance>,
): StoreReads {
  let first: StoreReads | undefined;
  let merged: Map<StoreName, StoreRead[]> | undefined;
  let count = 0;
  let seen: Set<StoreRead> | undefined;
  for (const callee of reads) {
    if (callee.status === "running" || context.incomplete?.has(callee) === true)
      continue;
    const descriptor = callee.descriptor;
    assertAlways(context.env, descriptor !== undefined);
    const found = descriptor.storeReads;
    if (found.size === 0 || found === first) continue;
    if (first === undefined) {
      first = found;
      continue;
    }
    if (merged === undefined) {
      merged = new Map();
      for (const [store, group] of first) {
        merged.set(store, [...group]);
        count += group.length;
      }
      if (count >= SMALL) seen = setOf(merged);
    }
    for (const [store, group] of found) {
      let into = merged.get(store);
      if (into === undefined) {
        into = [];
        merged.set(store, into);
      }
      for (const read of group) {
        if (seen === undefined) {
          if (into.includes(read)) continue;
          into.push(read);
          if (++count >= SMALL) seen = setOf(merged);
        } else if (!seen.has(read)) {
          seen.add(read);
          into.push(read);
        }
      }
    }
  }
  return merged ?? first ?? NO_STORE_READS;
}

function setOf(storeReads: StoreReads): Set<StoreRead> {
  const set = new Set<StoreRead>();
  for (const group of storeReads.values())
    for (const read of group) set.add(read);
  return set;
}

/** Below this, a linear scan finds duplicates faster than a set: measured on V8. */
const SMALL = 64;

// Instances

function isMemo(view: AnyView): boolean {
  return view.deterministic !== false && view.memo === true;
}

type StoreReads = ViewInstanceDescriptor["storeReads"];

const NO_STORE_READS: StoreReads = new Map();

/** Starts an instance `enter` left running: a derived view's or a pin's `resolve`, or a store view's read. */
function start(context: ExecutionContext, instance: ViewInstance): void {
  if (instance.status !== "running") return;
  const internals = internalsOf(instance.view);
  assertAlways(context.env, internals !== undefined);
  if (internals.kind === "store") startStoreView(context, instance, internals);
  else startDerivedView(context, instance, internals);
}

/**
 * The instance the execution has not met: a kept pin, one from the view cache, one failed for
 * a view that is neither a derived view, a pin nor a store view, or a new running one for the
 * caller to start. A store read another instance makes counts toward no limit.
 */
function enter(
  context: ExecutionContext,
  id: ViewInstanceId,
  view: AnyView,
  args: unknown,
  depth: number,
  viaRef: boolean,
): ViewInstance {
  assertAlways(context.env, depth >= 0);
  assertAlways(context.env, !context.instances.has(id));
  if (viaRef) assertAlways(context.env, depth === 0);
  const kept = viaRef ? takeKept(context, id) : undefined;
  if (kept !== undefined) return kept;
  const cached = takeCached(context, id);
  if (cached !== undefined) return cached;
  throwIfStopped(context);
  const internals = internalsOf(view);
  if (internals !== undefined && (viaRef || internals.kind === "derived")) {
    countRun(context, depth);
  }
  const instance: ViewInstance = {
    view,
    args,
    id,
    startedAt: context.startedAt,
    depth,
    status: "running",
    descriptor: undefined,
    data: null,
    errors: NO_ERRORS,
    reads: new Set(),
    settled: undefined,
  };
  context.instances.set(id, instance);
  if (internals === undefined) {
    settleFailure(context, instance, unresolved(view), false);
  }
  assertAlways(context.env, context.instances.get(id) === instance);
  return instance;
}

/** Counts an instance the execution runs against `maxDepth` and `maxInstances`. */
function countRun(context: ExecutionContext, depth: number): void {
  if (depth > context.maxDepth) {
    throw limit(
      context,
      "MAX_DEPTH",
      `Inline reads nest deeper than ${context.maxDepth}`,
    );
  }
  if (++context.ran > context.maxInstances) {
    throw limit(
      context,
      "MAX_INSTANCES",
      `The execution runs more than ${context.maxInstances} instances`,
    );
  }
  assertAlways(context.env, depth <= context.maxDepth);
}

/** The pin kept under `id`, taken in place of running it: it answered with a ref. */
function takeKept(
  context: ExecutionContext,
  id: ViewInstanceId,
): ViewInstance | undefined {
  const kept = context.pins?.get(id);
  if (kept === undefined) return undefined;
  assertAlways(context.env, kept.id === id);
  assertAlways(context.env, internalsOf(kept.view)?.kind === "pin");
  assertAlways(context.env, kept.status === "settled");
  assertAlways(context.env, kept.data !== null);
  assertSometimes(
    context.env,
    true,
    "An execution takes a kept pin in place of running it",
  );
  context.instances.set(id, kept);
  return kept;
}

/**
 * The cached instance, when it is not stale, and valid at its own `startedAt` and at the
 * execution's. A newer
 * one is taken too, unless every store read it made came from history: those stores answer
 * as of the execution's revision instead.
 */
function takeCached(
  context: ExecutionContext,
  id: ViewInstanceId,
): ViewInstance | undefined {
  assertAlways(context.env, !context.instances.has(id));
  const cached = context.viewCache?.get(id);
  if (cached === undefined || cached.status === "stale") return undefined;
  assertAlways(context.env, cached.status === "settled");
  const startedAt = context.startedAt;
  const descriptor = cached.descriptor;
  assertAlways(context.env, descriptor !== undefined);
  if (settledStale(descriptor)) return undefined;
  if (descriptor.matchedThrough < startedAt) return undefined;
  if (cached.startedAt > startedAt) {
    if (allExact(descriptor.storeReads)) {
      assertSometimes(
        context.env,
        true,
        "An execution reruns a newer instance read from history",
      );
      return undefined;
    }
    assertSometimes(
      context.env,
      true,
      "An execution takes a cached instance newer than asked",
    );
  }
  assertAlways(context.env, cached.id === id);
  assertSometimes(
    context.env,
    true,
    "An execution takes a cached instance in place of running it",
  );
  context.instances.set(id, cached);
  return cached;
}

/** Whether there are store reads, and each was answered as of the revision it was asked at. */
function allExact(reads: StoreReads): boolean {
  for (const group of reads.values())
    for (const read of group) if (!isExact(read)) return false;
  return reads.size > 0;
}

/** Calls the `resolve` of a derived view or a pin, settling and delivering the instance when it answers at once. */
function startDerivedView(
  context: ExecutionContext,
  instance: ViewInstance,
  internals: DerivedViewInternals | PinInternals,
): void {
  let answer: unknown;
  try {
    answer = internals.resolve(
      instance.args,
      resolveContextOf(context, instance),
    );
  } catch (error) {
    settleFailure(context, instance, error, false);
    deliver(context, instance);
    return;
  }
  if (isPromiseLike(answer)) {
    context.waitingInstances++;
    void Promise.resolve(answer).then(
      (value) => settleDerivedViewLater(context, instance, false, value),
      (error: unknown) =>
        settleDerivedViewLater(context, instance, true, error),
    );
    return;
  }
  settleValue(context, instance, answer);
  deliver(context, instance);
}

/** Settles and delivers a derived view's or a pin's instance once the promise its `resolve` returned settles. */
function settleDerivedViewLater(
  context: ExecutionContext,
  instance: ViewInstance,
  threw: boolean,
  answer: unknown,
): void {
  try {
    assertAlways(context.env, context.waitingInstances > 0);
    context.waitingInstances--;
    if (threw) settleFailure(context, instance, answer, false);
    else settleValue(context, instance, answer);
    deliver(context, instance);
  } catch (error) {
    // Nothing awaits this callback: a failed assert stops the execution instead.
    stop(context, error);
  }
}

/** The context `resolve` reads through. */
function resolveContextOf(
  context: ExecutionContext,
  instance: ViewInstance,
): ResolveContext {
  const resolveContext = {
    read: (view: AnyView, args?: unknown): unknown =>
      readInline(context, instance, view, args),
    ref,
    action,
    input,
  };
  return resolveContext;

  // The overloads type what the codec captures whatever it is, open inputs included.
  function ref<Result, Args, Inputs>(
    view: View<Args, Result, AccessConfig>,
    args?: unknown,
    meta?: RefMeta,
  ): Ref<Result, Args, Inputs>;
  function ref(view: AnyView, args?: unknown, meta?: RefMeta): AnyRef {
    return refTo(context, view, args, meta);
  }

  function input<const Name extends string>(name: Name): OpenInput<Name, never>;
  function input<const Name extends string, const Default>(
    name: Name,
    options: { readonly default: Default },
  ): OpenInput<Name, Default>;
  function input(
    name: string,
    options?: { readonly default: unknown },
  ): OpenInput {
    throwIfStopped(context);
    return createInput(instance.view, name, options);
  }

  // The overload types the arguments, which the codec captures whatever they are.
  function action<A extends Action, Inputs>(
    target: A,
    args?: unknown,
    meta?: RefMeta,
  ): ActionRef<A, Inputs>;
  function action(
    target: Action,
    args?: unknown,
    meta?: RefMeta,
  ): AnyActionRef {
    return actionRefTo(context, target, args, meta);
  }
}

/**
 * Settles a running instance with what its `resolve` answered, or with the failure to capture
 * it. A store view's instance records its store read, at the revision and footprint the
 * answer annotates.
 */
function settleValue(
  context: ExecutionContext,
  instance: ViewInstance,
  answer: unknown,
): void {
  assertAlways(context.env, instance.status === "running");
  let value = answer;
  let read: StoreRead | undefined;
  const internals = internalsOf(instance.view);
  if (internals?.kind === "store") {
    const annotation = annotationOf(answer);
    if (annotation !== undefined) value = annotation.data;
    const reported = annotation?.revision;
    read = storeReadOf(instance, reported, annotation?.footprint);
    if (reported !== undefined && reported < instance.startedAt) {
      assertSometimes(
        context.env,
        true,
        "A store answers from state older than asked",
      );
    }
  }
  let data: unknown;
  try {
    data = context.codec.captureResult(instance.view, value);
  } catch (error) {
    settleFailure(context, instance, error, true);
    return;
  }
  if (internals?.kind === "pin") {
    const wrong = wrongPinAnswer(instance.view, internals.target, data);
    if (wrong !== undefined) {
      assertSometimes(
        context.env,
        true,
        "A pin answers with neither a ref to its target nor null",
      );
      settleFailure(context, instance, wrong, false);
      return;
    }
  }
  settle(context, instance, data, NO_ERRORS, read);
}

/** Why a pin's answer is neither `null` nor a bound ref to its target, if it is not. */
function wrongPinAnswer(pin: AnyView, target: AnyView, data: unknown): unknown {
  if (data === null) return undefined;
  if (!isViewRef(data) || data.view !== target) {
    return valueError({
      code: "PIN_TARGET",
      message: `${nameOf(pin)} answers with neither a ref to ${nameOf(
        target,
      )} nor null`,
      path: [],
    });
  }
  try {
    throwIfOpen(
      data.args,
      "A pin answers with a bound ref: one leaving inputs open fails it",
    );
  } catch (error) {
    return error;
  }
  return undefined;
}

/**
 * Settles a running instance with the error its readers' `read` throws. A store view's
 * instance still records its store read. An internal error stops the execution instead,
 * leaving the instance running.
 */
function settleFailure(
  context: ExecutionContext,
  instance: ViewInstance,
  error: unknown,
  keepPath: boolean,
): void {
  assertAlways(context.env, instance.status === "running");
  if (isInternalError(error)) {
    stop(context, error);
    return;
  }
  (context.failures ??= new Map()).set(instance.id, error);
  const read =
    internalsOf(instance.view)?.kind === "store"
      ? storeReadOf(instance, undefined, undefined)
      : undefined;
  settle(context, instance, null, [valueErrorOf(error, keepPath)], read);
  assertAlways(context.env, context.failures.get(instance.id) === error);
}

function storeReadOf(
  instance: ViewInstance,
  reported: Revision | undefined,
  footprint: StoreRead["footprint"],
): StoreRead {
  const { view, args, startedAt } = instance;
  return { view, args, startedAt, reported, footprint };
}

/**
 * Settles a running instance, stale when it collects a lagging read. A store read records
 * `own`; a derived view's instance collects what it read inline.
 */
function settle(
  context: ExecutionContext,
  instance: ViewInstance,
  data: unknown,
  errors: readonly ValueError[],
  own: StoreRead | undefined,
): void {
  assertAlways(context.env, instance.depth <= context.maxDepth);
  const reads = instance.reads;
  assertAlways(context.env, reads !== undefined);
  let storeReads: StoreReads;
  if (own === undefined) {
    if (reads.size > 0) context.inlineReads.set(instance, reads);
    storeReads = collectReads(context, reads);
    const complete = readsComplete(context, reads);
    assertSometimes(
      context.env,
      !complete,
      "An instance settles before every instance it read has",
    );
    if (!complete) (context.incomplete ??= new Set()).add(instance);
  } else {
    assertAlways(context.env, reads.size === 0);
    const internals = internalsOf(own.view);
    assertAlways(context.env, internals?.kind === "store");
    storeReads = new Map([[internals.store, [own]]]);
  }
  assertAlways(context.env, instance.startedAt === context.startedAt);
  applyOutcome(context, instance, storeReads, data, errors);
  assertSometimes(
    context.env,
    errors.length > 0,
    "An instance settles with errors",
  );
}

/**
 * Records an instance's outcome, dropping its inline reads but its waiters, which
 * delivering takes: matched through its `startedAt`, and stale-settled when one of
 * `storeReads` was answered from state older than asked. Its execution may record it
 * again, once the reads of the instances it read are complete.
 *
 * A pin that answered with a ref keeps none of `storeReads`: its answer is kept, so no
 * change invalidates it.
 */
function applyOutcome(
  context: ExecutionContext,
  instance: ViewInstance,
  collected: StoreReads,
  data: unknown,
  errors: readonly ValueError[],
): void {
  const internals = internalsOf(instance.view);
  const kept = data !== null && internals?.kind === "pin";
  if (kept) {
    assertAlways(
      context.env,
      isViewRef(data) && data.view === internals.target,
    );
    assertAlways(context.env, errors.length === 0);
    assertSometimes(
      context.env,
      collected.size > 0,
      "A pin keeps an answer it read stores for",
    );
  }
  const storeReads = kept ? NO_STORE_READS : collected;
  assertAlways(context.env, NO_STORE_READS.size === 0);
  if (settledStale({ storeReads })) {
    assertSometimes(context.env, true, "An instance settles stale");
  }
  const { view, args, id } = instance;
  const matchedThrough = instance.startedAt;
  instance.status = "settled";
  instance.descriptor = { view, args, id, storeReads, matchedThrough };
  instance.reads = undefined;
  instance.data = data;
  instance.errors = errors;
}

/**
 * Delivers a settled instance to the readers waiting on it, and a pin's answer to its wave.
 * One left running is not delivered: settling it stopped the execution.
 */
function deliver(context: ExecutionContext, instance: ViewInstance): void {
  if (instance.status === "running") {
    assertAlways(context.env, context.stopped);
    return;
  }
  assertAlways(context.env, instance.descriptor !== undefined);
  const settled = instance.settled;
  instance.settled = undefined;
  if (settled !== undefined) {
    if (failed(instance)) {
      void settled.promise.catch(noop);
      settled.reject(failureOf(context, instance));
    } else {
      settled.resolve(instance.data);
    }
  }
  followPin(context, instance);
  notify(context);
}

/** A failure without a fallback: what a reader's `read` throws. */
function failed(instance: ViewInstance): boolean {
  return instance.data === null && instance.errors.length > 0;
}

function failureOf(context: ExecutionContext, instance: ViewInstance): unknown {
  assertAlways(context.env, instance.errors.length > 0);
  const failures = (context.failures ??= new Map());
  if (failures.has(instance.id)) return failures.get(instance.id);
  const first = instance.errors[0];
  const failure =
    first === undefined
      ? undefined
      : Object.assign(new Error(first.message), first);
  failures.set(instance.id, failure);
  return failure;
}

// Reading

/**
 * One inline read, of a view or a store view. A reader that has settled may still read,
 * as a `resolve` that kept running past its result does; it records nothing.
 */
function readInline(
  context: ExecutionContext,
  instance: ViewInstance,
  view: AnyView,
  args: unknown,
): unknown {
  throwIfStopped(context);
  const depth = instance.depth;
  assertAlways(context.env, depth <= context.maxDepth);
  const internals = internalsOf(view);
  throwIfUnreadable(instance, view, internals);
  throwIfOpen(args, "`read` takes no open inputs: they leave a ref to bind");
  const codec = context.codec;
  const captured = codec.captureArgs(view, args);
  const id = codec.instanceKey(view, captured);
  let callee = context.instances.get(id);
  const fresh = callee === undefined;
  if (callee === undefined) {
    const calleeDepth = internals.kind === "store" ? depth : depth + 1;
    callee = enter(context, id, view, captured, calleeDepth, false);
  } else {
    throwIfCycle(context, instance, callee);
  }
  instance.reads?.add(callee);
  if (fresh) start(context, callee);
  return answerOf(context, callee);
}

/** Throws why `reader` may not read `view` inline, if it may not. */
function throwIfUnreadable(
  reader: ViewInstance,
  view: AnyView,
  internals: ViewInternals | undefined,
): asserts internals is ViewInternals {
  if (internals === undefined) throw unresolved(view);
  if (view.access?.readable !== true) {
    throw refFailure(
      "NOT_READABLE",
      `${nameOf(view)} does not permit inline reads`,
      view,
    );
  }
  if (view.deterministic === false && reader.view.deterministic !== false) {
    throw refFailure(
      "NOT_DETERMINISTIC",
      `${nameOf(
        view,
      )} is not deterministic, so a deterministic view cannot read it`,
      view,
    );
  }
}

/** Throws when reading `callee` would wait on `reader` itself, while `reader` runs. */
function throwIfCycle(
  context: ExecutionContext,
  reader: ViewInstance,
  callee: ViewInstance,
): void {
  if (
    callee.status === "running" &&
    reader.status === "running" &&
    (callee === reader || reaches(context, callee, reader))
  ) {
    assertSometimes(context.env, true, "A read finds an inline-read cycle");
    throw refFailure(
      "INLINE_CYCLE",
      `${nameOf(callee.view)} reads itself inline`,
      callee.view,
    );
  }
}

/** What `read` answers: the data, a promise of it while it runs, or its failure, thrown. */
function answerOf(context: ExecutionContext, callee: ViewInstance): unknown {
  if (callee.status === "running")
    return (callee.settled ??= deferred()).promise;
  if (failed(callee)) throw failureOf(context, callee);
  return callee.data;
}

function refTo(
  context: ExecutionContext,
  view: AnyView,
  args: unknown,
  meta: RefMeta | undefined,
): AnyRef {
  throwIfStopped(context);
  if (view.access?.referenceable === false) {
    throw refFailure(
      "NOT_REFERENCEABLE",
      `${nameOf(view)} does not permit refs`,
      view,
    );
  }
  const codec = context.codec;
  const captured = codec.captureArgs(view, args);
  const ref = createRef(view, captured, meta);
  context.refIds.set(ref, codec.instanceKey(view, captured));
  return ref;
}

function actionRefTo(
  context: ExecutionContext,
  action: Action,
  args: unknown,
  meta: RefMeta | undefined,
): AnyActionRef {
  throwIfStopped(context);
  const captured = context.codec.captureActionArgs(action, args);
  context.codec.actionArgsKey(action, captured);
  return createActionRef(action, captured, meta);
}

/**
 * Whether `from` waits, through inline reads, on `target`. Allocates only once the walk
 * goes past `from`, which a running store read never does.
 */
function reaches(
  context: ExecutionContext,
  from: ViewInstance,
  target: ViewInstance,
): boolean {
  assertAlways(context.env, from !== target);
  let stack: ViewInstance[] | undefined;
  let seen: Set<ViewInstance> | undefined;
  for (
    let running: ViewInstance | undefined = from;
    running !== undefined;
    running = stack?.pop()
  ) {
    if (running === target) return true;
    const reads = running.reads;
    assertAlways(context.env, reads !== undefined);
    for (const callee of reads) {
      if (callee.status !== "running") continue;
      seen ??= new Set([from]);
      if (seen.has(callee)) continue;
      seen.add(callee);
      (stack ??= []).push(callee);
    }
  }
  return false;
}

// Store reads

/**
 * Issues a store read. A batched read joins the round; any other settles and delivers at
 * once when it answers at once, and joins the round with its promise otherwise.
 */
function startStoreView(
  context: ExecutionContext,
  instance: ViewInstance,
  internals: StoreViewInternals,
): void {
  assertAlways(context.env, instance.reads?.size === 0);
  notify(context);
  if (isBatched(internals)) {
    joinRound(context, instance, undefined);
    return;
  }
  let answer: unknown;
  try {
    answer = readStore(context, internals, instance.args);
  } catch (error) {
    settleFailure(context, instance, error, false);
    deliver(context, instance);
    return;
  }
  if (isPromiseLike(answer)) {
    joinRound(context, instance, answer);
    return;
  }
  settleValue(context, instance, answer);
  deliver(context, instance);
}

function joinRound(
  context: ExecutionContext,
  instance: ViewInstance,
  promised: PromiseLike<unknown> | undefined,
): void {
  const round = context.round;
  round.reads.push(instance);
  round.promised.push(promised);
  assertAlways(context.env, round.promised.length === round.reads.length);
}

/**
 * Runs one round: settles its reads with their answers, then delivers them in issue order.
 * Returns a promise when a read answers later.
 */
function runRound(
  context: ExecutionContext,
  round: Round,
): Promise<void> | undefined {
  const answers = answerRound(context, round);
  if (isPromiseLike(answers)) {
    return guard(context, answers).then((later) =>
      settleRound(context, round, later),
    );
  }
  settleRound(context, round, answers);
  return undefined;
}

/** Settles each read of a round with its answer, then delivers them, unless stopped. */
function settleRound(
  context: ExecutionContext,
  round: Round,
  answers: RoundAnswers,
): void {
  throwIfStopped(context);
  const reads = round.reads;
  const values = answers.values;
  const failures = answers.failed;
  assertAlways(context.env, values.length === reads.length);
  for (let index = 0; index < reads.length; index++) {
    const instance = reads[index];
    assertAlways(
      context.env,
      instance !== undefined && instance.status === "running",
    );
    if (failures?.[index] === true)
      settleFailure(context, instance, values[index], false);
    else settleValue(context, instance, values[index]);
  }
  throwIfStopped(context);
  for (let index = 0; index < reads.length; index++) {
    const instance = reads[index];
    assertAlways(context.env, instance !== undefined);
    deliver(context, instance);
  }
}

// Failures

function refFailure(code: string, message: string, view: AnyView): Error {
  const { id, name } = view;
  return refError({
    code,
    message,
    ...(id === undefined ? undefined : { view: id }),
    ...(name === undefined ? undefined : { viewName: name }),
  });
}

function unresolved(view: AnyView): Error {
  return refFailure(
    "UNRESOLVED_VIEW",
    `${nameOf(view)} is not linked to a definition`,
    view,
  );
}
