import { GraphQLError, print, getOperationAST } from "graphql";

import {
  WatchedQuery,
  Mutation as MutationType,
  RecentActivityRaw,
  RecentActivity,
  RecentActivities,
} from "../../types";

export function filterMutationInfo(mutations: any[]): MutationType[] {
  return mutations.map((mutation: any, key: number) =>
    getMutationData(mutation, key.toString())
  );
}

export function getErrorMessage(graphQLErrors?: GraphQLError[]) {
  if (!graphQLErrors || !graphQLErrors.length) {
    return;
  }

  return `Path: ${graphQLErrors[0].path} Stack: ${graphQLErrors[0].stack}`;
}

export function filterQueryInfo(
  queryInfoMap: Map<string, any>
): WatchedQuery[] {
  const queries = Array.from(queryInfoMap.values());
  return queries
    .map((query: any, id: number) => getQueryData(id.toString(), query))
    .filter(Boolean) as WatchedQuery[];
}

function getRecentQueryData({
  id,
  data,
  change,
}: RecentActivityRaw): RecentActivity<WatchedQuery> | undefined {
  const queryData = getQueryData(id, data);
  if (!queryData) {
    return queryData;
  }

  return {
    id,
    data: queryData,
    change,
  };
}

function getQueryData(id: string, query: any): WatchedQuery | undefined {
  if (!query || !query.document) return;
  const name = getOperationAST(query?.document)?.name?.value || "";
  if (name === "IntrospectionQuery") {
    return;
  }

  const graphQLErrorMessage = getErrorMessage(
    query.graphQLErrors as GraphQLError[]
  );

  const networkErrorMessage = (query.networkError as Error)?.stack;

  return {
    id,
    typename: "WatchedQuery",
    name,
    queryString: print(query.document),
    variables: query.variables,
    cachedData: query.cachedData,
    errorMessage: graphQLErrorMessage || networkErrorMessage,
  };
}

function getMutationData(mutation: any, id: string): MutationType {
  const error = mutation.error;

  const graphQLErrorMessage = getErrorMessage(
    error?.graphQLErrors as GraphQLError[]
  );

  const networkErrorMessage = (error?.networkError as Error)?.stack;
  return {
    id,
    typename: "Mutation",
    name: getOperationAST(mutation.mutation)?.name?.value || "",
    mutationString: print(mutation.mutation),
    variables: mutation.variables,
    errorMessage: graphQLErrorMessage || networkErrorMessage || error?.stack,
  };
}

function getRecentMutationData({
  id,
  data,
  change,
}: RecentActivityRaw): RecentActivity<MutationType> | undefined {
  if (!data) return;

  return {
    id,
    data: getMutationData(data, id),
    change,
  };
}

export const getRecentData = (
  queries: RecentActivityRaw[],
  mutations: RecentActivityRaw[],
  timestamp: number
): RecentActivities => {
  const filteredQueries: RecentActivity<WatchedQuery>[] = queries
    .map(getRecentQueryData)
    .filter(Boolean) as RecentActivity<WatchedQuery>[];

  const mappedMutations: RecentActivity<MutationType>[] = mutations
    .map(getRecentMutationData)
    .filter(Boolean) as RecentActivity<MutationType>[];

  return { mutations: mappedMutations, queries: filteredQueries, timestamp };
};
