import * as React from "react";
import { graphql } from "@graphitation/graphql-js-tag";
import { readFileSync } from "fs";
import { buildSchema } from "graphql";
import * as ReactTestRenderer from "react-test-renderer";
import { ApolloProvider, useQuery } from "@apollo/client";
import * as MockPayloadGenerator from "@graphitation/graphql-js-operation-payload-generator";

import { ApolloMockClient, createMockClient } from "../index";

const schema = buildSchema(
  readFileSync(
    require.resolve("relay-test-utils-internal/lib/testschema.graphql"),
    "utf8",
  ),
);

const TestQuery = graphql`
  query AsyncResolverTestQuery($id: ID = "<default>") {
    user: node(id: $id) {
      id
      name
    }
  }
`;

describe("Async resolver support", () => {
  let client: ApolloMockClient;

  beforeEach(() => {
    client = createMockClient(schema);
  });

  it("should resolve with an async resolver", async () => {
    const TestComponent: React.FC = () => {
      const { data, loading } = useQuery<{
        user: { id: string; name: string };
      }>(TestQuery as any);
      if (loading) return <div id="loading">Loading...</div>;
      if (data) return <div id="data">{data.user.name}</div>;
      return null;
    };

    let tree: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <ApolloProvider client={client}>
          <TestComponent />
        </ApolloProvider>,
      );
    });

    expect(() =>
      tree.root.find((node) => node.props.id === "loading"),
    ).not.toThrow();

    await ReactTestRenderer.act(() =>
      client.mock.resolveMostRecentOperation(async (operation) =>
        MockPayloadGenerator.generate(operation),
      ),
    );

    expect(() =>
      tree.root.find((node) => node.props.id === "data"),
    ).not.toThrow();
  });

  it("should call onCompleted with async resolver for network-only fetchPolicy", async () => {
    // Verifies the fix for https://github.com/apollographql/apollo-client/issues/11327
    //
    // Apollo Client 3.8+ added a networkStatus transition guard to onCompleted
    // (PR #10229). When mock resolution is synchronous, markReady() mutates
    // queryInfo.networkStatus before zen-observable delivers data through
    // reportResult(), causing getCurrentResult() to read an inconsistent
    // intermediate state. This consumes the networkStatus transition without
    // data, so by the time data arrives, onCompleted is blocked.
    //
    // An async resolver introduces a microtask boundary that flushes pending
    // zen-observable subscription microtasks before delivering data, matching
    // production timing where network responses are inherently async.
    const onCompletedFn = jest.fn();

    const TestComponent: React.FC = () => {
      const { data, loading } = useQuery<{
        user: { id: string; name: string };
      }>(TestQuery as any, {
        fetchPolicy: "network-only",
        onCompleted: onCompletedFn,
      });
      if (loading) return <div id="loading">Loading...</div>;
      if (data) return <div id="data">{data.user.name}</div>;
      return null;
    };

    let tree: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <ApolloProvider client={client}>
          <TestComponent />
        </ApolloProvider>,
      );
    });

    await ReactTestRenderer.act(() =>
      client.mock.resolveMostRecentOperation(async (operation) =>
        MockPayloadGenerator.generate(operation),
      ),
    );

    expect(onCompletedFn).toHaveBeenCalledTimes(1);
    expect(() =>
      tree!.root.find((node) => node.props.id === "data"),
    ).not.toThrow();
  });

  it("should still work with sync resolvers", async () => {
    const TestComponent: React.FC = () => {
      const { data, loading } = useQuery<{
        user: { id: string; name: string };
      }>(TestQuery as any);
      if (loading) return <div id="loading">Loading...</div>;
      if (data) return <div id="data">{data.user.name}</div>;
      return null;
    };

    let tree: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <ApolloProvider client={client}>
          <TestComponent />
        </ApolloProvider>,
      );
    });

    await ReactTestRenderer.act(() =>
      client.mock.resolveMostRecentOperation((operation) =>
        MockPayloadGenerator.generate(operation),
      ),
    );

    expect(() =>
      tree.root.find((node) => node.props.id === "data"),
    ).not.toThrow();
  });
});
