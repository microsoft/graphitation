import { RemplWrapper, browserWindow } from "../rempl-wrapper";

export class ApolloGlobalOperationsPublisher {
  private apolloPublisher;
  private remplWrapper: RemplWrapper;

  constructor(remplWrapper: RemplWrapper) {
    this.remplWrapper = remplWrapper;
    this.remplWrapper.subscribeToRemplStatus(
      "global-operations",
      this.globalOperationsFetcherHandler.bind(this),
      6000,
    );
    this.apolloPublisher = remplWrapper.publisher;
  }

  private globalOperationsFetcherHandler() {
    if (!browserWindow.__APOLLO_GLOBAL_OPERATIONS__) {
      return;
    }

    this.apolloPublisher
      .ns("apollo-global-operations")
      .publish(browserWindow.__APOLLO_GLOBAL_OPERATIONS__);

    this.remplWrapper.unSubscribeToRemplStatus("global-operations");
  }
}
