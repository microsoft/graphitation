import { ApolloLink, Observable } from "@apollo/client";
import {
  executeWithoutSchema as supermassiveExecute,
  subscribeWithoutSchema as supermassiveSubscribe,
  DocumentNode,
  Resolvers,
} from "@graphitation/supermassive";
import { resolvers, TodoStorage } from "./resolvers";
import { resolvers as generatedResolvers } from "./__generated__/typeDefs";
import { getOperationDefinitionNode } from "./utils";

export const supermassiveSchemaLink = new ApolloLink((operation) => {
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
            document: operation?.query as DocumentNode,
            resolvers: resolvers,
            schemaResolvers: generatedResolvers,
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
