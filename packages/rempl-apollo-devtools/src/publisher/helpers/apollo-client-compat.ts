import { ApolloClient, NormalizedCacheObject } from "@apollo/client";

/**
 * Ensures an Apollo Client instance is compatible with apollo-inspector
 * by shimming internal APIs that were renamed/removed in newer versions.
 *
 * Apollo Client 3.8+ replaced `queryManager.fetchQueryObservable` with
 * the private `queryManager.fetchConcastWithInfo` and renamed `getQuery`
 * to `getOrCreateQuery`. apollo-inspector monkey-patches
 * `fetchQueryObservable` to track operations, so we must:
 *
 * 1. Provide a `fetchQueryObservable` shim backed by `fetchConcastWithInfo`.
 * 2. Wrap `fetchConcastWithInfo` so that every call routes through
 *    `fetchQueryObservable` — this ensures apollo-inspector's hook is
 *    triggered by Apollo Client's own internal calls.
 * 3. Alias `getQuery` → `getOrCreateQuery` (used by apollo-inspector
 *    inside its `fetchQueryObservable` hook).
 */
export function ensureApolloClientCompat(
  client: ApolloClient<NormalizedCacheObject>,
): void {
  const qm = (client as any).queryManager;
  if (!qm) return;

  // 1. Alias getQuery → getOrCreateQuery (renamed in Apollo Client 3.8+).
  //    apollo-inspector calls queryManager.getQuery(queryId) in its hooks.
  if (!qm.getQuery && typeof qm.getOrCreateQuery === "function") {
    qm.getQuery = qm.getOrCreateQuery;
  }

  // 2. Shim fetchQueryObservable and wrap fetchConcastWithInfo.
  //    apollo-inspector hooks fetchQueryObservable, but Apollo Client 3.8+
  //    only calls fetchConcastWithInfo internally — so we must bridge them.
  if (!qm.fetchQueryObservable && qm.fetchConcastWithInfo) {
    const getQueryInfo =
      typeof qm.getOrCreateQuery === "function"
        ? qm.getOrCreateQuery.bind(qm)
        : typeof qm.getQuery === "function"
          ? qm.getQuery.bind(qm)
          : undefined;

    if (getQueryInfo) {
      const originalFetchConcastWithInfo = qm.fetchConcastWithInfo;

      // Closure variable to pass fromLink from the shim back to the
      // fetchConcastWithInfo wrapper (safe: single-threaded execution).
      let lastFromLink = true;

      // The shim that apollo-inspector will hook into.
      // It delegates to the *original* fetchConcastWithInfo.
      const shimFetchQueryObservable = function fetchQueryObservableShim(
        this: any,
        queryId: string,
        options: any,
        networkStatus?: any,
      ) {
        const queryInfo = getQueryInfo(queryId);
        const result = originalFetchConcastWithInfo.call(
          this,
          queryInfo,
          options,
          networkStatus,
        );
        lastFromLink = result.fromLink;
        return result.concast;
      };
      qm.fetchQueryObservable = shimFetchQueryObservable;

      // Wrap fetchConcastWithInfo so that Apollo Client's internal calls
      // are routed through fetchQueryObservable (which may be replaced by
      // apollo-inspector's hook at tracking time).
      qm.fetchConcastWithInfo = function fetchConcastWithInfoWrapper(
        this: any,
        queryInfo: any,
        options: any,
        networkStatus?: any,
        query?: any,
      ) {
        // If apollo-inspector has replaced fetchQueryObservable with its
        // own hook, route through it so operation tracking triggers.
        if (this.fetchQueryObservable !== shimFetchQueryObservable) {
          const concast = this.fetchQueryObservable(
            queryInfo.queryId,
            options,
            networkStatus,
          );
          return { concast, fromLink: lastFromLink };
        }

        // No hook installed — call original directly (avoids overhead).
        return originalFetchConcastWithInfo.call(
          this,
          queryInfo,
          options,
          networkStatus,
          query,
        );
      };
    }
  }

  // 3. Ensure mutationStore exists — in Apollo Client 3.13+,
  //    mutationStore is only initialized when onBroadcast is provided.
  //    Devtools code iterates mutationStore, so it must be non-null.
  if (!qm.mutationStore) {
    qm.mutationStore = {};
  }
}
