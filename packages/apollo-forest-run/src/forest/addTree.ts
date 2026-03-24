import { IndexedForest, IndexedTree } from "./types";
import { assert } from "../jsutils/assert";
import { getOrCreate } from "../jsutils/map";

const newSet = () => new Set();

export function addTree(forest: IndexedForest, tree: IndexedTree) {
  const { trees } = forest;
  assert(!trees.has(tree.operation.id));
  trees.set(tree.operation.id, tree);

  trackTreeNodes(forest, tree);
  trackOperationName(forest, tree);
}

export function replaceTree(forest: IndexedForest, tree: IndexedTree) {
  const { trees } = forest;
  trees.set(tree.operation.id, tree);

  trackTreeNodes(forest, tree);
  trackOperationName(forest, tree);
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
}
