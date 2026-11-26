import type { ResponsePath } from "../descriptor/types";
import type { SourceObject } from "../values/types";
import { assert } from "../jsutils/assert";

// JSON helpers for results of incremental delivery (copy-on-write)

// Copy-on-write merge of data at the path (undefined when the path is not in the value)
export function mergeAt(
  value: unknown,
  path: ResponsePath,
  index: number,
  data: SourceObject,
): unknown {
  if (index === path.length) {
    return isSourceData(value) ? mergeSourceData(value, data) : undefined;
  }
  const step = path[index];
  if (Array.isArray(value) && typeof step === "number") {
    const item = mergeAt(value[step], path, index + 1, data);
    if (item === undefined) {
      return undefined;
    }
    const copy: unknown[] = [...value];
    copy[step] = item;
    return copy;
  }
  if (isSourceData(value) && typeof step === "string") {
    const item = mergeAt(value[step], path, index + 1, data);
    return item === undefined ? undefined : { ...value, [step]: item };
  }
  return undefined;
}

/**
 * Deep merge of objects (copy-on-write). Lists are merged item by item: results of the same execution
 * (the server view) have the same lists at the same paths.
 */
export function mergeSourceData(
  target: SourceObject,
  source: SourceObject,
): SourceObject {
  const result: SourceObject = { ...target };
  for (const key of Object.keys(source)) {
    result[key] = mergeValues(result[key], source[key]) as SourceObject;
  }
  return result;
}

function mergeValues(existing: unknown, incoming: unknown): unknown {
  if (isSourceData(existing) && isSourceData(incoming)) {
    return mergeSourceData(existing, incoming);
  }
  if (Array.isArray(existing) && Array.isArray(incoming)) {
    const length = Math.max(existing.length, incoming.length);
    const result: unknown[] = new Array(length);
    for (let index = 0; index < length; index++) {
      result[index] =
        incoming[index] === undefined
          ? existing[index]
          : mergeValues(existing[index], incoming[index]);
    }
    return result;
  }
  return incoming;
}

export function isPathPrefix(
  prefix: ResponsePath,
  path: ResponsePath,
): boolean {
  return (
    prefix.length <= path.length &&
    prefix.every((step, index) => path[index] === step)
  );
}

// Unlike isSourceObject, excludes lists
export function isSourceData(value: unknown): value is SourceObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getDataAt(
  data: SourceObject,
  path: ResponsePath,
  index = 0,
): SourceObject | undefined {
  let value: unknown = data;
  for (let i = index; i < path.length && value !== undefined; i++) {
    const step = path[i];
    value =
      Array.isArray(value) && typeof step === "number"
        ? value[step]
        : isSourceData(value) && typeof step === "string"
        ? value[step]
        : undefined;
  }
  return isSourceData(value) ? value : undefined;
}

/**
 * Merges data received from the server at the path (copy-on-write, see mergeSourceData),
 * creating missing objects and lists on the path (sparse).
 */
export function mergeServerData(
  value: unknown,
  path: ResponsePath,
  data: SourceObject,
  index = 0,
): SourceObject {
  const result = mergeServerDataAt(value, path, data, index);
  assert(isSourceData(result));
  return result;
}

function mergeServerDataAt(
  value: unknown,
  path: ResponsePath,
  data: SourceObject,
  index: number,
): unknown {
  if (index === path.length) {
    return isSourceData(value) ? mergeSourceData(value, data) : data;
  }
  const step = path[index];
  if (typeof step === "number") {
    const copy: unknown[] = Array.isArray(value) ? [...value] : [];
    copy[step] = mergeServerDataAt(copy[step], path, data, index + 1);
    return copy;
  }
  const object: SourceObject = isSourceData(value)
    ? { ...value }
    : ({} as SourceObject);
  object[step] = mergeServerDataAt(
    object[step],
    path,
    data,
    index + 1,
  ) as SourceObject;
  return object;
}
