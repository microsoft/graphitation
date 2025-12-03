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
  ValueDifference,
} from "../diff/types";
import { createParentLocator, getDataPathForDebugging } from "./traverse";
import {
  CompositeListChunk,
  MissingFieldsSerialized,
  ObjectChunk,
  SourceCompositeList,
} from "./types";
import { isCompositeListEntryTuple } from "./predicates";

import * as ChangeKind from "../diff/itemChangeKind";
import * as DifferenceKind from "../diff/differenceKind";
import { OPERATION_HISTORY_SYMBOL } from "../descriptor/operation";
import { getSourceValue } from "../forest/updateObject";

function stripDataFromKeys(keys: (string | number)[]): (string | number)[] {
  return keys.map((segment) => {
    if (typeof segment === "string") {
      const [typeName] = segment.split(":", 1);
      return typeName;
    }
    return segment;
  });
}
function stripDataFromMissingFields(missingFields: MissingFieldsSerialized) {
  return missingFields.map((mf) => {
    return {
      fields: mf.fields.map(({ name, alias }) => ({
        name,
        alias,
      })),
    };
  });
}

function getChunkPath(
  currentTree: IndexedTree,
  chunk: CompositeListChunk | ObjectChunk,
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
  enableRichHistory = false,
): { itemChanges: CompositeListLayoutChange[]; previousLength: number } {
  const itemChanges: CompositeListLayoutChange[] = [];
  let maxOldIndex = -1;

  for (let index = 0; index < layout.length; index++) {
    const layoutValue = layout[index];

    if (typeof layoutValue === "number") {
      maxOldIndex = Math.max(maxOldIndex, layoutValue);
      if (layoutValue !== index) {
        itemChanges.push({
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
      itemChanges.push({
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
      maxOldIndex = Math.max(maxOldIndex, index);
      itemChanges.push({
        kind: ChangeKind.ItemRemove,
        oldIndex: index,
        data: enableRichHistory ? oldData[index] : undefined,
      });
    }
  }

  return { itemChanges, previousLength: maxOldIndex + 1 };
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
      const { itemChanges, previousLength } = extractArrayChanges(
        layout ?? [],
        chunk.data,
        fieldChanges.deletedKeys,
        env.historyConfig?.enableRichHistory ?? false,
      );
      changes.push({
        path: chunkPath,
        kind: fieldChanges.kind,
        itemChanges,
        previousLength,
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

function processValueDifference(
  basePath: (string | number)[],
  valueDiff: ValueDifference,
  changes: HistoryFieldChange[],
) {
  switch (valueDiff.kind) {
    case DifferenceKind.Replacement:
      changes.push({
        path: basePath,
        kind: valueDiff.kind,
        oldValue: getSourceValue(valueDiff.oldValue),
        newValue: getSourceValue(valueDiff.newValue),
      });
      break;

    case DifferenceKind.Filler:
      changes.push({
        path: basePath,
        kind: valueDiff.kind,
        newValue: getSourceValue(valueDiff.newValue),
      });
      break;

    case DifferenceKind.ObjectDifference:
      for (const [nestedFieldName, nestedFieldDiff] of valueDiff.fieldState) {
        const nestedFieldDiffs = Array.isArray(nestedFieldDiff)
          ? nestedFieldDiff
          : [nestedFieldDiff];

        for (const nestedFieldEntry of nestedFieldDiffs) {
          processValueDifference(
            [...basePath, nestedFieldName],
            nestedFieldEntry.state,
            changes,
          );
        }
      }
      break;

    case DifferenceKind.CompositeListDifference: {
      const { itemChanges, previousLength } = extractArrayChanges(
        valueDiff.layout ?? [],
        [],
        valueDiff.deletedKeys,
      );

      changes.push({
        path: basePath,
        kind: DifferenceKind.CompositeListDifference,
        itemChanges,
        previousLength,
        currentLength: valueDiff.layout?.length ?? 0,
      });
      break;
    }
  }
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
        if (fields.size > 0) {
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
      }

      return {
        ...entry,
        missingFields,
      };
    } else {
      const changes: HistoryFieldChange[] = [];

      if (entry.nodeDiffs) {
        for (const [nodeKey, diff] of entry.nodeDiffs) {
          for (const [fieldName, fieldDiff] of diff.fieldState) {
            const fieldDiffs = Array.isArray(fieldDiff)
              ? fieldDiff
              : [fieldDiff];

            for (const fieldEntry of fieldDiffs) {
              processValueDifference(
                [nodeKey, fieldName],
                fieldEntry.state,
                changes,
              );
            }
          }
        }
      }

      return {
        kind: entry.kind,
        updatedNodes: entry.updatedNodes,
        changes,
        timestamp: entry.timestamp,
        modifyingOperation: entry.modifyingOperation,
        data: entry.data,
      };
    }
  });
}

export function stripDataFromHistory(history: HistoryChangeSerialized[]) {
  return history.map((entry) => {
    const { data: _data, ...entryRest } = entry;
    const cleanModifyingOperation = {
      name: entry.modifyingOperation?.name,
    };

    const cleanChanges = entry.changes.map((change) => {
      const path = stripDataFromKeys(change.path);
      switch (change.kind) {
        case DifferenceKind.Replacement: {
          const {
            oldValue: _oldValue,
            newValue: _newValue,
            ...changeRest
          } = change;
          return {
            ...changeRest,
            path,
          };
        }
        case DifferenceKind.Filler: {
          const { newValue: _newValue, ...changeRest } = change;
          return {
            ...changeRest,
            path,
          };
        }
        case DifferenceKind.CompositeListDifference:
          return {
            ...change,
            path,
            itemChanges: change.itemChanges.map((itemChange) => {
              const { data: _data, ...itemRest } = itemChange;
              return itemRest;
            }),
          };
      }
    });

    if (entry.kind === "Regular") {
      return {
        ...entryRest,
        modifyingOperation: cleanModifyingOperation,
        changes: cleanChanges,
        missingFields: stripDataFromMissingFields(entry.missingFields),
      };
    }

    return {
      ...entryRest,
      modifyingOperation: cleanModifyingOperation,
      changes: cleanChanges,
      updatedNodes: stripDataFromKeys(entry.updatedNodes),
    };
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
