import {
  ApolloClient,
  InMemoryCache,
  from,
  ApolloProvider,
} from "@apollo/client";
import * as React from "react";

import { onError } from "@apollo/client/link/error";
import TodoList from "./components/TodoList";
import { asyncSplit } from "./schema/asyncSplit";

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
  cache: new InMemoryCache(),
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
