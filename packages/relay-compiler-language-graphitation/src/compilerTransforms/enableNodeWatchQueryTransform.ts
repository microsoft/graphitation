import { Directive, Fragment } from "relay-compiler";
import { IRTransform } from "relay-compiler/lib/core/CompilerContext";
import { implementsNodeInterface } from "./utils";

export const enableNodeWatchQueryTransform: IRTransform = (context) => {
  let nextContext = context;

  context.forEachDocument((document) => {
    if (
      document.kind === "Fragment" &&
      implementsNodeInterface(context, document)
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
