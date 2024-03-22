import { useRef, useEffect } from "react";
import { useQuery as useApolloQuery } from "@apollo/client";
import invariant from "invariant";
import { useDeepCompareMemoize } from "./useDeepCompareMemoize";
import { useForceUpdate } from "./useForceUpdate";
import { useOverridenOrDefaultApolloClient } from "../../useOverridenOrDefaultApolloClient";

import type { ObservableQuery, ApolloClient, WatchQueryFetchPolicy } from "@apollo/client";
import type { DocumentNode } from "graphql";
import type { CompiledArtefactModule } from "@graphitation/apollo-react-relay-duct-tape-compiler";
import { convertFetchPolicy } from "../../convertFetchPolicy";

class ExecutionQueryHandler {
  public status: [loading: boolean, error?: Error];
  private querySubscription?: ZenObservable.Subscription;

  constructor(private onComplete: () => void) {
    this.status = [true, undefined];
  }

  public isIdle() {
    return this.status[0] && this.querySubscription === undefined;
  }

  public dispose() {
    this.querySubscription?.unsubscribe();
    this.querySubscription = undefined;
  }

  public reset() {
    this.dispose();
    this.status = [true, undefined];
  }

  private handleResult(error?: Error) {
    this.status = [false, error];
    this.dispose();
    this.onComplete();
  }

  public subscribe(observable: ObservableQuery) {
    this.querySubscription = observable.subscribe(
      ({ error: err }) => {
        this.handleResult(err);
      },
      (err) => {
        this.handleResult(err);
      },
    );
  }
}

function useExecutionQuery(
  client: ApolloClient<unknown>,
  executionQueryDocument: DocumentNode,
  variables: Record<string, unknown>,
  fetchPolicy: WatchQueryFetchPolicy | undefined
): [loading: boolean, error?: Error] {
  const forceUpdate = useForceUpdate();
  const execution = useRef(new ExecutionQueryHandler(() => forceUpdate()));
  useEffect(() => {
    if (execution.current.isIdle()) {
      execution.current.subscribe(
        client.watchQuery({
          query: executionQueryDocument,
          variables,
          fetchPolicy: fetchPolicy ?? "network-only",
        }),
      );
    }
    return () => {
      execution.current.reset();
    };
  }, [executionQueryDocument, variables]);
  return execution.current.status;
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
  options: { variables: Record<string, unknown>; fetchPolicy?: WatchQueryFetchPolicy }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): { data?: Record<string, any>; error?: Error } {
  const { watchQueryDocument } = documents;
  invariant(
    watchQueryDocument,
    "useLazyLoadQuery(): Expected a `watchQueryDocument` to have been " +
      "extracted. Did you forget to invoke the compiler?",
  );
  const { executionQueryDocument } = documents;
  invariant(
    executionQueryDocument,
    "useLazyLoadQuery(): Expected a `executionQueryDocument` to have been " +
      "extracted. Did you forget to invoke the compiler?",
  );
  const client = useOverridenOrDefaultApolloClient();
  const variables = useDeepCompareMemoize(options.variables);
  // First fetch all data needed for the entire tree...
  const [loading, error] = useExecutionQuery(
    client,
    executionQueryDocument,
    variables,
    options.fetchPolicy
  );
  // ...then fetch/watch data for only the calling component...
  const { data } = useApolloQuery(watchQueryDocument, {
    client,
    variables,
    // ...but only once finished loading.
    skip: loading || !!error,
  });
  return { data, error };
}
