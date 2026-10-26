import type { AnyRef, ValueError } from "../api.core";
import type { FoundRefs } from "../api.codec";
import { isOpenInput } from "../views/input";
import { isRef, isViewRef } from "../views/ref";

/** Deeper than any result needs; stops a search of a cyclic one. */
const MAX_DEPTH = 256;

const NONE: FoundRefs = Object.freeze({ refs: Object.freeze([]) });

/**
 * `Codec.findRefs` for codecs without a schema: searches arrays, plain objects, Maps and
 * Sets, keys included, depth first in their own order, and tells no paths. Anything else
 * holds no refs, and action refs and open inputs are leaves it never finds.
 */
export function findRefsBySearch(_view: unknown, data: unknown): FoundRefs {
  const refs = search(data, undefined, 0);
  return refs === undefined ? NONE : { refs };
}

function search(
  value: unknown,
  refs: AnyRef[] | undefined,
  depth: number,
): AnyRef[] | undefined {
  if (typeof value !== "object" || value === null) return refs;
  if (isRef(value)) {
    // An action ref is a leaf, never found. Most results hold one ref or none: an array
    // made with it has room for it alone.
    if (isViewRef(value)) {
      if (refs === undefined) refs = [value];
      else refs.push(value);
    }
    return refs;
  }
  if (isOpenInput(value)) return refs;
  if (depth >= MAX_DEPTH) throw tooDeep();
  const next = depth + 1;
  if (Array.isArray(value)) {
    const array: readonly unknown[] = value;
    for (let index = 0; index < array.length; index++)
      refs = search(array[index], refs, next);
  } else if (value instanceof Map) {
    for (const [key, item] of value) {
      refs = search(key, refs, next);
      refs = search(item, refs, next);
    }
  } else if (value instanceof Set) {
    for (const item of value) refs = search(item, refs, next);
  } else if (isPlainObject(value)) {
    for (const key in value)
      if (Object.hasOwn(value, key)) refs = search(value[key], refs, next);
  }
  return refs;
}

function isPlainObject(
  value: object,
): value is Readonly<Record<string, unknown>> {
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function tooDeep(): Error {
  const message = "The result is too deep or cyclic to search for refs";
  const failure: ValueError = {
    kind: "value",
    message,
    path: [],
    code: "INVALID_RESULT",
  };
  return Object.assign(new Error(message), failure);
}
