import type { WatchQueryFetchPolicy as ApolloWatchQueryFetchPolicy } from "@apollo/client";
import type { FetchPolicy } from "./types";

/**
 * This is for internal use only.
 */
type PrivateFetchPolicy = FetchPolicy | "no-cache";

const FETCH_POLICY_MAPPING: Record<
  PrivateFetchPolicy,
  ApolloWatchQueryFetchPolicy
> = {
  "store-or-network": "cache-first",
  "store-and-network": "cache-and-network",
  "network-only": "network-only",
  "store-only": "cache-only",
  "no-cache": "no-cache",
};

export function convertFetchPolicy(
  fetchPolicy: PrivateFetchPolicy | undefined,
): ApolloWatchQueryFetchPolicy | undefined {
  return fetchPolicy && FETCH_POLICY_MAPPING[fetchPolicy];
}
