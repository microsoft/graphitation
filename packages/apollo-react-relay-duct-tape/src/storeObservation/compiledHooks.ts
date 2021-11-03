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
  const [_, forceUpdate] = useState({});

  // Not using state for the status object, because we don't want to trigger a
  // state update when we reset things due to new variables coming in.
  const execution = useRef<{
    query?: Promise<ApolloQueryResult<unknown>>;
    status: { loading: boolean; error?: Error };
  }>({
    query: undefined,
    status: { loading: true, error: undefined },
  });
  const { loading, error } = execution.current.status;

  useEffect(() => {
    if (
      execution.current.status.loading &&
      execution.current.query === undefined
    ) {
      execution.current.query = client.query({
        query: documents.executionQueryDocument,
        variables: options.variables,
      });
      execution.current.query
        .then((result) => {
          execution.current.status = { loading: false, error: result.error };
          forceUpdate({});
        })
        .catch((err) => {
          execution.current.status = { loading: false, error: err };
          forceUpdate({});
        })
        .then(() => {
          // No need to hang on to the results here any longer than necessary,
          // assuming Apollo doesn't trigger a GC round of its store.
          execution.current.query = undefined;
        });
    }
    return () => {
      // TODO: [How to] Cancel in-flight request?
      // TODO: How does Apollo evict from the store?
      execution.current.status = { loading: true, error: undefined };
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
