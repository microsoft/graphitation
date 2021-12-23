import { execute as graphQLExecute, isInputType, parse } from "graphql";
import {
  extractImplicitTypes,
  Resolvers,
  specifiedScalars,
} from "@graphitation/supermassive";
import { ApolloLink, Observable } from "@apollo/client";
import { resolvers, TodoStorage } from "./resolvers";
import schema from "./schema";
import typeDefs from "./typeDefs.graphql";

export const executableSchemaLink = new ApolloLink((operation) => {
  return new Observable((observer) => {
    (async () => {
      try {
        const result = await graphQLExecute({
          document: operation.query,
          schema,
          contextValue: {
            todoStorage: new TodoStorage(window.localStorage),
          },
        });
        observer.next(result);
        observer.complete();
      } catch (e) {
        observer.error(e);
      }
    })();
  });
});
