import {
  ApolloClient,
  useApolloClient as useDefaultApolloClient,
} from "@apollo/client";
import React from "react";

/**
 * @internal
 */
export function useOverridenOrDefaultApolloClient(): ApolloClient<any> {
  const client = React.useContext(ApolloReactRelayDuctTapeContext);
  if (client) {
    return client;
  }
  return useDefaultApolloClient();
}

const ApolloReactRelayDuctTapeContext = React.createContext<
  ApolloClient<any> | undefined
>(undefined);

/**
 * A context provider that allows passing an explicit ApolloClient instance to
 * the apollo-react-relay-duct-tape hooks. If this provider is not used, the
 * hooks will default to one provided by @apollo/client's ApolloProvider.
 *
 * This allows a subset of a tree to use apollo-react-relay-duct-tape using a
 * different ApolloClient instance than the rest of the tree above and below it.
 */
export const ApolloReactRelayDuctTapeProvider: React.FC<{
  client: ApolloClient<any>;
}> = (props) => {
  return React.createElement(
    ApolloReactRelayDuctTapeContext.Provider,
    { value: props.client },
    props.children
  );
};
