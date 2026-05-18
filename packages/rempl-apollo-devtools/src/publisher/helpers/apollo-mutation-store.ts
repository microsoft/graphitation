import { ApolloClient, NormalizedCacheObject } from "@apollo/client";

type ApolloClientWithMutationTracking = ApolloClient<NormalizedCacheObject> & {
  __REMPL_APOLLO_DEVTOOLS_MUTATION_STORE__?: Record<string, unknown>;
  __REMPL_APOLLO_DEVTOOLS_MUTATION_PATCHED__?: boolean;
};

let mutationIdCounter = 1;

export function ensureMutationTracking(
  client: ApolloClient<NormalizedCacheObject>,
) {
  const trackedClient = client as ApolloClientWithMutationTracking;

  if (trackedClient.__REMPL_APOLLO_DEVTOOLS_MUTATION_PATCHED__) {
    return;
  }

  const mutationStore =
    (trackedClient.__REMPL_APOLLO_DEVTOOLS_MUTATION_STORE__ ||= {});
  const originalMutate = trackedClient.mutate.bind(trackedClient);

  trackedClient.mutate = ((options: any) => {
    const mutationId = `${mutationIdCounter++}`;
    const mutation = {
      mutation: options.mutation,
      variables: options.variables || {},
      loading: true,
      error: null,
    };

    mutationStore[mutationId] = mutation;

    return originalMutate(options).then(
      (result) => {
        mutation.loading = false;
        return result;
      },
      (error) => {
        mutation.loading = false;
        mutation.error = error;
        throw error;
      },
    );
  }) as typeof trackedClient.mutate;

  trackedClient.__REMPL_APOLLO_DEVTOOLS_MUTATION_PATCHED__ = true;
}

export function getTrackedMutations(client: any) {
  const nativeMutationStore = client.queryManager.mutationStore?.getStore
    ? client.queryManager.mutationStore.getStore()
    : client.queryManager.mutationStore;

  if (nativeMutationStore && Object.keys(nativeMutationStore).length) {
    return nativeMutationStore;
  }

  return client.__REMPL_APOLLO_DEVTOOLS_MUTATION_STORE__ || {};
}
