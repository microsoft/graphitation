import type {
  Action,
  ActionId,
  AnyView,
  ValueError,
  ViewError,
  ViewId,
  ViewInstanceId,
} from "../api.core";
import type { Codec, JsonCodecOptions } from "../api.codec";
import { findRefsBySearch } from "./findRefs";

/**
 * The built-in, schema-less codec. A view with an `id` goes by it, whatever its format;
 * any other view gets a local id from its `name` and a counter, such as
 * `__messageItem_1`, or `__2` without a name, skipping ids already taken. Two views
 * cannot go by one id. It trusts
 * `ReadonlyResult` types: `captureResult`
 * returns its input. Arguments are JSON plus Dates. `captureArgs` returns them as
 * passed; with `freezeArgs` it first deep-freezes their arrays and plain objects, so a
 * caller mutating its arguments later fails at once. `argsKey` is `JSON.stringify` with
 * object keys in sorted order, so equal arguments share it whatever their property
 * order, written as base64url when `base64Keys` is `true`. `instanceKey` is the view
 * id, length-prefixed, followed by the arguments key, such as `10:ChatRoomV1{"id":1}`,
 * so no two pairs of keys share one. A Date is written as its
 * ISO string. Properties holding `undefined` are omitted, and `undefined` arguments — a
 * view without any — are `""`. Anything else — refs, `undefined` elsewhere, bigints,
 * non-finite numbers, invalid Dates, and objects other than Dates, arrays, and plain
 * objects — is rejected with code `INVALID_ARGUMENT`. An open input is written as text no
 * JSON is, such as `$input("first","__chat_1",10)`: its name, the id of the view that left it
 * open, and its default when it has one, so a template's key never matches a bound ref's. `findRefs` searches arrays, plain
 * objects, Maps and Sets, and tells no paths. Every action gets a local id the same way,
 * from its own counter, and its arguments are captured and keyed as a view's are.
 */
export function createJsonCodec(options?: JsonCodecOptions): Codec {
  const ids = new WeakMap<AnyView, ViewId>();
  const issued = new Set<ViewId>();
  let local = 0;
  const actionIds = new WeakMap<Action, ActionId>();
  let localActions = 0;
  const argsKey =
    options?.base64Keys === true
      ? (_view: unknown, args: unknown): string =>
          args === undefined ? "" : base64url(write(args, [], viewKey))
      : (_view: unknown, args: unknown): string =>
          args === undefined ? "" : write(args, [], viewKey);
  const captureArgs = options?.freezeArgs === true ? freezeArgs : identity;
  function viewKey(view: AnyView): ViewId {
    let id = ids.get(view);
    if (id !== undefined) return id;
    id = view.id;
    if (id === undefined) {
      do id = localId(view.name, ++local);
      while (issued.has(id));
    } else if (issued.has(id)) {
      throw viewError(
        DUPLICATE_VIEW,
        `Another view already goes by "${id}"`,
        id,
        view.name,
      );
    }
    issued.add(id);
    ids.set(view, id);
    return id;
  }
  return Object.freeze({
    viewKey,
    captureResult: identity,
    captureArgs,
    argsKey,
    instanceKey(view: AnyView, args: unknown): ViewInstanceId {
      return lengthPrefixed(viewKey(view), argsKey(view, args));
    },
    actionKey(action: Action): ActionId {
      let id = actionIds.get(action);
      if (id === undefined) {
        id = localId(action.name, ++localActions);
        actionIds.set(action, id);
      }
      return id;
    },
    captureActionArgs: captureArgs,
    actionArgsKey: argsKey,
    findRefs: findRefsBySearch,
  });
}

/** The length prefix keeps the pair unambiguous whatever characters either key holds. */
function lengthPrefixed(viewKey: ViewId, argsKey: string): ViewInstanceId {
  return `${viewKey.length}:${viewKey}${argsKey}`;
}

function localId(name: string | undefined, counter: number): ViewId {
  return name === undefined || name === ""
    ? `__${counter}`
    : `__${name}_${counter}`;
}

function identity<T>(_view: unknown, value: T): T {
  return value;
}

function freezeArgs<Args>(_view: unknown, args: Args): Args {
  freeze(args, 0);
  return args;
}

/** Deeper than any argument needs; stops a walk over a cyclic one. */
const MAX_DEPTH = 256;

const INVALID = "INVALID_ARGUMENT";

const NOT_JSON =
  "Arguments are JSON: null, booleans, finite numbers, strings, Dates, arrays, and plain objects";

const REF_TAG: symbol = Symbol.for("refresher.ref");
const INPUT_TAG: symbol = Symbol.for("refresher.input");

function tagOf(value: object): unknown {
  return Object.hasOwn(value, "$$typeof")
    ? Reflect.get(value, "$$typeof")
    : undefined;
}

/** A plain object other than a ref or an open input: every own enumerable string key is data. */
function isRecord(value: object): value is Readonly<Record<string, unknown>> {
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const tag = tagOf(value);
  return tag !== REF_TAG && tag !== INPUT_TAG;
}

/** An open input `input` made, as far as keys go. */
type InputShape = {
  readonly name: string;
  readonly view: AnyView;
  readonly default?: unknown;
};

function isInput(value: object): value is InputShape {
  return tagOf(value) === INPUT_TAG;
}

function invalidArgument(
  message: string,
  path: readonly (string | number)[],
): Error {
  const failure: ValueError = {
    kind: "value",
    message,
    path: path.slice(),
    code: INVALID,
  };
  return Object.assign(new Error(message), failure);
}

function write(
  value: unknown,
  path: (string | number)[],
  viewKey: (view: AnyView) => ViewId,
): string {
  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (Number.isFinite(value)) return JSON.stringify(value);
      break;
    case "object": {
      if (value === null) return "null";
      if (path.length >= MAX_DEPTH)
        throw invalidArgument("Arguments are too deep or cyclic", path);
      let text = "";
      if (Array.isArray(value)) {
        const array: readonly unknown[] = value;
        for (let index = 0; index < array.length; index++) {
          path.push(index);
          text += (index > 0 ? "," : "") + write(array[index], path, viewKey);
          path.pop();
        }
        return `[${text}]`;
      }
      if (value instanceof Date) {
        if (Number.isNaN(value.getTime()))
          throw invalidArgument("Invalid Date", path);
        return `"${value.toISOString()}"`;
      }
      if (isInput(value)) {
        const head = `$input(${JSON.stringify(value.name)},${JSON.stringify(
          viewKey(value.view),
        )}`;
        if (!Object.hasOwn(value, "default")) return `${head})`;
        const fallback = value.default;
        return `${head},${
          fallback === undefined ? "undefined" : write(fallback, path, viewKey)
        })`;
      }
      if (!isRecord(value)) break;
      for (const key of Object.keys(value).sort()) {
        const child = value[key];
        if (child === undefined) continue;
        path.push(key);
        text += `${text === "" ? "" : ","}${JSON.stringify(key)}:${write(
          child,
          path,
          viewKey,
        )}`;
        path.pop();
      }
      return `{${text}}`;
    }
  }
  throw invalidArgument(NOT_JSON, path);
}

/**
 * Freezes arrays and plain objects, depth first; anything else is left to `argsKey`.
 * Dates stay mutable: freezing one leaves its time settable.
 */
function freeze(value: unknown, depth: number): void {
  if (typeof value !== "object" || value === null || depth >= MAX_DEPTH) return;
  if (Array.isArray(value)) {
    const array: readonly unknown[] = value;
    for (let index = 0; index < array.length; index++)
      freeze(array[index], depth + 1);
  } else if (isRecord(value)) {
    for (const key in value)
      if (Object.hasOwn(value, key)) freeze(value[key], depth + 1);
  } else {
    return;
  }
  Object.freeze(value);
}

const encoder = new TextEncoder();

/** Base64url without padding of the UTF-8 encoding of `text`. */
function base64url(text: string): string {
  let binary = "";
  for (const byte of encoder.encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

const DUPLICATE_VIEW = "DUPLICATE_VIEW";

function viewError(
  code: string,
  message: string,
  view: ViewId | undefined,
  viewName?: string,
): Error {
  const failure: ViewError = {
    kind: "view",
    message,
    code,
    ...(view === undefined ? undefined : { view }),
    ...(viewName === undefined ? undefined : { viewName }),
  };
  return Object.assign(new Error(message), failure);
}
