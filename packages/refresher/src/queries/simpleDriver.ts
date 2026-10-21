/**
 * The simple driver, the one most examples use: from its roots, follows every ref tagged
 * with one of its tags, found in each settled result by the codec, and returns the
 * instances it reached.
 */
import type { AnyRef, PromiseOrValue, Ref, ViewInstanceId } from "../api.core";
import type { ExecutionState, ViewInstance } from "../api.execution";
import type {
  CreateSimpleDriverFn,
  DriverContext,
  QueryPayload,
  SimpleDriverOutput,
} from "../api.queries";
import { isValueError } from "../errors";
import { createRef } from "../views/ref";

export type { CreateSimpleDriverFn, SimpleDriverOutput };

/**
 * Runs the roots as the first wave of one execution, then, wave by wave, every tagged ref in
 * the results so far, breadth first, found by the runtime's codec. Each instance is
 * searched for refs once, so cycles end. Settles synchronously when every wave does, with
 * one result. Without roots, it runs no execution.
 *
 * A template is bound with its defaults alone, as the simple driver supplies no variables: one
 * leaving an input without a default open is not followed.
 *
 * A restart runs the stale instances' refs the same way, but follows no ref to a valid instance: its
 * data, and so what it leads to, is as the earlier run left it. Instances no longer reached
 * stay subscribed: a change to one restarts the query with output nothing refers to.
 *
 * Every instance a wave evaluated counts as reached, those its pins pinned included, and a ref
 * to an instance already reached is not followed again.
 */
export const createSimpleDriver: CreateSimpleDriverFn = (tags = []) => {
  const followed = new Set(tags);
  return {
    start: ({ roots, context }) =>
      runSimple(roots, context, followed, undefined),
    restart: ({ descriptor, invalidated, context }) => {
      const staleIds = new Set<ViewInstanceId>();
      const refs: Ref[] = [];
      for (const { descriptor: stale } of invalidated.stale) {
        staleIds.add(stale.id);
        refs.push(createRef(stale.view, stale.args));
      }
      const views = descriptor.views;
      const isValid = (id: ViewInstanceId) =>
        views.has(id) && !staleIds.has(id);
      return runSimple(refs, context, followed, isValid);
    },
  };
};

function runSimple(
  roots: readonly Ref[],
  context: DriverContext,
  tags: ReadonlySet<string>,
  isValid: ((id: ViewInstanceId) => boolean) | undefined,
): PromiseOrValue<QueryPayload<SimpleDriverOutput, never>> {
  const { codec, bind } = context;
  const instances = new Map<ViewInstanceId, ViewInstance>();
  if (roots.length === 0)
    return { output: { roots: [], instances }, waves: [] };

  /** The tagged refs to instances not reached yet, in the last wave's instances not searched before. */
  const nextRefs = (state: ExecutionState): Ref[] | undefined => {
    const wave = state.waves[state.waves.length - 1]!;
    const unsearched: ViewInstance[] = [];
    const reach = (instance: ViewInstance) => {
      if (instances.has(instance.id)) return;
      instances.set(instance.id, instance);
      unsearched.push(instance);
    };
    // All recorded before any is searched: a pin's ref leads to a target the wave ran.
    for (const instance of wave.evaluated) reach(instance);
    for (const target of wave.pinned.evaluated) reach(target);
    if (tags.size === 0) return undefined;
    let next: Ref[] | undefined;
    for (const instance of unsearched) {
      if (instance.data === null) continue;
      for (const found of codec.findRefs(instance.view, instance.data).refs) {
        if (!isTagged(found, tags)) continue;
        const ref = bindDefaults(bind, found);
        if (ref === undefined) continue;
        const id = codec.instanceKey(ref.view, ref.args);
        if (instances.has(id) || isValid?.(id) === true) continue;
        (next ??= []).push(ref);
      }
    }
    return next;
  };

  const follow = (
    state: ExecutionState,
  ): PromiseOrValue<QueryPayload<SimpleDriverOutput, never>> => {
    for (;;) {
      const refs = nextRefs(state);
      if (refs === undefined) {
        // The last result: the execution never continues, so its live `waves` stays as is.
        return {
          output: { roots: state.waves[0]!.evaluated, instances },
          waves: state.waves,
        };
      }
      const executed = context.execute({ state, refs });
      if (executed instanceof Promise) return executed.then(follow);
      state = executed;
    }
  };

  const started = context.execute({ refs: roots });
  return started instanceof Promise ? started.then(follow) : follow(started);
}

/** `ref` bound with no variables, or nothing when it leaves an input without a default open. */
function bindDefaults(
  bind: DriverContext["bind"],
  ref: AnyRef,
): Ref | undefined {
  try {
    return bind(ref);
  } catch (error) {
    if (isValueError(error, "MISSING_INPUT")) return undefined;
    throw error;
  }
}

function isTagged(ref: AnyRef, tags: ReadonlySet<string>): boolean {
  const refTags = ref.meta?.tags;
  if (refTags === undefined) return false;
  for (const tag of refTags) if (tags.has(tag)) return true;
  return false;
}
