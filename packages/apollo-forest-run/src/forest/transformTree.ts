import type {
  FieldInfo,
  FieldName,
  NodeKey,
  TypeName,
} from "../descriptor/types";
import type {
  CompositeListChunk,
  GraphChunk,
  NodeChunk,
  ObjectChunk,
  ParentLocator,
} from "../values/types";
import type {
  CompositeListDifference,
  NodeDifferenceMap,
  ObjectDifference,
  ValueDifference,
} from "../diff/types";
import type { IndexedTree, ForestEnv } from "./types";
import * as Difference from "../diff/difference";
import { resolveNormalizedField } from "../descriptor/resolvedSelection";
import { updateTree } from "./updateTree";
import {
  createParentLocator,
  descendToChunk,
  findClosestNode,
  isCompositeListValue,
  isObjectValue,
  resolveFieldAliases,
  resolveFieldChunk,
} from "../values";
import { assert, assertNever } from "../jsutils/assert";

export type ChunkFilter = {
  types?: Iterable<TypeName>;
  // OR
  nodes?: Iterable<NodeKey>;
};

export type Transformer = {
  transform?(
    chunk: ObjectChunk,
    currentDifference: ObjectDifference | undefined,
  ): ObjectDifference | undefined;

  getFieldQueue(
    chunk: ObjectChunk,
    currentDifference: ObjectDifference | undefined,
  ): Iterable<FieldName>;

  transformField(
    parent: ObjectChunk,
    field: FieldInfo,
    fieldValue: GraphChunk,
    fieldValueDifference: ValueDifference | undefined,
  ): ValueDifference | undefined;
};

const enum DirtyState {
  Clean,
  Dirty,
  StructureChanged,
}

type TreeState = {
  dirty: DirtyState;
  nodeDifference: NodeDifferenceMap;
  intermediateTree: IndexedTree;
  findParent: ParentLocator;
};

const EMPTY_ARRAY = Object.freeze([]);

/**
 * Transforms a tree using custom transformers. Returns the same (===) tree when there were no actual changes,
 * returns updated tree otherwise. Doesn't mutate the original tree.
 *
 * Breadth-first algorithm where transformers are applied level by level with two possible modes:
 *
 *   "DESCEND" mode:
 *      Starts from the root level chunk and applies transforms to nested chunks level-by-level.
 *      Output of the preceding transformation becomes input to the nested transformations.
 *      In case of conflict deeper transformation wins.
 *      (edit on ENTER)
 *   "ASCEND" mode:
 *      Starts from the bottom level and moves upwards. In case of conflict parent transformation wins.
 *      (edit on LEAVE)
 *
 * Notes:
 * - This function exploits indexed nature of the tree and doesn't actually traverse all nodes.
 * - In "DESCEND" mode tree may undergo multiple updates if transformation affects tree structure
 *   (add/remove list items, change union type members, change field values to null, etc.)
 */
export function transformTree(
  env: ForestEnv,
  tree: IndexedTree,
  direction: "ASCEND" | "DESCEND",
  chunkFilter: ChunkFilter,
  transformer: Transformer,
): IndexedTree {
  const treeState: TreeState = {
    dirty: DirtyState.Clean,
    nodeDifference: new Map(),
    intermediateTree: tree,
    findParent: createParentLocator(tree.dataMap),
  };
  let level = 0; // For "DESCEND" mode level 0 points to root chunk. For "ASCEND" mode - to the deepest chunks
  let chunks = collectChunks(tree, direction, chunkFilter);
  let chunkQueue = resolveLevelChunks(chunks, level);

  while (chunkQueue.length) {
    // First, apply object-level transforms
    if (transformer.transform) {
      for (const chunk of chunkQueue) {
        transformChunk(env, treeState, chunk, transformer);
      }
      if (
        treeState.dirty === DirtyState.StructureChanged &&
        direction === "DESCEND"
      ) {
        const newTree = updateTreeStructure(env, treeState);
        chunks = collectChunks(newTree, direction, chunkFilter);
        chunkQueue = resolveLevelChunks(chunks, level); // enter new chunks at the same level for field transforms
      }
      if (!chunkQueue.length) {
        break;
      }
    }
    // Next, apply field transforms
    for (const chunk of chunkQueue) {
      transformChunkFields(env, treeState, chunk, transformer);
    }
    if (
      treeState.dirty === DirtyState.StructureChanged &&
      direction === "DESCEND"
    ) {
      const newTree = updateTreeStructure(env, treeState);
      chunks = collectChunks(newTree, direction, chunkFilter);
    }
    level = chunkQueue[0].selection.depth + 1;
    chunkQueue = resolveLevelChunks(chunks, level);
  }
  return treeState.dirty !== DirtyState.Clean
    ? updateTree(treeState.intermediateTree, treeState.nodeDifference, env)
        .updatedTree
    : treeState.intermediateTree;
}

function transformChunk(
  env: ForestEnv,
  treeState: TreeState,
  chunk: ObjectChunk,
  transformer: Transformer,
) {
  assert(transformer.transform);

  const parentNode = findClosestNode(chunk, treeState.findParent);
  const difference = transformer.transform(
    chunk,
    getDifference(treeState, parentNode, chunk),
  );
  if (!difference) {
    return;
  }
  addDifference(treeState, parentNode, chunk, difference);
  markTreeDirty(treeState, difference);
}

function transformChunkFields(
  env: ForestEnv,
  treeState: TreeState,
  chunk: ObjectChunk,
  transformer: Transformer,
) {
  const parentNode = findClosestNode(chunk, treeState.findParent);

  let chunkDiff = getDifference(treeState, parentNode, chunk);
  const fieldQueue = transformer.getFieldQueue(chunk, chunkDiff);

  for (const fieldName of fieldQueue) {
    const aliases = resolveFieldAliases(chunk, fieldName);

    for (const fieldInfo of aliases ?? EMPTY_ARRAY) {
      const normalizedField = resolveNormalizedField(
        chunk.selection,
        fieldInfo,
      );
      const fieldDifference = Difference.getFieldDifference(
        chunkDiff,
        normalizedField,
      );
      const valueDifference = transformer.transformField(
        chunk,
        fieldInfo,
        resolveFieldChunk(chunk, fieldInfo),
        fieldDifference?.state,
      );
      if (valueDifference && Difference.isDirty(valueDifference)) {
        chunkDiff ??= addDifference(
          treeState,
          parentNode,
          chunk,
          Difference.createObjectDifference(),
        );
        if (!fieldDifference) {
          Difference.addFieldDifference(
            chunkDiff,
            normalizedField,
            valueDifference,
          );
        }
        Difference.addDirtyField(chunkDiff, normalizedField);
        markParentNodeDirty(treeState, parentNode, chunk);
        markTreeDirty(treeState, valueDifference);
      }
    }
  }
}

function markTreeDirty(
  state: TreeState,
  difference: ValueDifference | undefined,
) {
  if (Difference.hasStructuralChanges(difference)) {
    state.dirty = DirtyState.StructureChanged;
  } else if (difference && Difference.isDirty(difference)) {
    state.dirty = DirtyState.Dirty;
  }
}

function updateTreeStructure(env: ForestEnv, state: TreeState) {
  // Intermediate update of the tree structure
  //   We can skip intermediate updates in ASCEND mode because output of transformation doesn't change
  //   which chunks are visited during transformation.
  //   This is the same logic as returning changed values in visitor on "ENTER" vs. "LEAVE".
  const { updatedTree: newTree } = updateTree(
    state.intermediateTree,
    state.nodeDifference,
    env,
  );
  state.intermediateTree = newTree;
  state.dirty = DirtyState.Clean;
  state.nodeDifference.clear();
  state.findParent = createParentLocator(newTree.dataMap);

  return newTree;
}

function collectChunks(
  tree: IndexedTree,
  direction: "ASCEND" | "DESCEND",
  filter: ChunkFilter,
) {
  if (!filter.types && !filter.nodes) {
    const chunks: ObjectChunk[] = [];
    for (const nodeChunks of tree.nodes.values()) {
      chunks.push(...nodeChunks);
    }
    return chunks;
  }

  const typeSet = new Set(filter.types);

  const chunks: ObjectChunk[] = [];
  for (const typeName of typeSet) {
    chunks.push(...(tree.typeMap.get(typeName) ?? EMPTY_ARRAY));
  }
  const nodes = filter.nodes ?? tree.nodes.keys();
  for (const nodeKey of nodes) {
    for (const chunk of tree.nodes.get(nodeKey) ?? EMPTY_ARRAY) {
      if (!typeSet.has(chunk.type as string)) {
        // Chunks for this type were already added
        chunks.push(chunk);
      }
    }
  }
  return direction === "ASCEND"
    ? chunks.sort((a, b) => b.selection.depth - a.selection.depth)
    : chunks.sort((a, b) => a.selection.depth - b.selection.depth);
}

function resolveLevelChunks(
  chunksSortedByLevel: ObjectChunk[],
  level: number,
): ObjectChunk[] {
  const chunkQueue: ObjectChunk[] = [];
  let stopDepth = -1;
  for (const chunk of chunksSortedByLevel) {
    const depth = chunk.selection.depth;
    if (depth < level) {
      continue;
    }
    if (stopDepth === -1) {
      stopDepth = depth;
    }
    if (depth > stopDepth) {
      break;
    }
    chunkQueue.push(chunk);
  }
  return chunkQueue;
}

function getDifference(
  treeState: TreeState,
  parentNode: NodeChunk,
  chunk: ObjectChunk,
): ObjectDifference | undefined {
  const nodeDiff = treeState.nodeDifference.get(parentNode.key);
  return chunk === parentNode
    ? nodeDiff
    : getEmbeddedChunkDifference(treeState, chunk, parentNode, nodeDiff);
}

function addDifference(
  treeState: TreeState,
  parentNode: NodeChunk,
  chunk: ObjectChunk,
  chunkDifference: ObjectDifference,
): ObjectDifference {
  const { nodeDifference } = treeState;
  let nodeDiff = nodeDifference.get(parentNode.key);
  if (chunk === parentNode) {
    assert(!nodeDiff || nodeDiff === chunkDifference);
    nodeDifference.set(parentNode.key, chunkDifference);
    return chunkDifference;
  }
  if (!nodeDiff) {
    nodeDiff = Difference.createObjectDifference();
    nodeDifference.set(parentNode.key, nodeDiff);
  }
  addEmbeddedChunkDifference(
    treeState,
    parentNode,
    nodeDiff,
    chunk,
    chunkDifference,
  );
  return chunkDifference;
}

function getEmbeddedChunkDifference(
  treeState: TreeState,
  chunk: ObjectChunk,
  parentNode: NodeChunk,
  parentNodeDifference: ObjectDifference | undefined,
): ObjectDifference | undefined {
  if (!parentNodeDifference) {
    return undefined;
  }
  let parentDifference: ValueDifference | undefined = parentNodeDifference;
  let valueDifference: ValueDifference | undefined = parentDifference;

  descendToChunk(treeState, parentNode, chunk, (value, parent, step) => {
    if (!parentDifference) {
      return;
    }
    if (isObjectValue(parent)) {
      assert(
        typeof step !== "number" &&
          Difference.isObjectDifference(parentDifference),
      );
      const field = resolveNormalizedField(parent.selection, step);
      const fieldDifference = Difference.getFieldDifference(
        parentDifference,
        field,
      );
      valueDifference = fieldDifference?.state;
    } else {
      assert(
        typeof step === "number" &&
          Difference.isCompositeListDifference(parentDifference),
      );
      valueDifference = Difference.getListItemDifference(
        parentDifference,
        step,
      );
    }
    if (valueDifference === undefined) {
      parentDifference = undefined;
      return;
    }
    assert(
      Difference.isObjectDifference(valueDifference) ||
        Difference.isCompositeListDifference(valueDifference),
    );
    parentDifference = valueDifference;
  });
  return valueDifference;
}

function addEmbeddedChunkDifference(
  treeState: TreeState,
  parentNode: NodeChunk,
  parentNodeDifference: ObjectDifference,
  chunk: ObjectChunk,
  chunkDifference: ObjectDifference,
): ObjectDifference {
  let parentDiff: ValueDifference = parentNodeDifference;
  let valueDifference: ValueDifference = parentDiff;

  descendToChunk(treeState, parentNode, chunk, (value, parent, step) => {
    assert(isCompositeListValue(value) || isObjectValue(value));
    if (isObjectValue(parent)) {
      assert(
        typeof step !== "number" && Difference.isObjectDifference(parentDiff),
      );
      const field = resolveNormalizedField(parent.selection, step);
      const fieldDifference =
        Difference.getFieldDifference(parentDiff, field) ??
        Difference.addFieldDifference(
          parentDiff,
          field,
          value === chunk ? chunkDifference : createValueDifference(value),
        );
      valueDifference = fieldDifference.state;
    } else {
      assert(
        typeof step === "number" &&
          Difference.isCompositeListDifference(parentDiff),
      );
      valueDifference =
        Difference.getListItemDifference(parentDiff, step) ??
        Difference.addListItemDifference(
          parentDiff,
          step,
          value === chunk ? chunkDifference : createValueDifference(value),
        );
    }
    assert(
      Difference.isObjectDifference(valueDifference) ||
        Difference.isCompositeListDifference(valueDifference),
    );
    parentDiff = valueDifference;
  });
  assert(valueDifference === chunkDifference);
  return valueDifference;
}

function markParentNodeDirty(
  treeState: TreeState,
  parentNode: NodeChunk,
  chunk: ObjectChunk,
) {
  const parentNodeDifference = treeState.nodeDifference.get(parentNode.key);
  assert(parentNodeDifference);

  let parentDifference: ValueDifference | undefined = parentNodeDifference;
  descendToChunk(treeState, parentNode, chunk, (value, parent, step) => {
    if (isObjectValue(parent)) {
      assert(
        typeof step !== "number" &&
          Difference.isObjectDifference(parentDifference),
      );
      const field = resolveNormalizedField(parent.selection, step);
      Difference.addDirtyField(parentDifference, field);
      parentDifference = Difference.getFieldDifference(
        parentDifference,
        field,
      )?.state;
    } else {
      assert(
        typeof step === "number" &&
          Difference.isCompositeListDifference(parentDifference),
      );
      Difference.addDirtyListItem(parentDifference, step);
      parentDifference = Difference.getListItemDifference(
        parentDifference,
        step,
      );
    }
  });
}

function createValueDifference(
  chunk: ObjectChunk | CompositeListChunk,
): ObjectDifference | CompositeListDifference {
  if (isObjectValue(chunk)) {
    return Difference.createObjectDifference();
  }
  if (isCompositeListValue(chunk)) {
    return Difference.createCompositeListDifference();
  }
  assertNever(chunk);
}
