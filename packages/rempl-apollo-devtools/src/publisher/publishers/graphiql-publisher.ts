import { RemplWrapper } from "../rempl-wrapper";
import { parse } from "graphql";

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

  private attachMethodsToPublisher() {
    this.apolloPublisher.provide(
      "graphiql",
      (activeClientId: string, graphQLParams: any) => {
        const client = this.apolloClients[activeClientId];

        return client.query({
          query: parse(graphQLParams.query),
          variables: graphQLParams.variables,
        });
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
