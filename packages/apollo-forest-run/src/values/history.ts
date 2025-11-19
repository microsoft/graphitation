import type {
  HistoryChange,
  IndexedTree,
  UpdateTreeResult,
  HistoryFieldChange,
  ForestEnv,
  ChangedChunksTuple,
} from "../forest/types";
import type {
  CompositeListLayoutChange,
  CompositeListLayoutDifference,
  NodeDifferenceMap,
} from "../diff/types";
import { createParentLocator, getDataPathForDebugging } from "./traverse";
import { SourceCompositeList } from "./types";
import * as ChangeKind from "../diff/itemChangeKind";
import { isCompositeListEntryTuple } from "./predicates";

function getChunkPath(
  currentTree: IndexedTree,
  chunk: any,
  enableRichHistory: boolean,
): (string | number)[] {
  if (!enableRichHistory) {
    return ["Enable enableRichHistory for full path"];
  }
  const findParent = createParentLocator(currentTree.dataMap);
  return getDataPathForDebugging({ findParent }, chunk);
}

function extractArrayChanges(
  layout: CompositeListLayoutDifference,
  oldData: SourceCompositeList,
  deletedKeys: Set<number> | undefined,
  env: ForestEnv,
): CompositeListLayoutChange[] {
  const enableRichHistory = env.historyConfig?.enableRichHistory ?? false;
  const changes: CompositeListLayoutChange[] = [];
  for (let index = 0; index < layout.length; index++) {
    const layoutValue = layout[index];

    if (typeof layoutValue === "number") {
      if (layoutValue !== index) {
        changes.push({
          kind: ChangeKind.ItemIndexChange,
          index,
          oldIndex: layoutValue,
          data: enableRichHistory ? oldData[layoutValue] : undefined,
        });
      }
      // Value was null and remains null, no change
    } else if (layoutValue === null && oldData[index] === null) {
      continue;
    } else {
      changes.push({
        kind: ChangeKind.ItemAdd,
        index,
        data: enableRichHistory
          ? layoutValue
            ? layoutValue.data
            : null
          : undefined,
      });
    }
  }

  if (deletedKeys) {
    for (const deletedKey of deletedKeys) {
      const index = deletedKey;
      changes.push({
        kind: ChangeKind.ItemRemove,
        oldIndex: index,
        data: enableRichHistory ? oldData[index] : undefined,
      });
    }
  }

  return changes;
}

function getChanges(
  currentTree: IndexedTree,
  updatedTree: UpdateTreeResult,
  env: ForestEnv,
): HistoryFieldChange[] {
  const changes: HistoryFieldChange[] = [];
  for (const entry of updatedTree.changes) {
    const tuple = entry as ChangedChunksTuple;
    const chunkPath = getChunkPath(
      currentTree,
      entry[0],
      env.historyConfig?.enableRichHistory ?? false,
    );

    if (isCompositeListEntryTuple(tuple)) {
      const [chunk, fieldChanges] = tuple;
      const layout = fieldChanges.layout;
      const itemChanges = extractArrayChanges(
        layout ?? [],
        chunk.data,
        fieldChanges.deletedKeys,
        env,
      );
      changes.push({
        path: chunkPath,
        kind: fieldChanges.kind,
        itemChanges,
        previousLength: chunk.data.length,
        currentLength: layout?.length ?? 0,
      });
    } else {
      const [_chunk, fieldChanges] = tuple;
      for (const fieldChange of fieldChanges) {
        const { fieldInfo, ...restOfFieldChange } = fieldChange;
        changes.push({
          path: [...chunkPath, fieldInfo.dataKey],
          ...restOfFieldChange,
        });
      }
    }
  }

  return changes;
}

export function createRegularHistoryEntry(
  currentTree: IndexedTree,
  updatedTree: UpdateTreeResult,
  incomingTree: IndexedTree | undefined,
  env: ForestEnv,
): HistoryChange {
  const changes = getChanges(currentTree, updatedTree, env);
  return {
    kind: "Regular",
    missingFields: updatedTree.missingFields,
    changes,
    timestamp: Date.now(),
    modifyingOperation: {
      name: incomingTree?.operation?.debugName ?? "Anonymous Operation",
      variables: incomingTree?.operation?.variables || {},
    },
    data: env.historyConfig?.enableRichHistory
      ? {
          current: currentTree.result,
          incoming: incomingTree?.result,
          updated: updatedTree.updatedTree.result,
        }
      : undefined,
  };
}

export function createOptimisticHistoryEntry(
  currentTree: IndexedTree,
  nodeDiffs: NodeDifferenceMap,
  incomingTree: IndexedTree | undefined,
  updatedNodes: string[],
  env: ForestEnv,
): HistoryChange {
  return {
    kind: "Optimistic",
    nodeDiffs: env.historyConfig?.enableRichHistory ? nodeDiffs : undefined,
    updatedNodes,
    timestamp: Date.now(),
    modifyingOperation: {
      name: incomingTree?.operation?.debugName ?? "Anonymous Operation",
      variables: incomingTree?.operation?.variables || {},
    },
    data: env.historyConfig?.enableRichHistory
      ? {
          current: currentTree.result,
          incoming: incomingTree?.result,
          updated: undefined,
        }
      : undefined,
  };
}
