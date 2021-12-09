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
import { DataProxy } from "@apollo/client/cache/core/types/DataProxy";
import invariant from "invariant";
import { useDeepCompareMemoize } from "./useDeepCompareMemoize";

import type { CompiledArtefactModule } from "relay-compiler-language-graphitation";
import {
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  OperationDefinitionNode,
  visit,
} from "graphql";

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

interface RefetchOptions {
  onCompleted?: (error: Error | null) => void;
  fetchPolicy?: "network-only" | "no-cache";
  /**
   * Returns the fetched data. This does not exist in the Relay API.
   */
  UNSTABLE_onCompleted?: (
    error: Error | null,
    data: Record<string, any> | null
  ) => void;
}

export type RefetchFn<Variables extends {} = {}> = (
  variables: Partial<Variables>,
  options?: RefetchOptions
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

  const refetch = useCallback<RefetchFn>(
    async (variablesSubset, options) => {
      let error: Error | null;
      let data: {} | null;
      const variables = {
        ...fragmentReference.__fragments,
        ...variablesSubset,
        id: fragmentReference.id,
      };
      try {
        // TODO: Unsure how to trigger Apollo Client to return an error
        //       rather than throwing it, need to add test coverage for
        //       this.
        const { error: e = null, data: d = null } = await client.query({
          fetchPolicy: options?.fetchPolicy ?? "network-only",
          query: executionQueryDocument,
          variables,
        });
        error = e;
        data = d;
      } catch (e: any) {
        error = e;
      }
      // NOTE: Unsure if the order of callback invocation and updating
      //       state here matters.
      if (options?.UNSTABLE_onCompleted) {
        options.UNSTABLE_onCompleted(error, data!);
      } else {
        options?.onCompleted?.(error!);
      }
      if (!error) {
        const { id: _, ...variablesToPropagate } = variables;
        setFragmentReferenceWithOwnVariables({
          id: fragmentReference.id,
          __fragments: {
            ...fragmentReference.__fragments,
            ...variablesToPropagate,
          },
        });
      }
    },
    [client, fragmentReference.id, fragmentReference.__fragments]
  );

  return [data, refetch];
}

export function useCompiledPaginationFragment(
  documents: CompiledArtefactModule,
  fragmentReference: FragmentReference
): {
  data: any;
  loadNext: (count: number, options?: RefetchOptions) => void;
  loadPrevious: (count: number, options?: RefetchOptions) => void;
  hasNext: boolean;
  hasPrevious: boolean;
  isLoadingNext: boolean;
  isLoadingPrevious: boolean;
  refetch: RefetchFn;
} {
  const { executionQueryDocument, metadata } = documents;
  invariant(
    executionQueryDocument && metadata,
    "Expected compiled artefact to have a executionQueryDocument and metadata"
  );
  const connectionMetadata = metadata.connection;
  invariant(
    connectionMetadata,
    "Expected compiled artefact to have connection metadata"
  );

  const client = useApolloClient();
  const [data, refetch] = useCompiledRefetchableFragment(
    documents,
    fragmentReference
  );

  return {
    data,
    refetch,
    loadNext: (count, options) => {
      invariant(
        connectionMetadata.forwardCountVariable,
        "Expected a forward count variable to exist"
      );
      invariant(
        connectionMetadata.forwardCursorVariable,
        "Expected a forward cursor variable to exist"
      );
      const endCursor = getEndCursorValue(
        data,
        connectionMetadata.selectionPath
      );
      const previousVariables = {
        ...fragmentReference.__fragments,
        id: fragmentReference.id,
      };
      const newVariables = {
        ...previousVariables,
        [connectionMetadata.forwardCountVariable]: count,
        [connectionMetadata.forwardCursorVariable]: endCursor,
      };
      refetch(newVariables, {
        fetchPolicy: "no-cache",
        UNSTABLE_onCompleted: (error, data) => {
          if (error) {
            console.error("An error occurred during pagination", error);
            return;
          }

          invariant(data, "Expected to have response data");
          const newData = metadata.rootSelection
            ? data[metadata.rootSelection]
            : data;

          const mainFragment = metadata.mainFragment;
          invariant(mainFragment, "Expected mainFragment metadata");
          const cacheSelector: DataProxy.Fragment<any, any> = {
            id: fragmentReference.id
              ? `${mainFragment.typeCondition}:${fragmentReference.id}`
              : "ROOT_QUERY",
            variables: previousVariables,
            fragment: {
              kind: "Document",
              definitions: executionQueryDocument.definitions.filter(
                (def) => def.kind === "FragmentDefinition"
              ),
            },
            fragmentName: mainFragment.name,
          };

          /**
           * Note: Even though we already have the latest data from the
           * useCompiledFragment hook, we can't really use that as it may
           * contain __fragments fields and we don't want to write those to the
           * cache. If we figure out a way from a field-policy's merge function
           * to not write to the cache, then that would be preferable.
           */
          const existingData = client.readFragment(cacheSelector);
          const newCacheData = mergeEdges(
            connectionMetadata.selectionPath,
            newData,
            existingData,
            (existing, incoming) => [...existing, ...incoming]
          );
          client.writeFragment({
            ...cacheSelector,
            variables: newVariables,
            data: newCacheData,
          });
        },
      });
    },
    loadPrevious: (count, options) => {
      invariant(
        connectionMetadata.backwardCountVariable,
        "Expected a backward count variable to exist"
      );
      invariant(
        connectionMetadata.backwardCursorVariable,
        "Expected a backward cursor variable to exist"
      );
      const startCursor = getStartCursorValue(
        data,
        connectionMetadata.selectionPath
      );
      const previousVariables = {
        ...fragmentReference.__fragments,
        id: fragmentReference.id,
      };
      const newVariables = {
        ...previousVariables,
        [connectionMetadata.backwardCountVariable]: count,
        [connectionMetadata.backwardCursorVariable]: startCursor,
      };
      refetch(newVariables, {
        fetchPolicy: "no-cache",
        UNSTABLE_onCompleted: (error, data) => {
          if (error) {
            console.error("An error occurred during pagination", error);
            return;
          }

          invariant(data, "Expected to have response data");
          const newData = metadata.rootSelection
            ? data[metadata.rootSelection]
            : data;

          const mainFragment = metadata.mainFragment;
          invariant(mainFragment, "Expected mainFragment metadata");
          const cacheSelector: DataProxy.Fragment<any, any> = {
            id: fragmentReference.id
              ? `${mainFragment.typeCondition}:${fragmentReference.id}`
              : "ROOT_QUERY",
            variables: previousVariables,
            fragment: {
              kind: "Document",
              definitions: executionQueryDocument.definitions.filter(
                (def) => def.kind === "FragmentDefinition"
              ),
            },
            fragmentName: mainFragment.name,
          };

          // TODO: We already have the latest data from the fragment hook, use that?
          const existingData = client.readFragment(cacheSelector);
          const newCacheData = mergeEdges(
            connectionMetadata.selectionPath,
            newData,
            existingData,
            (existing, incoming) => [...incoming, ...existing]
          );
          client.writeFragment({
            ...cacheSelector,
            variables: newVariables,
            data: newCacheData,
          });
        },
      });
    },
    hasNext: false,
    hasPrevious: false,
    isLoadingNext: false,
    isLoadingPrevious: false,
  };
}

function useForceUpdate() {
  const [_, forceUpdate] = useReducer((x) => x + 1, 0);
  return forceUpdate;
}

function getEndCursorValue(data: Record<string, any>, selectionPath: string[]) {
  const object = getValueAtSelectionPath(data, selectionPath);
  const cursor = object.pageInfo?.endCursor;
  invariant(cursor, "Expected to find the connection's current end cursor");
  return cursor;
}

function getStartCursorValue(
  data: Record<string, any>,
  selectionPath: string[]
) {
  const object = getValueAtSelectionPath(data, selectionPath);
  const cursor = object.pageInfo?.startCursor;
  invariant(cursor, "Expected to find the connection's current start cursor");
  return cursor;
}

function getValueAtSelectionPath(
  data: Record<string, any>,
  selectionPath: string[]
): any {
  let object: Record<string, any> = data;
  selectionPath.forEach((field) => {
    object = object[field];
    invariant(object, "Expected path to connection in response to exist");
  });
  return object;
}

/**
 * Mutates the `data` object
 */
function setValueAtSelectionPath(
  data: Record<string, any>,
  selectionPath: string[],
  newValue: any
): void {
  const pathUpToComponentToUpdate = selectionPath.slice(0, -1);
  const object = getValueAtSelectionPath(data, pathUpToComponentToUpdate);
  const componentToUpdate = selectionPath[selectionPath.length - 1];
  object[componentToUpdate] = newValue;
}

function mergeEdges(
  connectionPath: string[],
  destination: {},
  source: {},
  updater: <T>(existing: T[], incoming: T[]) => T[]
) {
  const edgesPath = [...connectionPath, "edges"];
  const existingEdges = getValueAtSelectionPath(source, edgesPath);
  invariant(existingEdges, "Expected to find previous edges");
  const newEdges = getValueAtSelectionPath(destination, edgesPath);
  const allEdges = updater(existingEdges, newEdges);
  setValueAtSelectionPath(destination, edgesPath, allEdges);
  return destination;
}
