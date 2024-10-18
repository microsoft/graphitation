import {
  ApolloClient,
  useApolloClient as useDefaultApolloClient,
} from "@apollo/client";
import invariant from "invariant";
import * as React from "react";

/**
 * @internal
 */
export function useOverridenOrDefaultApolloClient() {
  const client = React.useContext(ApolloReactRelayDuctTapeContext);
  if (client) {
    return client;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return useDefaultApolloClient() as ApolloClient<any>;
}

const ApolloReactRelayDuctTapeContext = React.createContext<
  ApolloClient<unknown> | undefined
>(undefined);

/**
 * A context provider that allows passing an explicit ApolloClient instance to
 * the apollo-react-relay-duct-tape hooks. If this provider is not used, the
 * hooks will default to one provided by @apollo/client's ApolloProvider.
 *
 * This allows a subset of a tree to use apollo-react-relay-duct-tape using a
 * different ApolloClient instance than the rest of the tree above and below it.
 */
export const ApolloReactRelayDuctTapeProvider: React.FC<
  React.PropsWithChildren<{
    client: ApolloClient<unknown>;
  }>
> = (props) => {
  invariant(
    props.client,
    "ApolloReactRelayDuctTapeProvider: client is required",
  );
  return React.createElement(
    ApolloReactRelayDuctTapeContext.Provider,
    { value: props.client },
    props.children,
  );
};
