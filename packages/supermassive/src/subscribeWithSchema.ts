import { buildASTSchema } from "graphql";
import { subscribeWithoutSchema } from "./index";
import { PromiseOrValue } from "./jsutils/PromiseOrValue";
import { ExecutionWithSchemaArgs, ExecutionResult } from "./types";
import { extractMinimalViableSchemaForRequestDocument } from "./utilities/extractMinimalViableSchemaForRequestDocument";

export function subscribeWithSchema({
  schema,
  document,
  rootValue,
  contextValue,
  variableValues,
  operationName,
  fieldResolver,
  typeResolver,
}: ExecutionWithSchemaArgs): PromiseOrValue<ExecutionResult> {
  const { definitions } = extractMinimalViableSchemaForRequestDocument(
    buildASTSchema(schema.definitions),
    document,
  );
  return subscribeWithoutSchema({
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
  });
}
