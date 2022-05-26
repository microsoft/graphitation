import { RemplWrapper } from "../rempl-wrapper";
import { NormalizedCacheObject, ApolloClient } from "@apollo/client";
import { getRecentActivities } from "../helpers/recent-activities";
import { RecentActivities, WrapperCallbackParams } from "../../types";
import { getRecentData } from "../helpers/parse-apollo-data";

export class ApolloRecentActivityPublisher {
  private apolloPublisher;
  private remplWrapper: RemplWrapper;
  private recordRecentActivity = false;
  private lastIterationData: {
    mutations: unknown[];
    queries: Map<number, unknown>;
  } = {
    mutations: [],
    queries: new Map(),
  };

  constructor(remplWrapper: RemplWrapper) {
    this.remplWrapper = remplWrapper;
    this.remplWrapper.subscribeToRemplStatus(
      "recent-activities",
      this.trackerDataPublishHandler.bind(this),
      400
    );
    this.apolloPublisher = remplWrapper.publisher;
    this.attachMethodsToPublisher();
  }

  private attachMethodsToPublisher() {
    this.apolloPublisher.provide("clearRecentActivity", () => {
      this.lastIterationData = { mutations: [], queries: new Map() };
    });

    this.apolloPublisher.provide("recordRecentActivity", (options) => {
      this.recordRecentActivity = Boolean(options?.shouldRecord);
    });
  }

  private trackerDataPublishHandler({ activeClient }: WrapperCallbackParams) {
    if (!activeClient || !this.recordRecentActivity) {
      return;
    }

    const newData = this.serializeRecentActivitiesDataObjects(
      activeClient.client
    );

    if (!newData.mutations.length && !newData.queries.length) {
      return;
    }

    this.publishRecentActivitiesData(newData);
  }

  private serializeRecentActivitiesDataObjects = (
    client: ApolloClient<NormalizedCacheObject>
  ) => {
    const recentQueries = this.getQueriesRecentActivities(client);
    const recentMutations = this.getMutationsRecentActivities(client);

    return getRecentData(recentQueries, recentMutations, Date.now());
  };

  private getQueriesRecentActivities(
    client: ApolloClient<NormalizedCacheObject>
  ) {
    const currentQueries = this.getQueries(client);
    if (!this.lastIterationData.queries.size) {
      this.lastIterationData.queries = new Map(currentQueries);

      return [];
    }
    const currentQueriesValues = Array.from(currentQueries.values());
    const lastIterationValues = Array.from(
      this.lastIterationData.queries.values()
    );
    this.lastIterationData.queries = new Map(currentQueries);

    return getRecentActivities(currentQueriesValues, lastIterationValues) || [];
  }

  private getMutationsRecentActivities(
    client: ApolloClient<NormalizedCacheObject>
  ) {
    const currentMutations = this.getMutations(client);
    if (!Object.keys(this.lastIterationData.mutations).length) {
      this.lastIterationData.mutations = {
        ...currentMutations,
      };
      return [];
    }
    const currentMutationsValues = Object.values(currentMutations);
    const lastIterationValues = Object.values(this.lastIterationData.mutations);

    this.lastIterationData.mutations = {
      ...currentMutations,
    };

    return (
      getRecentActivities(currentMutationsValues, lastIterationValues) || []
    );
  }

  private getMutations(client: any) {
    // Apollo Client 2 to 3.2
    if (client.queryManager.mutationStore?.getStore) {
      return client.queryManager.mutationStore.getStore();
    } else {
      // Apollo Client 3.3+
      return client.queryManager.mutationStore;
    }
  }

  private getQueries(client: any) {
    if (client.queryManager.queryStore?.getStore) {
      return client.queryManager.queryStore.getStore();
    } else {
      return client.queryManager.queries;
    }
  }

  public publishRecentActivitiesData(recentActivitiesData: RecentActivities) {
    this.apolloPublisher
      .ns("apollo-recent-activity")
      .publish(recentActivitiesData);
  }
}
