import type { ObjMap } from "./ObjMap";

/**
 * Walks `result` following `path` and returns the nested value, but only when
 * that value is a non-null object (a valid `Object.assign` target). Returns
 * `undefined` if any segment is missing or the resolved value is not an object.
 */
export function getObjectAtPath(
  result: ObjMap<unknown>,
  path: ReadonlyArray<string | number>,
): ObjMap<unknown> | undefined {
  let target = result;
  for (const key of path) {
    const next = target[key];
    if (next === null || typeof next !== "object") {
      return undefined;
    }
    target = next as ObjMap<unknown>;
  }

  return target;
}
