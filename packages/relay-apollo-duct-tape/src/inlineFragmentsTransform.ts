import IRTransformer from "./vendor/relay-compiler/lib/core/IRTransformer";

import type { CompilerContext } from "relay-compiler";
import type {
  InlineFragment,
  Fragment,
  FragmentSpread,
} from "relay-compiler/lib/core/IR";

type FragmentVisitorCache = Map<FragmentSpread, FragmentSpread>;
type FragmentVisitor = (
  fragmentSpread: FragmentSpread,
) => FragmentSpread | undefined;
/**
 * A transform that inlines all fragments and removes them.
 */
export function inlineFragmentsTransform(
  context: CompilerContext,
): CompilerContext {
  const visitFragmentSpread = fragmentSpreadVisitor(new Map());
  return IRTransformer.transform(context, {
    FragmentSpread: visitFragmentSpread,
  });
}

function fragmentSpreadVisitor(cache: FragmentVisitorCache): FragmentVisitor {
  return function visitFragmentSpread(fragmentSpread: FragmentSpread) {
    let traverseResult = cache.get(fragmentSpread);
    if (traverseResult != null) {
      return traverseResult;
    }

    // @ts-ignore
    const fragment: Fragment = this.getContext().getFragment(
      fragmentSpread.name,
      fragmentSpread.loc,
    );
    const result: InlineFragment = {
      kind: "InlineFragment",
      directives: fragmentSpread.directives,
      loc: { kind: "Derived", source: fragmentSpread.loc },
      metadata: fragmentSpread.metadata,
      selections: fragment.selections,
      typeCondition: fragment.type,
    };
    // @ts-ignore
    traverseResult = this.traverse(result);
    if (traverseResult) {
      cache.set(fragmentSpread, traverseResult);
    }
    return traverseResult;
  };
}
