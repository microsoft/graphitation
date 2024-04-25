/**
 * Modified from https://github.com/facebook/react/blob/201af81b0168cabea3cc07cd8201378a4fec4aaf/packages/shared/shallowEqual.js
 * Copying is the suggested way, as mentioned here https://github.com/facebook/react/issues/16919
 */

/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found at
 * https://github.com/facebook/react/blob/201af81b0168cabea3cc07cd8201378a4fec4aaf/LICENSE
 */

import invariant from "invariant";

/**
 * A custom React.memo() comparator function factory that can be used with
 * components that use `useFragment` on a GraphQL type that implements the
 * `Node` interface, in which case only the `id` value needs to be equal to
 * avoid a re-render.
 *
 * @todo
 *   Support arrays with fragment references
 *
 * @param fragmentReferenceProps
 *   The props that refer to fragment references and should only be compared by
 *   their [Node] ids.
 *
 * @returns
 *   A comparator with parameters typed such that TS can verify the component
 *   passed to React.memo() has props that match.
 */
export function shallowCompareFragmentReferences<
  K extends string,
  ComparatorParam extends { [key in K]: { " $fragmentSpreads": unknown } },
>(
  ...fragmentReferenceProps: K[]
): (prevProps: ComparatorParam, nextProps: ComparatorParam) => boolean {
  return (prevProps, nextProps) => {
    if (Object.is(prevProps, nextProps)) {
      return true;
    }

    const keysPrev = Object.keys(prevProps);
    const keysNext = Object.keys(nextProps);

    if (keysPrev.length !== keysNext.length) {
      return false;
    }

    for (let i = 0; i < keysPrev.length; i++) {
      const checkKey = keysPrev[i] as K;
      if (
        !Object.prototype.hasOwnProperty.call(nextProps, checkKey) ||
        fragmentReferenceProps.includes(checkKey)
          ? !idsEqual(
              prevProps[checkKey] as { id?: unknown },
              nextProps[checkKey] as { id?: unknown },
            )
          : !Object.is(prevProps[checkKey], nextProps[checkKey])
      ) {
        return false;
      }
    }

    return true;
  };
}

function idsEqual(objA: { id?: unknown }, objB: { id?: unknown }) {
  invariant(
    objA.id && objB.id,
    "Expected both fragment reference objects to have an id field",
  );
  return objA.id === objB.id;
}
