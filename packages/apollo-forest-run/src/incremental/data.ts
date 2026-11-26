import type { ResponsePath } from "../descriptor/types";
import type { SourceObject } from "../values/types";

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

export function mergeSourceData(
  target: SourceObject,
  source: SourceObject,
): SourceObject {
  const result: SourceObject = { ...target };
  for (const key of Object.keys(source)) {
    const existing = result[key];
    const incoming = source[key];
    result[key] =
      isSourceData(existing) && isSourceData(incoming)
        ? mergeSourceData(existing, incoming)
        : incoming;
  }
  return result;
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
