import { buildASTSchema } from "graphql";
import { subscribeWithoutSchema } from "./index";
import { PromiseOrValue } from "./jsutils/PromiseOrValue";
import { ExecutionWithSchemaArgs, ExecutionResult } from "./types";
import { extractMinimalViableSchemaForRequestDocument } from "./utilities/extractMinimalViableSchemaForRequestDocument";

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
