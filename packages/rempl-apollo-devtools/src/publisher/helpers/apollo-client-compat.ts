import { ApolloClient, NormalizedCacheObject } from "@apollo/client";

/**
 * Ensures an Apollo Client instance is compatible with apollo-inspector
 * by shimming internal APIs that were renamed/removed in newer versions.
 *
 * Apollo Client 3.8+ replaced `queryManager.fetchQueryObservable` with
 * `queryManager.fetchConcastWithInfo`. apollo-inspector hooks into
 * `fetchQueryObservable` to track query operations; without it, queries
 * are silently missing from recordings.
 */
export function ensureApolloClientCompat(
  client: ApolloClient<NormalizedCacheObject>,
): void {
  const qm = (client as any).queryManager;
  if (!qm) return;

  // Shim fetchQueryObservable for Apollo Client 3.8+
  // where it was replaced by fetchConcastWithInfo (private).
  if (!qm.fetchQueryObservable && qm.fetchConcastWithInfo) {
    const getQueryInfo =
      typeof qm.getOrCreateQuery === "function"
        ? qm.getOrCreateQuery.bind(qm)
        : typeof qm.getQuery === "function"
          ? qm.getQuery.bind(qm)
          : undefined;

    if (getQueryInfo) {
      qm.fetchQueryObservable = function fetchQueryObservableShim(
        queryId: string,
        options: any,
        networkStatus?: any,
      ) {
        const queryInfo = getQueryInfo(queryId);
        const result = qm.fetchConcastWithInfo(
          queryInfo,
          options,
          networkStatus,
        );
        return result.concast;
      };
    }
  }

  // Ensure mutationStore exists — in Apollo Client 3.13+,
  // mutationStore is only initialized when onBroadcast is provided.
  // Some devtools code iterates mutationStore, so it must be non-null.
  if (!qm.mutationStore) {
    qm.mutationStore = {};
  }
}
