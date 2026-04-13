import {
  DefaultPartition,
  ForestEnv,
  IndexedForest,
  IndexedTree,
} from "./types";
import { assert } from "../jsutils/assert";
import { getOrCreate } from "../jsutils/map";

const newSet = () => new Set();

const DEFAULT_PARTITION: DefaultPartition = "__default__";

export function addTree(
  env: ForestEnv,
  forest: IndexedForest,
  tree: IndexedTree,
) {
  const { trees } = forest;
  assert(!trees.has(tree.operation.id));
  trees.set(tree.operation.id, tree);

  trackTreeNodes(forest, tree);
  trackOperationName(forest, tree);
  trackPartitions(env, forest, tree);
}

export function replaceTree(
  env: ForestEnv,
  forest: IndexedForest,
  tree: IndexedTree,
) {
  const { trees } = forest;
  trees.set(tree.operation.id, tree);

  trackTreeNodes(forest, tree);
  trackOperationName(forest, tree);
  trackPartitions(env, forest, tree);
}

export function trackTreeNodes(forest: IndexedForest, tree: IndexedTree) {
  for (const nodeKey of tree.nodes.keys()) {
    getOrCreate(forest.operationsByNodes, nodeKey, newSet).add(
      tree.operation.id,
    );
  }
}

function trackOperationName(forest: IndexedForest, tree: IndexedTree) {
  const name = tree.operation.name;
  if (!name) return;
  getOrCreate(forest.operationsByName, name, newSet).add(tree.operation.id);

  for (const coveredName of tree.operation.covers) {
    getOrCreate(forest.operationsByCoveredName, coveredName, newSet).add(
      tree.operation.id,
    );
  }
}

function trackPartitions(
  env: ForestEnv,
  forest: IndexedForest,
  tree: IndexedTree,
) {
  const partitionKey =
    env.partitionConfig?.partitionKey(tree) ?? DEFAULT_PARTITION;

  const operationIds = getOrCreate(
    forest.operationsByPartitions,
    partitionKey,
    newSet,
  );
  if (tree.prev) {
    operationIds.delete(tree.prev.operation.id);
  }
  operationIds.add(tree.operation.id);
}
