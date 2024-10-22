import { IndexedForest, IndexedTree } from "./types";
import { assert } from "../jsutils/assert";

export function addTree(forest: IndexedForest, tree: IndexedTree) {
  const { trees } = forest;
  assert(!trees.has(tree.operation));
  trees.set(tree.operation, tree);

  trackTreeNodes(forest, tree);
}

export function replaceTree(forest: IndexedForest, tree: IndexedTree) {
  const { trees } = forest;
  trees.set(tree.operation, tree);

  trackTreeNodes(forest, tree);
}

export function trackTreeNodes(forest: IndexedForest, tree: IndexedTree) {
  const { operationsByNodes } = forest;
  for (const nodeKey of tree.nodes.keys()) {
    let seenIn = operationsByNodes.get(nodeKey);
    if (!seenIn) {
      seenIn = new Set();
      operationsByNodes.set(nodeKey, seenIn);
    }
    seenIn.add(tree.operation);
  }
}
