/**
 * Federation's wire format, as this example defines it: refs and action refs encoded as JSON
 * text, and the messages between an asking and an answering session. See
 * docs/architecture/federation.md#the-protocol, which leaves it to be designed.
 */
import type { Revision, ViewId } from "../../../src/index";

/**
 * A ref as it crosses to another session: its view's id and its arguments, as JSON text.
 * The asking session holds it as an external ref, and keys the instance it names by it.
 */
export type EncodedRef = string;

/**
 * An action ref as it crosses to another session: its action's id and its arguments, each
 * open input an `InputMarker`, as JSON text. The asking session holds it as an external
 * action ref, and runs it by sending it back.
 */
export type EncodedActionRef = string;

/** An open input in an encoded action ref's arguments: its name, and its default if it has one. */
export type InputMarker = {
  readonly $input: string;
  readonly default?: unknown;
};

/** One instance a query visited: its value with refs encoded, and its failures. */
export type Answer = {
  readonly ref: EncodedRef;
  readonly value: unknown;
  readonly errors: readonly string[];
};

/** A remote query: its root, and the tags the answering session's driver follows from it. */
export type RemoteQuery = {
  /** `queryKey(view, args, tags)`: names the query in later messages. */
  readonly key: string;
  readonly view: ViewId;
  readonly args: unknown;
  readonly tags: readonly string[];
};

/**
 * Every message carries its sender's latest revision, for the receiver's hybrid clock to
 * observe: what it issues after the message then orders after what the sender issued before.
 */
export type Stamp = { readonly revision: Revision };

/** A message before it is stamped: as a session writes it. */
export type Unstamped<M> = M extends Stamp ? Omit<M, "revision"> : never;

/** Asking session to answering session. */
export type ToHost = Stamp &
  (
    | /** One round's queries, started or joined. */
    { readonly type: "query"; readonly queries: readonly RemoteQuery[] }
    /** Queries nothing reads any more. */
    | { readonly type: "release"; readonly keys: readonly string[] }
    /** Runs an action ref an answer held, with values for its open inputs; `id` names the reply. */
    | {
        readonly type: "run";
        readonly id: number;
        readonly ref: EncodedActionRef;
        readonly inputs: object | undefined;
      }
  );

/** What a query ran, or that it failed. */
export type RemoteResult =
  | /** Every instance a query visited: its first result, or all it holds when joined. */
  {
      readonly type: "answer";
      readonly key: string;
      readonly answers: readonly Answer[];
    }
  /** The instances a restart of a live query ran. */
  | {
      readonly type: "push";
      readonly key: string;
      readonly answers: readonly Answer[];
    }
  /** The query could not start, or stopped. */
  | { readonly type: "failed"; readonly key: string; readonly message: string };

/** Answering session to asking session. */
export type FromHost = Stamp &
  (
    | /**
     * What one pass ran, every query it started or restarted at once; or what a query
     * message joined or could not start.
     */
    { readonly type: "results"; readonly results: readonly RemoteResult[] }
    /** What the action run `id` answered, with refs encoded. */
    | { readonly type: "ran"; readonly id: number; readonly result: unknown }
    /** What the action run `id` threw or rejected with. */
    | {
        readonly type: "rejected";
        readonly id: number;
        readonly message: string;
      }
  );

/** JSON with object keys sorted, so equal values give equal text. */
export function stableJson(value: unknown): string {
  return JSON.stringify(value, sortKeys);
}

function sortKeys(_key: string, nested: unknown): unknown {
  if (nested === null || typeof nested !== "object" || Array.isArray(nested))
    return nested;
  return Object.fromEntries(
    Object.entries(nested).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
}

/** Encodes the ref to `view`'s instance for `args`: equal on either side for equal refs. */
export function encodeRef(view: ViewId, args: unknown): EncodedRef {
  return stableJson([view, args]);
}

/** Encodes the ref to `action` for `args`, their open inputs already markers. */
export function encodeActionRef(
  action: string,
  args: unknown,
): EncodedActionRef {
  return stableJson({ action, args });
}

/** The action's id and arguments an encoded action ref names. */
export function decodeActionRef(ref: EncodedActionRef): {
  action: string;
  args: unknown;
} {
  const decoded: unknown = JSON.parse(ref);
  if (
    typeof decoded !== "object" ||
    decoded === null ||
    !("action" in decoded) ||
    typeof decoded.action !== "string"
  ) {
    throw new Error(`Not an action ref: ${ref}`);
  }
  return {
    action: decoded.action,
    args: "args" in decoded ? decoded.args : undefined,
  };
}

/** Names a remote query: its root and its tags. */
export function queryKey(
  view: ViewId,
  args: unknown,
  tags: readonly string[],
): string {
  return stableJson([view, args, [...tags].sort()]);
}
