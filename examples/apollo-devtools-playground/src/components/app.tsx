import { ApolloProvider } from "@apollo/client";
import { buildClient } from "data/data-builder";
import ChatContainer from "./chat/chat-container";
import { FluentProvider, teamsLightTheme } from "@fluentui/react-components";

const client = buildClient();
const client2 = buildClient();

if ((window as any) && !(window as any).__APOLLO_CLIENTS__?.length) {
  (window as any).__APOLLO_CLIENTS__ = [
    { client, clientId: "main" },
    { client: client2, clientId: "emptyClient" },
  ];
}

const App = () => {
  return (
    <FluentProvider theme={teamsLightTheme}>
      <ApolloProvider client={client}>
        <ChatContainer />
      </ApolloProvider>
    </FluentProvider>
  );
};

export default App;
