import { isInputType, buildASTSchema } from "graphql";
import {
  addTypesToRequestDocument,
  executeWithoutSchema,
  extractImplicitTypes,
  specifiedScalars,
} from "./index";
import { PromiseOrValue } from "./jsutils/PromiseOrValue";
import {
  Resolvers,
  ExecutionResult,
  ExecutionWithSchemaArgs,
  IncrementalExecutionResults,
} from "./types";

export function executeWithSchema({
  typeDefs,
  resolvers,
  document: rawDocument,
  rootValue,
  contextValue,
  variableValues,
  operationName,
  fieldResolver,
  typeResolver,
  fieldExecutionHooks,
}: ExecutionWithSchemaArgs): PromiseOrValue<
  ExecutionResult | IncrementalExecutionResults
> {
  const schema = buildASTSchema(typeDefs);
  let extractedResolvers: Resolvers = {};
  const getTypeByName = (name: string) => {
    const type = specifiedScalars[name] || extractedResolvers[name];
    if (isInputType(type)) {
      return type;
    } else {
      throw new Error("Invalid type");
    }
  };
  extractedResolvers = extractImplicitTypes(typeDefs, getTypeByName);

  const document = addTypesToRequestDocument(schema, rawDocument);
  return executeWithoutSchema({
    document,
    resolvers,
    schemaResolvers: extractedResolvers,
    rootValue,
    contextValue,
    variableValues,
    operationName,
    fieldResolver,
    typeResolver,
    fieldExecutionHooks,
  });
}
