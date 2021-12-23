import { useRef, useState, useEffect } from "react";
import {
  QueryResult,
  useApolloClient,
  useQuery as useApolloQuery,
  ApolloQueryResult,
} from "@apollo/client";
import { DocumentNode } from "graphql";
import invariant from "invariant";

/**
 * @todo Rewrite this to mimic Relay's preload APIs
 *
 * @param documents Compiled execute and watch query documents that are used to
 *                  setup a narrow observable for just the data selected by the
 *                  original fragment.
 * @param options An object containing a variables field.
 */
export function useCompiledLazyLoadQuery(
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

/**
 * @param documents Compiled watch query document that is used to setup a narrow
 *                  observable for just the data selected by the original fragment.
 * @param fragmentReference A Node object that has a globally unique `id` field.
 */
export function useCompiledFragment(
  documents: {
    watchQueryDocument: DocumentNode;
  },
  fragmentReference: { id: unknown }
) {
  const result = useApolloQuery(documents.watchQueryDocument, {
    variables: { id: fragmentReference.id },
    fetchPolicy: "cache-only",
  });
  invariant(
    result.data?.node,
    "Expected Apollo to response with previously seeded node data"
  );
  return result.data.node;
}
