import { extractMinimalViableSchemaForRequestDocument } from "@graphitation/supermassive-ast";
import type { PromiseOrValue } from "@graphitation/supermassive-common";
import { buildASTSchema } from "graphql";
import { executeWithoutSchema } from "./index";
import { ExecutionResult, ExecutionWithSchemaArgs } from "./types";

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
  });
}
