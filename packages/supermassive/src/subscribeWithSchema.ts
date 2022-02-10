import { isInputType, buildASTSchema } from "graphql";
import {
  addTypesToRequestDocument,
  subscribeWithoutSchema,
  extractImplicitTypes,
  specifiedScalars,
} from "./index";
import { PromiseOrValue } from "./jsutils/PromiseOrValue";
import { Resolvers, ExecutionResult, ExecutionWithSchemaArgs } from "./types";

export function subscribeWithSchema({
  typeDefs,
  resolvers,
  document: rawDocument,
  rootValue,
  contextValue,
  variableValues,
  operationName,
  fieldResolver,
  typeResolver,
}: ExecutionWithSchemaArgs): Promise<
  AsyncGenerator<ExecutionResult, void, void> | ExecutionResult
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

  return subscribeWithoutSchema({
    document,
    resolvers,
    schemaResolvers: extractedResolvers,
    rootValue,
    contextValue,
    variableValues,
    operationName,
    fieldResolver,
    typeResolver,
  });
}
