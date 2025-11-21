import type {
  HistoryChange,
  IndexedTree,
  UpdateTreeResult,
  HistoryFieldChange,
  ForestEnv,
  ChangedChunksTuple,
  HistoryChangeSerialized,
} from "../forest/types";
import type {
  CompositeListLayoutChange,
  CompositeListLayoutDifference,
  NodeDifferenceMap,
  SerializedNodeDifference,
} from "../diff/types";
import { createParentLocator, getDataPathForDebugging } from "./traverse";
import { MissingFieldsSerialized, SourceCompositeList } from "./types";
import { isCompositeListEntryTuple } from "./predicates";

import * as ChangeKind from "../diff/itemChangeKind";
import * as DifferenceKind from "../diff/differenceKind";
import { OPERATION_HISTORY_SYMBOL } from "../descriptor/operation";

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
    nodeDiffs,
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

export function serializeHistory(
  history: HistoryChange[],
): HistoryChangeSerialized[] {
  return history.map((entry) => {
    if (entry.kind === "Regular") {
      const missingFields: MissingFieldsSerialized = [];
      for (const [object, fields] of entry.missingFields) {
        missingFields.push({
          object,
          fields: Array.from(fields).map((field) => {
            const {
              __refs,
              selection: _selection,
              watchBoundaries: _watchBoundaries,
              ...rest
            } = field;
            return rest;
          }),
        });
      }

      return {
        ...entry,
        missingFields,
      };
    } else {
      const nodeDiffs: SerializedNodeDifference[] = [];
      if (entry.nodeDiffs) {
        for (const [nodeKey, diff] of entry.nodeDiffs) {
          const { fieldState, fieldQueue, dirtyFields, ...restDiff } = diff;
          const serializedDiff = {
            ...restDiff,
            fieldState: Array.from(fieldState.entries()).map(
              ([key, value]) => ({
                key,
                value,
              }),
            ),
            fieldQueue: Array.from(fieldQueue),
            dirtyFields: dirtyFields ? Array.from(dirtyFields) : undefined,
          };
          nodeDiffs.push({ nodeKey, diff: serializedDiff });
        }
      }

      return {
        ...entry,
        nodeDiffs,
      };
    }
  });
}

export function stripDataFromHistory(history: HistoryChangeSerialized[]) {
  return history.map((entry) => {
    const { data: _data, ...entryRest } = entry;

    if (entry.kind === "Regular") {
      return {
        ...entryRest,
        changes: entry.changes.map((change) => {
          switch (change.kind) {
            case DifferenceKind.Replacement: {
              const {
                oldValue: _oldValue,
                newValue: _newValue,
                ...changeRest
              } = change;
              return changeRest;
            }
            case DifferenceKind.Filler: {
              const { newValue: _newValue, ...changeRest } = change;
              return changeRest;
            }
            case DifferenceKind.CompositeListDifference:
              return {
                ...change,
                itemChanges: change.itemChanges.map((itemChange) => {
                  const { data: _data, ...itemRest } = itemChange;
                  return itemRest;
                }),
              };
          }
        }),
      };
    } else {
      const nodeDiffs = [];

      if (entry.nodeDiffs) {
        for (const item of entry.nodeDiffs) {
          const { nodeKey, diff } = item;
          const { kind, dirtyFields, errors } = diff;
          nodeDiffs.push({ nodeKey, diff: { kind, dirtyFields, errors } });
        }
      }

      return {
        ...entryRest,
        nodeDiffs,
      };
    }
  });
}

export function appendHistoryToData(tree: IndexedTree): void {
  Object.defineProperty(tree.result.data, OPERATION_HISTORY_SYMBOL, {
    get() {
      const history = serializeHistory(Array.from(tree.history));
      const historyObj = {
        totalEntries: tree.history.totalEntries,
        history,
      };

      Object.defineProperty(historyObj, "historyWithoutData", {
        get() {
          return stripDataFromHistory(history);
        },
        enumerable: false,
      });

      return historyObj;
    },
    enumerable: false,
  });
}
