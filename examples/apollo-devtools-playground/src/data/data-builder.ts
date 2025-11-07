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
  shuffleMessagesResolver,
  userPreferenceResolver,
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
    cache: new ForestRun({
      enableRichHistory: true,
      defaultHistorySize: 50,
    }),
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
  userPreference: userPreferenceResolver,
};

const mutationResolvers = {
  addMessage: addMessageResolver,
  removeMessage: removeMessageResolver,
  updateMessage: updateMessageResolver,
  shuffleMessages: shuffleMessagesResolver,
};

const buildResolvers: () => ApolloResolvers = () => {
  const resolvers = {
    Query: queryResolvers,
    Mutation: mutationResolvers,
  };

  return resolvers as ApolloResolvers;
};
