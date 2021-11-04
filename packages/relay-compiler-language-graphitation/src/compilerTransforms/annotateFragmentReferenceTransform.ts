import {
  CompilerContext,
  Fragment,
  InlineFragment,
  LinkedField,
} from "relay-compiler";
import { IRTransform } from "relay-compiler/lib/core/CompilerContext";
import { visit } from "relay-compiler/lib/core/IRVisitor";
import { implementsNodeInterface } from "./utils";

export const annotateFragmentReferenceTransform: IRTransform = (context) => {
  const visitor = visitNodeWithSelections.bind(null, context);
  let nextContext = context;

  context.forEachDocument((document) => {
    const nextDocument = visit(document, {
      Fragment: visitor,
      InlineFragment: visitor,
      LinkedField: visitor,
    });
    nextContext = nextContext.replace(nextDocument);
  });

  return nextContext;
};

function visitNodeWithSelections(
  context: CompilerContext,
  node: Fragment | InlineFragment | LinkedField
): Fragment | InlineFragment | LinkedField | undefined {
  const hasNodeFragmentSpread = node.selections.some((selection) => {
    return (
      selection.kind === "FragmentSpread" &&
      implementsNodeInterface(context, context.getFragment(selection.name))
    );
  });
  if (hasNodeFragmentSpread) {
    return {
      ...node,
      selections: [
        ...node.selections,
        {
          kind: "InlineFragment",
          typeCondition: "Node",
          selections: [
            {
              kind: "ScalarField",
              name: "__fragments",
              alias: "__fragments",
              type: "String!",
              directives: [
                {
                  kind: "Directive",
                  name: "client",
                  args: [],
                  loc: { kind: "Generated" },
                  metadata: undefined,
                },
              ],
              args: [],
              loc: { kind: "Generated" },
              metadata: undefined,
            },
          ],
          directives: [],
          loc: { kind: "Generated" },
          metadata: undefined,
        },
      ],
    };
  }
}
