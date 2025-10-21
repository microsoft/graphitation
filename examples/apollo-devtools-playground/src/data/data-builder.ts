import {
  ApolloClient,
  from,
  NormalizedCacheObject,
  Resolvers as ApolloResolvers,
} from "@apollo/client";

import { ForestRun } from "@graphitation/apollo-forest-run";

import { makeExecutableSchema } from "@graphql-tools/schema";

import {
  messageResolver,
  addMessageResolver,
  removeMessageResolver,
  updateMessageResolver,
  chatResolver,
} from "./resolver/resolvers";

import createGraphQLContext, { IGraphQLContext } from "./graphql-context";
import typeDefs from "./typeDefs";
import { SchemaLink } from "@apollo/client/link/schema";

export const buildClient: () => ApolloClient<NormalizedCacheObject> = () => {
  const schema = makeExecutableSchema<IGraphQLContext>({
    typeDefs,
    resolvers: buildResolvers(),
  });

  return new ApolloClient({
    cache: new ForestRun({}),
    connectToDevTools: true,
    link: from([
      new SchemaLink({
        schema: schema,
        context: createGraphQLContext(),
      }),
    ]),
  });
};

const queryResolvers = {
  message: messageResolver,
  chat: chatResolver,
};

const mutationResolvers = {
  addMessage: addMessageResolver,
  removeMessage: removeMessageResolver,
  updateMessage: updateMessageResolver,
};

const buildResolvers: () => ApolloResolvers = () => {
  const resolvers = {
    Query: queryResolvers,
    Mutation: mutationResolvers,
  };

  return resolvers as ApolloResolvers;
};
