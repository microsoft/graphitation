import { equal } from "@wry/equality";
import type {
  CacheEnv,
  DataForest,
  OptimisticLayer,
  Store,
  Transaction,
} from "../cache/types";
import type { OperationDescriptor } from "../descriptor/types";
import { applyReadPolicies } from "../cache/policies";
import { growDataTree, normalizeRootLevelTypeName } from "../cache/read";
import { getActiveForest, getEffectiveReadLayers } from "../cache/store";

// The name authorizes a read layer, not a result. Hydration resolves the consumer's own
// root, arguments, aliases and entity references, including links supplied by the base.
export function projectWatch(
  env: CacheEnv,
  store: Store,
  operation: OperationDescriptor,
  transaction: Transaction | undefined,
  optimistic: boolean,
  onlyIfChangedFromBase: boolean,
) {
  if (!store.incrementalExecutions.size) return;
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
  const layers = getEffectiveReadLayers(
    store,
    getActiveForest(store, transaction),
    transaction?.forceOptimistic ?? optimistic,
  );
  // Optimistic layers, the watch's own stream, covering streams newest first, then base.
  const preview = project([
    ...layers.slice(0, -1),
    ...covering.reverse(),
    store.dataForest,
  ]);
  if (onlyIfChangedFromBase && !own) {
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
  return preview;

  function project(sources: (DataForest | OptimisticLayer)[]) {
    const tree = growDataTree(env, sources, operation, true);
    const output = applyReadPolicies(env, sources, env.readPolicies, tree);
    output.prev = null;
    normalizeRootLevelTypeName(output);
    return output;
  }
}
