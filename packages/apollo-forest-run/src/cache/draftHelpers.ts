import type {
  ChunkMatcher,
  ChunkProvider,
  CompositeListChunk,
  GraphValueReference,
  NodeChunk,
  ObjectChunk,
  ParentInfo,
  ParentLocator,
} from "../values/types";
import type {
  NodeKey,
  OperationDescriptor,
  ResolvedSelection,
} from "../descriptor/types";
import type { ForestEnv, IndexedForest, IndexedTree } from "../forest/types";
import { assert } from "../jsutils/assert";
import {
  isMissingValue,
  isNodeValue,
  isObjectValue,
  findClosestNode,
  resolveGraphValueReference,
  retrieveEmbeddedValue,
  TraverseEnv,
  isCompositeListValue,
} from "../values";
import { resolvedSelectionsAreEqual } from "../descriptor/resolvedSelection";
import { applyPendingUpdates } from "../forest/updateTree";

const EMPTY_ARRAY = Object.freeze([]);

/**
 * Loads chunks from provided layers that match given reference chunk (either by key, or by path from the closest node).
 * Chunks from earlier layers have priority.
 */
export function getObjectChunks(
  layers: IndexedForest[],
  ref: GraphValueReference,
  includeDeleted = false,
  parentNode?: NodeChunk,
): Iterable<ObjectChunk> {
  if (typeof ref === "string") {
    return getNodeChunks(layers, ref, includeDeleted);
  }
  const [chunkParentInfo, findParent] = ref;
  const value = resolveGraphValueReference(chunkParentInfo);
  if (isNodeValue(value)) {
    return getNodeChunks(layers, value.key, includeDeleted);
  }
  assert(isObjectValue(value) || isCompositeListValue(value));
  parentNode ??= findClosestNode(value, findParent);

  return getEmbeddedObjectChunks(
    { findParent: createParentLocator(layers) },
    getNodeChunks(layers, parentNode.key, includeDeleted),
    ref,
  );
}

function* getEmbeddedObjectChunks(
  pathEnv: TraverseEnv,
  nodeChunks: Iterable<NodeChunk>,
  ref: GraphValueReference,
): Generator<ObjectChunk> {
  for (const chunk of nodeChunks) {
    const value = retrieveEmbeddedValue(pathEnv, chunk, ref);
    if (value === undefined || isMissingValue(value)) {
      continue;
    }
    assert(isObjectValue(value) && value.key === false);
    if (value.isAggregate) {
      for (const embeddedChunk of value.chunks) {
        yield embeddedChunk;
      }
    } else {
      yield value;
    }
  }
}

export function* getNodeChunks(
  layers: IndexedForest[],
  key: NodeKey,
  includeDeleted = false,
  updateStale = true,
): Generator<NodeChunk> {
  const hasDirtyNode = (tree: IndexedTree) =>
    tree.pendingUpdates.some((pendingUpdate) => pendingUpdate.has(key));

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    if (!includeDeleted && layer.deletedNodes.has(key)) {
      // When a node is deleted in some layer - it is treated as deleted from lower layers too
      break;
    }
    const operations = layer.operationsByNodes.get(key);

    // First, return up-to-date chunks
    let dirtyTrees: IndexedTree[] | undefined = undefined;
    for (const operation of operations ?? EMPTY_ARRAY) {
      const tree = layer.trees.get(operation);
      if (!tree) {
        continue;
      }
      if (tree.pendingUpdates.length && hasDirtyNode(tree)) {
        dirtyTrees ??= [];
        dirtyTrees.push(tree);
        continue;
      }
      const chunks = tree.nodes.get(key) ?? EMPTY_ARRAY;
      for (const chunk of chunks) {
        yield chunk;
      }
    }
    if (!updateStale || !dirtyTrees?.length) {
      continue;
    }
    // ApolloCompat: this is necessary for custom reads from field policies and optimistic stuff
    // FIXME: env passing has become messy - warrants a refactor
    const updateLayers = layers.slice(i);
    const chunkProvider = (nodeKey: NodeKey) =>
      nodeKey === key
        ? []
        : getNodeChunks(updateLayers, nodeKey, includeDeleted, true);

    for (const tree of dirtyTrees ?? EMPTY_ARRAY) {
      assert(tree.operation.env.objectKey);
      const updatedTree = applyPendingUpdates(
        tree.operation.env as ForestEnv,
        layer,
        tree,
        chunkProvider,
      );
      const chunks = updatedTree.nodes.get(key) ?? EMPTY_ARRAY;
      for (const chunk of chunks) {
        yield chunk;
      }
    }
  }
}

export function findRecyclableChunk(
  layers: IndexedForest[],
  operation: OperationDescriptor,
  ref: GraphValueReference,
  selection: ResolvedSelection,
  includeDeleted = false,
): NodeChunk | undefined {
  if (typeof ref !== "string") {
    return undefined; // TODO?
  }
  for (const layer of layers) {
    if (!includeDeleted && layer.deletedNodes.has(ref)) {
      // When a node is deleted in some layer - it is treated as deleted from lower layers too
      return undefined;
    }
    const totalTreesWithNode = layer.operationsByNodes.get(ref)?.size ?? 0;
    if (totalTreesWithNode === 0) {
      // Can safely move to lower level
      continue;
    }
    const tree = layer.trees.get(operation.id);
    for (const chunk of tree?.nodes.get(ref) ?? EMPTY_ARRAY) {
      if (resolvedSelectionsAreEqual(chunk.selection, selection)) {
        return chunk;
      }
    }
    if (tree?.incompleteChunks.size) {
      // Cannot recycle chunks from lower layers when there is missing data in this layer.
      //   This "missing data" may be present in this layer in sibling chunks.
      //   If we move to lower layers - we may accidentally skip the actual data in this layer.
      return undefined;
    }
    if (totalTreesWithNode - (tree ? 1 : 0) > 0) {
      // Cannot recycle chunks from lower layers if there is another partially matching chunks in this layer
      //   which may contain data having precedence over lower layers.
      return undefined;
    }
  }
  return undefined;
}

function findParentInfo(
  layers: IndexedForest[],
  chunk: ObjectChunk | CompositeListChunk,
): ParentInfo {
  for (const layer of layers) {
    const tree = layer.trees.get(chunk.operation.id);
    const parentInfo = tree?.dataMap.get(chunk.data);
    if (parentInfo) {
      return parentInfo;
    }
  }
  assert(false);
}

export const createParentLocator =
  (layers: IndexedForest[]): ParentLocator =>
  (chunk: ObjectChunk | CompositeListChunk) =>
    findParentInfo(layers, chunk);

export const createChunkMatcher =
  (layers: IndexedForest[], includeDeleted = false): ChunkMatcher =>
  (
    ref: GraphValueReference,
    operation: OperationDescriptor,
    selection: ResolvedSelection,
  ) =>
    findRecyclableChunk(layers, operation, ref, selection, includeDeleted);

export const createChunkProvider =
  (layers: IndexedForest[], includeDeleted = false): ChunkProvider =>
  (ref: GraphValueReference) =>
    getObjectChunks(layers, ref, includeDeleted);
