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
  FieldInfo,
  NodeKey,
  OperationDescriptor,
  OperationId,
  ResolvedSelection,
  TypeName,
} from "../descriptor/types";
import type { IndexedForest } from "../forest/types";
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
import { DirtyNodeMap } from "./types";

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
): Generator<NodeChunk> {
  for (const layer of layers) {
    if (!includeDeleted && layer.deletedNodes.has(key)) {
      // When a node is deleted in some layer - it is treated as deleted from lower layers too
      break;
    }
    const operations = layer.operationsByNodes.get(key);
    for (const operation of operations ?? EMPTY_ARRAY) {
      const tree = layer.trees.get(operation);
      if (!tree) {
        continue;
      }
      const chunks = tree.nodes.get(key) ?? EMPTY_ARRAY;
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
  dirtyNodes?: DirtyNodeMap,
  coveringIds?: Set<OperationId>,
): NodeChunk | undefined {
  if (typeof ref !== "string") {
    return undefined; // TODO?
  }
  if (dirtyNodes && isDirtyNode(ref, selection, dirtyNodes)) {
    return undefined;
  }
  for (const layer of layers) {
    if (!includeDeleted && layer.deletedNodes.has(ref)) {
      // When a node is deleted in some layer - it is treated as deleted from lower layers too
      return undefined;
    }
    const opsWithNode = layer.operationsByNodes.get(ref);
    const totalTreesWithNode = opsWithNode?.size ?? 0;
    if (totalTreesWithNode === 0) {
      // Can safely move to lower level
      continue;
    }
    const tree = layer.trees.get(operation.id);
    let checkedInLayer = tree ? 1 : 0;
    for (const chunk of tree?.nodes.get(ref) ?? EMPTY_ARRAY) {
      if (resolvedSelectionsAreEqual(chunk.selection, selection)) {
        return chunk;
      }
    }
    // Check covering operations' trees for recyclable chunks
    if (coveringIds) {
      for (const coverId of coveringIds) {
        if (coverId === operation.id) continue;
        if (!opsWithNode?.has(coverId)) continue;
        const coverTree = layer.trees.get(coverId);
        if (!coverTree) continue;
        checkedInLayer++;
        for (const chunk of coverTree.nodes.get(ref) ?? EMPTY_ARRAY) {
          if (resolvedSelectionsAreEqual(chunk.selection, selection)) {
            return chunk;
          }
        }
      }
    }
    if (tree?.incompleteChunks.size) {
      // Cannot recycle chunks from lower layers when there is missing data in this layer.
      //   This "missing data" may be present in this layer in sibling chunks.
      //   If we move to lower layers - we may accidentally skip the actual data in this layer.
      return undefined;
    }
    if (totalTreesWithNode - checkedInLayer > 0) {
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

function isDirtyNode(
  nodeKey: NodeKey,
  selection: ResolvedSelection,
  dirtyNodes: DirtyNodeMap,
) {
  const dirtyFields = dirtyNodes.get(nodeKey);
  if (!dirtyFields) {
    return false;
  }
  if (dirtyFields.size === 0) {
    return true;
  }
  for (const fieldName of dirtyFields) {
    const aliases = selection.fields.get(fieldName);
    if (
      aliases?.length &&
      aliases.some((alias) => !selection.skippedFields?.has(alias))
    ) {
      return true;
    }
  }
  return false;
}

export const createParentLocator =
  (layers: IndexedForest[]): ParentLocator =>
  (chunk: ObjectChunk | CompositeListChunk) =>
    findParentInfo(layers, chunk);

export function createChunkMatcher(
  layers: IndexedForest[],
  includeDeleted = false,
  dirtyNodes?: DirtyNodeMap | undefined,
): ChunkMatcher {
  let coveringIds: Set<OperationId> | undefined;
  let coveringIdsComputed = false;
  return (
    ref: GraphValueReference,
    operation: OperationDescriptor,
    selection: ResolvedSelection,
  ) => {
    if (!coveringIdsComputed) {
      coveringIds = getCoveringOperationIds(layers, operation);
      coveringIdsComputed = true;
    }
    return findRecyclableChunk(
      layers,
      operation,
      ref,
      selection,
      includeDeleted,
      dirtyNodes,
      coveringIds,
    );
  };
}

function getCoveringOperationIds(
  layers: IndexedForest[],
  operation: OperationDescriptor,
): Set<OperationId> | undefined {
  const opName = operation.name;
  if (!opName && !operation.covers.length) return undefined;

  let ids: Set<OperationId> | undefined;

  for (const layer of layers) {
    // Forward: find ops that cover us via pre-built index
    if (opName) {
      const coveringIds = layer.operationsByCoveredName.get(opName);
      if (coveringIds) {
        for (const id of coveringIds) {
          if (id !== operation.id) {
            if (!ids) ids = new Set();
            ids.add(id);
          }
        }
      }
    }
    // Reverse: find ops that we cover (look up by name)
    for (const coveredName of operation.covers) {
      const coveredIds = layer.operationsByName.get(coveredName);
      if (coveredIds) {
        for (const id of coveredIds) {
          if (id !== operation.id) {
            if (!ids) ids = new Set();
            ids.add(id);
          }
        }
      }
    }
  }
  return ids;
}

export const createChunkProvider =
  (layers: IndexedForest[], includeDeleted = false): ChunkProvider =>
  (ref: GraphValueReference, typeName?: TypeName | false) =>
    getObjectChunksWithFieldIndex(layers, ref, includeDeleted, typeName);

function getObjectChunksWithFieldIndex(
  layers: IndexedForest[],
  ref: GraphValueReference,
  includeDeleted: boolean,
  typeName?: TypeName | false,
): Iterable<ObjectChunk> & { update?(fields: FieldInfo[]): void } {
  if (
    !typeName ||
    typeof ref !== "string" ||
    !layers[0]?.fieldIndex.has(typeName) // assuming fieldIndex is the same for all layers
  ) {
    return getObjectChunks(layers, ref, includeDeleted);
  }
  const nodeKey = ref;
  let relevantOps: Set<OperationId> | undefined;

  return {
    update(fields: FieldInfo[]) {
      relevantOps = undefined;
      for (const field of fields) {
        for (const layer of layers) {
          const ops = layer.fieldIndex.get(typeName)?.get(field.name);
          if (ops) {
            if (!relevantOps) relevantOps = new Set();
            for (const opId of ops) relevantOps.add(opId);
          }
        }
      }
    },
    *[Symbol.iterator]() {
      if (!relevantOps) {
        yield* getNodeChunks(layers, nodeKey, includeDeleted);
        return;
      }
      for (const layer of layers) {
        if (!includeDeleted && layer.deletedNodes.has(nodeKey)) break;
        for (const opId of relevantOps) {
          const tree = layer.trees.get(opId);
          if (!tree) continue;
          const chunks = tree.nodes.get(nodeKey);
          if (chunks) yield* chunks;
        }
      }
    },
  };
}
