/**
 * `createViewCache`: the runtime's view cache, following `ViewCache` in `../api.execution`.
 *
 * Instances are kept by id, and validated as they are asked for: an instance nothing asks
 * for costs no work as changes arrive. `validate` checks those about to fall out of the
 * change log together, in one call to `invalidate`. An instance a change hit is marked
 * stale and stays. Eviction is not decided yet; an entry stays until it is replaced or
 * deleted.
 */
import type { AnyView, ViewInstanceId } from "../api.core";
import type { CreateViewCacheFn, ViewInstance } from "../api.execution";
import type { ViewInstanceDescriptor } from "../api.invalidation";
import { assertAlways, assertSometimes } from "../env/assert";
import { invalidate } from "../invalidation/invalidate";
import { settledStale } from "../invalidation/reads";

function cacheable(view: AnyView): boolean {
  return view.deterministic !== false && view.memo === true;
}

/** Whether it is valid at its own `startedAt`: no store answered one of its reads from older state. */
function current(descriptor: ViewInstanceDescriptor): boolean {
  return !settledStale(descriptor);
}

/** Whether `instance` replaces `kept`: one not stale, then one current, then the newer one. */
function displaces(
  kept: ViewInstance,
  keptDescriptor: ViewInstanceDescriptor,
  instance: ViewInstance,
  descriptor: ViewInstanceDescriptor,
): boolean {
  const keptStale = kept.status === "stale";
  if (keptStale !== (instance.status === "stale")) return keptStale;
  const valid = current(descriptor);
  if (valid !== current(keptDescriptor)) return valid;
  return kept.startedAt <= instance.startedAt;
}

export const createViewCache: CreateViewCacheFn = ({ env, changes }) => {
  const entries = new Map<ViewInstanceId, ViewInstance>();

  return {
    cacheable,
    get(id) {
      const instance = entries.get(id);
      if (instance === undefined || instance.status === "stale")
        return instance;
      const descriptor = instance.descriptor;
      assertAlways(env, descriptor !== undefined);
      const head = changes.head;
      if (descriptor.matchedThrough >= head) return instance;
      const { stale } = invalidate({ env, changes, descriptors: [descriptor] });
      if (stale.length > 0) {
        assertSometimes(
          env,
          true,
          "A cached instance goes stale when it is asked for",
        );
        instance.status = "stale";
        return instance;
      }
      descriptor.matchedThrough = head;
      return instance;
    },
    keep(instance) {
      if (instance.status === "running" || !cacheable(instance.view))
        return false;
      const descriptor = instance.descriptor;
      assertAlways(env, descriptor !== undefined);
      const kept = entries.get(instance.id);
      if (kept !== undefined && kept !== instance) {
        assertAlways(env, kept.descriptor !== undefined);
        if (!displaces(kept, kept.descriptor, instance, descriptor))
          return false;
      }
      entries.set(instance.id, instance);
      return true;
    },
    delete: (id) => entries.delete(id),
    validate(before) {
      const head = changes.head;
      const due: ViewInstanceDescriptor[] = [];
      for (const instance of entries.values()) {
        if (instance.status === "stale") continue;
        const descriptor = instance.descriptor;
        assertAlways(env, descriptor !== undefined);
        const matchedThrough = descriptor.matchedThrough;
        if (matchedThrough < before && matchedThrough < head)
          due.push(descriptor);
      }
      if (due.length === 0) return;
      const { stale } = invalidate({ env, changes, descriptors: due });
      assertSometimes(
        env,
        stale.length > 0,
        "Validating ahead of a trim stales a cached instance",
      );
      for (const { descriptor } of stale) {
        const instance = entries.get(descriptor.id);
        assertAlways(env, instance?.descriptor === descriptor);
        instance.status = "stale";
      }
      for (const descriptor of due) {
        if (entries.get(descriptor.id)?.status === "settled")
          descriptor.matchedThrough = head;
      }
    },
    get size() {
      return entries.size;
    },
  };
};
