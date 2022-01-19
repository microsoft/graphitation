import { execute as graphQLExecute, DocumentNode } from "graphql";
import {
  executeWithSchema as supermassiveExecute,
  subscribeWithSchema as supermassiveSubscribe,
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
        if (operation?.query?.definitions) {
          const operationDefinition: any = operation.query.definitions.find(
            ({ kind }) => kind === "OperationDefinition"
          );
          if (operationDefinition) {
            let resolveFn;
            if (operationDefinition.operation === "subscription") {
              resolveFn = supermassiveSubscribe;
            } else {
              resolveFn = supermassiveExecute;
            }

            const result: any = await resolveFn({
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
          }
        }
        observer.complete();
      } catch (e) {
        observer.error(e);
      }
    })();
  });
});
