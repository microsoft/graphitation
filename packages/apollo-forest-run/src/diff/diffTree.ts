import {
  DiffEnv,
  DiffError,
  DiffErrorKind,
  MissingBaseFieldsError,
  MissingModelFieldsError,
  NodeDifferenceMap,
  ObjectDiffState,
} from "./types";
import { isComplete, isDirty, isObjectDifference } from "./difference";
import { getEmbeddedChunkDifference } from "./embedded";
import { createObjectAggregate } from "../values/create";
import { diffObject } from "./diffObject";
import {
  NodeKey,
  NodeMap,
  NodeValue,
  ObjectChunk,
  ObjectValue,
  ParentLocator,
} from "../values/types";
import { assert, assertNever } from "../jsutils/assert";
import { OperationId } from "../descriptor/types";
import { resolveOperation } from "../descriptor/operation";
import { AnyIndexedTree, IndexedForest, IndexedTree } from "../forest/types";
import {
  findClosestNode,
  getGraphValueReference,
  retrieveEmbeddedValue,
} from "../values/traverse";
import { isNodeValue, isObjectValue } from "../values/predicates";
import { createTreeParentLocator } from "../forest/parentLocator";

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
  model: AnyIndexedTree,
  env: DiffEnv,
): GraphDifference {
  const context: Context = { env, forest: forest };
  const currentTreeState = forest.trees.get(
    resolveOperation(model.operation).id,
  );
  const difference = diffNodesImpl(
    context,
    forest,
    model.nodes,
    env,
    currentTreeState,
  );
  if (model.kind === "OperationFragment") {
    // Roots embedded into nodes outside of the tree (see createTreeParentLocator)
    const findParent = createTreeParentLocator(model);
    for (const { data } of model.roots) {
      const rootRef = model.dataMap.get(data);
      assert(rootRef && isObjectValue(rootRef.value));
      if (rootRef.value.key === false) {
        diffEmbeddedRoot(
          context,
          findParent,
          rootRef.value,
          difference.nodeDifference,
        );
      }
    }
    difference.errors = getErrors(context);
  }
  return difference;
}

/**
 * Diffs the embedded root against the same object in the forest.
 * The difference is recorded as a difference of the closest node of the root (along the path to the root).
 */
function diffEmbeddedRoot(
  context: Context,
  findParent: ParentLocator,
  root: ObjectChunk,
  nodeDifference: NodeDifferenceMap,
) {
  const env = { findParent };
  const node = findClosestNode(root, findParent);
  const ref = getGraphValueReference(env, root);
  const existing = getEmbeddedChunkDifference(nodeDifference, findParent, root);
  assert(!existing || isObjectDifference(existing));

  // Note: continues the difference of the same object within the node, when the node is in the tree too
  const state: ObjectDiffState = nodeDiffState;
  state.difference = existing;
  nodeDiffState.errors.length = 0;

  for (const operation of resolveOperationsWithNode(context.forest, node)) {
    const baseNode = getBaseNode(context.forest.trees.get(operation), node.key);
    const base = baseNode && retrieveEmbeddedValue(env, baseNode, ref);
    if (base && isObjectValue(base)) {
      diffObject(base, root, context.env, state);
      if (state.difference && isComplete(state.difference)) {
        break;
      }
    }
  }
  const difference = state.difference;
  if (difference && isDirty(difference)) {
    const added = getEmbeddedChunkDifference(
      nodeDifference,
      findParent,
      root,
      difference,
    );
    assert(added === difference);
  }
  if (state.errors?.length) {
    accumulateDiffErrors(context, root, state.errors);
  }
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
): Set<OperationId> {
  if (!node.key) {
    return EMPTY_SET as Set<OperationId>;
  }
  // TODO: additionally filter trees for common nodes (like ROOT_QUERY or ROOT_SUBSCRIPTION)
  //   Using indexes on types
  return (
    forest.operationsByNodes.get(node.key) ?? (EMPTY_SET as Set<OperationId>)
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
  const baseNode = getBaseNode(baseTree, modelNode.key as string);
  assert(baseNode);

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

function getBaseNode(
  tree: IndexedTree | undefined,
  key: NodeKey,
): NodeValue | undefined {
  const chunks = tree?.nodes.get(key);
  if (!chunks?.length) {
    return undefined;
  }
  const node = chunks.length === 1 ? chunks[0] : createObjectAggregate(chunks);
  assert(isNodeValue(node));
  return node;
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
