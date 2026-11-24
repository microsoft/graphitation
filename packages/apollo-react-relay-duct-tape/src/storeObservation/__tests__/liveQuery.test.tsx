import * as React from "react";
import { act, create, ReactTestRenderer } from "react-test-renderer";
import { ApolloClient, ApolloLink, Observable, gql } from "@apollo/client";
import { ForestRun } from "@graphitation/apollo-forest-run";
import {
  createLiveSource,
  executeWithSchema,
} from "@graphitation/supermassive";
import type { CompiledArtefactModule } from "@graphitation/apollo-react-relay-duct-tape-compiler";
import { parse } from "graphql";
import { useCompiledFragment } from "../compiledHooks";
import { ApolloReactRelayDuctTapeProvider } from "../../useOverridenOrDefaultApolloClient";

function state<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    listeners,
    source: createLiveSource({
      read: () => value,
      subscribe(invalidate) {
        listeners.add(invalidate);
        return () => {
          listeners.delete(invalidate);
        };
      },
    }),
    set(next: T) {
      value = next;
      listeners.forEach((invalidate) => invalidate());
    },
  };
}

async function waitFor(predicate: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for live query update");
}

it("keeps unchanged narrow fragments quiet when native live execution emits full snapshots", async () => {
  const count = state(1);
  const label = state("unchanged");
  const definitions = parse(`
    directive @live(if: Boolean = true) on QUERY
    interface Node { id: ID! }
    type State implements Node { id: ID!, count: Int!, label: String! }
    type Query { node(id: ID!): Node }
  `);
  const client = new ApolloClient({
    cache: new ForestRun(),
    link: new ApolloLink(
      (operation) =>
        new Observable((observer) => {
          let cancelled = false;
          let iterator: AsyncIterator<unknown> | undefined;
          void (async () => {
            const result = await executeWithSchema({
              definitions,
              document: operation.query,
              variableValues: operation.variables,
              resolvers: {
                Query: {
                  node: () => ({
                    __typename: "State",
                    id: "state",
                    count: count.source,
                    label: label.source,
                  }),
                },
              },
            });
            if (!(Symbol.asyncIterator in result)) {
              throw new Error("Expected a native live result stream");
            }
            iterator = result;
            if (cancelled) {
              await iterator.return?.();
              return;
            }
            for await (const snapshot of result) observer.next(snapshot);
            observer.complete();
          })().catch((error) => observer.error(error));
          return () => {
            cancelled = true;
            void iterator?.return?.();
          };
        }),
    ),
  });
  const execution = gql`
    query LiveState @live {
      node(id: "state") {
        id
        __typename
        ... on State {
          count
          label
        }
      }
    }
  `;
  const countDocument: CompiledArtefactModule = {
    watchQueryDocument: gql`
      query WatchCount {
        node(id: "state") {
          id
          __typename
          ... on State {
            count
          }
        }
      }
    `,
    metadata: { rootSelection: "node" },
  };
  const labelDocument: CompiledArtefactModule = {
    watchQueryDocument: gql`
      query WatchLabel {
        node(id: "state") {
          id
          __typename
          ... on State {
            label
          }
        }
      }
    `,
    metadata: { rootSelection: "node" },
  };
  const reference = { id: "state" };
  let countRenders = 0;
  let labelRenders = 0;
  function Count() {
    const data = useCompiledFragment(countDocument, reference) as {
      count: number;
    };
    countRenders++;
    return <span>{data.count}</span>;
  }
  function Label() {
    const data = useCompiledFragment(labelDocument, reference) as {
      label: string;
    };
    labelRenders++;
    return <span>{data.label}</span>;
  }
  function View() {
    return (
      <ApolloReactRelayDuctTapeProvider client={client}>
        <Count />
        <Label />
      </ApolloReactRelayDuctTapeProvider>
    );
  }
  let renderer: ReactTestRenderer | undefined;
  let snapshots = 0;
  let failure: unknown;
  const subscription = client
    .watchQuery({
      query: execution,
      fetchPolicy: "network-only",
      nextFetchPolicy: "network-only",
    })
    .subscribe({
      next: () => {
        snapshots++;
      },
      error: (error) => {
        failure = error;
      },
    });
  try {
    await waitFor(() => snapshots === 1 || failure !== undefined);
    if (failure) throw failure;
    act(() => {
      renderer = create(<View />);
    });
    expect([countRenders, labelRenders]).toEqual([1, 1]);
    await act(async () => {
      count.set(2);
      await waitFor(() => countRenders === 2);
    });
    expect(snapshots).toBe(2);
    expect([countRenders, labelRenders]).toEqual([2, 1]);
    expect(client.readQuery({ query: execution })).toMatchObject({
      node: { count: 2, label: "unchanged" },
    });

    act(() => {
      renderer?.update(<View />);
    });
    expect([countRenders, labelRenders]).toEqual([3, 2]);
  } finally {
    act(() => {
      renderer?.unmount();
    });
    subscription.unsubscribe();
    client.stop();
  }
  await waitFor(() => count.listeners.size === 0 && label.listeners.size === 0);
});
