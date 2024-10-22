import { assertNever } from "../jsutils/assert";
import { FieldInfo } from "../descriptor/types";
import {
  CompositeListChunk,
  ObjectChunk,
  GraphChunkReference,
  CompositeValueChunkReference,
} from "./types";
import {
  isDeletedValue,
  isParentListRef,
  isParentObjectRef,
  isRootRef,
} from "./predicates";
import { createCompositeUndefinedChunk } from "./create";
import { resolveFieldChunk } from "./resolve";
import { TraverseEnv } from "./traverse";

export function markAsPartial(
  env: TraverseEnv,
  ref: GraphChunkReference | null,
) {
  if (!ref || isRootRef(ref)) {
    return;
  }
  if (isParentObjectRef(ref)) {
    const { parent, field } = ref;
    if (parent.partialFields?.has(field)) {
      return;
    }
    parent.partialFields ??= new Set();
    parent.partialFields.add(field);
    const parentRef = env.findParent(parent);
    markAsPartial(env, parentRef || null);
    return;
  }
  if (isParentListRef(ref)) {
    const { parent, index } = ref;
    if (parent.partialItems?.has(index)) {
      return;
    }
    parent.partialItems ??= new Set();
    parent.partialItems.add(index);
    const parentRef = env.findParent(parent);
    markAsPartial(env, parentRef || null);
    return;
  }
  assertNever(ref);
}

export function deleteField(
  env: TraverseEnv,
  chunk: ObjectChunk,
  fieldInfo: FieldInfo,
): boolean {
  const chunkRef = env.findParent(chunk);
  const hasField = chunk.selection.fields
    .get(fieldInfo.name)
    ?.some((field) => field === fieldInfo);

  if (!hasField || chunk.missingFields?.has(fieldInfo)) {
    return false;
  }
  // ApolloCompat: cache.modify allows to "delete" field values
  // TODO: remove DELETE support for cache modify and the whole "missing fields" / "missing items" notion
  //   instead we should always have all fields in place, but some of them should be marked as "stale" to
  //   indicate that they shouldn't be used for diffing and should be re-fetched from the server when possible
  chunk.missingFields ??= new Set();
  chunk.missingFields.add(fieldInfo);

  if (fieldInfo.selection) {
    const parentInfo: CompositeValueChunkReference = {
      value: createCompositeUndefinedChunk(
        chunk.operation,
        fieldInfo.selection,
        true,
      ),
      parent: chunk,
      field: fieldInfo,
    };
    chunk.fieldChunks.set(fieldInfo.dataKey, parentInfo);
  }
  markAsPartial(env, chunkRef);

  // Note: not mutating the source value on purpose, because it could be used by product code,
  //   instead just marking this value as "missing"
  // chunk.source[fieldInfo.dataKey] = undefined;
  return true;
}

export function deleteListItem(
  env: TraverseEnv,
  chunk: CompositeListChunk,
  index: number,
): boolean {
  if (index >= chunk.data.length || chunk.missingItems?.has(index)) {
    return false;
  }
  const chunkRef = env.findParent(chunk);

  chunk.missingItems ??= new Set();
  chunk.missingItems.add(index);
  chunk.itemChunks[index] = {
    value: createCompositeUndefinedChunk(
      chunk.operation,
      chunk.possibleSelections,
      true,
    ),
    parent: chunk,
    index,
  };
  markAsPartial(env, chunkRef);

  // Note: not mutating the source value on purpose, because it could be used by product code,
  //   instead just marking this value as "missing"
  // chunk.source[index] = undefined;
  return true;
}

export function hasDeletedField(chunk: ObjectChunk): boolean {
  if (!chunk.missingFields?.size) {
    return false;
  }
  for (const field of chunk.missingFields) {
    const fieldValue = resolveFieldChunk(chunk, field);
    if (isDeletedValue(fieldValue)) {
      return true;
    }
  }
  return false;
}
