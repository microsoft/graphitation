import { equal } from "@wry/equality";
import type {
  CacheEnv,
  DataForest,
  OptimisticLayer,
  Store,
  Transaction,
} from "../cache/types";
import type { Cache } from "@apollo/client";
import {
  getReadDescriptor,
  resolveResultDescriptor,
} from "../cache/descriptor";
import { applyReadPolicies } from "../cache/policies";
import {
  diffResult,
  growDataTree,
  normalizeRootLevelTypeName,
} from "../cache/read";
import { getActiveForest, getEffectiveReadLayers } from "../cache/store";

// The name authorizes a read layer, not a result. Hydration resolves the consumer's own
// root, arguments, aliases and entity references, including links supplied by the base.
export function readInFlight<TData>(
  env: CacheEnv,
  store: Store,
  options: Cache.DiffOptions,
  transaction: Transaction | undefined,
  onlyIfChangedFromBase = false,
) {
  // Apollo's readFragment passes its fragment options alongside a synthetic query.
  if (!store.incrementalExecutions.size || "fragment" in options) return;
  const operation = getReadDescriptor(env, store, options);
  const covering = [];
  const own = store.incrementalExecutions.get(operation);
  for (const [source, { forest }] of store.incrementalExecutions) {
    if (
      source !== operation &&
      operation.name &&
      source.covers.includes(operation.name)
    )
      covering.push(forest);
  }
  if (own) covering.push(own.forest);
  if (!covering.length) return;
  const forest = getActiveForest(store, transaction);
  const layers = getEffectiveReadLayers(
    store,
    forest,
    transaction?.forceOptimistic ?? options.optimistic,
  );
  // Optimistic layers, the watch's own stream, covering streams newest first, then base.
  const preview = project([
    ...layers.slice(0, -1),
    ...covering.reverse(),
    store.dataForest,
  ]);
  if (onlyIfChangedFromBase) {
    // A newly registered (non-immediate) watch should not be woken by its name alone.
    // Compare without inserting a grown tree or read result into the committed forest.
    const base = project(layers);
    if (
      Boolean(base.incompleteChunks.size) ===
        Boolean(preview.incompleteChunks.size) &&
      equal(base.result.data, preview.result.data)
    )
      return;
  }
  // Reuse a complete cached result on a no-op without creating a base tree for a cold read.
  if (!preview.incompleteChunks.size) {
    const resultOp = resolveResultDescriptor(env, store, operation);
    const results =
      options.optimistic && store.optimisticLayers.length
        ? store.optimisticReadResults
        : forest.readResults;
    const cached =
      results.get(resultOp)?.outputTree ?? forest.trees.get(resultOp.id);
    if (
      cached &&
      !cached.incompleteChunks.size &&
      equal(cached.result.data, preview.result.data)
    ) {
      return diffResult<TData>(cached);
    }
  }
  return diffResult<TData>(preview);

  function project(sources: (DataForest | OptimisticLayer)[]) {
    const tree = growDataTree(env, sources, operation, true);
    const output = applyReadPolicies(env, sources, env.readPolicies, tree);
    output.prev = null;
    normalizeRootLevelTypeName(output);
    return output;
  }
}
