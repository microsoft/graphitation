import { buildASTSchema, parse } from "graphql";
import { executeWithoutSchema } from "./index";
import { PromiseOrValue } from "./jsutils/PromiseOrValue";
import { ExecutionResult, ExecutionWithSchemaArgs } from "./types";
import { extractMinimalViableSchemaForRequestDocument } from "./supermassive-ast/addMinimalViableSchemaToRequestDocument";
import { encodeSchema } from "./utilities/encodeSchema";

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
  const schemaFragment = encodeSchema(
    parse(extractMinimalViableSchemaForRequestDocument(schema, document)),
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
