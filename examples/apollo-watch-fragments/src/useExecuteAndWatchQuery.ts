/**
 * TODO: Rewrite this to mimic Relay's preload APIs and move it to
 *       @graphitation/apollo-react-relay-duct-tape.
 */

import {
  useApolloClient,
  ApolloQueryResult,
  useQuery as useApolloQuery,
} from "@apollo/client";
import { DocumentNode } from "graphql";
import { useRef, useState, useEffect } from "react";

export function useExecuteAndWatchQuery(
  executionQuery: DocumentNode,
  watchQuery: DocumentNode,
  variables: Record<string, any>
) {
  const client = useApolloClient();
  const inFlightQuery = useRef<Promise<ApolloQueryResult<unknown>>>();

  const [[completed, error], setCompletionStatus] = useState<
    [completed: boolean, error: Error | undefined]
  >([false, undefined]);

  if (error) {
    throw error;
  }

  useEffect(() => {
    if (!completed && inFlightQuery.current === undefined) {
      inFlightQuery.current = client.query({
        query: executionQuery,
        variables,
      });
      inFlightQuery.current
        .then((result) => setCompletionStatus([true, result.error]))
        .catch((error) => setCompletionStatus([true, error]))
        .then(() => {
          // No need to hang onto this any longer than necessary.
          // TODO: How does Apollo evict from the store?
          inFlightQuery.current = undefined;
        });
    }
    return () => {
      // TODO: [How to] Cancel in-flight request?
      // TODO: How does Apollo evict from the store?
      inFlightQuery.current = undefined;
    };
  }, [completed, inFlightQuery.current]);

  return useApolloQuery(watchQuery, {
    fetchPolicy: "cache-only",
    skip: !completed,
  });
}
