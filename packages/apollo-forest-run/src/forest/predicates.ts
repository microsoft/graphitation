import type {
  IndexedOperationFragment,
  IndexedTree,
  UncheckedIndexedTree,
} from "./types";

export const isIndexedTree = (
  tree: UncheckedIndexedTree,
): tree is IndexedTree => tree.kind === tree.operation.kind;

// Narrows to trees stored in the forest (indexed operation fragments are never stored)
export const isStoredTree = (
  tree: IndexedTree | IndexedOperationFragment,
): tree is IndexedTree => tree.kind !== "OperationFragment";
