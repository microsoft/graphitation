import { ApolloClient, NormalizedCacheObject } from "@apollo/client";
import { RemplWrapper } from "../rempl-wrapper";
import {
  ApolloInspector,
  IStopTracking,
  IInspectorTrackingConfig,
  IDataView,
} from "apollo-inspector";
import { WrapperCallbackParams } from "../../types";

export class ApolloOperationsTrackerPublisher {
  private remplWrapper: RemplWrapper;
  protected apolloPublisher;
  protected stopTracking: IStopTracking | undefined;
  protected activeClient: ApolloClient<NormalizedCacheObject> | undefined;
  protected isRecording: boolean;

  constructor(remplWrapper: RemplWrapper) {
    this.remplWrapper = remplWrapper;
    this.isRecording = false;
    this.remplWrapper.subscribeToRemplStatus(
      "operations-tracker",
      this.setActiveClient.bind(this),
      1000,
    );
    this.apolloPublisher = remplWrapper.publisher;
    this.attachMethodsToPublisher();
  }

  protected attachMethodsToPublisher() {
    this.apolloPublisher.provide(
      "startOperationsTracker",
      (options: IInspectorTrackingConfig | undefined) => {
        if (this.activeClient) {
          this.isRecording = true;
          const inspector = new ApolloInspector(this.activeClient);
          if (options && Object.keys(options).length === 0) {
            options = undefined;
          }
          this.stopTracking = inspector.startTracking(
            (options as unknown) as IInspectorTrackingConfig,
          );
        }
      },
    );

    this.apolloPublisher.provide("stopOperationsTracker", () => {
      if (this.stopTracking) {
        this.isRecording = false;
        try {
          const data = this.stopTracking?.();
          this.publishApolloOperations(data);
        } catch (error) {
          // publish error to subscriber to show error UX
          this.publishApolloOperations({
            error: JSON.stringify(error),
            message: "Something went wrong",
          } as any);
          throw error;
        }

        this.stopTracking = undefined;
      }
    });
  }

  protected publishApolloOperations(data: IDataView) {
    this.apolloPublisher.ns("apollo-operations-tracker").publish(data);
  }

  private setActiveClient({ activeClient }: WrapperCallbackParams) {
    this.activeClient = activeClient?.client;
  }
}
