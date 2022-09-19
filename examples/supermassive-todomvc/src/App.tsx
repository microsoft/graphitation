import {
  ApolloClient,
  InMemoryCache,
  from,
  ApolloProvider,
} from "@apollo/client";
import { Cache as RelayCache } from "../../../packages/relay-apollo-duct-tape/src/Cache";
import React from "react";
import { Environment, Network, RecordSource, Store } from "relay-runtime";
import { onError } from "@apollo/client/link/error";
import TodoList from "./components/TodoList";
import { asyncSplit } from "./schema/asyncSplit";

const network = Network.create(() => {
  return null as any;
});
const store = new Store(new RecordSource());
const environment = new Environment({ network, store });

// Log any GraphQL errors or network error that occurred
const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors)
    graphQLErrors.forEach((error) => {
      const { message, locations, path } = error;
      console.log(
        `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
      );
      console.error(error);
    });
  if (networkError) {
    console.log(`[Network error]: ${networkError}`);
    console.error(networkError);
  }
});

const client = new ApolloClient({
  cache: new RelayCache(environment) as any,
  link: from([
    errorLink,
    asyncSplit(
      () => true,
      async () => {
        const { supermassiveSchemaLink } = await import(
          /* webpackChunkName: "supermassiveLink" */
          "./schema/productionLink"
        );
        return supermassiveSchemaLink;
      },
      async () => {
        const { executableSchemaLink } = await import(
          /* webpackChunkName: "executableLink" */
          "./schema/link"
        );
        return executableSchemaLink;
      }
    ),
  ]),
});

function App() {
  return (
    <ApolloProvider client={client}>
      <TodoList />
    </ApolloProvider>
  );
}

export default App;
