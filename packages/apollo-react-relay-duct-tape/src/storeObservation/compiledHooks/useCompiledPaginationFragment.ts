import { useState, useCallback, useRef } from "react";
import { ApolloCache, DataProxy } from "@apollo/client";
import invariant from "invariant";
import { useCompiledRefetchableFragment } from "./useCompiledRefetchableFragment";
import { useOverridenOrDefaultApolloClient } from "../../useOverridenOrDefaultApolloClient";

import type { FragmentReference } from "./types";
import type {
  RefetchFn,
  Disposable,
  PrivateRefetchOptions,
  RefetchOptions,
} from "./useCompiledRefetchableFragment";
import type {
  CompiledArtefactModule,
  Metadata,
} from "@graphitation/apollo-react-relay-duct-tape-compiler";
import type { DocumentNode } from "graphql";
import { Variables } from "../../types";
import { merge } from "lodash";

export type PaginationFn = (
  count: number,
  options?: RefetchOptions,
) => Disposable;

interface PaginationParams {
  fragmentReference: FragmentReference;
  refetch: RefetchFn;
  latestVariablesUsedByStandaloneRefetch: Partial<Variables>;
  metadata: Metadata;
  executionQueryDocument: DocumentNode;
  cache: ApolloCache<unknown>;
  countVariable: string | undefined;
  cursorVariable: string | undefined;
  connectionSelectionPath: string[];
  cursorValue: string | undefined;
  updater: <T>(existing: T[], incoming: T[]) => T[];
}

function useLoadMore({
  fragmentReference,
  refetch,
  latestVariablesUsedByStandaloneRefetch,
  metadata,
  executionQueryDocument,
  cache,
  countVariable,
  cursorVariable,
  connectionSelectionPath,
  cursorValue,
  updater,
}: PaginationParams): [loadPage: PaginationFn, isLoadingMore: boolean] {
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadPage = useCallback<PaginationFn>(
    (countValue, options) => {
      invariant(
        countVariable,
        "usePaginationFragment(): Expected a count variable to exist",
      );
      invariant(
        cursorVariable,
        "usePaginationFragment(): Expected a cursor variable to exist",
      );
      invariant(
        cursorValue,
        "usePaginationFragment(): Expected a cursor value to exist",
      );
      const previousVariables = {
        ...merge(
          {},
          metadata.connection?.filterVariableDefaults,
          latestVariablesUsedByStandaloneRefetch,
          fragmentReference.__fragments,
        ),
        id: fragmentReference.id,
      };
      const newVariables = {
        ...previousVariables,
        [countVariable]: countValue,
        [cursorVariable]: cursorValue,
      };
      const refetchOptions: PrivateRefetchOptions = {
        fetchPolicy: "no-cache",
        UNSTABLE_onCompletedWithData: (error, data) => {
          // NOTE: We can do this now already, because `refetch` wraps the
          //       onCompleted callback in a batchedUpdates callback.
          setIsLoadingMore(false);

          if (!error) {
            invariant(
              data,
              "usePaginationFragment(): Expected to have response data",
            );
            const newData = metadata.rootSelection
              ? data[metadata.rootSelection]
              : data;
            const mainFragment = metadata.mainFragment;
            invariant(
              mainFragment,
              "usePaginationFragment(): Expected mainFragment metadata",
            );
            const cacheSelector: DataProxy.Fragment<unknown, object> = {
              // TODO: If we're dropping default Apollo Cache keys, we can probably just do the below
              id: fragmentReference.id as string,
              // id: cache.identify({
              //   __typename: mainFragment.typeCondition,
              //   id: fragmentReference.id as StoreValue,
              // }),
              variables: previousVariables,
              fragmentName: mainFragment.name,
              // Create new document with operation filtered out.
              fragment: {
                kind: "Document",
                definitions: executionQueryDocument.definitions.filter(
                  (def) => def.kind === "FragmentDefinition",
                ),
              },
            };
            /**
             * Note: Even though we already have the latest data from the
             * useCompiledFragment hook, we can't really use that as it may contain
             * __fragments fields and we don't want to write those to the cache. If
             * we figure out a way from a field-policy's merge function to not write
             * to the cache, then that would be preferable.
             */
            const existingData = cache.readFragment(cacheSelector);
            invariant(existingData, "Expected existing data");
            const newCacheData = mergeEdges(
              connectionSelectionPath,
              newData,
              existingData,
              updater,
            );
            cache.writeFragment({
              ...cacheSelector,
              variables: newVariables,
              data: newCacheData,
            });
          }

          options?.onCompleted?.(error);
        },
      };
      // TODO: Measure if invoking `refetch` leads to React updates and if it
      //       makes sense to wrap it and the following setIsLoadingMore(true)
      //       call in a batchedUpdates callback.
      const disposable = refetch(
        newVariables,
        refetchOptions as RefetchOptions,
      );
      setIsLoadingMore(true);
      return disposable;
    },
    [
      fragmentReference.id,
      fragmentReference.__fragments,
      refetch,
      latestVariablesUsedByStandaloneRefetch,
      metadata,
      executionQueryDocument,
      cache,
      countVariable,
      cursorVariable,
      connectionSelectionPath,
      cursorValue,
    ],
  );
  return [loadPage, isLoadingMore];
}

function getValueAtSelectionPath(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
  selectionPath: string[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let object: Record<string, any> = data;
  selectionPath.forEach((field) => {
    object = object[field];
    invariant(object, "Expected path to connection in response to exist");
  });
  return object;
}

function getPageInfo(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
  selectionPath: string[],
): {
  startCursor?: string;
  endCursor?: string;
  hasPreviousPage?: boolean;
  hasNextPage?: boolean;
} {
  const object = getValueAtSelectionPath(data, selectionPath);
  const pageInfo = object.pageInfo;
  invariant(pageInfo, "Expected to find the connection's page info object");
  return pageInfo;
}

function mergeEdges(
  connectionPath: string[],
  destination: object,
  source: object,
  updater: <T>(existing: T[], incoming: T[]) => T[],
) {
  const edgesPath = [...connectionPath, "edges"];
  const existingEdges = getValueAtSelectionPath(source, edgesPath);
  const newEdges = getValueAtSelectionPath(destination, edgesPath);
  const allEdges = updater(existingEdges, newEdges);

  const connection = getValueAtSelectionPath(destination, connectionPath);
  connection["edges"] = allEdges;

  return destination;
}

export function useCompiledPaginationFragment(
  documents: CompiledArtefactModule,
  fragmentReference: FragmentReference,
): {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  loadNext: PaginationFn;
  loadPrevious: PaginationFn;
  hasNext: boolean;
  hasPrevious: boolean;
  isLoadingNext: boolean;
  isLoadingPrevious: boolean;
  refetch: RefetchFn;
} {
  const { executionQueryDocument, metadata } = documents;
  invariant(
    metadata && metadata.mainFragment,
    "usePaginationFragment(): Expected metadata to have been extracted from " +
      "the fragment. Did you forget to invoke the compiler?",
  );
  invariant(
    executionQueryDocument,
    "usePaginationFragment(): Expected fragment `%s` to be refetchable when " +
      "using `usePaginationFragment`. Did you forget to add a @refetchable " +
      "directive to the fragment?",
    metadata.mainFragment.name,
  );
  const connectionMetadata = metadata.connection;
  invariant(
    connectionMetadata,
    "usePaginationFragment: Expected fragment `%s` to include a " +
      "connection when using `usePaginationFragment`. Did you forget to add a @connection " +
      "directive to the connection field in the fragment?",
    metadata.mainFragment.name,
  );
  const [data, refetch] = useCompiledRefetchableFragment(
    documents,
    fragmentReference,
  );

  // Consumers might want to not only use loadNext/loadPrevious with pagination fragment but also standalone refetch,
  // for example to change the variables that decide on connection filtering. To make sure that loadNext/loadPrevious
  // respects the variables used by standalone refetch, we store them in a ref and pass them to useLoadMore.
  const latestVariablesUsedByStandaloneRefetch = useRef({});
  const storeVariablesAndRefetch = useCallback<RefetchFn>(
    (variables: Partial<Variables>, options?: RefetchOptions) => {
      latestVariablesUsedByStandaloneRefetch.current = variables;
      return refetch(variables, options);
    },
    [],
  );

  const commonPaginationParams = {
    fragmentReference,
    refetch,
    latestVariablesUsedByStandaloneRefetch:
      latestVariablesUsedByStandaloneRefetch.current,
    metadata,
    executionQueryDocument,
    cache: useOverridenOrDefaultApolloClient().cache,
    connectionSelectionPath: connectionMetadata.selectionPath,
  };
  const pageInfo = getPageInfo(data, connectionMetadata.selectionPath);
  const [loadNext, isLoadingNext] = useLoadMore({
    ...commonPaginationParams,
    countVariable: connectionMetadata.forwardCountVariable,
    cursorVariable: connectionMetadata.forwardCursorVariable,
    cursorValue: pageInfo?.endCursor,
    updater: (existing, incoming) => [...existing, ...incoming],
  });
  const [loadPrevious, isLoadingPrevious] = useLoadMore({
    ...commonPaginationParams,
    countVariable: connectionMetadata.backwardCountVariable,
    cursorVariable: connectionMetadata.backwardCursorVariable,
    cursorValue: pageInfo?.startCursor,
    updater: (existing, incoming) => [...incoming, ...existing],
  });
  return {
    data,
    refetch: storeVariablesAndRefetch,
    hasNext: !!pageInfo?.hasNextPage,
    hasPrevious: !!pageInfo?.hasPreviousPage,
    isLoadingNext,
    isLoadingPrevious,
    loadNext,
    loadPrevious,
  };
}
