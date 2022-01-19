import { ApolloLink, Observable, Operation } from "@apollo/client";
import { Kind } from "graphql";

import {
  executeWithoutSchema as supermassiveExecute,
  subscribeWithoutSchema as supermassiveSubscribe,
  DocumentNode,
  OperationDefinitionNode,
  Resolvers,
} from "@graphitation/supermassive";
import { resolvers, TodoStorage } from "./resolvers";
import { resolvers as generatedResolvers } from "./__generated__/typeDefs";

function getOperationDefinitionNode(
  operation: Operation
): OperationDefinitionNode | null {
  if (operation?.query?.definitions) {
    const operationDefinitionNode = operation.query.definitions.find(
      ({ kind }) => kind === Kind.OPERATION_DEFINITION
    ) as OperationDefinitionNode | undefined;

    if (operationDefinitionNode?.operation) {
      return operationDefinitionNode;
    }
  }
  return null;
}

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
            resolvers: { ...generatedResolvers, ...resolvers } as Resolvers,
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
