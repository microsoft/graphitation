import * as React from "react";
import { ApolloProvider } from "@apollo/client";
import { buildClient } from "data/data-builder";
import ChatContainer from "./chat/chat-container";
import { UserPreferenceTest } from "./user-preference-test";
import { OptimisticUpdateDemo } from "./optimistic-update-demo";
import { FluentProvider, teamsLightTheme } from "@fluentui/react-components";

const client = buildClient();
const client2 = buildClient();

if ((window as any) && !(window as any).__APOLLO_CLIENTS__?.length) {
  (window as any).__APOLLO_CLIENTS__ = [
    { client, clientId: "main" },
    { client: client2, clientId: "emptyClient" },
  ];
}

(window as any).__REMPL_APOLLO_DEVTOOLS_URL__ = "/subscriber.html";

const App = () => {
  return (
    <FluentProvider theme={teamsLightTheme}>
      <ApolloProvider client={client}>
        <OptimisticUpdateDemo />
        <UserPreferenceTest />
        <ChatContainer />
      </ApolloProvider>
    </FluentProvider>
  );
};

export default App;
