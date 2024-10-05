export function assert(condition: unknown): asserts condition {
  if (!Boolean(condition)) {
    throw new Error("Invariant violation");
  }
}

export function assertNever(...values: never[]): never {
  throw new Error(
    `Unexpected member of typed union: \n` + JSON.stringify(values),
  );
}
