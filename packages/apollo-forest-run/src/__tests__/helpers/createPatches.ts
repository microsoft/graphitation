import type { ObjectChunk, ParentLocator } from "../../values/types";
import type { ObjectDifference } from "../../diff/types";
import { ValueKind } from "../../values/types";
import { assert } from "../../jsutils/assert";
import {
  hasField,
  isAggregate,
  isComplexLeafValue,
  isCompositeListValue,
  isCompositeValue,
  isLeafListValue,
  isMissingValue,
  isObjectValue,
  getDataPathForDebugging,
  resolveFieldValue,
  resolveListItemChunk,
} from "../../values";
import { resolveFieldDataKey } from "../../descriptor/resolvedSelection";
import * as Difference from "../../diff/difference";

export type Path = (string | number)[];

type ReplaceOperation = {
  op: "replace";
  value: unknown;
  basePath: Path;
  path: Path;
};

type FillOperation = {
  op: "fill";
  value: unknown;
  basePath: Path;
  path: Path;
};

type AlterListOperation = {
  op: "alterListLayout";
  value: (null | number | object)[];
  basePath: Path;
  path: Path;
};

type PatchEnv = {
  findParent: ParentLocator;
};

export type Patch = ReplaceOperation | FillOperation | AlterListOperation;

export function createPatches(
  env: PatchEnv,
  obj: ObjectChunk,
  difference?: ObjectDifference,
): Patch[] {
  return createPatchesImpl(env, obj, difference);
}

function createPatchesImpl(
  env: PatchEnv,
  obj: ObjectChunk,
  difference?: ObjectDifference,
  patches: Patch[] = [],
  parentPath: Path = [],
): Patch[] {
  if (!difference?.dirtyFields?.size) {
    return [];
  }
  for (const fieldName of difference.dirtyFields) {
    if (!hasField(obj, fieldName)) {
      continue;
    }
    const fieldDifference = difference.fieldState?.get(fieldName);
    if (!fieldDifference) {
      continue;
    }
    const allDiff = Array.isArray(fieldDifference)
      ? fieldDifference
      : [fieldDifference];

    for (const fieldDiff of allDiff) {
      const dataKey = resolveFieldDataKey(
        obj.selection.fields,
        fieldDiff.fieldEntry,
        obj.operation.variablesWithDefaults,
      );
      if (!dataKey) {
        continue;
      }
      const path = parentPath.concat([dataKey]);

      if (
        Difference.isReplacement(fieldDiff.state) ||
        Difference.isFiller(fieldDiff.state)
      ) {
        const newValue = fieldDiff.state.newValue;
        const patch = {
          op: Difference.isFiller(fieldDiff.state)
            ? ("fill" as const)
            : ("replace" as const),
          value:
            isCompositeValue(newValue) || isComplexLeafValue(newValue)
              ? newValue.data
              : newValue,
          basePath: getDataPathForDebugging(env, obj),
          path,
        };
        patches.push(patch);
        continue;
      }
      const value = resolveFieldValue(obj, fieldDiff.fieldEntry);
      if (value === undefined || isMissingValue(value)) {
        continue;
      }

      if (Difference.isObjectDifference(fieldDiff.state)) {
        assert(value && isObjectValue(value));
        const chunks = isAggregate(value) ? value.chunks : [value];
        for (const chunk of chunks) {
          createPatchesImpl(env, chunk, fieldDiff.state, patches, path);
        }
        continue;
      }
      if (Difference.isCompositeListDifference(fieldDiff.state)) {
        assert(value && isCompositeListValue(value));

        for (const index of fieldDiff.state.dirtyItems ?? []) {
          const itemPath = path.concat(index);
          const itemDiff = fieldDiff.state.itemState.get(index);
          if (Difference.isObjectDifference(itemDiff)) {
            const chunks = isAggregate(value) ? value.chunks : [value];
            for (const chunk of chunks) {
              const itemChunk = resolveListItemChunk(chunk, index);
              assert(itemChunk.kind === ValueKind.Object);
              createPatchesImpl(env, itemChunk, itemDiff, patches, itemPath);
            }
            continue;
          }
          if (Difference.isReplacement(itemDiff)) {
            const newValue = itemDiff.newValue;
            const patch = {
              op: "replace" as const,
              value:
                isCompositeValue(newValue) || isLeafListValue(newValue)
                  ? newValue.data
                  : newValue,
              basePath: getDataPathForDebugging(env, obj),
              path: itemPath,
            };
            patches.push(patch);
          }
        }

        if (!fieldDiff.state.layout) {
          continue;
        }
        patches.push({
          op: "alterListLayout",
          value: fieldDiff.state.layout.map((item) =>
            typeof item === "object" && null !== item ? item?.data : item,
          ),
          basePath: getDataPathForDebugging(env, obj),
          path,
        });
        // Handle structural changes
        // const newLen = fieldDiff.state.layout.length;
        // for (let i = 0; i < newLen; i++) {
        //   const layoutItem = fieldDiff.state.layout[i];
        //   if (typeof layoutItem === "object" && layoutItem !== null) {
        //     const newValue = layoutItem;
        //     const patch = {
        //       op: "add" as const,
        //       value:
        //         Aggregate.isCompositeValue(newValue) ||
        //         Aggregate.isLeafList(newValue)
        //           ? newValue.firstValue
        //           : newValue,
        //       basePath: obj.dataPath ? flattenPath(obj.dataPath) : emptyArray,
        //       path: path.concat(i),
        //     };
        //     patches.push(patch);
        //   }
        // }
        // const oldLen = value.firstValue.length;
        // for (let i = newLen; i < oldLen; i++) {
        //   const patch = {
        //     op: "remove" as const,
        //     basePath: obj.dataPath ? flattenPath(obj.dataPath) : emptyArray,
        //     path: path.concat(i),
        //   };
        //   patches.push(patch);
        // }
      }
    }
  }
  return patches;
}
