/**
 * Open inputs at runtime: frozen records tagged with a symbol the codecs recognize, as refs
 * are, so data decoded from elsewhere never passes for one. Binding replaces each with the
 * value supplied for its name, or its default. See docs/architecture/variables.md.
 */
import type { AnyView, OpenInput } from "../api.core";
import { valueError } from "../errors";

export const INPUT_TAG: symbol = Symbol.for("refresher.input");

/** An input `view` leaves open, under `name`. */
export function createInput(
  view: AnyView,
  name: string,
  options?: { readonly default: unknown },
): OpenInput {
  if (typeof name !== "string" || name === "") {
    throw inputError(
      "INVALID_INPUT",
      "An input's name is a non-empty string",
      [],
    );
  }
  const input: OpenInput & { readonly $$typeof: symbol } =
    options === undefined || !Object.hasOwn(options, "default")
      ? Object.freeze({ $$typeof: INPUT_TAG, name, view })
      : Object.freeze({
          $$typeof: INPUT_TAG,
          name,
          view,
          default: options.default,
        });
  return input;
}

/** Whether `value` is an open input `input` made. */
export function isOpenInput(value: unknown): value is OpenInput {
  return (
    typeof value === "object" &&
    value !== null &&
    Reflect.get(value, "$$typeof") === INPUT_TAG
  );
}

/** Deeper than any argument needs; stops a walk over a cyclic one. */
const MAX_DEPTH = 256;

/** Throws a value error if `args` hold an open input, as arguments that must be bound may not. */
export function throwIfOpen(args: unknown, message: string): void {
  if (typeof args !== "object" || args === null || !holdsOpen(args, 0)) return;
  const path: (string | number)[] = [];
  if (findOpen(args, path)) throw inputError("OPEN_INPUT", message, path);
}

/** Whether `value` holds an open input; `path` is left at the first one found. */
function findOpen(value: unknown, path: (string | number)[]): boolean {
  if (typeof value !== "object" || value === null) return false;
  if (isOpenInput(value)) return true;
  if (path.length >= MAX_DEPTH) return false;
  if (Array.isArray(value)) {
    const array: readonly unknown[] = value;
    for (let index = 0; index < array.length; index++) {
      path.push(index);
      if (findOpen(array[index], path)) return true;
      path.pop();
    }
    return false;
  }
  if (!isPlain(value)) return false;
  for (const key in value) {
    if (!Object.hasOwn(value, key)) continue;
    path.push(key);
    if (findOpen(value[key], path)) return true;
    path.pop();
  }
  return false;
}

/**
 * `args` with each open input replaced by the value given for its name, or its default:
 * `args` itself when it holds none. An input with neither is a value error.
 */
export function bindArgs(args: unknown, values: object | undefined): unknown {
  // Most arguments hold no input: those are told apart without a path to report one at.
  if (!holdsOpen(args, 0)) return args;
  return substitute(args, values, []);
}

/** Whether `args` hold an open input, so a ref with them is a template. */
export function isOpen(args: unknown): boolean {
  return holdsOpen(args, 0);
}

/** Whether `value` holds an open input, within `MAX_DEPTH` as `substitute` searches. */
function holdsOpen(value: unknown, depth: number): boolean {
  if (typeof value !== "object" || value === null) return false;
  if (isOpenInput(value)) return true;
  if (depth >= MAX_DEPTH) return false;
  if (Array.isArray(value)) {
    const array: readonly unknown[] = value;
    for (let index = 0; index < array.length; index++) {
      if (holdsOpen(array[index], depth + 1)) return true;
    }
    return false;
  }
  if (!isPlain(value)) return false;
  for (const key in value) {
    if (Object.hasOwn(value, key) && holdsOpen(value[key], depth + 1))
      return true;
  }
  return false;
}

function substitute(
  value: unknown,
  values: object | undefined,
  path: (string | number)[],
): unknown {
  if (typeof value !== "object" || value === null) return value;
  if (isOpenInput(value)) {
    const name = value.name;
    if (values !== undefined && Object.hasOwn(values, name))
      return Reflect.get(values, name);
    if (Object.hasOwn(value, "default")) return value.default;
    throw inputError("MISSING_INPUT", `No value for the input "${name}"`, path);
  }
  if (path.length >= MAX_DEPTH) return value;
  if (Array.isArray(value)) {
    const array: readonly unknown[] = value;
    let copy: unknown[] | undefined;
    for (let index = 0; index < array.length; index++) {
      path.push(index);
      const element = array[index];
      const bound = substitute(element, values, path);
      path.pop();
      if (bound !== element) (copy ??= array.slice())[index] = bound;
    }
    return copy ?? value;
  }
  if (!isPlain(value)) return value;
  let copy: Record<string, unknown> | undefined;
  for (const key in value) {
    if (!Object.hasOwn(value, key)) continue;
    path.push(key);
    const child = value[key];
    const bound = substitute(child, values, path);
    path.pop();
    if (bound !== child) (copy ??= { ...value })[key] = bound;
  }
  return copy ?? value;
}

/** A plain object other than a ref or an open input: every own key is data. */
function isPlain(value: object): value is Readonly<Record<string, unknown>> {
  const prototype: unknown = Object.getPrototypeOf(value);
  return (
    (prototype === Object.prototype || prototype === null) &&
    !Object.hasOwn(value, "$$typeof")
  );
}

function inputError(
  code: string,
  message: string,
  path: readonly (string | number)[],
): Error {
  return valueError({ message, path: path.slice(), code });
}
