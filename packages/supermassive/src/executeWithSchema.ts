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
  const { definitions } = extractMinimalViableSchemaForRequestDocument(
    buildASTSchema(schema.definitions),
    document,
  );
  return executeWithoutSchema({
    document,
    schemaFragment: {
      ...schema,
      definitions,
    },
    rootValue,
    contextValue,
    variableValues,
    operationName,
    fieldResolver,
    typeResolver,
    fieldExecutionHooks,
  });
}
