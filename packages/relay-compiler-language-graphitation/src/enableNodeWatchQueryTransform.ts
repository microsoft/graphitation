import { Directive } from "relay-compiler";
import {
  CompilerContextDocument,
  IRTransform,
} from "relay-compiler/lib/core/CompilerContext";

export const enableNodeWatchQueryTransform: IRTransform = (context) => {
  let nextContext = context;
  const schema = context.getSchema();

  const nodeType = schema.getTypeFromString("Node");
  schema.assertInterfaceType(nodeType);

  context.forEachDocument((document) => {
    if (document.kind === "Fragment") {
      const typeConstraint = document.type;
      if (schema.getInterfaces(typeConstraint).includes(nodeType)) {
        nextContext = nextContext.replace({
          ...document,
          directives: [
            ...document.directives,
            emitRefetchableDirective(document),
          ],
        });
      }
    }
  });

  return nextContext;
};

function emitRefetchableDirective(
  document: CompilerContextDocument
): Directive {
  const fragmentName = document.name;
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
