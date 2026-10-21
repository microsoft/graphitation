/**
 * Values as the devtools show them: plain data a port can carry, each ref, action ref, open
 * input and anything JSON has no form for replaced by a marker. A ref or action ref the
 * inspector keeps gets a handle, by which the devtools follow or run it.
 */
import type { AnyActionRef, AnyRef, AnyView } from "../../../../src/index";
import { isOpenInput } from "../../../../src/views/input";
import { isActionRef, isViewRef } from "../../../../src/views/ref";

/** An open input of an action ref, as running it asks for a value. */
export type InputInfo = { readonly name: string; readonly default?: unknown };

/** A ref to the runtime's own view: `handle` follows it, unless `null`. */
export type RefMarker = {
  readonly $ref: number | null;
  readonly label: string;
};

/** Another runtime's ref: the devtools open its view there. */
export type OpenMarker = {
  readonly $open: {
    readonly side: string;
    readonly view: string;
    readonly args: unknown;
  };
  readonly label: string;
};

/** An action ref: `handle` runs it, unless `null`. */
export type ActionMarker = {
  readonly $action: number | null;
  readonly label: string;
  readonly inputs: readonly InputInfo[];
};

/** What another runtime's encoded ref or action ref names. */
export type Encoded =
  | {
      readonly kind: "ref";
      readonly side: string;
      readonly view: string;
      readonly args: unknown;
    }
  | {
      readonly kind: "action";
      readonly action: string;
      readonly args: unknown;
    };

export type DescribeOptions = {
  /** Keeps a ref, answering its handle. */
  readonly ref?: (ref: AnyRef) => number;
  /** Keeps an action ref, the runtime's own or another's encoded, answering its handle. */
  readonly action?: (ref: AnyActionRef | string) => number;
  /** What a string names, when it is another runtime's ref or action ref. */
  readonly encoded?: (text: string) => Encoded | undefined;
};

/** How deep a value is described: deeper, it is cut. */
const DEPTH = 40;

/**
 * Tells another runtime's encoded refs and action refs, as `lib/protocol.ts` encodes them:
 * a ref is `[viewId, args]`, of one of `views`, `side`'s; an action ref is `{ action, args }`.
 */
export function encodedBy(
  side: string,
  views: Iterable<string>,
): (text: string) => Encoded | undefined {
  const known = new Set(views);
  return (text) => {
    if (!text.startsWith('["') && !text.startsWith('{"action"'))
      return undefined;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return undefined;
    }
    if (Array.isArray(parsed)) {
      const [view, args]: unknown[] = parsed;
      return parsed.length === 2 && typeof view === "string" && known.has(view)
        ? { kind: "ref", side, view, args }
        : undefined;
    }
    if (typeof parsed !== "object" || parsed === null || !("action" in parsed))
      return undefined;
    const { action } = parsed;
    if (typeof action !== "string") return undefined;
    return {
      kind: "action",
      action,
      args: "args" in parsed ? parsed.args : undefined,
    };
  };
}

/** How long a label grows. */
const LABEL = 80;

export function viewName(view: AnyView): string {
  return view.name ?? view.id ?? "view";
}

/** `value` as short JSON, refs by their labels. */
export function brief(value: unknown): string {
  const text =
    JSON.stringify(value, (_key, nested: unknown) => {
      if (typeof nested !== "object" || nested === null) {
        return typeof nested === "function" ? "ƒ" : nested;
      }
      if (isViewRef(nested))
        return `→${labelOf(viewName(nested.view), nested.args)}`;
      if (isActionRef(nested)) return `!${actionName(nested)}`;
      if (isOpenInput(nested)) return `$${nested.name}`;
      return nested;
    }) ?? "undefined";
  return text.length > LABEL ? `${text.slice(0, LABEL - 1)}…` : text;
}

/** A view's or action's name with its arguments. */
export function labelOf(name: string, args: unknown): string {
  return args === undefined ? name : `${name}(${brief(args)})`;
}

function actionName(ref: AnyActionRef): string {
  const action: unknown = ref.action;
  return typeof action === "function" && action.name !== ""
    ? action.name
    : "action";
}

/** The open inputs in an action ref's arguments: the runtime's own, or markers as encoded. */
function inputsOf(args: unknown, found: InputInfo[] = []): InputInfo[] {
  if (typeof args !== "object" || args === null) return found;
  if (isOpenInput(args)) {
    found.push(
      Object.hasOwn(args, "default")
        ? { name: args.name, default: args.default }
        : { name: args.name },
    );
    return found;
  }
  if ("$input" in args && typeof args.$input === "string") {
    found.push(
      "default" in args
        ? { name: args.$input, default: args.default }
        : { name: args.$input },
    );
    return found;
  }
  for (const nested of Object.values(args)) inputsOf(nested, found);
  return found;
}

function isPlain(value: object): boolean {
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** `value` as plain data, with markers. */
export function describe(
  value: unknown,
  options: DescribeOptions = {},
  depth = 0,
): unknown {
  if (depth > DEPTH) return { $cut: true };
  if (typeof value === "string") {
    const encoded = options.encoded?.(value);
    if (encoded === undefined) return value;
    if (encoded.kind === "ref") {
      const { side, view, args } = encoded;
      return {
        $open: { side, view, args },
        label: labelOf(view, args),
      } satisfies OpenMarker;
    }
    return {
      $action: options.action?.(value) ?? null,
      label: labelOf(encoded.action, encoded.args),
      inputs: inputsOf(encoded.args),
    } satisfies ActionMarker;
  }
  if (typeof value === "function") return { $fn: value.name };
  if (typeof value === "bigint" || typeof value === "symbol")
    return String(value);
  if (typeof value !== "object" || value === null) return value;
  const next = (nested: unknown): unknown =>
    describe(nested, options, depth + 1);
  if (isViewRef(value)) {
    return {
      $ref: options.ref?.(value) ?? null,
      label: labelOf(viewName(value.view), value.args),
    } satisfies RefMarker;
  }
  if (isActionRef(value)) {
    return {
      $action: options.action?.(value) ?? null,
      label: labelOf(actionName(value), value.args),
      inputs: inputsOf(value.args),
    } satisfies ActionMarker;
  }
  if (isOpenInput(value)) {
    return Object.hasOwn(value, "default")
      ? { $input: value.name, default: next(value.default) }
      : { $input: value.name };
  }
  if (Array.isArray(value)) return value.map(next);
  if (value instanceof Date) return { $date: value.toISOString() };
  if (value instanceof Error) return { $error: value.message };
  if (value instanceof Map) {
    return {
      $map: Array.from(value as Map<unknown, unknown>, ([key, item]) => [
        next(key),
        next(item),
      ]),
    };
  }
  if (value instanceof Set)
    return { $set: Array.from(value as Set<unknown>, next) };
  if (!isPlain(value)) return { $object: value.constructor.name };
  const described: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value))
    described[key] = next(nested);
  return described;
}
