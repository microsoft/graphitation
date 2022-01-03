/**
 * Taken from: https://github.com/kentcdodds/use-deep-compare-effect/blob/b08633471714cdd1a1dba6af4bbfbfcf89d3492f/src/index.ts
 * MIT License: https://github.com/kentcdodds/use-deep-compare-effect/blob/b08633471714cdd1a1dba6af4bbfbfcf89d3492f/LICENSE
 *
 * Updated to use lodash, which is already a dependency of Teams.
 */

import { useMemo, useRef } from "react";
import { isEqual } from "lodash";

/**
 * @param value the value to be memoized (usually a dependency list)
 * @returns a memoized version of the value as long as it remains deeply equal
 */
export function useDeepCompareMemoize<T>(value: T) {
  const ref = useRef<T>(value);
  const signalRef = useRef<number>(0);

  if (!isEqual(value, ref.current)) {
    ref.current = value;
    signalRef.current += 1;
  }

  return useMemo(() => ref.current, [signalRef.current]);
}
