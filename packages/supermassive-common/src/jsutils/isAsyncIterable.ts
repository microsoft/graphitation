/**
 * Returns true if the provided object implements the AsyncIterator protocol via
 * implementing a `Symbol.asyncIterator` method.
 */
export function isAsyncIterable(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  maybeAsyncIterable: any,
): maybeAsyncIterable is AsyncIterable<unknown> {
  return typeof maybeAsyncIterable?.[Symbol.asyncIterator] === "function";
}
