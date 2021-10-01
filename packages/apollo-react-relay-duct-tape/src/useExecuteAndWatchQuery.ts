import {
  useApolloClient,
  ApolloQueryResult,
  useQuery as useApolloQuery,
  QueryResult,
} from "@apollo/client";
import { DocumentNode } from "graphql";
import { useRef, useState, useEffect } from "react";

/**
 * TODO: Rewrite this to mimic Relay's preload APIs and move it to
 *       @graphitation/apollo-react-relay-duct-tape.
 */
export function useExecuteAndWatchQuery(
  documents: {
    executionQueryDocument: DocumentNode;
    watchQueryDocument: DocumentNode;
  },
  options: { variables: Record<string, any> }
): QueryResult {
  const client = useApolloClient();
  const inFlightQuery = useRef<Promise<ApolloQueryResult<unknown>>>();

  const [[loading, error], setLoadingStatus] = useState<
    [completed: boolean, error: Error | undefined]
  >([true, undefined]);

  if (error) {
    throw error;
  }

  useEffect(() => {
    if (loading && inFlightQuery.current === undefined) {
      inFlightQuery.current = client.query({
        query: documents.executionQueryDocument,
        variables: options.variables,
      });
      inFlightQuery.current
        .then((result) => setLoadingStatus([false, result.error]))
        .catch((error) => setLoadingStatus([false, error]))
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
  }, [loading, inFlightQuery.current]);

  const watchQueryResponse = useApolloQuery(documents.watchQueryDocument, {
    variables: options.variables,
    fetchPolicy: "cache-only",
    skip: loading,
  });
  return { ...watchQueryResponse, loading };
}
