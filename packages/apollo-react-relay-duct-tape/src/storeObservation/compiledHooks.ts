import { useRef, useState, useEffect, useMemo } from "react";
import {
  QueryResult,
  useApolloClient,
  useQuery as useApolloQuery,
  ApolloError,
  FetchMoreQueryOptions,
  ObservableQuery,
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
  const executionQuery = useRef<ObservableQuery>();
  const [[loading, error], setLoadingStatus] = useState<
    [loading: boolean, error: ApolloError | undefined]
  >([true, undefined]);

  useEffect(() => {
    if (loading && executionQuery.current === undefined) {
      executionQuery.current = client.watchQuery({
        query: documents.executionQueryDocument,
        variables: options.variables,
      });
      const subscription = executionQuery.current.subscribe((result) => {
        if (!result.loading) {
          subscription.unsubscribe();
          setLoadingStatus([false, result.error]);
        }
      });
    }
    return () => {
      // TODO: [How to] Cancel in-flight request?
      // TODO: How does Apollo evict from the store?
      executionQuery.current = undefined;
    };
  }, [documents.executionQueryDocument, options.variables]);

  const watchQueryResponse = useApolloQuery(documents.watchQueryDocument, {
    variables: options.variables,
    fetchPolicy: "cache-only",
    skip: loading || !!error,
  });
  return {
    ...watchQueryResponse,
    loading,
    error,
    fetchMore: (options: FetchMoreQueryOptions<unknown>) => {
      invariant(
        executionQuery.current,
        "Expected query to have started before fetching more list data"
      );
      return executionQuery.current.fetchMore(options);
    },
    subscribeToMore: (options) => {
      invariant(
        executionQuery.current,
        "Expected query to have started before subscribing to more data"
      );
      return executionQuery.current.subscribeToMore(options);
    },
  };
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
    "Expected Apollo to response with previously seeded node data"
  );
  return result.data.node;
}
