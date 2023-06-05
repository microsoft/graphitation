/**
 * Returns true if the value acts like a Promise, i.e. has a "then" function,
 * otherwise returns false.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isPromise(value: any): value is Promise<unknown> {
  return typeof value?.then === "function";
}
