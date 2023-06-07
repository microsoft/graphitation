import { useState, useCallback, useRef, useEffect } from "react";
import { unstable_batchedUpdates } from "react-dom";
import invariant from "invariant";
import { useCompiledFragment } from "./useCompiledFragment";
import { isEqual } from "lodash";
import { convertFetchPolicy } from "../../convertFetchPolicy";
import { useOverridenOrDefaultApolloClient } from "../../useOverridenOrDefaultApolloClient";

import type { CompiledArtefactModule } from "@graphitation/apollo-react-relay-duct-tape-compiler";
import type { FragmentReference } from "./types";
import type { FetchPolicy } from "../../types";

export interface Disposable {
  dispose(): void;
}

export type RefetchFn<Variables extends object = object> = (
  variables: Partial<Variables>,
  options?: RefetchOptions,
) => Disposable;

export interface RefetchOptions {
  onCompleted?: (error: Error | null) => void;
  fetchPolicy?: FetchPolicy;
}

/**
 * These do not exist in the Relay API and should not be exported from the package.
 */
export interface PrivateRefetchOptions
  extends Omit<RefetchOptions, "fetchPolicy"> {
  /**
   * Returns the fetched data.
   */
  UNSTABLE_onCompletedWithData?: (
    error: Error | null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Record<string, any> | null,
  ) => void;

  fetchPolicy?: FetchPolicy | "no-cache";
}

export function useCompiledRefetchableFragment(
  documents: CompiledArtefactModule,
  fragmentReference: FragmentReference,
): [data: object, refetch: RefetchFn] {
  const { executionQueryDocument, metadata } = documents;
  invariant(
    metadata && metadata.mainFragment,
    "useRefetchableFragment(): Expected metadata to have been extracted from " +
      "the fragment. Did you forget to invoke the compiler?",
  );
  invariant(
    executionQueryDocument,
    "useRefetchableFragment(): Expected fragment `%s` to be refetchable when " +
      "using `useRefetchableFragment`. Did you forget to add a @refetchable " +
      "directive to the fragment?",
    metadata.mainFragment.name,
  );

  const client = useOverridenOrDefaultApolloClient();

  // We use state for this, so that...
  const [
    fragmentReferenceWithOwnVariables,
    setFragmentReferenceWithOwnVariables,
  ] = useState(fragmentReference);
  // ...this gets invoked again with updated variables.
  const data = useCompiledFragment(
    documents,
    fragmentReferenceWithOwnVariables,
  );

  const disposable = useRef<Disposable>();
  useEffect(
    () => () => {
      if (disposable.current) {
        disposable.current.dispose();
        disposable.current = undefined;
      }
    },
    [], // On unmount
  );

  const refetch = useCallback<RefetchFn>(
    (variablesSubset, options?: PrivateRefetchOptions) => {
      const variables = {
        ...fragmentReference.__fragments,
        ...variablesSubset,
        id: fragmentReference.id,
      };
      const observable = client.watchQuery({
        fetchPolicy: convertFetchPolicy(options?.fetchPolicy) ?? "network-only",
        query: executionQueryDocument,
        variables,
      });
      let subscription: ZenObservable.Subscription | undefined =
        observable.subscribe(
          ({ data, error }) => {
            // Be sure not to keep a retain cycle, so cleanup the reference first thing.
            subscription?.unsubscribe();
            subscription = undefined;
            disposable.current = undefined;

            unstable_batchedUpdates(() => {
              if (options?.UNSTABLE_onCompletedWithData) {
                options.UNSTABLE_onCompletedWithData(error || null, data);
              } else {
                options?.onCompleted?.(error || null);
              }
              if (!error) {
                const { id: _, ...variablesToPropagate } = variables;
                const nextVariables = {
                  ...fragmentReference.__fragments,
                  ...variablesToPropagate,
                };
                // No need to trigger an update to propagate new variables if they don't actually change.
                if (
                  !isEqual(
                    fragmentReferenceWithOwnVariables.__fragments,
                    nextVariables,
                  )
                ) {
                  const nextFragmentReference: FragmentReference = {
                    __fragments: nextVariables,
                  };
                  // Don't add an empty key if this is a fragment on the Query type.
                  if (fragmentReference.id !== undefined) {
                    nextFragmentReference.id = fragmentReference.id;
                  }
                  setFragmentReferenceWithOwnVariables(nextFragmentReference);
                }
              }
            });
          },
          (error) => {
            // Be sure not to keep a retain cycle
            subscription?.unsubscribe();
            subscription = undefined;

            if (options?.UNSTABLE_onCompletedWithData) {
              options.UNSTABLE_onCompletedWithData(error, null);
            } else {
              options?.onCompleted?.(error);
            }
          },
        );
      disposable.current = { dispose: () => subscription?.unsubscribe() };
      return disposable.current;
    },
    [
      client,
      executionQueryDocument,
      fragmentReference.id,
      fragmentReference.__fragments,
    ],
  );

  return [data, refetch];
}
