import { IndexedForest, IndexedTree } from "./types";
import { assert } from "../jsutils/assert";
import { trackTreeNodes } from "./trackNodes";

export function addTree(forest: IndexedForest, tree: IndexedTree) {
  const { trees } = forest;
  assert(!trees.has(tree.operation.id));
  trees.set(tree.operation.id, tree);

  trackTreeNodes(forest, tree);
}

export function replaceTree(forest: IndexedForest, tree: IndexedTree) {
  const { trees } = forest;
  trees.set(tree.operation.id, tree);

  trackTreeNodes(forest, tree);
}
