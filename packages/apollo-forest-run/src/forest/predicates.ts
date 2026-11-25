import type {
  AnyIndexedTree,
  IndexedTree,
  UncheckedIndexedTree,
} from "./types";

export const isIndexedTree = (
  tree: UncheckedIndexedTree,
): tree is IndexedTree => tree.kind === tree.operation.kind;

// Narrows to trees which can be stored in the forest
export const isStoredTree = (tree: AnyIndexedTree): tree is IndexedTree =>
  tree.kind !== "OperationFragment";

// Narrows the tree to the (possibly generic) tree type of another tree of the same kind
export const isSameTreeKind = <TTree extends AnyIndexedTree>(
  base: TTree,
  tree: AnyIndexedTree,
): tree is TTree => tree.kind === base.kind;
