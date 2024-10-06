import {
  DiffEnv,
  DiffError,
  DiffErrorKind,
  MissingBaseFieldsError,
  MissingModelFieldsError,
  NodeDifferenceMap,
  ObjectDiffState,
} from "./types";
import { isComplete, isDirty } from "./difference";
import { createObjectAggregate } from "../values/create";
import { diffObject } from "./diffObject";
import { NodeKey, NodeMap, ObjectValue } from "../values/types";
import { assert, assertNever } from "../jsutils/assert";
import { OperationDescriptor } from "../descriptor/types";
import { IndexedForest, IndexedTree } from "../forest/types";

type MissingFieldsError = {
  kind: "MissingFields";
  model?: MissingModelFieldsError[];
  base?: MissingBaseFieldsError[];
};

type FirstDiffNodeException = {
  kind: "FirstDiffNodeException";
  nodeKey: string;
  base: ObjectValue;
  model: ObjectValue;
  error: Error;
};

export type GraphDiffError = MissingFieldsError | FirstDiffNodeException;

export type GraphDifference = {
  nodeDifference: NodeDifferenceMap;
  newNodes: NodeKey[];
  errors: GraphDiffError[];
};

type Context = {
  env: DiffEnv;
  forest: IndexedForest;

  // Accumulated errors
  firstError?: FirstDiffNodeException;
  missingModelFields?: MissingModelFieldsError[];
  missingBaseFields?: MissingBaseFieldsError[];
};

const EMPTY_SET = new Set();
EMPTY_SET.add = () => {
  throw new Error("Immutable Empty Set");
};

// Re-using state object for multiple nodes
const nodeDiffState = {
  difference: undefined,
  errors: [],
};

export function diffTree(
  forest: IndexedForest,
  model: IndexedTree,
  env: DiffEnv,
): GraphDifference {
  const context: Context = { env, forest: forest };
  const currentTreeState = forest.trees.get(model.operation);
  return diffNodesImpl(context, forest, model.nodes, env, currentTreeState);
}

export function diffNodes(
  forest: IndexedForest,
  nodes: NodeMap,
  env: DiffEnv,
): GraphDifference {
  const context: Context = { env, forest: forest };
  return diffNodesImpl(context, forest, nodes, env, undefined);
}

function diffNodesImpl(
  context: Context,
  forest: IndexedForest,
  nodes: NodeMap,
  env: DiffEnv,
  currentTreeState?: IndexedTree,
): GraphDifference {
  const newNodes: NodeKey[] = [];
  const nodeDifference: NodeDifferenceMap = new Map();

  for (const nodeChunks of nodes.values()) {
    assert(nodeChunks.length);
    nodeDiffState.difference = undefined;
    nodeDiffState.errors.length = 0;

    const modelNode =
      nodeChunks.length === 1
        ? nodeChunks[0]
        : createObjectAggregate(nodeChunks);

    assert(modelNode.key);

    if (currentTreeState?.nodes.has(modelNode.key)) {
      const difference = diffTreeNode(
        context,
        currentTreeState,
        modelNode,
        nodeDifference,
        nodeDiffState,
      );
      // TODO: additionally diff nodes that exist in the incoming state, but are missing in the current state
      //    And keep a list of "removed" / "added" nodes
      if (!difference) {
        continue;
      }
    }
    const operationsWithNode = resolveOperationsWithNode(forest, modelNode);

    for (const operation of operationsWithNode) {
      const treeWithNode = forest.trees.get(operation);
      if (!treeWithNode?.nodes.has(modelNode.key)) {
        // False-positives in operationsWithNode are possible
        // (due to garbage-collection of unused trees/replacement of node in the tree, etc.)
        continue;
      }
      if (treeWithNode === currentTreeState) {
        // Already ran a diff for it above
        continue;
      }
      const difference = diffTreeNode(
        context,
        treeWithNode,
        modelNode,
        nodeDifference,
        nodeDiffState,
      );
      if (!difference) {
        break;
      }
    }
    if (!operationsWithNode.size) {
      assert(typeof modelNode.key === "string");
      newNodes.push(modelNode.key);
    }
    if (nodeDiffState.difference && isDirty(nodeDiffState.difference)) {
      assert(modelNode.key);
      nodeDifference.set(modelNode.key, nodeDiffState.difference);
    }
    if (nodeDiffState.errors?.length) {
      accumulateDiffErrors(context, modelNode, nodeDiffState.errors);
    }
  }
  return { nodeDifference, errors: getErrors(context), newNodes };
}

function resolveOperationsWithNode(
  forest: IndexedForest,
  node: ObjectValue,
): Set<OperationDescriptor> {
  if (!node.key) {
    return EMPTY_SET as Set<OperationDescriptor>;
  }
  // TODO: additionally filter trees for common nodes (like ROOT_QUERY or ROOT_SUBSCRIPTION)
  //   Using indexes on types
  return (
    forest.operationsByNodes.get(node.key) ??
    (EMPTY_SET as Set<OperationDescriptor>)
  );
}

function diffTreeNode(
  context: Context,
  baseTree: IndexedTree,
  modelNode: ObjectValue,
  nodeDifferenceMap: NodeDifferenceMap,
  nodeDiffState: ObjectDiffState,
) {
  if (nodeDiffState.difference && isComplete(nodeDiffState.difference)) {
    return nodeDiffState.difference;
  }
  const baseChunks = baseTree.nodes.get(modelNode.key as string);
  assert(baseChunks?.length);

  const baseNode =
    baseChunks.length === 1 ? baseChunks[0] : createObjectAggregate(baseChunks);

  try {
    const { difference } = diffObject(
      baseNode,
      modelNode,
      context.env,
      nodeDiffState,
    );
    return difference && (isDirty(difference) || !isComplete(difference))
      ? difference
      : undefined;
  } catch (e) {
    assert(modelNode.key !== false);
    context.firstError ??= {
      kind: "FirstDiffNodeException",
      nodeKey: modelNode.key,
      base: baseNode,
      model: modelNode,
      error: e as Error,
    };
    return undefined;
  }
}

function accumulateDiffErrors(
  context: Context,
  modelNode: ObjectValue,
  errors: DiffError[],
) {
  for (const error of errors) {
    if (error.kind === DiffErrorKind.MissingModelFields) {
      context.missingModelFields ??= [];
      context.missingModelFields.push(error);
      continue;
    }
    if (error.kind === DiffErrorKind.MissingBaseFields) {
      context.missingBaseFields ??= [];
      context.missingBaseFields.push(error);
      continue;
    }
    assert(error.kind !== DiffErrorKind.MissingModelValue); // This can only happen with custom value diffing
    assertNever(error);
  }
}

function getErrors(context: Context): GraphDiffError[] {
  const errors: GraphDiffError[] = [];
  if (context.firstError) {
    errors.push(context.firstError);
  }
  if (context.missingBaseFields || context.missingModelFields) {
    errors.push({
      kind: "MissingFields",
      base: context.missingBaseFields,
      model: context.missingModelFields,
    });
  }
  return errors;
}
