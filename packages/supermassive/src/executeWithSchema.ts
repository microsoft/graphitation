import { isInputType, buildASTSchema } from "graphql";
import {
  addTypesToRequestDocument,
  executeWithoutSchema,
  extractImplicitTypes,
  specifiedScalars,
} from "./index";
import { PromiseOrValue } from "./jsutils/PromiseOrValue";
import { Resolvers, ExecutionResult, ExecutionWithSchemaArgs } from "./types";
import { mergeResolvers } from "./utilities/mergeResolvers";

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
}: ExecutionWithSchemaArgs): PromiseOrValue<ExecutionResult> {
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
  const fullResolvers = mergeResolvers(
    (resolvers as any) as Resolvers<any, any>,
    extractedResolvers,
  );

  const document = addTypesToRequestDocument(schema, rawDocument);
  return executeWithoutSchema({
    document,
    resolvers: fullResolvers,
    rootValue,
    contextValue,
    variableValues,
    operationName,
    fieldResolver,
    typeResolver,
  });
}
