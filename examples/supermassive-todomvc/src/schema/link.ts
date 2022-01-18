import { execute as graphQLExecute, DocumentNode } from "graphql";
import {
  executeWithSchema as supermassiveExecute,
  Resolvers,
} from "@graphitation/supermassive";
import { ApolloLink, Observable } from "@apollo/client";
import { resolvers as generatedResolvers } from "./__generated__/typeDefs";
import { resolvers, TodoStorage } from "./resolvers";
import typeDefs from "./typeDefs.graphql";

export const executableSchemaLink = new ApolloLink((operation) => {
  return new Observable((observer) => {
    (async () => {
      try {
        const result = await supermassiveExecute({
          operationName: operation?.operationName,
          variableValues: operation?.variables,
          resolvers: { ...generatedResolvers, ...resolvers } as Resolvers,
          document: operation.query as DocumentNode,
          typeDefs,
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
