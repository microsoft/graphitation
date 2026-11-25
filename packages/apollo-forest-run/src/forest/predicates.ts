import type {
  AnyIndexedTree,
  IndexedTree,
  UncheckedIndexedTree,
} from "./types";

export const isIndexedTree = (
  tree: UncheckedIndexedTree,
): tree is IndexedTree => tree.kind === tree.operation.kind;

// Trees which can be stored in the forest (all except transient operation fragment trees)
export const isStoredTree = (tree: AnyIndexedTree): tree is IndexedTree =>
  tree.kind !== "OperationFragment";
