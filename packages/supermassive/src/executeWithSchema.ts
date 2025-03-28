import { buildASTSchema } from "graphql";
import { executeWithoutSchema } from "./index";
import { PromiseOrValue } from "./jsutils/PromiseOrValue";
import { ExecutionResult, ExecutionWithSchemaArgs } from "./types";
import { extractMinimalViableSchemaForRequestDocument } from "./utilities/extractMinimalViableSchemaForRequestDocument";

export function executeWithSchema({
  document,
  definitions,
  resolvers,
  rootValue,
  contextValue,
  variableValues,
  operationName,
  fieldResolver,
  typeResolver,
  fieldExecutionHooks,
  enablePerEventContext,
}: ExecutionWithSchemaArgs): PromiseOrValue<ExecutionResult> {
  const extracted = extractMinimalViableSchemaForRequestDocument(
    buildASTSchema(definitions),
    document,
  );
  return executeWithoutSchema({
    document,
    schemaFragment: {
      schemaId: "executeWithSchema",
      definitions: extracted.definitions,
      resolvers,
    },
    rootValue,
    contextValue,
    variableValues,
    operationName,
    fieldResolver,
    typeResolver,
    fieldExecutionHooks,
    enablePerEventContext,
  });
}
