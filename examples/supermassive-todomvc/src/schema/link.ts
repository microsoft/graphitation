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
import { getOperationDefinitionNode } from "./utils";

export const executableSchemaLink = new ApolloLink((operation) => {
  return new Observable((observer) => {
    (async () => {
      try {
        const operationDefinitionNode = getOperationDefinitionNode(operation);
        if (operationDefinitionNode) {
          let resolveFn;
          if (operationDefinitionNode.operation === "subscription") {
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

          if (typeof result?.[Symbol.asyncIterator] === "function") {
            for await (const item of result) {
              observer.next(item);
            }
          } else {
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
