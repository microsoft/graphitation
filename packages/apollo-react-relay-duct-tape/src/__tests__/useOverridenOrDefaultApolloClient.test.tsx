import * as React from "react";
import { create as createTestRenderer } from "react-test-renderer";
import {
  ApolloClient,
  ApolloProvider,
  InMemoryCache,
  useApolloClient as useDefaultApolloClient,
} from "@apollo/client";
import {
  ApolloReactRelayDuctTapeProvider,
  useOverridenOrDefaultApolloClient,
} from "../useOverridenOrDefaultApolloClient";

describe(useOverridenOrDefaultApolloClient, () => {
  it("defaults to the client provided by ApolloProvider", () => {
    const expectedClient = new ApolloClient({ cache: new InMemoryCache() });
    let yieldedClient: ApolloClient<any> | undefined;
    const Subject = () => {
      yieldedClient = useOverridenOrDefaultApolloClient();
      return null;
    };
    createTestRenderer(
      <ApolloProvider client={expectedClient}>
        <Subject />
      </ApolloProvider>,
    );
    expect(yieldedClient).toBe(expectedClient);
  });

  it("returns the explicitly overriden client provided by ApolloReactRelayDuctTapeProvider", () => {
    const overridenClient = new ApolloClient({ cache: new InMemoryCache() });
    const defaultClient = new ApolloClient({ cache: new InMemoryCache() });
    let yieldedOverridenClient: ApolloClient<any> | undefined;
    let yieldedDefaultClient: ApolloClient<any> | undefined;
    const OverridenSubject = () => {
      yieldedOverridenClient = useOverridenOrDefaultApolloClient();
      return null;
    };
    const DefaultSubject = () => {
      yieldedDefaultClient = useDefaultApolloClient();
      return null;
    };
    createTestRenderer(
      <ApolloProvider client={defaultClient}>
        <ApolloReactRelayDuctTapeProvider client={overridenClient}>
          <OverridenSubject />
          <DefaultSubject />
        </ApolloReactRelayDuctTapeProvider>
      </ApolloProvider>,
    );
    expect(yieldedOverridenClient).toBe(overridenClient);
    expect(yieldedDefaultClient).toBe(defaultClient);
  });
});
