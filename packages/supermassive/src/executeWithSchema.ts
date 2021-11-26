import { makeExecutableSchema } from "@graphql-tools/schema";
import { isInputType, parse } from "graphql";
import {
  addTypesToRequestDocument,
  executeWithoutSchema,
  extractImplicitTypes,
  specifiedScalars,
} from ".";
import resolvers from "./benchmarks/swapi-schema/resolvers";
import { PromiseOrValue } from "./jsutils/PromiseOrValue";
import {
  FieldResolver,
  TypeResolver,
  Resolvers,
  ExecutionResult,
  ExecutionWithSchemaArgs,
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
}: ExecutionWithSchemaArgs): PromiseOrValue<ExecutionResult> {
  const schema = makeExecutableSchema({ typeDefs, resolvers });
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
  const fullResolvers = {
    ...extractedResolvers,
    ...((resolvers as any) as Resolvers<any, any>),
  };
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
