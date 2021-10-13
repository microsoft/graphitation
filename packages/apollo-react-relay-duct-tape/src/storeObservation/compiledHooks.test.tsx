import React from "react";
import { ApolloProvider, QueryResult } from "@apollo/client";
import {
  act,
  create as createTestRenderer,
  ReactTestRenderer,
} from "react-test-renderer";
import { buildASTSchema, buildSchema } from "graphql";
import { graphql } from "@graphitation/graphql-js-tag";
import {
  ApolloMockClient,
  createMockClient,
} from "@graphitation/apollo-mock-client";
import * as MockPayloadGenerator from "@graphitation/graphql-js-operation-payload-generator";

import { useCompiledLazyLoadQuery } from "./compiledHooks";

const schema = buildASTSchema(graphql`
  type Query {
    user: User!
  }
  type User {
    id: ID!
    name: String!
    petName: String!
  }
`);

const executionQueryDocument = graphql`
  query {
    user {
      __typename
      id
      name
      petName
    }
  }
`;

const watchQueryDocument = graphql`
  query {
    user {
      name
    }
  }
`;

describe(useCompiledLazyLoadQuery, () => {
  let client: ApolloMockClient;
  let testRenderer: ReactTestRenderer;
  let lastResultReturnedFromHook: QueryResult | null = null;

  const Subject: React.FC = () => {
    const result = useCompiledLazyLoadQuery(
      {
        executionQueryDocument,
        watchQueryDocument,
      },
      { variables: {} }
    );
    lastResultReturnedFromHook = result;
    return null;
  };

  beforeEach(() => {
    client = createMockClient(schema);
    act(() => {
      testRenderer = createTestRenderer(
        <ApolloProvider client={client}>
          <Subject />
        </ApolloProvider>
      );
    });
  });

  afterEach(() => {
    lastResultReturnedFromHook = null;
  });

  it("correctly returns loading state", async () => {
    expect(lastResultReturnedFromHook).toMatchObject({ loading: true });
    await act(() =>
      client.mock.resolveMostRecentOperation((operation) =>
        MockPayloadGenerator.generate(operation)
      )
    );
    expect(lastResultReturnedFromHook).toMatchObject({ loading: false });
  });

  describe("once loaded", () => {
    beforeEach(async () => {
      await act(() =>
        client.mock.resolveMostRecentOperation((operation) =>
          MockPayloadGenerator.generate(operation, { User: () => ({ id: 42 }) })
        )
      );
    });

    it("loads all data of the execution query into the store", () => {
      expect(client.cache.extract()["User:42"]).toMatchInlineSnapshot(`
        Object {
          "__typename": "User",
          "id": 42,
          "name": "<mock-value-for-field-\\"name\\">",
          "petName": "<mock-value-for-field-\\"petName\\">",
        }
      `);
    });

    it("only returns the fields selected in the watch query to the component", () => {
      expect(lastResultReturnedFromHook!.data).toMatchInlineSnapshot(`
        Object {
          "user": Object {
            "name": "<mock-value-for-field-\\"name\\">",
          },
        }
      `);
    });

    it("does not re-render when a field that was not selected in the watch query is updated in the store", async () => {
      const before = lastResultReturnedFromHook!.data;
      await act(async () => {
        client.cache.modify({
          id: "User:42",
          fields: {
            petName: () => "Phoenix",
          },
        });
        return new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(lastResultReturnedFromHook!.data).toBe(before);
    });

    it("does re-render when a field that was selected in the watch query is updated in the store", async () => {
      const before = lastResultReturnedFromHook!.data;
      await act(async () => {
        client.cache.modify({
          id: "User:42",
          fields: {
            name: () => "Satya",
          },
        });
        return new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(lastResultReturnedFromHook!.data).not.toBe(before);
      expect(lastResultReturnedFromHook!.data).toMatchInlineSnapshot(`
        Object {
          "user": Object {
            "name": "Satya",
          },
        }
      `);
    });

    // FIXME: Is the component unmounted earlier than expected?
    //        Commenting out the useEffect callback makes this test pass.
    it.skip("invokes fetchMore using the execution query", () => {
      lastResultReturnedFromHook!.fetchMore({});
      expect(client.mock.getMostRecentOperation().request.node).toBe(
        executionQueryDocument
      );
    });
  });
});
