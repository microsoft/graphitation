import invariant from "invariant";
import {
  useSubscription as useApolloSubscription,
  useQuery as useApolloQuery,
  useMutation as useApolloMutation,
  SubscriptionHookOptions as ApolloSubscriptionHookOptions,
  ErrorPolicy as ApolloErrorPolicy,
  ApolloClient,
  ApolloCache,
} from "@apollo/client";

import {
  FetchPolicy,
  GraphQLTaggedNode,
  KeyType,
  KeyTypeData,
  OperationType,
} from "./types";
import {
  RefetchFn,
  PaginationFn,
  useCompiledLazyLoadQuery,
  useCompiledFragment,
  useCompiledRefetchableFragment,
  useCompiledPaginationFragment,
} from "./storeObservation/compiledHooks";
import { convertFetchPolicy } from "./convertFetchPolicy";
import { useOverridenOrDefaultApolloClient } from "./useOverridenOrDefaultApolloClient";
import type { CompiledArtefactModule } from "@graphitation/apollo-react-relay-duct-tape-compiler";
import { FragmentReference } from "./storeObservation/compiledHooks/types";

/**
 * Executes a GraphQL query.
 *
 * This hook is called 'lazy' as it is used to fetch a GraphQL query _during_ render. This hook can trigger multiple
 * round trips, one for loading and one for resolving.
 *
 * @see {@link https://microsoft.github.io/graphitation/docs/apollo-react-relay-duct-tape/use-lazy-load-query}
 *
 * @param query The query operation to perform.
 * @param variables Object containing the variable values to fetch the query. These variables need to match GraphQL
 *                  variables declared inside the query.
 * @param options Options passed on to the underlying implementation.
 * @param options.context The query context to pass along the apollo link chain. Should be avoided when possible as
 *                        it will not be compatible with Relay APIs.
 * @returns An object with either an error, the result data, or neither while loading.
 */
export function useLazyLoadQuery<TQuery extends OperationType>(
  query: GraphQLTaggedNode,
  variables: TQuery["variables"],
  options?: { fetchPolicy?: FetchPolicy; context?: TQuery["context"] },
): { error?: Error; data?: TQuery["response"] } {
  invariant(
    query?.__brand === undefined,
    "useLazyLoadQuery: Document must be a valid runtime type.",
  );
  const apolloOptions = options && {
    ...options,
    fetchPolicy: convertFetchPolicy(options.fetchPolicy),
  };
  if (query.watchQueryDocument) {
    return useCompiledLazyLoadQuery(query as CompiledArtefactModule, {
      variables,
      ...apolloOptions,
    });
  } else {
    const client = useOverridenOrDefaultApolloClient();
    return useApolloQuery(
      // Compiled documents without narrow observables should be treated like
      // normal queries.
      query.executionQueryDocument || query,
      {
        client,
        variables,
        ...apolloOptions,
      },
    );
  }
}

/**
 * A first-class way for an individual component to express its direct data requirements using GraphQL. The fragment
 * should select all the fields that the component directly uses in its rendering or needs to pass to external
 * functions. It should *not* select data that its children need, unless those children are intended to remain their
 * pure React props as data inputs.
 *
 * For children that *do* have their own data requirements expressed using GraphQL, the fragment should ensure to
 * spread in the child's fragment.
 *
 * @see {@link https://microsoft.github.io/graphitation/docs/apollo-react-relay-duct-tape/use-fragment}
 *
 * @note For migration purposes, this hook supports the notion that the fragment reference can be undefined. This is
 *       to support cases where useFragment is used in a tree that is conditionally using fragments.
 *
 * @param fragmentInput The GraphQL fragment document created using the `graphql` tagged template function.
 * @param fragmentRef The opaque fragment reference passed in by a parent component that has spread in this component's
 *                    fragment.
 * @returns The data corresponding to the field selections.
 */
export function useFragment<TKey extends KeyType>(
  fragmentInput: GraphQLTaggedNode,
  fragmentRef: TKey,
): KeyTypeData<TKey>;
export function useFragment(
  fragmentInput: GraphQLTaggedNode,
  fragmentRef: undefined,
): undefined;
export function useFragment<TKey extends KeyType>(
  fragmentInput: GraphQLTaggedNode,
  fragmentRef: TKey | undefined,
): KeyTypeData<TKey> | undefined;
export function useFragment<TKey extends KeyType>(
  fragmentInput: GraphQLTaggedNode | undefined,
  fragmentRef: TKey,
): KeyTypeData<TKey> {
  invariant(
    fragmentInput?.__brand === undefined,
    "useFragment: fragmentInput must be a valid runtime type.",
  );
  // If fragmentInput is undefined, it means the fragment is not compiled and we should just return the fragmentRef.
  // This is an implementation detail that should never surface to the user.
  if (fragmentInput && fragmentInput.watchQueryDocument) {
    return useCompiledFragment(fragmentInput, fragmentRef as FragmentReference);
  } else {
    return fragmentRef as unknown;
  }
}

/**
 * Equivalent to `useFragment`, but allows refetching of its subtree of the overall query.
 *
 * @see {@link https://microsoft.github.io/graphitation/docs/apollo-react-relay-duct-tape/use-refetchable-fragment}
 *
 * @param fragmentInput The GraphQL fragment document created using the `graphql` tagged template function.
 * @param fragmentRef The opaque fragment reference passed in by a parent component that has spread in this component's
 *                    fragment.
 * @returns The data corresponding to the field selections and a function to perform the refetch.
 */
export function useRefetchableFragment<
  TQuery extends OperationType,
  TKey extends KeyType,
>(
  fragmentInput: GraphQLTaggedNode,
  fragmentRef: TKey,
): [data: KeyTypeData<TKey>, refetch: RefetchFn<TQuery["variables"]>] {
  invariant(
    fragmentInput,
    "useRefetchableFragment: Missing metadata; did you forget to use the @refetchable directive?",
  );
  invariant(
    fragmentInput.__brand === undefined,
    "useRefetchableFragment: fragmentInput must be a valid runtime type.",
  );
  invariant(
    !!fragmentInput.watchQueryDocument,
    "useRefetchableFragment is only supported at this time when using compilation",
  );
  return useCompiledRefetchableFragment(
    fragmentInput as CompiledArtefactModule,
    fragmentRef as FragmentReference,
  );
}

/**
 * Equivalent to `useFragment`, but allows pagination of its subtree of the overall query.
 *
 * @see {@link https://microsoft.github.io/graphitation/docs/apollo-react-relay-duct-tape/use-pagination-fragment}
 *
 * @param fragmentInput The GraphQL fragment document created using the `graphql` tagged template function.
 * @param fragmentRef The opaque fragment reference passed in by a parent component that has spread in this component's
 *                    fragment.
 * @returns The data corresponding to the field selections and functions to deal with pagination.
 */
export function usePaginationFragment<
  TQuery extends OperationType,
  TKey extends KeyType,
>(
  fragmentInput: GraphQLTaggedNode,
  fragmentRef: TKey,
): {
  data: KeyTypeData<TKey>;
  loadNext: PaginationFn;
  loadPrevious: PaginationFn;
  hasNext: boolean;
  hasPrevious: boolean;
  isLoadingNext: boolean;
  isLoadingPrevious: boolean;
  refetch: RefetchFn<TQuery["variables"]>;
} {
  invariant(
    fragmentInput,
    "usePaginationFragment: Missing metadata; did you forget to use the @refetchable directive?",
  );
  invariant(
    fragmentInput.__brand === undefined,
    "usePaginationFragment: fragmentInput must be a valid runtime type.",
  );
  invariant(
    !!fragmentInput.watchQueryDocument,
    "usePaginationFragment is only supported at this time when using compilation",
  );
  return useCompiledPaginationFragment(
    fragmentInput as CompiledArtefactModule,
    fragmentRef as FragmentReference,
  );
}

// https://github.com/facebook/relay/blob/master/website/docs/api-reference/types/GraphQLSubscriptionConfig.md
interface GraphQLSubscriptionConfig<
  TSubscriptionPayload extends OperationType,
> {
  subscription: GraphQLTaggedNode;
  variables: TSubscriptionPayload["variables"];
  /**
   * Should be avoided when possible as it will not be compatible with Relay APIs.
   */
  context?: TSubscriptionPayload["context"];
  /**
   * Should response be nullable?
   */
  onNext?: (response: TSubscriptionPayload["response"]) => void;
  onError?: (error: Error) => void;
}

/**
 * @see {@link https://microsoft.github.io/graphitation/docs/apollo-react-relay-duct-tape/use-subscription}
 *
 * @param config
 */
export function useSubscription<TSubscriptionPayload extends OperationType>(
  config: GraphQLSubscriptionConfig<TSubscriptionPayload>,
): void {
  const document = config.subscription;
  invariant(
    document?.__brand === undefined,
    "useSubscription: Document must be a valid runtime type.",
  );
  invariant(
    !document.watchQueryDocument,
    "useSubscription: Did not expect a watch query document",
  );
  const client = useOverridenOrDefaultApolloClient();
  const { error } = useApolloSubscription(
    document.executionQueryDocument || document,
    {
      client,
      variables: config.variables,
      context: config.context,
      onSubscriptionData: ({ subscriptionData }) => {
        // Supposedly this never gets triggered for an error by design:
        // https://github.com/apollographql/react-apollo/issues/3177#issuecomment-506758144
        invariant(
          !subscriptionData.error,
          "Did not expect to receive an error here",
        );
        if (subscriptionData.data && config.onNext) {
          config.onNext(subscriptionData.data);
        }
      },
      errorPolicy: "ignore",
    } as ApolloSubscriptionHookOptions & {
      errorPolicy: ApolloErrorPolicy;
    },
  );
  if (error) {
    if (config.onError) {
      config.onError(error);
    } else {
      console.warn(
        `An unhandled GraphQL subscription error occurred: ${error.message}`,
      );
    }
  }
}

interface IMutationCommitterOptions<TMutationPayload extends OperationType> {
  variables: TMutationPayload["variables"];
  optimisticResponse?: Partial<TMutationPayload["response"]> | null;
  onCompleted?: (response: TMutationPayload["response"]) => void;
  /**
   * This version yields the ApolloCache instance, instead of the RelayStore,
   * and usage of it will not be portable to Relay directly. However, it is a
   * necessary evil for migration purposes.
   */
  updater?: (
    cache: ApolloCache<unknown>,
    data: TMutationPayload["response"],
  ) => void;
  /**
   * @deprecated Should be avoided when possible as it will not be compatible with Relay APIs.
   */
  context?: TMutationPayload["context"];
}

type MutationCommiter<TMutationPayload extends OperationType> = (
  options: IMutationCommitterOptions<TMutationPayload>,
) => Promise<{ errors?: Error[]; data?: TMutationPayload["response"] }>;

/**
 * @see {@link https://microsoft.github.io/graphitation/docs/apollo-react-relay-duct-tape/use-mutation}
 *
 * @param mutation
 * @returns
 */
export function useMutation<TMutationPayload extends OperationType>(
  mutation: GraphQLTaggedNode,
): [MutationCommiter<TMutationPayload>, boolean] {
  invariant(
    mutation?.__brand === undefined,
    "useMutation: Document must be a valid runtime type.",
  );
  invariant(
    !mutation.watchQueryDocument,
    "useMutation: Did not expect a watch query document",
  );
  const client = useOverridenOrDefaultApolloClient();
  const [apolloUpdater, { loading: mutationLoading }] = useApolloMutation(
    mutation.executionQueryDocument || mutation,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { client: client as ApolloClient<any> },
  );

  return [
    async (options: IMutationCommitterOptions<TMutationPayload>) => {
      const apolloResult = await apolloUpdater({
        variables: options.variables || {},
        context: options.context,
        optimisticResponse: options.optimisticResponse,
        onCompleted: options.onCompleted,
        update: options.updater,
      });
      if (apolloResult.errors) {
        return {
          errors: Array.from(Object.values(apolloResult.errors)),
          data: apolloResult.data,
        };
      }
      return {
        data: apolloResult.data,
      };
    },
    mutationLoading,
  ];
}
