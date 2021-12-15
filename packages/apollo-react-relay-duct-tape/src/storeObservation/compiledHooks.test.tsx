import React from "react";
import { ApolloProvider } from "@apollo/client";
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
  RefetchFn,
  useCompiledFragment,
  useCompiledLazyLoadQuery,
  useCompiledPaginationFragment,
  useCompiledRefetchableFragment,
} from "./compiledHooks";
import { typePolicies } from "./typePolicies";

/**
 * NOTE: These compiler artefacts are normally imported using the transform from the createImportDocumentsTransform.ts module
 */
import { documents as compiledHooks_Root_executionQuery_documents } from "./__generated__/compiledHooks_Root_executionQuery.graphql";
import { documents as compiledHooks_ChildFragment_documents } from "./__generated__/compiledHooks_ChildWatchNodeQuery.graphql";
import { documents as compiledHooks_RefetchableFragment_documents } from "./__generated__/compiledHooks_RefetchableFragment_RefetchQuery.graphql";
import { documents as compiledHooks_QueryTypeFragment_documents } from "./__generated__/compiledHooks_QueryTypeWatchNodeQuery.graphql";
import { documents as compiledHooks_ForwardPaginationFragment_documents } from "./__generated__/compiledHooks_ForwardPaginationFragment_PaginationQuery.graphql";
import { documents as compiledHooks_BackwardPaginationFragment_documents } from "./__generated__/compiledHooks_BackwardPaginationFragment_PaginationQuery.graphql";
import { compiledHooks_Root_executionQueryVariables } from "./__generated__/compiledHooks_Root_executionQuery.graphql";

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
  # @argumentDefinitions(avatarSize: { type: "Int!", defaultValue: 21 })
  @refetchable(queryName: "compiledHooks_RefetchableFragment_RefetchQuery") {
    petName
    avatarUrl(size: $avatarSize)
  }
`;

const QueryType_fragment = graphql`
  fragment compiledHooks_QueryTypeFragment on Query {
    nonNode {
      id
    }
  }
`;

const ForwardPagination_fragment = graphql`
  fragment compiledHooks_ForwardPaginationFragment on User
  @refetchable(
    queryName: "compiledHooks_ForwardPaginationFragment_PaginationQuery"
  ) {
    petName
    avatarUrl(size: $avatarSize)
    conversations(
      first: $conversationsForwardCount
      after: $conversationsAfterCursor
    ) @connection(key: "compiledHooks_user_conversations") {
      edges {
        node {
          title
          ...compiledHooks_BackwardPaginationFragment
        }
      }
    }
  }
`;

const BackwardPagination_fragment = graphql`
  fragment compiledHooks_BackwardPaginationFragment on Conversation
  @refetchable(
    queryName: "compiledHooks_BackwardPaginationFragment_PaginationQuery"
  ) {
    messages(last: $messagesBackwardCount, before: $messagesBeforeCursor)
      @connection(key: "compiledHooks_conversation_messages") {
      edges {
        node {
          text
        }
      }
    }
  }
`;

const Root_executionQueryDocument = graphql`
  query compiledHooks_Root_executionQuery(
    $userId: Int!
    $avatarSize: Int!
    $conversationsForwardCount: Int!
    $conversationsAfterCursor: String!
    $messagesBackwardCount: Int!
    $messagesBeforeCursor: String!
  ) {
    user(id: $userId) {
      name
      ...compiledHooks_ChildFragment
      ...compiledHooks_RefetchableFragment
      ...compiledHooks_ForwardPaginationFragment
    }
    ...compiledHooks_QueryTypeFragment
  }
`;

describe("compiledHooks", () => {
  let client: ApolloMockClient;
  let testRenderer: ReactTestRenderer;

  let lastUseFragmentResult: { id: number }[];
  let lastUseRefetchableFragmentResult: ReturnType<
    typeof useCompiledRefetchableFragment
  >[];
  let lastForwardUsePaginationFragmentResult: ReturnType<
    typeof useCompiledPaginationFragment
  >[];
  let lastBackwardUsePaginationFragmentResult: ReturnType<
    typeof useCompiledPaginationFragment
  >[];
  let lastUseLazyLoadQueryResult: { data?: any; error?: Error } | null = null;
  let lastComponentOnQueryTypeResult: {}[];

  const ChildComponent: React.FC<{ user: { id: any } }> = (props) => {
    const result = useCompiledFragment(
      compiledHooks_ChildFragment_documents,
      props.user
    );
    lastUseFragmentResult.push(result as { id: number });
    return null;
  };

  const ChildRefetchableComponent: React.FC<{ user: { id: any } }> = (
    props
  ) => {
    const result = useCompiledRefetchableFragment(
      compiledHooks_RefetchableFragment_documents,
      props.user
    );
    lastUseRefetchableFragmentResult.push(result);
    return null;
  };

  const ComponentOnQueryType: React.FC<{ query: {} }> = (props) => {
    const result = useCompiledFragment(
      compiledHooks_QueryTypeFragment_documents,
      props.query
    );
    lastComponentOnQueryTypeResult.push(result);
    return null;
  };

  const ChildForwardPaginationComponent: React.FC<{ user: { id: any } }> = (
    props
  ) => {
    const result = useCompiledPaginationFragment(
      compiledHooks_ForwardPaginationFragment_documents as any,
      props.user
    );
    lastForwardUsePaginationFragmentResult.push(result);

    return result.data.conversations.edges.map((edge: any, index: number) => {
      // console.log(edge.node);
      return (
        <ChildBackwardPaginationComponent
          conversation={edge.node}
          key={index}
        />
      );
    });
  };

  const ChildBackwardPaginationComponent: React.FC<{
    conversation: { id: any };
  }> = (props) => {
    const result = useCompiledPaginationFragment(
      compiledHooks_BackwardPaginationFragment_documents as any,
      props.conversation
    );
    lastBackwardUsePaginationFragmentResult.push(result);
    return null;
  };

  const RootComponent: React.FC<{
    variables: compiledHooks_Root_executionQueryVariables;
  }> = (props) => {
    const result = useCompiledLazyLoadQuery(
      compiledHooks_Root_executionQuery_documents,
      { variables: props.variables }
    );
    lastUseLazyLoadQueryResult = result;
    return result.data ? (
      <>
        <ChildComponent user={result.data.user} />
        <ChildRefetchableComponent user={result.data.user} />
        <ChildForwardPaginationComponent user={result.data.user} />
        <ComponentOnQueryType query={result.data} />
      </>
    ) : null;
  };

  beforeEach(() => {
    lastUseLazyLoadQueryResult = null;
    lastUseFragmentResult = [];
    lastUseRefetchableFragmentResult = [];
    lastForwardUsePaginationFragmentResult = [];
    lastBackwardUsePaginationFragmentResult = [];
    lastComponentOnQueryTypeResult = [];
    client = createMockClient(schema, {
      cache: {
        possibleTypes: {
          Node: ["User"],
        },
        typePolicies,
      },
    });
    act(() => {
      testRenderer = createTestRenderer(
        <ApolloProvider client={client}>
          <ErrorBoundary>
            <RootComponent
              variables={{
                userId: 42,
                avatarSize: 21,
                conversationsForwardCount: 1,
                conversationsAfterCursor: "",
                messagesBackwardCount: 1,
                messagesBeforeCursor: "",
              }}
            />
          </ErrorBoundary>
        </ApolloProvider>
      );
    });
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
              User: (options, generateId) => {
                // console.log({ options });
                return {
                  id:
                    options.parentType === "Query"
                      ? operation.request.variables.userId
                      : generateId(),
                };
              },
              Conversation: () => ({
                id: "first-paged-conversation",
              }),
              Message: () => ({
                id: "first-paged-message",
              }),
            })
          )
        );
      });

      it("loads all data of the execution query into the store", () => {
        expect(client.cache.extract()).toMatchInlineSnapshot(`
          Object {
            "Conversation:first-paged-conversation": Object {
              "__typename": "Conversation",
              "id": "first-paged-conversation",
              "messages:compiledHooks_conversation_messages": Object {
                "__typename": "ConversationMessagesConnection",
                "edges": Array [
                  Object {
                    "__typename": "ConversationMessagesConnectionEdge",
                    "cursor": "<mock-value-for-field-\\"cursor\\">",
                    "node": Object {
                      "__ref": "Message:first-paged-message",
                    },
                  },
                ],
                "pageInfo": Object {
                  "__typename": "PageInfo",
                  "hasPreviousPage": false,
                  "startCursor": "<mock-value-for-field-\\"startCursor\\">",
                },
              },
              "title": "<mock-value-for-field-\\"title\\">",
            },
            "Message:first-paged-message": Object {
              "__typename": "Message",
              "id": "first-paged-message",
              "text": "<mock-value-for-field-\\"text\\">",
            },
            "NonNode:<mock-value-for-field-\\"id\\">": Object {
              "__typename": "NonNode",
              "id": "<mock-value-for-field-\\"id\\">",
            },
            "ROOT_QUERY": Object {
              "__typename": "Query",
              "nonNode": Object {
                "__ref": "NonNode:<mock-value-for-field-\\"id\\">",
              },
              "user({\\"id\\":42})": Object {
                "__ref": "User:42",
              },
            },
            "User:42": Object {
              "__typename": "User",
              "avatarUrl({\\"size\\":21})": "<mock-value-for-field-\\"avatarUrl\\">",
              "conversations:compiledHooks_user_conversations": Object {
                "__typename": "ConversationsConnection",
                "edges": Array [
                  Object {
                    "__typename": "ConversationsConnectionEdge",
                    "cursor": "<mock-value-for-field-\\"cursor\\">",
                    "node": Object {
                      "__ref": "Conversation:first-paged-conversation",
                    },
                  },
                ],
                "pageInfo": Object {
                  "__typename": "PageInfo",
                  "endCursor": "<mock-value-for-field-\\"endCursor\\">",
                  "hasNextPage": false,
                },
              },
              "id": 42,
              "name": "<mock-value-for-field-\\"name\\">",
              "petName": "<mock-value-for-field-\\"petName\\">",
            },
          }
        `);
      });

      it("only returns the fields selected in the watch query to the component", () => {
        expect(lastUseLazyLoadQueryResult!.data).toMatchInlineSnapshot(`
          Object {
            "__fragments": Object {
              "avatarSize": 21,
              "conversationsAfterCursor": "",
              "conversationsForwardCount": 1,
              "messagesBackwardCount": 1,
              "messagesBeforeCursor": "",
              "userId": 42,
            },
            "user": Object {
              "__fragments": Object {
                "avatarSize": 21,
                "conversationsAfterCursor": "",
                "conversationsForwardCount": 1,
                "messagesBackwardCount": 1,
                "messagesBeforeCursor": "",
                "userId": 42,
              },
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
            "__fragments": Object {
              "avatarSize": 21,
              "conversationsAfterCursor": "",
              "conversationsForwardCount": 1,
              "messagesBackwardCount": 1,
              "messagesBeforeCursor": "",
              "userId": 42,
            },
            "user": Object {
              "__fragments": Object {
                "avatarSize": 21,
                "conversationsAfterCursor": "",
                "conversationsForwardCount": 1,
                "messagesBackwardCount": 1,
                "messagesBeforeCursor": "",
                "userId": 42,
              },
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
              <ErrorBoundary>
                <RootComponent
                  variables={{
                    userId: 21,
                    avatarSize: 21,
                    conversationsForwardCount: 1,
                    conversationsAfterCursor: "",
                    messagesBackwardCount: 1,
                    messagesBeforeCursor: "",
                  }}
                />
              </ErrorBoundary>
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
            "avatarUrl({\\"size\\":21})": "<mock-value-for-field-\\"avatarUrl\\">",
            "conversations:compiledHooks_user_conversations": Object {
              "__typename": "ConversationsConnection",
              "edges": Array [
                Object {
                  "__typename": "ConversationsConnectionEdge",
                  "cursor": "<mock-value-for-field-\\"cursor\\">",
                  "node": Object {
                    "__ref": "Conversation:<Conversation-mock-id-5>",
                  },
                },
              ],
              "pageInfo": Object {
                "__typename": "PageInfo",
                "endCursor": "<mock-value-for-field-\\"endCursor\\">",
                "hasNextPage": false,
              },
            },
            "id": 21,
            "name": "<mock-value-for-field-\\"name\\">",
            "petName": "<mock-value-for-field-\\"petName\\">",
          }
        `);
      });

      it("does not try to kick-off a new query when the variables object deep equals the previous one", async () => {
        const spy = jest.spyOn(client, "query");
        await act(async () => {
          testRenderer.update(
            <ApolloProvider client={client}>
              <ErrorBoundary>
                <RootComponent
                  variables={{
                    userId: 42,
                    avatarSize: 21,
                    conversationsForwardCount: 1,
                    conversationsAfterCursor: "",
                    messagesBackwardCount: 1,
                    messagesBeforeCursor: "",
                  }}
                />
              </ErrorBoundary>
            </ApolloProvider>
          );
          return new Promise((resolve) => setTimeout(resolve, 100));
        });
        expect(spy).not.toHaveBeenCalled();
      });
    });
  });

  function itBehavesLikeFragment(
    returnedResults: () => { id: number }[],
    fragmentSpecificFieldSelections?: {}
  ) {
    // TODO: This should be scoped so it doesn't leak to other tests in the same parent describe
    // describe("behaves like useFragment", () => {
    beforeEach(async () => {
      await act(() =>
        client.mock.resolveMostRecentOperation((operation) => {
          const result = MockPayloadGenerator.generate(operation, {
            User: () => ({
              id: 42,
            }),
            Conversation: () => ({
              id: "first-paged-conversation",
            }),
            Message: () => ({
              id: "first-paged-message",
            }),
            PageInfo: () => ({
              startCursor: "first-page-start-cursor",
              endCursor: "first-page-end-cursor",
              hasNextPage: true,
              hasPreviousPage: true,
            }),
          });
          return result;
        })
      );
    });

    it("only returns the fields selected in the watch query to the component", () => {
      expect(returnedResults()[0]).toEqual({
        __fragments: {
          avatarSize: 21,
          conversationsForwardCount: 1,
          conversationsAfterCursor: "",
          messagesBackwardCount: 1,
          messagesBeforeCursor: "",
          userId: 42,
        },
        __typename: "User",
        id: 42,
        petName: '<mock-value-for-field-"petName">',
        ...fragmentSpecificFieldSelections,
      });
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
      expect(returnedResults()[1]).toBe(before);
    });

    it("returns a new object when a field that was selected in the watch query is updated in the store", async () => {
      await act(async () => {
        client.cache.modify({
          id: "User:42",
          fields: {
            petName: () => "some new value",
          },
        });
        return new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(returnedResults().length).toBe(2);
      expect(returnedResults()[1]).toMatchObject({
        petName: "some new value",
      });
    });

    it("returns data synchronously", () => {
      expect(returnedResults().length).toBe(1);
    });

    it("fetches new data when variables change", async () => {
      act(() => {
        testRenderer.update(
          <ApolloProvider client={client}>
            <ErrorBoundary>
              <RootComponent
                variables={{
                  userId: 21,
                  avatarSize: 21,
                  conversationsForwardCount: 1,
                  conversationsAfterCursor: "",
                  messagesBackwardCount: 1,
                  messagesBeforeCursor: "",
                }}
              />
            </ErrorBoundary>
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
    // });
  }

  describe(useCompiledFragment, () => {
    itBehavesLikeFragment(() => lastUseFragmentResult, {
      petName: '<mock-value-for-field-"petName">',
    });

    it("also works with fragments on the Query type", () => {
      expect(lastComponentOnQueryTypeResult[0]).toMatchInlineSnapshot(`
        Object {
          "__fragments": Object {
            "avatarSize": 21,
            "conversationsAfterCursor": "",
            "conversationsForwardCount": 1,
            "messagesBackwardCount": 1,
            "messagesBeforeCursor": "",
            "userId": 42,
          },
          "nonNode": Object {
            "__typename": "NonNode",
            "id": "<mock-value-for-field-\\"id\\">",
          },
        }
      `);
    });
  });

  function itBehavesLikeRefetchableFragment(
    returnedResults: () => [data: { id: number }, refetch: RefetchFn][]
  ) {
    it.todo(
      "supports variables with default values on either operations or with @argumentDefinitions"
    );

    describe("when refetching", () => {
      let onCompleted: jest.Mock;

      beforeEach(() => {
        const [_data, refetch] = returnedResults()[0];
        onCompleted = jest.fn();
        refetch({ avatarSize: 42 }, { onCompleted });
      });

      describe("successfully", () => {
        beforeEach(async () => {
          await act(() => {
            client.mock.resolveMostRecentOperation((operation) =>
              MockPayloadGenerator.generate(operation, {
                Node: () => ({
                  id: 42,
                  avatarUrl: `avatarUrl-with-size-${operation.request.variables.avatarSize}`,
                }),
              })
            );
            return new Promise((resolve) => setTimeout(resolve, 0));
          });
        });

        it("returns a new object from the hook", () => {
          const results = returnedResults();
          expect(results[results.length - 1][0]).toMatchObject({
            __typename: "User",
            avatarUrl: "avatarUrl-with-size-42",
            id: 42,
          });
        });

        it("updates the fragment reference request variables for future requests", () => {
          const results = returnedResults();
          expect(results[results.length - 1][0]).toMatchObject({
            __fragments: {
              avatarSize: 42,
              userId: 42,
            },
          });
        });

        it("invokes the onComplete callback without error", () => {
          expect(onCompleted).toHaveBeenCalledWith(null);
        });
      });

      describe("and an error occurs", () => {
        const error = new Error("oh noes");

        beforeEach(async () => {
          await act(() => client.mock.rejectMostRecentOperation(error));
        });

        it("invokes the onComplete callback when an error occurs", () => {
          expect(onCompleted).toHaveBeenCalledWith(error);
        });

        it("does not update the fragment reference request variables for future requests", async () => {
          const [_data, refetch] = returnedResults()[0];
          refetch({});
          expect(
            client.mock.getMostRecentOperation().request.variables.avatarSize
          ).toBe(21);
        });
      });
    });
  }

  describe(useCompiledRefetchableFragment, () => {
    itBehavesLikeFragment(
      () =>
        lastUseRefetchableFragmentResult.map(
          ([data, _refetch]) => data as { id: number }
        ),
      { avatarUrl: '<mock-value-for-field-"avatarUrl">' }
    );

    itBehavesLikeRefetchableFragment(
      () =>
        lastUseRefetchableFragmentResult as [
          data: { id: number },
          refetch: RefetchFn
        ][]
    );
  });

  describe(useCompiledPaginationFragment, () => {
    itBehavesLikeFragment(
      () =>
        lastForwardUsePaginationFragmentResult.map(
          ({ data }) => data as { id: number }
        ),
      {
        avatarUrl: '<mock-value-for-field-"avatarUrl">',
        conversations: {
          __typename: "ConversationsConnection",
          edges: [
            {
              __typename: "ConversationsConnectionEdge",
              cursor: '<mock-value-for-field-"cursor">',
              node: {
                __fragments: {
                  avatarSize: 21,
                  conversationsForwardCount: 1,
                  conversationsAfterCursor: "",
                  messagesBackwardCount: 1,
                  messagesBeforeCursor: "",
                  userId: 42,
                },
                __typename: "Conversation",
                id: "first-paged-conversation",
                title: '<mock-value-for-field-"title">',
              },
            },
          ],
          pageInfo: {
            __typename: "PageInfo",
            endCursor: "first-page-end-cursor",
            hasNextPage: true,
          },
        },
      }
    );

    itBehavesLikeRefetchableFragment(() =>
      lastForwardUsePaginationFragmentResult.map(({ data, refetch }) => [
        data as { id: number },
        refetch,
      ])
    );

    describe("when paginating forward", () => {
      it("returns that next data is available", () => {
        const { hasNext } = lastForwardUsePaginationFragmentResult[0];
        expect(hasNext).toBeTruthy();
      });

      it("uses the correct count and cursor values", () => {
        const { loadNext } = lastForwardUsePaginationFragmentResult[0];
        loadNext(123);

        const operation = client.mock.getMostRecentOperation();
        expect(operation.request.variables).toMatchObject({
          conversationsForwardCount: 123,
          conversationsAfterCursor: "first-page-end-cursor",
        });
      });

      describe("and having received the response", () => {
        beforeEach(async () => {
          const { loadNext } = lastForwardUsePaginationFragmentResult[0];
          loadNext(1);

          await act(() => 
            client.mock.resolveMostRecentOperation((operation) =>
              MockPayloadGenerator.generate(operation, {
                Node: () => ({
                  id: 42,
                }),
                Conversation: () => ({
                  id: "second-paged-conversation",
                }),
                PageInfo: () => ({
                  endCursor: "second-page-end-cursor",
                  hasNextPage: false,
                }),
              })
            ));
            return new Promise((resolve) => setTimeout(resolve, 0));
          });
        });

        it("loads the new data into the store", () => {
          expect(client.cache.extract()).toMatchObject({
            "Conversation:second-paged-conversation": {
              id: "second-paged-conversation",
              __typename: "Conversation",
              title: '<mock-value-for-field-"title">',
            },
          });
        });

        it("returns the complete list data (previous+new) from the hook", () => {
          const result =
            lastForwardUsePaginationFragmentResult[
              lastForwardUsePaginationFragmentResult.length - 1
            ];
          expect(
            (result.data as any).conversations.edges.map(
              (edge: any) => edge.node.id
            )
          ).toMatchInlineSnapshot(`
            Array [
              "first-paged-conversation",
              "second-paged-conversation",
            ]
          `);
        });

        it("uses the new cursor value", () => {
          const {
            loadNext,
          } = lastForwardUsePaginationFragmentResult.reverse()[0];
          loadNext(123);

          const operation = client.mock.getMostRecentOperation();
          expect(operation.request.variables).toMatchObject({
            conversationsAfterCursor: "second-page-end-cursor",
          });
        });

        it("returns that no next data is available", () => {
          const {
            hasNext,
          } = lastForwardUsePaginationFragmentResult.reverse()[0];
          expect(hasNext).toBeFalsy();
        });
      });
    });

    describe("when paginating backward", () => {
      it("returns that previous data is available", () => {
        const { hasPrevious } = lastBackwardUsePaginationFragmentResult[0];
        expect(hasPrevious).toBeTruthy();
      });

      it("uses the correct count and cursor values", () => {
        const { loadPrevious } = lastBackwardUsePaginationFragmentResult[0];
        loadPrevious(123);

        const operation = client.mock.getMostRecentOperation();
        expect(operation.request.variables).toMatchObject({
          messagesBackwardCount: 123,
          messagesBeforeCursor: "first-page-start-cursor",
        });
      });

      describe("and having received the response", () => {
        beforeEach(async () => {
          const { loadPrevious } = lastBackwardUsePaginationFragmentResult[0];
          loadPrevious(1);

          await act(() => {
            client.mock.resolveMostRecentOperation((operation) =>
              MockPayloadGenerator.generate(operation, {
                Node: () => ({
                  id: 42,
                }),
                Message: () => ({
                  id: "second-paged-message",
                }),
                PageInfo: () => ({
                  startCursor: "second-page-start-cursor",
                  hasPreviousPage: false,
                }),
              })
            );
            return new Promise((resolve) => setTimeout(resolve, 0));
          });
        });

        it("loads the new data into the store", () => {
          expect(client.cache.extract()).toMatchObject({
            "Message:second-paged-message": {
              id: "second-paged-message",
              __typename: "Message",
              text: '<mock-value-for-field-"text">',
            },
          });
        });

        it("returns the complete list data (previous+new) from the hook", () => {
          const result =
            lastBackwardUsePaginationFragmentResult[
              lastBackwardUsePaginationFragmentResult.length - 1
            ];
          expect(
            (result.data as any).messages.edges.map((edge: any) => edge.node.id)
          ).toMatchInlineSnapshot(`
            Array [
              "second-paged-message",
              "first-paged-message",
            ]
          `);
        });

        it("uses the new cursor value", () => {
          const {
            loadPrevious,
          } = lastBackwardUsePaginationFragmentResult.reverse()[0];
          loadPrevious(123);

          const operation = client.mock.getMostRecentOperation();
          expect(operation.request.variables).toMatchObject({
            messagesBeforeCursor: "second-page-start-cursor",
          });
        });

        it("returns that no previous data is available", () => {
          const {
            hasPrevious,
          } = lastBackwardUsePaginationFragmentResult.reverse()[0];
          expect(hasPrevious).toBeFalsy();
        });
      });
    });
  });
});

class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong.</h1>;
    }

    return this.props.children;
  }
}
