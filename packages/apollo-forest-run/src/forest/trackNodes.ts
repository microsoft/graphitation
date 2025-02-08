import { IndexedForest, IndexedTree } from "./types";
import { NodeDifferenceMap } from "../diff/types";

const EMPTY_ARRAY = Object.freeze([]);

export function trackTreeNodes(forest: IndexedForest, tree: IndexedTree) {
  const { operationsByNodes } = forest;
  for (const nodeKey of tree.nodes.keys()) {
    let seenIn = operationsByNodes.get(nodeKey);
    if (!seenIn) {
      seenIn = new Set();
      operationsByNodes.set(nodeKey, seenIn);
    }
    seenIn.add(tree.operation.id);
  }
}

export function trackRelationshipChanges(
  forest: IndexedForest,
  difference: NodeDifferenceMap,
) {
  for (const [nodeKey, nodeDiff] of difference.entries()) {
    if (!nodeDiff.added?.size && !nodeDiff.removed?.size) {
      continue;
    }
    const ops = forest.operationsByNodes.get(nodeKey);

    for (const removedNodeKey of nodeDiff.removed ?? EMPTY_ARRAY) {
      let removedFrom = forest.operationsByNodes.get(removedNodeKey);
      if (!removedFrom) {
        removedFrom = new Set();
        forest.operationsByNodes.set(removedNodeKey, removedFrom);
      }
      for (const opId of ops ?? []) {
        removedFrom.add(opId);
      }
    }
    for (const addedNodeKey of nodeDiff.added ?? EMPTY_ARRAY) {
      let addedTo = forest.operationsByNodes.get(addedNodeKey);
      if (!addedTo) {
        addedTo = new Set();
        forest.operationsByNodes.set(addedNodeKey, addedTo);
      }
      for (const opId of ops ?? []) {
        addedTo.add(opId);
      }
    }
  }
}
