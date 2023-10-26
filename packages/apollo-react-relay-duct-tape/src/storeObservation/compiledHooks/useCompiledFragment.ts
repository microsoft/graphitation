import { useEffect, useMemo } from "react";
import invariant from "invariant";
import { useForceUpdate } from "./useForceUpdate";
import { useOverridenOrDefaultApolloClient } from "../../useOverridenOrDefaultApolloClient";

import type { FragmentReference } from "./types";
import type { CompiledArtefactModule } from "@graphitation/apollo-react-relay-duct-tape-compiler";

/**
 * @param documents Compiled watch query document that is used to setup a narrow
 *                  observable for just the data selected by the original fragment.
 * @param fragmentReference A Node object that has a globally unique `id` field.
 */

export function useCompiledFragment(
  documents: CompiledArtefactModule,
  fragmentReference: FragmentReference,
): object {
  invariant(
    fragmentReference,
    "useFragment(): Expected metadata to have been extracted from " +
      "the fragment. Did you forget to invoke the compiler?",
  );
  const { watchQueryDocument, metadata } = documents;
  invariant(
    watchQueryDocument,
    "useFragment(): Expected a `watchQueryDocument` to have been " +
      "extracted. Did you forget to invoke the compiler?",
  );

  const client = useOverridenOrDefaultApolloClient();
  const forceUpdate = useForceUpdate();

  const observableQuery = useMemo(
    () =>
      client.watchQuery({
        fetchPolicy: "cache-only",
        query: watchQueryDocument,
        returnPartialData: false,
        variables: {
          id: fragmentReference.id,
          __fragments: fragmentReference.__fragments,
          ...fragmentReference.__fragments,
        },
      }),
    [client, fragmentReference.id, fragmentReference.__fragments],
  );

  useEffect(() => {
    let skipFirst = true;
    const subscription = observableQuery.subscribe(
      () => {
        // Unclear why, but this yields twice with the same results, so skip one.
        if (skipFirst) {
          skipFirst = false;
        } else {
          forceUpdate();
        }
      },
      (error) => {
        console.log(error);
      },
    );
    return () => subscription.unsubscribe();
  }, [observableQuery]);

  const result = observableQuery.getCurrentResult();
  let data = result.data;
  if (metadata?.rootSelection && !result.loading && data) {
    data = data[metadata.rootSelection];
  }
  // invariant(
  //   data,
  //   "useFragment(): Expected Apollo to respond with previously seeded data of the execution query document",
  // );
  return data;
}
