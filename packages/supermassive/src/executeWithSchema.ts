import { buildASTSchema } from "graphql";
import { executeWithoutSchema } from "./index";
import { PromiseOrValue } from "./jsutils/PromiseOrValue";
import { ExecutionResult, ExecutionWithSchemaArgs } from "./types";
import { extractMinimalViableSchemaForRequestDocument } from "./utilities/extractMinimalViableSchemaForRequestDocument";

export function executeWithSchema({
  schema,
  document,
  rootValue,
  contextValue,
  variableValues,
  operationName,
  fieldResolver,
  typeResolver,
  fieldExecutionHooks,
}: ExecutionWithSchemaArgs): PromiseOrValue<ExecutionResult> {
  const schemaFragment = {
    ...schema,
    definitions: extractMinimalViableSchemaForRequestDocument(
      buildASTSchema(schema.definitions),
      document,
    ),
  };
  return executeWithoutSchema({
    document,
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
