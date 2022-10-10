import {
  NormalizedCacheObject,
  ApolloClient,
  StoreObject,
} from "@apollo/client";
import { createPublisher } from "rempl";

export type Publisher = ReturnType<typeof createPublisher>;

export type WrapperCallbackParams = {
  clientObjects: ClientObject[];
  activeClient: ClientObject | null;
};

export type ClientObject = {
  clientId: string;
  client: ApolloClient<NormalizedCacheObject>;
};

export type ApolloGlobalOperations = {
  globalQueries: string[];
  globalMutations: string[];
  globalSubscriptions: string[];
};

export type ApolloKeyFields = Record<string, string[]>;

declare global {
  interface Window {
    __APOLLO_CLIENTS__: ClientObject[];
    __APOLLO_GLOBAL_OPERATIONS__: ApolloGlobalOperations;
    __APOLLO_KEY_FIELDS__: ApolloKeyFields;
    __REMPL_APOLLO_DEVTOOLS_URL__?: string;
  }
}

export type RecentActivity<Data> = {
  id: string;
  change: string;
  type: string;
  data: Data;
};
export type CacheStoreObject = { __activity_key: string } & StoreObject;
export type RecentActivities = {
  queries: RecentActivity<WatchedQuery>[];
  mutations: RecentActivity<Mutation>[];
  cache: RecentActivity<CacheStoreObject>[];
  timestamp: number;
};

export type RecentActivityRaw = {
  id: string;
  change: string;
  type: string;
  data: WatchedQuery | Mutation | CacheStoreObject;
};

export type CacheDuplicates = {
  type: string;
  duplicates: { [key: string]: StoreObject };
}[];

export type ApolloTrackerData = {
  mutations: Mutation[];
  queries: WatchedQuery[];
};

export type ApolloTrackerMetadata = {
  mutationsCount: number;
  queriesCount: number;
  queriesHaveError: boolean;
  mutationsHaveError: boolean;
};

export type ClientRecentCacheObject = NormalizedCacheObject;

export type ApolloClientsObject = {
  [clientId: string]: ApolloClient<NormalizedCacheObject>;
};

export type FetcherParams = {
  query: string;
  operationName: string;
  variables?: any;
};

interface Query {
  id: string;
  name: string;
  change?: string;
  variables: Record<string, unknown>;
  errorMessage?: string;
}

export type WatchedQuery = Query & {
  typename: "WatchedQuery";
  queryString: string;
  cachedData?: Record<string, unknown>;
  networkData?: Record<string, unknown>;
};

export type Mutation = Query & {
  typename: "Mutation";
  mutationString: string;
};
