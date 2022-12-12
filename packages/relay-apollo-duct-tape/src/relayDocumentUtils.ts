import { DocumentNode, Source, print as printGraphQLJS } from "graphql";
import { Parser, Schema } from "relay-compiler";
import { create as createSchema } from "relay-compiler/lib/core/Schema";

export function parseDocumentAsRelayIR(schema: Schema, document: DocumentNode) {
  const text = printGraphQLJS(document);
  const ir = Parser.parse(schema, text);
  console.log(JSON.stringify(ir, null, 2));
  return undefined;
}

export function transformSchema(schema: DocumentNode): Schema {
  return createSchema(new Source(printGraphQLJS(schema)));
}
