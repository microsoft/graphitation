import type { ForestEnv } from "./types";
import type {
  CompositeListChunk,
  MissingFieldsMap,
  ObjectChunk,
  SourceCompositeList,
  SourceObject,
} from "../values/types";
import { ValueKind } from "../values/types";
import { resolveListItemChunk } from "../values/resolve";

/**
 * Restores tree-shaped composite data without changing caller-owned objects.
 * Unlike a graph-preserving deep clone, every repeated occurrence gets its own copy.
 */
export function cloneSharedReferences(
  env: ForestEnv,
  root: ObjectChunk,
): { data: SourceObject; missingFields: MissingFieldsMap } {
  const seen = new Set<SourceObject | SourceCompositeList>();
  const missingFields: MissingFieldsMap = new Map();

  function cloneObject(chunk: ObjectChunk): SourceObject {
    const source = chunk.data;
    let copy = seen.has(source) ? { ...source } : undefined;
    seen.add(source);

    for (const [dataKey, ref] of chunk.fieldChunks) {
      const child = ref.value;
      const value =
        child.kind === ValueKind.Object
          ? cloneObject(child)
          : child.kind === ValueKind.CompositeList
          ? cloneList(child)
          : child.data;
      if (value !== source[dataKey]) {
        copy ??= { ...source };
        copy[dataKey] = value;
      }
    }

    const data = copy ?? source;
    if (chunk.missingFields?.size) {
      missingFields.set(data, new Set(chunk.missingFields));
    }
    if (copy) {
      env.keyMap?.set(copy, chunk.key);
    }
    return data;
  }

  function cloneList(chunk: CompositeListChunk): SourceCompositeList {
    const source = chunk.data;
    let copy = seen.has(source) ? source.slice() : undefined;
    seen.add(source);

    for (let index = 0; index < source.length; index++) {
      const child = resolveListItemChunk(chunk, index);
      if (
        child.kind !== ValueKind.Object &&
        child.kind !== ValueKind.CompositeList
      ) {
        continue;
      }
      const value =
        child.kind === ValueKind.Object ? cloneObject(child) : cloneList(child);
      if (value !== source[index]) {
        copy ??= source.slice();
        copy[index] = value;
      }
    }
    return copy ?? source;
  }

  return { data: cloneObject(root), missingFields };
}
