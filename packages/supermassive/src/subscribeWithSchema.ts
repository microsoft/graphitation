import { makeExecutableSchema } from "@graphql-tools/schema";
import { isInputType, parse } from "graphql";
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

  return subscribeWithoutSchema({
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
