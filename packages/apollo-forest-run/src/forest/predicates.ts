import type { IndexedTree, UncheckedIndexedTree } from "./types";

export const isIndexedTree = (
  tree: UncheckedIndexedTree,
): tree is IndexedTree => tree.kind === tree.operation.kind;
