import { buildASTSchema } from "graphql";
import { executeWithoutSchema } from "./index";
import { PromiseOrValue } from "./jsutils/PromiseOrValue";
import { ExecutionResult, ExecutionWithSchemaArgs } from "./types";
import { extractMinimalViableSchemaForRequestDocument } from "./utilities/addMinimalViableSchemaToRequestDocument";

export function executeWithSchema({
  typeDefs,
  resolvers,
  document,
  rootValue,
  contextValue,
  variableValues,
  operationName,
  fieldResolver,
  typeResolver,
  fieldExecutionHooks,
}: ExecutionWithSchemaArgs): PromiseOrValue<ExecutionResult> {
  const schema = buildASTSchema(typeDefs);
  const schemaFragment = extractMinimalViableSchemaForRequestDocument(
    schema,
    document,
  );

  return executeWithoutSchema({
    document,
    resolvers,
    schemaFragment,
    rootValue,
    contextValue,
    variableValues,
    operationName,
    fieldResolver,
    typeResolver,
    fieldExecutionHooks,
  });
}
