import { GraphDifference } from "../diff/diffTree";
import { NodeKey, OperationDescriptor } from "../descriptor/types";
import { updateTree } from "./updateTree";
import { isDirty } from "../diff/difference";
import { NodeDifferenceMap, ObjectDifference } from "../diff/types";
import {
  resolveNormalizedField,
  resolveSelection,
  fieldEntriesAreEqual,
} from "../descriptor/resolvedSelection";
import { assert } from "../jsutils/assert";
import type { IndexedForest, ForestEnv, UpdateTreeResult } from "./types";
import { DataForest, OptimisticLayer } from "../cache/types";
import { replaceTree } from "./addTree";
import { NodeChunk } from "../values/types";

export const ROOT_NODES = Object.freeze([
  "ROOT_QUERY",
  "ROOT_MUTATION",
  "ROOT_SUBSCRIPTION",
]);
const EMPTY_ARRAY = Object.freeze([]);

export function updateAffectedTrees(
  env: ForestEnv,
  forest: DataForest | OptimisticLayer,
  affectedOperations: Map<OperationDescriptor, NodeDifferenceMap>,
  getNodeChunks?: (key: NodeKey) => Iterable<NodeChunk>,
): UpdateTreeResult[] {
  // Note: affectedOperations may contain false-positives (updateTree will ignore those)
  const allUpdated: UpdateTreeResult[] = [];
  for (const [operation, difference] of affectedOperations.entries()) {
    const currentTreeState = forest.trees.get(operation.id);
    assert(currentTreeState);
    const result = updateTree(env, currentTreeState, difference, getNodeChunks);
    if (result.updatedTree === currentTreeState) {
      // nodeDifference may not be overlapping with selections of this tree.
      //   E.g. difference could be for operation { id: "1", firstName: "Changed" }
      //   but current operation is { id: "1", lastName: "Unchanged" }
      continue;
    }
    allUpdated.push(result);

    // Reset previous tree state on commit
    result.updatedTree.prev = null;
    replaceTree(forest, result.updatedTree);
  }
  return allUpdated;
}

export function resolveAffectedOperations(
  forest: IndexedForest,
  difference: GraphDifference,
  accumulatorMutable: Map<OperationDescriptor, NodeDifferenceMap> = new Map(),
): Map<OperationDescriptor, NodeDifferenceMap> {
  for (const [nodeKey, diff] of difference.nodeDifference.entries()) {
    if (isDirty(diff)) {
      accumulateOperationDiffs(forest, nodeKey, diff, accumulatorMutable);
    }
  }
  return accumulatorMutable;
}

function accumulateOperationDiffs(
  forest: IndexedForest,
  nodeKey: string,
  difference: ObjectDifference,
  accumulatorMutable: Map<OperationDescriptor, NodeDifferenceMap>,
) {
  const operationIds = forest.operationsByNodes.get(nodeKey) ?? EMPTY_ARRAY;
  const isRootNode = ROOT_NODES.includes(nodeKey);

  for (const operationId of operationIds) {
    const operationDescriptor = forest.trees.get(operationId)?.operation;
    if (!operationDescriptor) {
      // operationsByNodes may contain operations with evicted data, which is expected
      continue;
    }
    if (isRootNode && !rootFieldsOverlap(operationDescriptor, difference)) {
      continue;
    }
    let map = accumulatorMutable.get(operationDescriptor);
    if (!map) {
      map = new Map();
      accumulatorMutable.set(operationDescriptor, map);
    }
    map.set(nodeKey, difference);
  }
}

function rootFieldsOverlap(
  operationDescriptor: OperationDescriptor,
  difference: ObjectDifference,
): boolean {
  const rootSelection = resolveSelection(
    operationDescriptor,
    operationDescriptor.possibleSelections,
    operationDescriptor.rootType,
  );
  const dirtyFields = difference.dirtyFields;
  assert(rootSelection && dirtyFields);

  for (const field of dirtyFields) {
    const fieldInfos = rootSelection.fields.get(field);
    if (!fieldInfos) {
      continue;
    }
    const dirtyEntries = difference.fieldState.get(field);
    assert(dirtyEntries);

    // Also check that args are matching
    for (const fieldInfo of fieldInfos) {
      const fieldEntry = resolveNormalizedField(rootSelection, fieldInfo);
      const match = Array.isArray(dirtyEntries)
        ? dirtyEntries.some((dirtyEntry) =>
            fieldEntriesAreEqual(dirtyEntry.fieldEntry, fieldEntry),
          )
        : fieldEntriesAreEqual(dirtyEntries.fieldEntry, fieldEntry);
      if (match) {
        return true;
      }
    }
  }
  return false;
}
