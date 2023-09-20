import { RemplWrapper } from "../rempl-wrapper";
import { NormalizedCacheObject, ApolloClient } from "@apollo/client";
import {
  getRecentOperationsActivity,
  getRecentCacheActivity,
} from "../helpers/recent-activities";
import {
  RecentActivities,
  WatchedQuery,
  WrapperCallbackParams,
  Mutation,
} from "../../types";
import { getRecentData } from "../helpers/parse-apollo-data";

export class ApolloRecentActivityPublisher {
  private apolloPublisher;
  private remplWrapper: RemplWrapper;
  private recordRecentActivity = false;
  private lastIterationData: {
    mutations: Mutation[];
    queries: Map<number, WatchedQuery>;
    cache: NormalizedCacheObject;
  } = {
    cache: {},
    mutations: [],
    queries: new Map(),
  };

  constructor(remplWrapper: RemplWrapper) {
    this.remplWrapper = remplWrapper;
    this.remplWrapper.subscribeToRemplStatus(
      "recent-activity",
      this.trackerDataPublishHandler.bind(this),
      400,
    );
    this.apolloPublisher = remplWrapper.publisher;
    this.attachMethodsToPublisher();
  }

  private attachMethodsToPublisher() {
    this.apolloPublisher.provide("clearRecentActivity", () => {
      this.lastIterationData = { mutations: [], queries: new Map(), cache: {} };
    });

    this.apolloPublisher.provide(
      "recordRecentActivity",
      (options: { shouldRecord?: boolean }) => {
        this.recordRecentActivity = Boolean(options?.shouldRecord);
      },
    );
  }

  private trackerDataPublishHandler({ activeClient }: WrapperCallbackParams) {
    if (!activeClient || !this.recordRecentActivity) {
      return;
    }

    const newData = this.serializeRecentActivityDataObjects(
      activeClient.client,
    );

    if (
      !newData.mutations.length &&
      !newData.queries.length &&
      !newData.cache.length
    ) {
      return;
    }

    this.publishRecentActivityData(newData);
  }

  private serializeRecentActivityDataObjects = (
    client: ApolloClient<NormalizedCacheObject>,
  ) => {
    const recentQueries = this.getQueriesRecentActivity(client);
    const recentMutations = this.getMutationsRecentActivity(client);
    const recentCache = this.getCacheRecentActivity(client);

    return getRecentData(
      recentQueries,
      recentMutations,
      recentCache,
      Date.now(),
    );
  };

  private getQueriesRecentActivity(
    client: ApolloClient<NormalizedCacheObject>,
  ) {
    const currentQueries = this.getQueries(client);

    if (!this.lastIterationData.queries.size) {
      this.lastIterationData.queries = new Map(currentQueries);

      return [];
    }
    const currentQueriesValues: WatchedQuery[] = Array.from(
      currentQueries.values(),
    );
    const lastIterationValues: WatchedQuery[] = Array.from(
      this.lastIterationData.queries.values(),
    );
    this.lastIterationData.queries = new Map(currentQueries);

    return (
      getRecentOperationsActivity(currentQueriesValues, lastIterationValues) ||
      []
    );
  }

  private getCacheRecentActivity(client: ApolloClient<NormalizedCacheObject>) {
    const currentCache = client.cache.extract();
    if (!Object.keys(this.lastIterationData.cache).length) {
      this.lastIterationData.cache = {
        ...currentCache,
      };
      return [];
    }

    const result = getRecentCacheActivity(
      currentCache,
      this.lastIterationData.cache,
    );
    this.lastIterationData.cache = {
      ...currentCache,
    };

    return result || [];
  }

  private getMutationsRecentActivity(
    client: ApolloClient<NormalizedCacheObject>,
  ) {
    const currentMutations = this.getMutations(client);
    if (!Object.keys(this.lastIterationData.mutations).length) {
      this.lastIterationData.mutations = {
        ...currentMutations,
      };
      return [];
    }
    const currentMutationsValues: Mutation[] = Object.values(currentMutations);
    const lastIterationValues = Object.values(this.lastIterationData.mutations);

    this.lastIterationData.mutations = {
      ...currentMutations,
    };

    return (
      getRecentOperationsActivity(
        currentMutationsValues,
        lastIterationValues,
      ) || []
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

  public publishRecentActivityData(recentActivityData: RecentActivities) {
    this.apolloPublisher
      .ns("apollo-recent-activity")
      .publish(recentActivityData);
  }
}
