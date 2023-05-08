import { Directive, Fragment } from "relay-compiler";
import { IRTransform } from "relay-compiler/lib/core/CompilerContext";
import { implementsNodeInterface } from "./utils";

/**
 * Uses relay-compiler's `@refetchable` directive to emit a query operation for
 * a single fragment (on the `Node` interface or `Query` type). This operation
 * is used by the `use*Fragment` hooks to observe the Apollo Client store for
 * changes to _just_ that data selected in the fragment.
 */
export const enableNodeWatchQueryTransform: IRTransform = (context) => {
  let nextContext = context;

  context.forEachDocument((document) => {
    if (
      document.kind === "Fragment" &&
      (document.type === context.getSchema().getQueryType() ||
        implementsNodeInterface(context, document))
    ) {
      nextContext = nextContext.replace({
        ...document,
        directives: [
          ...document.directives,
          emitRefetchableDirective(document),
        ],
      });
    }
  });

  return nextContext;
};

function emitRefetchableDirective(fragmentDefinition: Fragment): Directive {
  const fragmentName = fragmentDefinition.name;
  const fragmentBaseName = fragmentName.replace(/Fragment$/, "");
  return {
    kind: "Directive",
    name: "refetchable",
    args: [
      {
        kind: "Argument",
        name: "queryName",
        value: {
          kind: "Literal",
          value: `${fragmentBaseName}WatchNodeQuery`,
          loc: { kind: "Generated" },
        },
        loc: { kind: "Generated" },
        metadata: undefined,
      },
    ],
    loc: { kind: "Generated" },
    metadata: undefined,
  };
}
