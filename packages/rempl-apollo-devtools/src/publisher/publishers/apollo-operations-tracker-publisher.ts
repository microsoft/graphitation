import { ApolloClient, NormalizedCacheObject } from "@apollo/client";
import { RemplWrapper } from "../rempl-wrapper";
import {
  ApolloInspector,
  IStopTracking,
  IInspectorTrackingConfig,
  IDataView,
  IVerboseOperation,
} from "apollo-inspector";
import { WrapperCallbackParams } from "../../types";

export class ApolloOperationsTrackerPublisher {
  private remplWrapper: RemplWrapper;
  protected apolloPublisher;
  protected stopTracking: IStopTracking | undefined;
  protected activeClient: ApolloClient<NormalizedCacheObject> | undefined;
  protected isRecording: boolean;
  protected lastDataReceived: Map<number, IVerboseOperation> | null;

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
    this.lastDataReceived = null;
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
          const operationsMap = new Map();
          data.verboseOperations?.forEach((op) => {
            operationsMap.set(op.id, op);
          });
          this.lastDataReceived = operationsMap;
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

    this.apolloPublisher.provide(
      "copyOperationsData",
      (ids: number[] | undefined) => {
        if (ids && ids.length === 1 && ids[0] === -1) {
          const stringified = JSON.stringify(
            (this.activeClient?.cache as any).data.data,
          );
          window.navigator.clipboard.writeText(stringified);
          return;
        }
        if (this.lastDataReceived) {
          const copiedOperations: IVerboseOperation[] = [];
          ids?.forEach((id) => {
            if (this.lastDataReceived?.has(id)) {
              copiedOperations.push(
                this.lastDataReceived.get(id) as IVerboseOperation,
              );
            }
          });

          copiedOperations.sort((a, b) => a.id - b.id);
          const stringified = JSON.stringify(copiedOperations);
          window.navigator.clipboard.writeText(stringified);
        }
      },
    );
  }

  protected publishApolloOperations(data: IDataView) {
    this.apolloPublisher.ns("apollo-operations-tracker").publish(data);
  }

  private setActiveClient({ activeClient }: WrapperCallbackParams) {
    this.activeClient = activeClient?.client;
  }
}
