import { RemplWrapper } from "../rempl-wrapper";
import {
  parse,
  type DocumentNode,
  type OperationDefinitionNode,
} from "graphql";

import { ApolloClientsObject, WrapperCallbackParams } from "../../types";

export class GraphiQLPublisher {
  private apolloPublisher;
  private remplWrapper: RemplWrapper;
  private apolloClients: ApolloClientsObject = {};

  constructor(remplWrapper: RemplWrapper) {
    this.remplWrapper = remplWrapper;
    this.remplWrapper.subscribeToRemplStatus(
      "graphiql",
      this.cachePublishHandler.bind(this),
      6000,
    );
    this.apolloPublisher = remplWrapper.publisher;
    this.attachMethodsToPublisher();
  }

  private getOperationType(operation: DocumentNode): string | null {
    const operationDefinitionNode = operation.definitions.find(
      (definition) => definition.kind === "OperationDefinition",
    );

    if (operationDefinitionNode) {
      return (operationDefinitionNode as OperationDefinitionNode).operation;
    }

    return null;
  }
  private attachMethodsToPublisher() {
    this.apolloPublisher.provide(
      "graphiql",
      (activeClientId: string, graphQLParams: any) => {
        const client = this.apolloClients[activeClientId];

        const documentNode = parse(graphQLParams.query);
        const operationName = this.getOperationType(documentNode);

        if (operationName === "query") {
          return client.query({
            query: documentNode,
            variables: graphQLParams.variables,
          });
        } else if (operationName === "mutation") {
          return client.mutate({
            mutation: documentNode,
            variables: graphQLParams.variables,
          });
        } else {
          throw new Error(`Unsupported operation type ${operationName}`);
        }
      },
    );
  }

  private cachePublishHandler({ clientObjects }: WrapperCallbackParams) {
    for (const client of clientObjects) {
      if (this.apolloClients[client.clientId]) {
        continue;
      }
      this.apolloClients[client.clientId] = client.client;
    }
  }
}
