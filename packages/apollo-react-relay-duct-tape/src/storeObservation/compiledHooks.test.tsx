import React from "react";
import { ApolloProvider, QueryResult } from "@apollo/client";
import {
  act,
  create as createTestRenderer,
  ReactTestRenderer,
} from "react-test-renderer";
import { buildSchema } from "graphql";
import { graphql } from "@graphitation/graphql-js-tag";
import {
  ApolloMockClient,
  createMockClient,
} from "@graphitation/apollo-mock-client";
import * as MockPayloadGenerator from "@graphitation/graphql-js-operation-payload-generator";
import * as fs from "fs";
import * as path from "path";

import {
  useCompiledFragment,
  useCompiledLazyLoadQuery,
  useCompiledRefetchableFragment,
} from "./compiledHooks";
import { nodeFromCacheFieldPolicy } from "./nodeFromCacheFieldPolicy";

/**
 * NOTE: These compiler artefacts are normally imported using the transform from the createImportDocumentsTransform.ts module
 */
import * as compiledHooks_Root_executionQuery_documents from "./__generated__/compiledHooks_Root_executionQuery.graphql";
import * as compiledHooks_ChildFragment_documents from "./__generated__/compiledHooks_ChildWatchNodeQuery.graphql";
// TODO: Emit this import from transform
import * as compiledHooks_RefetchableFragment_documents from "./__generated__/compiledHooks_RefetchableFragment_RefetchQuery.graphql";

const schema = buildSchema(
  fs.readFileSync(
    path.resolve(__dirname, "../__tests__/schema.graphql"),
    "utf8"
  )
);

const Child_fragment = graphql`
  fragment compiledHooks_ChildFragment on User {
    petName
  }
`;

const Refetchable_fragment = graphql`
  fragment compiledHooks_RefetchableFragment on User
  @refetchable(queryName: "compiledHooks_RefetchableFragment_RefetchQuery") {
    petName
  }
`;

const Root_executionQueryDocument = graphql`
  query compiledHooks_Root_executionQuery($userId: ID!) {
    user(id: $userId) {
      name
      ...compiledHooks_ChildFragment
      ...compiledHooks_RefetchableFragment
    }
  }
  ${Child_fragment}
  ${Refetchable_fragment}
`;

describe("compiledHooks", () => {
  let client: ApolloMockClient;
  let testRenderer: ReactTestRenderer;

  let lastUseFragmentResult: any[];
  let lastUseRefetchableFragmentResult: any[];
  let lastUseLazyLoadQueryResult: { data?: any; error?: Error } | null = null;

  const ChildComponent: React.FC<{ user: { id: any } }> = (props) => {
    const result = useCompiledFragment(
      compiledHooks_ChildFragment_documents as any,
      props.user
    );
    lastUseFragmentResult.push(result);
    return null;
  };

  const ChildRefetchableComponent: React.FC<{ user: { id: any } }> = (
    props
  ) => {
    const result = useCompiledRefetchableFragment(
      compiledHooks_RefetchableFragment_documents as any,
      props.user
    );
    lastUseRefetchableFragmentResult.push(result);
    return null;
  };

  const RootComponent: React.FC<{ variables: {} }> = (props) => {
    const result = useCompiledLazyLoadQuery(
      compiledHooks_Root_executionQuery_documents as any,
      { variables: props.variables }
    );
    lastUseLazyLoadQueryResult = result;
    return result.data ? (
      <>
        <ChildComponent user={result.data.user} />
        <ChildRefetchableComponent user={result.data.user} />
      </>
    ) : null;
  };

  function itBehavesLikeFragment(returnedResults: () => any[]) {
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
      expect(returnedResults()[0]).toMatchInlineSnapshot(`
        Object {
          "__typename": "User",
          "id": 42,
          "petName": "<mock-value-for-field-\\"petName\\">",
        }
      `);
    });

    it("returns the same object when a field that was not selected in the watch query is updated in the store", async () => {
      const before = returnedResults()[0];
      await act(async () => {
        client.cache.modify({
          id: "User:42",
          fields: {
            name: () => "Satya",
          },
        });
        return new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(returnedResults().length).toBe(2);
      expect(returnedResults()[1]).toBe(before);
    });

    it("returns a new object when a field that was selected in the watch query is updated in the store", async () => {
      await act(async () => {
        client.cache.modify({
          id: "User:42",
          fields: {
            petName: () => "Phoenix",
          },
        });
        return new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(returnedResults().length).toBe(2);
      expect(returnedResults()[1]).toMatchInlineSnapshot(`
        Object {
          "__typename": "User",
          "id": 42,
          "petName": "Phoenix",
        }
      `);
    });

    it("returns data synchronously", () => {
      expect(returnedResults().length).toBe(1);
    });

    it("fetches new data when variables change", async () => {
      act(() => {
        testRenderer.update(
          <ApolloProvider client={client}>
            <RootComponent variables={{ userId: 21 }} />
          </ApolloProvider>
        );
      });
      await act(() =>
        client.mock.resolveMostRecentOperation((operation) =>
          MockPayloadGenerator.generate(operation, {
            User: () => ({ id: operation.request.variables.userId }),
          })
        )
      );
      expect(returnedResults()[1].id).toBe(21);
    });
  }

  beforeEach(() => {
    lastUseFragmentResult = [];
    lastUseRefetchableFragmentResult = [];
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
          <RootComponent variables={{ userId: 42 }} />
        </ApolloProvider>
      );
    });
  });

  afterEach(() => {
    lastUseLazyLoadQueryResult = null;
  });

  describe(useCompiledLazyLoadQuery, () => {
    it("correctly returns loading state", async () => {
      expect(lastUseLazyLoadQueryResult).toEqual({
        data: undefined,
        error: undefined,
      });
      await act(() =>
        client.mock.resolveMostRecentOperation((operation) =>
          MockPayloadGenerator.generate(operation)
        )
      );
      expect(lastUseLazyLoadQueryResult).toEqual({
        data: expect.objectContaining({}),
        error: undefined,
      });
    });

    describe("once loaded", () => {
      beforeEach(async () => {
        await act(() =>
          client.mock.resolveMostRecentOperation((operation) =>
            MockPayloadGenerator.generate(operation, {
              User: () => ({ id: operation.request.variables.userId }),
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

      it("fetches new data when variables change", async () => {
        act(() => {
          testRenderer.update(
            <ApolloProvider client={client}>
              <RootComponent variables={{ userId: 21 }} />
            </ApolloProvider>
          );
        });
        await act(() =>
          client.mock.resolveMostRecentOperation((operation) =>
            MockPayloadGenerator.generate(operation, {
              User: () => ({ id: operation.request.variables.userId }),
            })
          )
        );
        expect(client.cache.extract()["User:21"]).toMatchInlineSnapshot(`
          Object {
            "__typename": "User",
            "id": 21,
            "name": "<mock-value-for-field-\\"name\\">",
            "petName": "<mock-value-for-field-\\"petName\\">",
          }
        `);
      });
    });
  });

  describe(useCompiledFragment, () => {
    itBehavesLikeFragment(() => lastUseFragmentResult);
  });

  describe(useCompiledRefetchableFragment, () => {
    itBehavesLikeFragment(() => lastUseRefetchableFragmentResult);
  });
});
