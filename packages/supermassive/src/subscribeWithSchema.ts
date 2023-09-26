import { extractMinimalViableSchemaForRequestDocument } from "@graphitation/supermassive-ast";
import type { PromiseOrValue } from "@graphitation/supermassive-common";
import { buildASTSchema } from "graphql";
import { subscribeWithoutSchema } from "./index";
import { ExecutionResult, ExecutionWithSchemaArgs } from "./types";

export function subscribeWithSchema({
  document,
  definitions,
  resolvers,
  rootValue,
  contextValue,
  variableValues,
  operationName,
  fieldResolver,
  typeResolver,
}: ExecutionWithSchemaArgs): PromiseOrValue<ExecutionResult> {
  const extracted = extractMinimalViableSchemaForRequestDocument(
    buildASTSchema(definitions),
    document,
  );
  return subscribeWithoutSchema({
    document,
    schemaFragment: {
      schemaId: "subscribeWithSchema",
      definitions: extracted.definitions,
      resolvers,
    },
    rootValue,
    contextValue,
    variableValues,
    operationName,
    fieldResolver,
    typeResolver,
  });
}
