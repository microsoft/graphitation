/**
 * The simple driver, the one most examples use: from its roots, follows every ref tagged
 * with one of its tags, found in each settled result by the codec, and returns the
 * instances it reached.
 */
import type { AnyRef, PromiseOrValue, Ref, ViewInstanceId } from "../api.core";
import type { ExecutionState, ViewInstance } from "../api.execution";
import type { ViewInstanceDescriptor } from "../api.invalidation";
import type {
  CreateSimpleDriverFn,
  DriverContext,
  QueryPayload,
  SimpleDriverOutput,
} from "../api.queries";
import { isValueError } from "../errors";
import { createRef, isViewRef } from "../views/ref";

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
 * A restart walks from the roots again, as a start would, but runs no valid instance: its
 * data, and so what it leads to, is as the earlier run left it, so the walk goes on through
 * the edges the runtime kept for it. The first wave runs the stale instances the walk
 * reaches through valid ones alone; each later wave, those the refs in the last one's
 * results reach, directly or through valid instances. So a stale instance runs only once
 * the stale ones above it have, and only if they still lead to it: those no run reaches
 * the runtime drops. A wave runs whatever a walk reached, from whatever depth, so a restart
 * runs no wave with nothing to run, and none at all when its roots reach no stale instance.
 * Without the runtime's edges, it runs every stale instance in its first wave instead,
 * following no ref to a valid instance.
 *
 * Its results report as `traversed` what each instance it searched leads to: the tagged refs
 * in its data, followed or not, and its target when it is a pin. So the runtime drops what
 * a restart's instances no longer lead to.
 *
 * Every instance a wave evaluated counts as reached, those its pins pinned included, and a ref
 * to an instance already reached is not followed again.
 */
export const createSimpleDriver: CreateSimpleDriverFn = (tags = []) => {
  const followed = new Set(tags);
  return {
    start: ({ roots, context }) =>
      runSimple(roots, context, followed, runEvery),
    restart: ({ descriptor, invalidated, edges, context }) => {
      const stale = new Map<ViewInstanceId, ViewInstanceDescriptor>();
      for (const { descriptor: instance } of invalidated.stale)
        stale.set(instance.id, instance);
      const { views, roots } = descriptor;
      const isValid = (id: ViewInstanceId) => views.has(id) && !stale.has(id);
      if (edges === undefined) {
        const refs = [...stale.values()].map((instance) =>
          createRef(instance.view, instance.args),
        );
        return runSimple(refs, context, followed, (id, ref, next) => {
          if (!isValid(id)) next.push(ref);
        });
      }
      const walked = new Set<ViewInstanceId>();
      /** Into `next`, the stale instances not `reached` that valid `from` leads to through valid ones. */
      const walk = (
        from: ViewInstanceId,
        next: Ref[],
        reached: ReadonlyMap<ViewInstanceId, ViewInstance>,
      ) => {
        const stack = [from];
        for (let id = stack.pop(); id !== undefined; id = stack.pop()) {
          if (walked.has(id)) continue;
          walked.add(id);
          for (const target of edges.get(id) ?? []) {
            if (isValid(target)) stack.push(target);
            else if (!reached.has(target)) {
              const instance = stale.get(target);
              if (instance !== undefined)
                next.push(createRef(instance.view, instance.args));
            }
          }
        }
      };
      const lead: Lead = (id, ref, next, reached) => {
        if (isValid(id)) walk(id, next, reached);
        else next.push(ref);
      };
      const first: Ref[] = [];
      for (const root of roots)
        lead(idOf(context, root), root, first, new Map());
      return runSimple(first, context, followed, lead);
    },
  };
};

/**
 * What a run does with `ref`, to instance `id` not `reached` yet, found in a result: pushes
 * into `next` what the next wave runs for it.
 */
type Lead = (
  id: ViewInstanceId,
  ref: Ref,
  next: Ref[],
  reached: ReadonlyMap<ViewInstanceId, ViewInstance>,
) => void;

/** A start runs every ref it finds. */
const runEvery: Lead = (_id, ref, next) => {
  next.push(ref);
};

function idOf(context: DriverContext, ref: Ref): ViewInstanceId {
  return context.codec.instanceKey(ref.view, ref.args);
}

function runSimple(
  roots: readonly Ref[],
  context: DriverContext,
  tags: ReadonlySet<string>,
  lead: Lead,
): PromiseOrValue<QueryPayload<SimpleDriverOutput, never>> {
  const { codec, bind } = context;
  const instances = new Map<ViewInstanceId, ViewInstance>();
  if (roots.length === 0) {
    return {
      output: { roots: [], instances },
      waves: [],
      traversed: new Map(),
    };
  }
  const traversed = new Map<ViewInstanceId, ViewInstanceId[]>();

  /** What the next wave runs for the tagged refs in the last wave's instances not searched before. */
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
    const next: Ref[] = [];
    for (const instance of unsearched) {
      const { data } = instance;
      if (data === null) continue;
      let targets: ViewInstanceId[] | undefined;
      if (isViewRef(data)) {
        const pinned = bindDefaults(bind, data);
        if (pinned !== undefined)
          (targets ??= []).push(codec.instanceKey(pinned.view, pinned.args));
      }
      if (tags.size > 0) {
        for (const found of codec.findRefs(instance.view, data).refs) {
          if (!isTagged(found, tags)) continue;
          const ref = bindDefaults(bind, found);
          if (ref === undefined) continue;
          const id = codec.instanceKey(ref.view, ref.args);
          (targets ??= []).push(id);
          if (!instances.has(id)) lead(id, ref, next, instances);
        }
      }
      if (targets !== undefined) traversed.set(instance.id, targets);
    }
    return next.length === 0 ? undefined : next;
  };

  const follow = (
    state: ExecutionState,
  ): PromiseOrValue<QueryPayload<SimpleDriverOutput, never>> => {
    for (;;) {
      const refs = nextRefs(state);
      if (refs === undefined) {
        // The last result: the execution never continues, so its live `waves` stays as is.
        const output = { roots: state.waves[0]!.evaluated, instances };
        return { output, waves: state.waves, traversed };
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
