/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *
 * @format
 */
// flowlint ambiguous-object-type:error
"use strict";

import IRTransformer from "../core/IRTransformer";

import invariant from "invariant";

/**
 * A transform that inlines all fragments and removes them.
 */
function inlineFragmentsTransform(context) {
  const visitFragmentSpread = fragmentSpreadVisitor(new Map());
  return IRTransformer.transform(context, {
    Fragment: visitFragment,
    FragmentSpread: visitFragmentSpread,
  });
}

function visitFragment(fragment) {
  return null;
}

function fragmentSpreadVisitor(cache) {
  return function visitFragmentSpread(fragmentSpread) {
    let traverseResult = cache.get(fragmentSpread);

    if (traverseResult != null) {
      return traverseResult;
    }

    invariant(
      fragmentSpread.args.length === 0,
      "InlineFragmentsTransform: Cannot flatten fragment spread `%s` with " +
        "arguments. Use the `ApplyFragmentArgumentTransform` before flattening",
      fragmentSpread.name,
    ); // $FlowFixMe[incompatible-use]

    const fragment = this.getContext().getFragment(
      fragmentSpread.name,
      fragmentSpread.loc,
    );
    const result = {
      kind: "InlineFragment",
      directives: fragmentSpread.directives,
      loc: {
        kind: "Derived",
        source: fragmentSpread.loc,
      },
      metadata: fragmentSpread.metadata,
      selections: fragment.selections,
      typeCondition: fragment.type,
    }; // $FlowFixMe[incompatible-use]

    traverseResult = this.traverse(result);
    cache.set(fragmentSpread, traverseResult);
    return traverseResult;
  };
}

module.exports = {
  transform: inlineFragmentsTransform,
};
