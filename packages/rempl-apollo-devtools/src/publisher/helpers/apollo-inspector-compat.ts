import type { ApolloClient, NormalizedCacheObject } from "@apollo/client";

type Cleanup = () => void;

type QueryManagerWithInternals = {
  fetchConcastWithInfo?: (...args: any[]) => any;
  fetchQueryObservable?: (...args: any[]) => any;
  getOrCreateQuery?: (queryId: any) => any;
  getQuery?: (queryId: any) => any;
  queries?: Map<any, any>;
};

export function wrapApolloClientForApolloInspector(
  client: ApolloClient<NormalizedCacheObject>,
): Cleanup {
  const queryManager = (client as any)
    .queryManager as QueryManagerWithInternals;

  if (!queryManager) {
    return noop;
  }

  const queryInfoCompat = wrapQueryInfoShouldNotify(queryManager);
  const cleanupFetchBridge = wrapFetchConcastWithInfo(
    queryManager,
    queryInfoCompat.wrap,
  );

  return () => {
    cleanupFetchBridge();
    queryInfoCompat.cleanup();
  };
}

export function wrapFragmentMethodsForApolloInspector(
  client: ApolloClient<NormalizedCacheObject>,
): Cleanup {
  const apolloClient = client as any;
  const cleanups = [
    wrapFragmentMethod(apolloClient, "readFragment"),
    wrapFragmentMethod(apolloClient, "writeFragment"),
  ];

  return () => cleanups.forEach((cleanup) => cleanup());
}

function wrapFetchConcastWithInfo(
  queryManager: QueryManagerWithInternals,
  wrapQueryInfo: (queryInfo: any) => void,
): Cleanup {
  const originalFetchConcastWithInfo = queryManager.fetchConcastWithInfo;

  if (
    typeof originalFetchConcastWithInfo !== "function" ||
    typeof queryManager.fetchQueryObservable === "function"
  ) {
    return noop;
  }

  let lastFetchConcastInfo: any;

  const fetchQueryObservable = function fetchQueryObservable(
    this: QueryManagerWithInternals,
    queryId: any,
    options: any,
    networkStatus: any,
    query: any,
  ) {
    const queryInfo = getQueryInfo(this, queryId);
    wrapQueryInfo(queryInfo);

    lastFetchConcastInfo = originalFetchConcastWithInfo.call(
      this,
      queryInfo,
      options,
      networkStatus,
      query,
    );

    return lastFetchConcastInfo?.concast ?? lastFetchConcastInfo;
  };

  const fetchConcastWithInfo = function fetchConcastWithInfo(
    this: QueryManagerWithInternals,
    queryInfo: any,
    options: any,
    networkStatus: any,
    query: any,
  ) {
    wrapQueryInfo(queryInfo);

    if (
      typeof this.fetchQueryObservable === "function" &&
      this.fetchQueryObservable !== fetchQueryObservable
    ) {
      lastFetchConcastInfo = undefined;

      const concast = this.fetchQueryObservable(
        getQueryId(queryInfo),
        options,
        networkStatus,
        query,
      );

      return lastFetchConcastInfo?.concast === concast
        ? lastFetchConcastInfo
        : { concast, fromLink: true };
    }

    return originalFetchConcastWithInfo.call(
      this,
      queryInfo,
      options,
      networkStatus,
      query,
    );
  };

  queryManager.fetchQueryObservable = fetchQueryObservable;
  queryManager.fetchConcastWithInfo = fetchConcastWithInfo;

  return () => {
    if (queryManager.fetchConcastWithInfo === fetchConcastWithInfo) {
      queryManager.fetchConcastWithInfo = originalFetchConcastWithInfo;
    }

    if (queryManager.fetchQueryObservable === fetchQueryObservable) {
      delete queryManager.fetchQueryObservable;
    }
  };
}

function wrapQueryInfoShouldNotify(queryManager: QueryManagerWithInternals) {
  const wrappedQueryInfos = new Map<any, () => boolean>();
  const queries = queryManager.queries;

  const wrap = (queryInfo: any) => {
    if (!queryInfo || typeof queryInfo.shouldNotify === "function") {
      return;
    }

    const shouldNotify = function shouldNotify(this: any) {
      if (typeof this.observableQuery?.dirty === "boolean") {
        return this.observableQuery.dirty;
      }

      return Boolean(this.dirty);
    };

    Object.defineProperty(queryInfo, "shouldNotify", {
      configurable: true,
      value: shouldNotify,
    });
    wrappedQueryInfos.set(queryInfo, shouldNotify);
  };

  queries?.forEach((queryInfo) => wrap(queryInfo));

  let cleanupSet = noop;

  if (queries && typeof queries.set === "function") {
    const originalSet = queries.set;
    const setWithWrap = function setWithWrap(
      this: Map<any, any>,
      queryId: any,
      queryInfo: any,
    ) {
      wrap(queryInfo);
      return originalSet.call(this, queryId, queryInfo);
    };

    queries.set = setWithWrap;
    cleanupSet = () => {
      if (queries.set === setWithWrap) {
        queries.set = originalSet;
      }
    };
  }

  return {
    wrap,
    cleanup: () => {
      cleanupSet();

      wrappedQueryInfos.forEach((shouldNotify, queryInfo) => {
        if (queryInfo.shouldNotify === shouldNotify) {
          delete queryInfo.shouldNotify;
        }
      });
      wrappedQueryInfos.clear();
    },
  };
}

function getQueryInfo(queryManager: QueryManagerWithInternals, queryId: any) {
  return (
    queryManager.queries?.get?.(queryId) ??
    queryManager.getQuery?.(queryId) ??
    queryManager.getOrCreateQuery?.(queryId)
  );
}

function getQueryId(queryInfo: any) {
  return queryInfo?.queryId ?? queryInfo?.observableQuery?.queryId;
}

function wrapFragmentMethod(target: any, methodName: string): Cleanup {
  if (!target || typeof target[methodName] !== "function") {
    return noop;
  }

  const originalMethod = target[methodName];

  const wrappedMethod = function fragmentNameCompat(this: any, ...args: any[]) {
    const options = args[0];
    const fragmentName = getFragmentName(options?.fragment);

    if (options && !options.fragmentName && fragmentName) {
      args[0] = { ...options, fragmentName };
    }

    return originalMethod.apply(this, args);
  };

  target[methodName] = wrappedMethod;

  return () => {
    if (target[methodName] === wrappedMethod) {
      target[methodName] = originalMethod;
    }
  };
}

function getFragmentName(fragment: any): string | undefined {
  return fragment?.definitions?.find(
    (definition: any) =>
      definition?.kind === "FragmentDefinition" && definition?.name?.value,
  )?.name.value;
}

function noop() {}
