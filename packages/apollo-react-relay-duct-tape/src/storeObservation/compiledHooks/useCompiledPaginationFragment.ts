import { useState, useRef, useEffect, useCallback } from "react";
import { DataProxy, useApolloClient } from "@apollo/client";
import invariant from "invariant";
import { CompiledArtefactModule } from "relay-compiler-language-graphitation";
import { useCompiledRefetchableFragment } from "./useCompiledRefetchableFragment";
import { FragmentReference } from "./types";
import type {
  RefetchFn,
  Disposable,
  PrivateRefetchOptions,
  RefetchOptions,
} from "./useCompiledRefetchableFragment";
import type { Metadata } from "relay-compiler-language-graphitation";
import type { DocumentNode } from "graphql";

export type PaginationFn = (
  count: number,
  options?: RefetchOptions
) => Disposable;

interface PaginationParams {
  fragmentReference: FragmentReference;
  refetch: RefetchFn;
  metadata: Metadata;
  executionQueryDocument: DocumentNode;
  cache: DataProxy;
  countVariable: string | undefined;
  cursorVariable: string | undefined;
  connectionSelectionPath: string[];
  cursorValue: string | undefined;
  updater: <T>(existing: T[], incoming: T[]) => T[];
}

function useLoadMore({
  fragmentReference,
  refetch,
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
  const disposable = useRef<Disposable>();
  useEffect(
    () => () => {
      if (disposable.current) {
        disposable.current.dispose();
        disposable.current = undefined;
      }
    },
    [] // On unmount
  );
  const loadPage = useCallback<PaginationFn>(
    (countValue, options) => {
      invariant(
        countVariable,
        "usePaginationFragment(): Expected a count variable to exist"
      );
      invariant(
        cursorVariable,
        "usePaginationFragment(): Expected a cursor variable to exist"
      );
      invariant(
        cursorValue,
        "usePaginationFragment(): Expected a cursor value to exist"
      );
      const previousVariables = {
        ...fragmentReference.__fragments,
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
          disposable.current = undefined;

          if (!error) {
            invariant(
              data,
              "usePaginationFragment(): Expected to have response data"
            );
            const newData = metadata.rootSelection
              ? data[metadata.rootSelection]
              : data;
            const mainFragment = metadata.mainFragment;
            invariant(
              mainFragment,
              "usePaginationFragment(): Expected mainFragment metadata"
            );
            const cacheSelector: DataProxy.Fragment<any, any> = {
              id: fragmentReference.id
                ? `${mainFragment.typeCondition}:${fragmentReference.id}`
                : "ROOT_QUERY",
              variables: previousVariables,
              fragmentName: mainFragment.name,
              // Create new document with operation filtered out.
              fragment: {
                kind: "Document",
                definitions: executionQueryDocument.definitions.filter(
                  (def) => def.kind === "FragmentDefinition"
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
            const newCacheData = mergeEdges(
              connectionSelectionPath,
              newData,
              existingData,
              updater
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
      disposable.current = refetch(newVariables, refetchOptions);
      setIsLoadingMore(true);
      return disposable.current;
    },
    [
      fragmentReference.id,
      fragmentReference.__fragments,
      refetch,
      metadata,
      executionQueryDocument,
      cache,
      countVariable,
      cursorVariable,
      connectionSelectionPath,
      cursorValue,
    ]
  );
  return [loadPage, isLoadingMore];
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

function getPageInfo(
  data: Record<string, any>,
  selectionPath: string[]
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
  destination: {},
  source: {},
  updater: <T>(existing: T[], incoming: T[]) => T[]
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
  fragmentReference: FragmentReference
): {
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
      "the fragment. Did you forget to invoke the compiler?"
  );
  invariant(
    executionQueryDocument,
    "usePaginationFragment(): Expected fragment `%s` to be refetchable when " +
      "using `usePaginationFragment`. Did you forget to add a @refetchable " +
      "directive to the fragment?",
    metadata.mainFragment.name
  );
  const connectionMetadata = metadata.connection;
  invariant(
    connectionMetadata,
    "usePaginationFragment: Expected fragment `%s` to include a " +
      "connection when using `usePaginationFragment`. Did you forget to add a @connection " +
      "directive to the connection field in the fragment?",
    metadata.mainFragment.name
  );
  const [data, refetch] = useCompiledRefetchableFragment(
    documents,
    fragmentReference
  );
  const commonPaginationParams = {
    fragmentReference,
    refetch,
    metadata,
    executionQueryDocument,
    cache: useApolloClient().cache,
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
    refetch,
    hasNext: !!pageInfo?.hasNextPage,
    hasPrevious: !!pageInfo?.hasPreviousPage,
    isLoadingNext,
    isLoadingPrevious,
    loadNext,
    loadPrevious,
  };
}
