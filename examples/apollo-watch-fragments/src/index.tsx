import "./wdyr";

import * as React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import { ApolloClient, ApolloProvider } from "@apollo/client";
import { createClient } from "./graphql";

const client = createClient();

ReactDOM.render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <App />
    </ApolloProvider>
  </React.StrictMode>,
  document.getElementById("root"),
);

/**
 * Make the client available to the debug console.
 */
declare global {
  var $client: ApolloClient<unknown>;
}
global.$client = client;
