import { useRef, useState, useEffect, useMemo } from "react";
import {
  useApolloClient,
  useQuery as useApolloQuery,
  ApolloError,
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
): { data?: any; error?: Error } {
  const client = useApolloClient();
  const executionQuery = useRef<Promise<ApolloQueryResult<unknown>>>();
  const [[loading, error], setLoadingStatus] = useState<
    [loading: boolean, error: ApolloError | undefined]
  >([true, undefined]);

  useEffect(() => {
    // TODO: This conditional is probably not right when we actually do want a new query to be issued.
    if (loading && executionQuery.current === undefined) {
      executionQuery.current = client.query({
        query: documents.executionQueryDocument,
        variables: options.variables,
      });
      executionQuery.current
        .then((result) => setLoadingStatus([false, result.error]))
        .catch((error) => setLoadingStatus([false, error]))
        .then(() => {
          // No need to hang onto this any longer than necessary.
          // TODO: How does Apollo evict from the store?
          executionQuery.current = undefined;
        });
    }
    return () => {
      // TODO: [How to] Cancel in-flight request?
      // TODO: How does Apollo evict from the store?
      executionQuery.current = undefined;
    };
  }, [documents.executionQueryDocument, options.variables]);

  const { data } = useApolloQuery(documents.watchQueryDocument, {
    variables: options.variables,
    fetchPolicy: "cache-only",
    skip: loading || !!error,
  });

  return { data, error };
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
  const client = useApolloClient();
  const observableQuery = useMemo(
    () =>
      client.watchQuery<{ node: null | {} }>({
        query: documents.watchQueryDocument,
        variables: { id: fragmentReference.id },
        fetchPolicy: "cache-only",
      }),
    [fragmentReference.id, client]
  );
  const [forceUpdateCount, forceUpdate] = useState(0);
  useEffect(() => {
    let skipFirst = true;
    const subscription = observableQuery.subscribe(() => {
      if (skipFirst) {
        skipFirst = false;
      } else {
        forceUpdate(forceUpdateCount + 1);
      }
    });
    return () => subscription.unsubscribe();
  }, [observableQuery]);
  const result = observableQuery.getCurrentResult();
  invariant(
    result.data?.node,
    "Expected Apollo to respond with previously seeded node data"
  );
  return result.data.node;
}

export function useCompiledRefetchableFragment(
  documents: {
    executionQueryDocument: DocumentNode;
    watchQueryDocument: DocumentNode;
  },
  fragmentReference: { id: unknown }
) {
  return useCompiledFragment(documents, fragmentReference);
}
