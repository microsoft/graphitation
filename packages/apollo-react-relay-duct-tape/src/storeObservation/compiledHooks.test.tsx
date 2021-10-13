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

import { useCompiledFragment, useCompiledLazyLoadQuery } from "./compiledHooks";
import { nodeFromCacheFieldPolicy } from "./nodeFromCacheFieldPolicy";

const schema = buildASTSchema(graphql`
  interface Node {
    id: ID!
  }
  type Query {
    user: User!
    node: Node
  }
  type User implements Node {
    id: ID!
    name: String!
    petName: String!
  }
`);

const Child_fragment = graphql`
  fragment Child_fragment on User {
    petName
    # NOTE: These selections get inserted by the compiler
    __typename
    id
  }
`;

const Root_executionQueryDocument = graphql`
  query Root_executionQueryDocument {
    user {
      name
      ...Child_fragment
      # NOTE: These selections get inserted by the compiler
      __typename
      id
    }
  }
  ${Child_fragment}
`;

const Root_watchQueryDocument = graphql`
  query Root_watchQueryDocument {
    user {
      name
      # NOTE: These selections get inserted by the compiler
      __typename
      id
    }
  }
`;

const Child_watchQueryDocument = graphql`
  query Child_watchQueryDocument($id: ID!) {
    node(id: $id) {
      ...Child_fragment
    }
  }
  ${Child_fragment}
`;

describe("compiledHooks", () => {
  let client: ApolloMockClient;
  let testRenderer: ReactTestRenderer;

  let lastUseFragmentResult: any | null = null;
  let lastUseLazyLoadQueryResult: QueryResult | null = null;
  let useFragmentRenderCount: number | null;

  const ChildComponent: React.FC<{ user: { id: any } }> = (props) => {
    useFragmentRenderCount!++;
    const result = useCompiledFragment(
      {
        watchQueryDocument: Child_watchQueryDocument,
      },
      props.user
    );
    lastUseFragmentResult = result;
    return null;
  };

  const RootComponent: React.FC = () => {
    const result = useCompiledLazyLoadQuery(
      {
        executionQueryDocument: Root_executionQueryDocument,
        watchQueryDocument: Root_watchQueryDocument,
      },
      { variables: {} }
    );
    lastUseLazyLoadQueryResult = result;
    return result.data ? <ChildComponent user={result.data.user} /> : null;
  };

  beforeEach(() => {
    useFragmentRenderCount = 0;
    client = createMockClient(schema, {
      cache: {
        typePolicies: {
          Query: {
            fields: {
              node: {
                read: nodeFromCacheFieldPolicy,
              },
            },
          },
        },
      },
    });
    act(() => {
      testRenderer = createTestRenderer(
        <ApolloProvider client={client}>
          <RootComponent />
        </ApolloProvider>
      );
    });
  });

  afterEach(() => {
    useFragmentRenderCount = null;
    lastUseLazyLoadQueryResult = null;
    lastUseFragmentResult = null;
  });

  describe(useCompiledLazyLoadQuery, () => {
    it("correctly returns loading state", async () => {
      expect(lastUseLazyLoadQueryResult).toMatchObject({ loading: true });
      await act(() =>
        client.mock.resolveMostRecentOperation((operation) =>
          MockPayloadGenerator.generate(operation)
        )
      );
      expect(lastUseLazyLoadQueryResult).toMatchObject({ loading: false });
    });

    describe("once loaded", () => {
      beforeEach(async () => {
        await act(() =>
          client.mock.resolveMostRecentOperation((operation) =>
            MockPayloadGenerator.generate(operation, {
              User: () => ({ id: 42 }),
            })
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
        expect(lastUseLazyLoadQueryResult!.data).toMatchInlineSnapshot(`
          Object {
            "user": Object {
              "__typename": "User",
              "id": 42,
              "name": "<mock-value-for-field-\\"name\\">",
            },
          }
        `);
      });

      it("does not re-render when a field that was not selected in the watch query is updated in the store", async () => {
        const before = lastUseLazyLoadQueryResult!.data;
        await act(async () => {
          client.cache.modify({
            id: "User:42",
            fields: {
              petName: () => "Phoenix",
            },
          });
          return new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(lastUseLazyLoadQueryResult!.data).toBe(before);
      });

      it("does re-render when a field that was selected in the watch query is updated in the store", async () => {
        const before = lastUseLazyLoadQueryResult!.data;
        await act(async () => {
          client.cache.modify({
            id: "User:42",
            fields: {
              name: () => "Satya",
            },
          });
          return new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(lastUseLazyLoadQueryResult!.data).not.toBe(before);
        expect(lastUseLazyLoadQueryResult!.data).toMatchInlineSnapshot(`
          Object {
            "user": Object {
              "__typename": "User",
              "id": 42,
              "name": "Satya",
            },
          }
        `);
      });

      // FIXME: Is the component unmounted earlier than expected?
      //        Commenting out the useEffect callback makes this test pass.
      it.skip("invokes fetchMore using the execution query", () => {
        lastUseLazyLoadQueryResult!.fetchMore({});
        expect(client.mock.getMostRecentOperation().request.node).toBe(
          Root_executionQueryDocument
        );
      });
    });
  });

  describe(useCompiledFragment, () => {
    beforeEach(async () => {
      await act(() =>
        client.mock.resolveMostRecentOperation((operation) =>
          MockPayloadGenerator.generate(operation, {
            User: () => ({ id: 42 }),
          })
        )
      );
    });

    it("only returns the fields selected in the watch query to the component", () => {
      expect(lastUseFragmentResult).toMatchInlineSnapshot(`
        Object {
          "__typename": "User",
          "id": 42,
          "petName": "<mock-value-for-field-\\"petName\\">",
        }
      `);
    });

    it("does not re-render when a field that was not selected in the watch query is updated in the store", async () => {
      const before = lastUseFragmentResult;
      await act(async () => {
        client.cache.modify({
          id: "User:42",
          fields: {
            name: () => "Satya",
          },
        });
        return new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(lastUseFragmentResult).toBe(before);
    });

    it("does re-render when a field that was selected in the watch query is updated in the store", async () => {
      const before = lastUseFragmentResult;
      await act(async () => {
        client.cache.modify({
          id: "User:42",
          fields: {
            petName: () => "Phoenix",
          },
        });
        return new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(lastUseFragmentResult).not.toBe(before);
      expect(lastUseFragmentResult).toMatchInlineSnapshot(`
        Object {
          "__typename": "User",
          "id": 42,
          "petName": "Phoenix",
        }
      `);
    });

    it("returns data synchronously", () => {
      expect(useFragmentRenderCount).toBe(1);
    });
  });
});
