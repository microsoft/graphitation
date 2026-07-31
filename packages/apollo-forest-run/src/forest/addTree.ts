import {
  DefaultPartition,
  ForestEnv,
  IndexedForest,
  IndexedTree,
} from "./types";
import { resolveNormalizedField } from "../descriptor/resolvedSelection";
import { assert } from "../jsutils/assert";
import { getOrCreate } from "../jsutils/map";
import { fieldToStringKey } from "../cache/keys";

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
  trackIndexedFields(forest, tree);
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
  trackIndexedFields(forest, tree);
  trackOperationName(forest, tree);
  trackPartitions(env, forest, tree);
}

export function trackTreeNodes(forest: IndexedForest, tree: IndexedTree) {
  const opId = tree.operation.id;
  for (const nodeKey of tree.nodes.keys()) {
    getOrCreate(forest.operationsByNodes, nodeKey, newSet).add(opId);
  }
}

export function trackIndexedFields(forest: IndexedForest, tree: IndexedTree) {
  const opId = tree.operation.id;
  for (const [typeName, { fields, ops }] of forest.fieldIndex) {
    const chunks = tree.typeMap.get(typeName);
    if (!chunks?.length) continue;
    for (const chunk of chunks) {
      for (const [fieldName, fieldInfos] of chunk.selection.fields) {
        if (!fields.has(fieldName)) continue;
        for (const fieldInfo of fieldInfos) {
          const cacheKey = fieldToStringKey(
            resolveNormalizedField(chunk.selection, fieldInfo),
          );
          getOrCreate(ops, cacheKey, newSet).add(opId);
        }
      }
    }
  }
}

function trackOperationName(forest: IndexedForest, tree: IndexedTree) {
  const name = tree.operation.name;
  if (!name) return;
  const opId = tree.operation.id;
  getOrCreate(forest.operationsByName, name, newSet).add(opId);

  for (const coveredName of tree.operation.covers) {
    getOrCreate(forest.operationsByCoveredName, coveredName, newSet).add(opId);
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
