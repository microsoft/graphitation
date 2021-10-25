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

import { useCompiledFragment, useCompiledLazyLoadQuery } from "./compiledHooks";
import { nodeFromCacheFieldPolicy } from "./nodeFromCacheFieldPolicy";

/**
 * NOTE: These compiler artefacts are normally imported using the transform from the createImportDocumentsTransform.ts module
 */
import * as compiledHooks_Root_executionQuery_documents from "./__generated__/compiledHooks_Root_executionQuery.graphql";
import * as compiledHooks_ChildFragment_documents from "./__generated__/compiledHooks_ChildWatchNodeQuery.graphql";

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

const Root_executionQueryDocument = graphql`
  query compiledHooks_Root_executionQuery {
    user(id: 42) {
      name
      ...compiledHooks_ChildFragment
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
      compiledHooks_ChildFragment_documents as any,
      props.user
    );
    lastUseFragmentResult = result;
    return null;
  };

  const RootComponent: React.FC = () => {
    const result = useCompiledLazyLoadQuery(
      compiledHooks_Root_executionQuery_documents as any,
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

  describe(useCompiledRefetchableFragment, () => {
    it("works", () => {});
  });
});
