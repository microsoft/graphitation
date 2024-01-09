import type { PromiseOrValue } from "./PromiseOrValue";

/**
 * Based on Promise.withResolvers proposal
 * https://github.com/tc39/proposal-promise-with-resolvers
 */
export function promiseWithResolvers<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseOrValue<T>) => void;
  reject: (reason?: unknown) => void;
} {
  // these are assigned synchronously within the Promise constructor
  let resolve!: (value: T | PromiseOrValue<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
