import { ApolloClient, NormalizedCacheObject } from "@apollo/client";
import { RemplWrapper } from "../rempl-wrapper";
import {
  ApolloInspector,
  IDataView,
  IApolloClientObject,
} from "apollo-inspector";
import { ClientObject, WrapperCallbackParams } from "../../types";
import { Subscription } from "rxjs";
import { ICopyData } from "apollo-inspector-ui";

export class ApolloOperationsTrackerPublisher {
  private remplWrapper: RemplWrapper;
  protected apolloPublisher;
  protected apolloClients: ClientObject[];
  protected activeClient: ApolloClient<NormalizedCacheObject> | undefined;

  private trackingSubscription: Subscription | null;

  constructor(remplWrapper: RemplWrapper) {
    this.apolloClients = [];
    this.remplWrapper = remplWrapper;
    this.remplWrapper.subscribeToRemplStatus(
      "operations-tracker",
      this.setActiveClient.bind(this),
      1000,
    );
    this.apolloPublisher = remplWrapper.publisher;
    this.attachMethodsToPublisher();
    this.trackingSubscription = null;
  }

  protected attachMethodsToPublisher() {
    this.apolloPublisher.provide("startOperationsTracker", (options: any) => {
      this.trackingSubscription?.unsubscribe();
      const apolloClients: IApolloClientObject[] = this.apolloClients.map(
        (ac) =>
          ({
            client: ac.client as ApolloClient<NormalizedCacheObject>,
            clientId: ac.clientId,
          } as unknown as IApolloClientObject),
      );
      const inspector = new ApolloInspector(apolloClients);

      const observable = inspector.startTrackingSubscription({
        tracking: { trackVerboseOperations: true },
        apolloClientIds: options.clientIds,
        delayOperationsEmitByInMS: 1000,
      });

      const subscription = observable.subscribe({
        next: (data) => {
          this.publishApolloOperations(data);
        },
        error: () => {
          subscription.unsubscribe();
        },
        complete: () => {
          subscription.unsubscribe();
        },
      });

      this.trackingSubscription = subscription as any;
    });

    this.apolloPublisher.provide("stopOperationsTracker", () => {
      try {
        this.trackingSubscription?.unsubscribe();
      } catch (error) {
        // publish error to subscriber to show error UX
        this.publishApolloOperations({
          error: JSON.stringify(error),
          message: "Something went wrong",
        } as any);
      }
    });

    this.apolloPublisher.provide(
      "copyOperationsData",
      (data: { data: ICopyData }) => {
        try {
          if (data.data.clientId) {
            const apolloClient = this.apolloClients.find(
              (ac) => ac.clientId === data.data.clientId,
            );
            window.navigator.clipboard.writeText(
              JSON.stringify(apolloClient?.client.cache.extract()),
            );
          } else {
            const copiedData = JSON.stringify(data.data.operations);
            window.navigator.clipboard.writeText(copiedData);
          }
        } catch {
          /* empty */
        }
      },
    );

    this.apolloPublisher.provide("getApolloClientsIds", () => {
      const clientIds = this.apolloClients.map((client) => client.clientId);
      this.apolloPublisher.ns("apollo-operations-tracker").publish(clientIds);
    });
  }

  protected publishApolloOperations(data: IDataView) {
    this.apolloPublisher.ns("apollo-operations-tracker").publish(data);
  }

  private setActiveClient({
    activeClient,
    clientObjects,
  }: WrapperCallbackParams) {
    this.activeClient = activeClient?.client;
    this.apolloClients = clientObjects;

    const clientIds = this.apolloClients.map((client) => client.clientId);
    this.apolloPublisher.ns("apollo-operations-tracker").publish(clientIds);
  }
}
