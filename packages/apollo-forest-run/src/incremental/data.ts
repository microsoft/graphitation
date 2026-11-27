import type { ResponsePath } from "../descriptor/types";
import type { ResultData } from "./types";

// JSON helpers for results of incremental delivery (copy-on-write)

/**
 * Merges data received from the server at the path (copy-on-write, see mergeResultData).
 * Returns undefined when there is no object at the path.
 */
export function mergeAt(
  value: ResultData,
  path: ResponsePath,
  data: ResultData,
): ResultData | undefined {
  const result = mergeAtImpl(value, path, data, 0);
  return isResultData(result) ? result : undefined;
}

function mergeAtImpl(
  value: unknown,
  path: ResponsePath,
  data: ResultData,
  index: number,
): unknown {
  if (index === path.length) {
    return isResultData(value) ? mergeResultData(value, data) : undefined;
  }
  const step = path[index];
  if (Array.isArray(value) && typeof step === "number") {
    const item = mergeAtImpl(value[step], path, data, index + 1);
    if (item === undefined) {
      return undefined;
    }
    const copy: unknown[] = [...value];
    copy[step] = item;
    return copy;
  }
  if (isResultData(value) && typeof step === "string") {
    const item = mergeAtImpl(value[step], path, data, index + 1);
    return item === undefined ? undefined : { ...value, [step]: item };
  }
  return undefined;
}

/**
 * Deep merge of objects (copy-on-write). Lists are merged item by item: results of the same execution
 * (the server view) have the same lists at the same paths.
 */
export function mergeResultData(
  target: ResultData,
  source: ResultData,
): ResultData {
  const result: ResultData = { ...target };
  for (const key of Object.keys(source)) {
    result[key] = mergeValues(result[key], source[key]);
  }
  return result;
}

function mergeValues(existing: unknown, incoming: unknown): unknown {
  if (isResultData(existing) && isResultData(incoming)) {
    return mergeResultData(existing, incoming);
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

// Excludes lists
export function isResultData(value: unknown): value is ResultData {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
