import { OperationDescriptor } from "../../descriptor/types";
import { ForestEnv, IndexedForest, IndexedTree } from "../../forest/types";
import { SourceObject } from "../../values/types";
import { indexTree } from "../../forest/indexTree";
import { assert } from "../../jsutils/assert";
import { parse } from "graphql/index";
import { generateMockObject, removeMockDirectives } from "./mock";
import { createTestOperation } from "./descriptor";

const defaultEnv: ForestEnv = {
  objectKey: (o) => `${o.__typename}:${o.id}`,
};

export function generateTree(query: string) {
  const document = parse(query);
  const source = generateMockObject(document);
  removeMockDirectives(document);
  const op = createTestOperation(document);

  return createTestTree(op, source);
}

export function createTestTree(
  operation: OperationDescriptor,
  data: SourceObject,
  errors?: any[],
  config: ForestEnv = defaultEnv,
): IndexedTree {
  return indexTree(config, operation, { data, errors });
}

export function createTestForest(): IndexedForest {
  return {
    trees: new Map(),
    extraRootIds: new Map(),
    operationsByNodes: new Map(),
    operationsWithErrors: new Set(),
    deletedNodes: new Set(),
  };
}

export function addForestTree(forest: IndexedForest, tree: IndexedTree) {
  assert(!forest.trees.has(tree.operation.id));
  forest.trees.set(tree.operation.id, tree);

  for (const nodeKey of tree.nodes.keys()) {
    let seenIn = forest.operationsByNodes.get(nodeKey);
    if (!seenIn) {
      seenIn = new Set();
      forest.operationsByNodes.set(nodeKey, seenIn);
    }
    seenIn.add(tree.operation.id);
  }
}
