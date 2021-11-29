import {
  CompilerContext,
  Fragment,
  InlineFragment,
  LinkedField,
  Root,
  ScalarField,
} from "relay-compiler";
import { IRTransform } from "relay-compiler/lib/core/CompilerContext";
import { visit } from "relay-compiler/lib/core/IRVisitor";
import { implementsNodeInterface } from "./utils";

const FRAGMENTS_SELECTION: ScalarField = {
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
};

const FRAGMENTS_ON_NODE_SELECTION: InlineFragment = {
  kind: "InlineFragment",
  typeCondition: "Node",
  selections: [FRAGMENTS_SELECTION],
  directives: [],
  loc: { kind: "Generated" },
  metadata: undefined,
};

export const annotateFragmentReferenceTransform: IRTransform = (context) => {
  const visitor = visitNodeWithSelections.bind(null, context);
  let nextContext = context;

  context.forEachDocument((document) => {
    const nextDocument = visit(document, {
      Root: visitor,
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
  node: Root | Fragment | InlineFragment | LinkedField
): Root | Fragment | InlineFragment | LinkedField | undefined {
  for (const selection of node.selections) {
    if (selection.kind === "FragmentSpread") {
      const fragment = context.getFragment(selection.name);
      if (implementsNodeInterface(context, fragment)) {
        return {
          ...node,
          selections: [...node.selections, FRAGMENTS_ON_NODE_SELECTION],
        };
      } else if (fragment.type === context.getSchema().getQueryType()) {
        return {
          ...node,
          selections: [...node.selections, FRAGMENTS_SELECTION],
        };
      }
    }
  }
}
