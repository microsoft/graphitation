import type { CacheEnv, DataTree, Store } from "../cache/types";
import { IndexedForest } from "./types";
import type { NodeKey, OperationDescriptor } from "../descriptor/types";
import { NodeChunk } from "../values/types";
import { resolveKeyDescriptor } from "../cache/descriptor";
import { applyPendingUpdates } from "./updateTree";

export function getTreeAtLatest(
  env: CacheEnv,
  store: Store,
  targetForest: IndexedForest,
  operation: OperationDescriptor,
  getNodeChunks?: (key: NodeKey) => Iterable<NodeChunk>,
): DataTree | undefined {
  const op = resolveKeyDescriptor(env, store, operation);
  const tree = targetForest.trees.get(op.id);
  return tree?.pendingUpdates.length
    ? applyPendingUpdates(env, targetForest, tree, getNodeChunks)
    : tree;
}
