import {
  useRef,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useReducer,
} from "react";
import {
  useApolloClient,
  useQuery as useApolloQuery,
  ApolloQueryResult,
} from "@apollo/client";
import invariant from "invariant";
import { useDeepCompareMemoize } from "./useDeepCompareMemoize";
import type { CompiledArtefactModule } from "relay-compiler-language-graphitation";

interface FragmentReference {
  /**
   * In case of a watch query on a Node type, the `id` needs to be provided.
   * In case of a watch query on the Query type, this should be omitted.
   */
  id?: unknown;

  /**
   * These are the request variables, which is named awkwardly `__fragments`
   * because that's the name of the property Relay uses to pass context data so
   * not introducing a different property name felt right, from a migration
   * perspective.
   */
  __fragments?: Record<string, any>;
}

/**
 * @todo Rewrite this to mimic Relay's preload APIs
 *
 * @param documents Compiled execute and watch query documents that are used to
 *                  setup a narrow observable for just the data selected by the
 *                  original fragment.
 * @param options An object containing a variables field.
 */
export function useCompiledLazyLoadQuery(
  documents: CompiledArtefactModule,
  options: { variables: Record<string, any> }
): { data?: any; error?: Error } {
  const { watchQueryDocument, executionQueryDocument } = documents;
  invariant(
    executionQueryDocument && watchQueryDocument,
    "Expected compiled artefact to have a executionQueryDocument and watchQueryDocument"
  );

  const client = useApolloClient();
  const forceUpdate = useForceUpdate();
  const variables = useDeepCompareMemoize(options.variables);

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
        query: executionQueryDocument,
        variables,
      });
      execution.current.query
        .then((result) => {
          execution.current.status = { loading: false, error: result.error };
          forceUpdate();
        })
        .catch((err) => {
          execution.current.status = { loading: false, error: err };
          forceUpdate();
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
  }, [documents.executionQueryDocument, variables]);

  const { data } = useApolloQuery(watchQueryDocument, {
    variables,
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
  documents: CompiledArtefactModule,
  fragmentReference: FragmentReference
): {} {
  const { watchQueryDocument, metadata } = documents;
  invariant(
    watchQueryDocument,
    "Expected compiled artefact to have a watchQueryDocument"
  );

  const client = useApolloClient();
  const forceUpdate = useForceUpdate();

  const observableQuery = useMemo(
    () =>
      client.watchQuery({
        fetchPolicy: "cache-only",
        query: watchQueryDocument,
        returnPartialData: false, // FIXME: In tests this needs to be true, but not in the example app
        variables: {
          id: fragmentReference.id,
          __fragments: fragmentReference.__fragments,
          ...fragmentReference.__fragments,
        },
      }),
    [client, fragmentReference.id, fragmentReference.__fragments]
  );

  useEffect(() => {
    let skipFirst = true;
    const subscription = observableQuery.subscribe(
      () => {
        if (skipFirst) {
          skipFirst = false;
        } else {
          forceUpdate();
        }
      },
      (error) => {
        console.log(error);
      }
    );
    return () => subscription.unsubscribe();
  }, [observableQuery]);

  const result = observableQuery.getCurrentResult();
  let data = result.data;
  if (metadata?.rootSelection) {
    data = data[metadata.rootSelection];
  }
  invariant(
    data,
    "Expected Apollo to respond with previously seeded data of the execution query document"
  );
  return data;
}

export type RefetchFn<Variables extends {} = {}> = (
  variables: Partial<Variables>,
  options?: { onCompleted?: (arg: Error | null) => void }
) => void;

export function useCompiledRefetchableFragment(
  documents: CompiledArtefactModule,
  fragmentReference: FragmentReference
): [data: {}, refetch: RefetchFn] {
  const { executionQueryDocument } = documents;
  invariant(
    executionQueryDocument,
    "Expected compiled artefact to have a executionQueryDocument"
  );

  const client = useApolloClient();
  const [
    fragmentReferenceWithOwnVariables,
    setFragmentReferenceWithOwnVariables,
  ] = useState(fragmentReference);
  const data = useCompiledFragment(
    documents,
    fragmentReferenceWithOwnVariables
  );

  const refetch = useCallback(
    async (variables, options) => {
      let error: Error | null;
      try {
        // TODO: Unsure how to trigger Apollo Client to return an error
        //       rather than throwing it, need to add test coverage for
        //       this.
        const { error: e = null } = await client.query({
          fetchPolicy: "network-only",
          query: executionQueryDocument,
          variables: {
            ...fragmentReference.__fragments,
            ...variables,
            id: fragmentReference.id,
          },
        });
        error = e;
      } catch (e: any) {
        error = e;
      }
      // NOTE: Unsure if the order of callback invocation and updating
      //       state here matters.
      options?.onCompleted?.(error!);
      if (!error) {
        setFragmentReferenceWithOwnVariables({
          id: fragmentReference.id,
          __fragments: { ...fragmentReference.__fragments, ...variables },
        });
      }
    },
    [client, fragmentReference.id, fragmentReference.__fragments]
  );

  return [data, refetch];
}

export function useCompiledPaginationFragment(
  documents: {
    executionQueryDocument: DocumentNode;
    watchQueryDocument: DocumentNode;
  },
  fragmentReference: { id: unknown; __fragments?: Record<string, any> }
): {
  data: {};
  loadNext: () => void;
  loadPrevious: () => void;
  hasNext: boolean;
  hasPrevious: boolean;
  isLoadingNext: boolean;
  isLoadingPrevious: boolean;
  refetch: () => void;
} {
  const data = useCompiledFragment(documents, fragmentReference);
  return { data } as any;
}

function useForceUpdate() {
  const [_, forceUpdate] = useReducer((x) => x + 1, 0);
  return forceUpdate;
}
