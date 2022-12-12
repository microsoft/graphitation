import {
  DefinitionNode,
  DocumentNode,
  Source,
  print as printGraphQLJS,
} from "graphql";
import { CompilerContext, Parser, Schema } from "relay-compiler";
import { create as createSchema } from "relay-compiler/lib/core/Schema";
import * as IRTransforms from "relay-compiler/lib/core/RelayIRTransforms";
import { IRTransform } from "relay-compiler/lib/core/CompilerContext";
import { inlineFragmentsTransform } from "./inlineFragmentsTransform";
import invariant from "invariant";

const {
  generate: generateIRDocument,
} = require("relay-compiler/lib/codegen/RelayCodeGenerator");

const fragmentTransforms = [
  inlineFragmentsTransform,
  ...IRTransforms.fragmentTransforms,
];

export function transformDocument(schema: Schema, document: DocumentNode) {
  const nodes = Parser.transform(
    schema,
    document.definitions as DefinitionNode[],
  );
  let compilerContext = new CompilerContext(schema);
  for (const node of nodes) {
    compilerContext = compilerContext.add(node);
  }
  let operationCompilerContext = compilerContext.applyTransforms(
    IRTransforms.codegenTransforms,
  );
  let fragmentCompilerContext = compilerContext.applyTransforms(
    fragmentTransforms,
  );
  const res: any[] = [];
  operationCompilerContext.forEachDocument((node) => {
    if (node.kind === "Root") {
      const fragment = operationCompilerContext.getRoot(node.name);
      const name = fragment.name;
      // const request: ConcreteRequest = {
      const request = {
        kind: "Request",
        fragment: {
          kind: "Fragment",
          name,
          argumentDefinitions: fragment.argumentDefinitions,
          directives: fragment.directives,
          loc: { kind: "Derived", source: node.loc },
          metadata: undefined,
          selections: fragment.selections as any,
          type: fragment.type,
        },
        id: undefined,
        loc: node.loc,
        metadata: node.metadata || {},
        name: fragment.name,
        root: node,
        text: "",
      };
      const generatedNode = generateIRDocument(schema, request);
      res.push(generatedNode);
    }
  });
  fragmentCompilerContext.forEachDocument((node) => {
    if (node.kind === "Fragment") {
      res.push(generateIRDocument(schema, node));
    }
  });
  invariant(
    res.length === 1,
    "TODO: Handle multiple documents in a single request",
  );
  return res[0];
}

export function transformSchema(schema: DocumentNode): Schema {
  return createSchema(new Source(printGraphQLJS(schema)));
}
