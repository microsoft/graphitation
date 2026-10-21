import type {
  InternalError,
  OperationError,
  RefError,
  RefresherError,
  SessionError,
  StoreError,
  ValueError,
  ViewError,
} from "./api.core";

const KINDS: ReadonlySet<string> = new Set([
  "store",
  "view",
  "ref",
  "value",
  "session",
  "operation",
  "internal",
]);

export function isRefresherError(value: unknown): value is RefresherError {
  if (typeof value !== "object" || value === null) return false;
  const kind: unknown = Reflect.get(value, "kind");
  return (
    typeof kind === "string" &&
    KINDS.has(kind) &&
    typeof Reflect.get(value, "message") === "string"
  );
}

function failure<E extends RefresherError>(
  data: E,
  cause?: unknown,
): Error & E {
  const error = Object.assign(
    new Error(data.message, cause === undefined ? undefined : { cause }),
    data,
  );
  error.name = "RefresherError";
  return error;
}

export function storeError(
  data: Omit<StoreError, "kind">,
  cause?: unknown,
): Error & StoreError {
  return failure({ kind: "store", ...data }, cause);
}

export function viewError(data: Omit<ViewError, "kind">): Error & ViewError {
  return failure({ kind: "view", ...data });
}

export function refError(data: Omit<RefError, "kind">): Error & RefError {
  return failure({ kind: "ref", ...data });
}

export function valueError(data: Omit<ValueError, "kind">): Error & ValueError {
  return failure({ kind: "value", ...data });
}

/** Whether `value` is a value error with `code`. */
export function isValueError(
  value: unknown,
  code: string,
): value is ValueError {
  return (
    isRefresherError(value) && value.kind === "value" && value.code === code
  );
}

export function sessionError(
  data: Omit<SessionError, "kind">,
): Error & SessionError {
  return failure({ kind: "session", ...data });
}

export function operationError(
  data: Omit<OperationError, "kind">,
  cause?: unknown,
): Error & OperationError {
  return failure({ kind: "operation", ...data }, cause);
}

export function internalError(
  data: Omit<InternalError, "kind">,
): Error & InternalError {
  return failure({ kind: "internal", ...data });
}

/** A defect of Refresher itself, which no view may turn into a value. */
export function isInternalError(value: unknown): boolean {
  return isRefresherError(value) && value.kind === "internal";
}

/** What an abort rejects with: the signal's reason when it is a Refresher error. */
export function abortedBy(signal: AbortSignal): unknown {
  const reason: unknown = signal.reason;
  return reason instanceof Error && isRefresherError(reason)
    ? reason
    : operationError(
        { code: "ABORTED", message: "The execution was aborted" },
        reason,
      );
}

/**
 * A thrown value as the `ValueError` of the view that threw it. The path starts at the
 * view's result, so only a failure the codec reported on that result keeps its own.
 */
export function valueErrorOf(thrown: unknown, keepPath: boolean): ValueError {
  if (isRefresherError(thrown)) {
    const path = keepPath && thrown.kind === "value" ? thrown.path : [];
    const code = thrown.code;
    return code === undefined
      ? { kind: "value", message: thrown.message, path }
      : { kind: "value", message: thrown.message, path, code };
  }
  const message = thrown instanceof Error ? thrown.message : String(thrown);
  return { kind: "value", message, path: [] };
}
