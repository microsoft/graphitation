import { buildASTSchema } from "graphql";
import { subscribeWithoutSchema } from "./index";
import { PromiseOrValue } from "./jsutils/PromiseOrValue";
import { ExecutionWithSchemaArgs, ExecutionResult } from "./types";
import { extractMinimalViableSchemaForRequestDocument } from "./supermassive-ast/addMinimalViableSchemaToRequestDocument";

export function subscribeWithSchema({
  typeDefs,
  resolvers,
  document,
  rootValue,
  contextValue,
  variableValues,
  operationName,
  fieldResolver,
  typeResolver,
}: ExecutionWithSchemaArgs): PromiseOrValue<ExecutionResult> {
  const schema = buildASTSchema(typeDefs);
  const schemaFragment = extractMinimalViableSchemaForRequestDocument(
    schema,
    document,
  );

  return subscribeWithoutSchema({
    document,
    resolvers,
    schemaFragment,
    rootValue,
    contextValue,
    variableValues,
    operationName,
    fieldResolver,
    typeResolver,
  });
}
