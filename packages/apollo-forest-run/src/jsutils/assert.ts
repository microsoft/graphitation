export function assert(condition: unknown, message = ""): asserts condition {
  if (!condition) {
    invariantViolation(message);
  }
}

// Kept out of line so optimized callers don't embed the cold throw path
function invariantViolation(message: string): never {
  throw new Error("Invariant violation" + (message ? `: ${message}` : ""));
}

export function assertNever(...values: never[]): never {
  throw new Error(
    `Unexpected member of typed union: \n` + JSON.stringify(values),
  );
}

export function fail(message: string): never {
  throw new Error(message);
}
