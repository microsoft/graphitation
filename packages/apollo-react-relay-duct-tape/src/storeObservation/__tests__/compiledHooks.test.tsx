import React from "react";
import { ApolloClient, defaultDataIdFromObject } from "@apollo/client";
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
  Disposable,
  RefetchFn,
  useCompiledFragment,
  useCompiledLazyLoadQuery,
  useCompiledPaginationFragment,
  useCompiledRefetchableFragment,
} from "../compiledHooks";
import {
  typePoliciesWithDefaultApolloClientStoreKeys,
  typePoliciesWithGlobalObjectIdStoreKeys,
} from "../typePolicies";
import { ApolloReactRelayDuctTapeProvider } from "../../useOverridenOrDefaultApolloClient";

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
    path.resolve(__dirname, "../../__tests__/schema.graphql"),
    "utf8",
  ),
);

const _Child_fragment = graphql`
  fragment compiledHooks_ChildFragment on User {
    petName
  }
`;

const _Refetchable_fragment = graphql`
  fragment compiledHooks_RefetchableFragment on User
  @refetchable(queryName: "compiledHooks_RefetchableFragment_RefetchQuery") {
    petName
    avatarUrl(size: $avatarSize)
  }
`;

const _QueryType_fragment = graphql`
  fragment compiledHooks_QueryTypeFragment on Query {
    nonNode {
      id
    }
  }
`;

const _ForwardPagination_fragment = graphql`
  fragment compiledHooks_ForwardPaginationFragment on NodeWithPetAvatarAndConversations
  @refetchable(
    queryName: "compiledHooks_ForwardPaginationFragment_PaginationQuery"
  )
  @argumentDefinitions(
    conversationsForwardCount: { type: "Int!", defaultValue: 1 }
    conversationsAfterCursor: { type: "String!", defaultValue: "" }
    addExtra: { type: "Boolean!", defaultValue: false }
    sortBy: {
      type: "SortByInput"
      defaultValue: { sortField: NAME, sortDirection: ASC }
    }
  ) {
    petName
    avatarUrl(size: $avatarSize)
    conversations(
      first: $conversationsForwardCount
      after: $conversationsAfterCursor
      sortBy: $sortBy
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

const _BackwardPagination_fragment = graphql`
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

const _Root_executionQueryDocument = graphql`
  query compiledHooks_Root_executionQuery(
    $userId: Int!
    $avatarSize: Int = 21
    $messagesBackwardCount: Int!
    $messagesBeforeCursor: String!
    $id: String = "shouldNotOverrideCompiledFragmentId"
  ) {
    user(id: $userId, idThatDoesntOverride: $id) {
      name
      ...compiledHooks_ChildFragment
      ...compiledHooks_RefetchableFragment
      ...compiledHooks_ForwardPaginationFragment
    }
    ...compiledHooks_QueryTypeFragment
  }
`;

describe.each([
  // TODO: Clean this up
  // [
  //   "with default Apollo Client type-policies",
  //   typePoliciesWithDefaultApolloClientStoreKeys,
  // ],
  [
    "with strict Global Object Id spec type-policies",
    typePoliciesWithGlobalObjectIdStoreKeys,
  ],
])("compiledHooks %s", (_, typePolicies) => {
  let client: ApolloMockClient;
  let testRenderer: ReactTestRenderer;

  let useFragmentResult: { id: number }[];
  let useRefetchableFragmentResult: ReturnType<
    typeof useCompiledRefetchableFragment
  >[];
  let forwardUsePaginationFragmentResult: ReturnType<
    typeof useCompiledPaginationFragment
  >[];
  let backwardUsePaginationFragmentResult: ReturnType<
    typeof useCompiledPaginationFragment
  >[];
  let useLazyLoadQueryResult: { data?: any; error?: Error } | null = null;
  let componentOnQueryTypeResult: object[];

  const ChildComponent: React.FC<{ user: { id: any } }> = (props) => {
    const result = useCompiledFragment(
      compiledHooks_ChildFragment_documents,
      props.user,
    );
    useFragmentResult.push(result as { id: number });
    return null;
  };

  const ChildRefetchableComponent: React.FC<{ user: { id: any } }> = (
    props,
  ) => {
    const result = useCompiledRefetchableFragment(
      compiledHooks_RefetchableFragment_documents,
      props.user,
    );
    useRefetchableFragmentResult.push(result);
    return null;
  };

  const ComponentOnQueryType: React.FC<{ query: object }> = (props) => {
    const result = useCompiledFragment(
      compiledHooks_QueryTypeFragment_documents,
      props.query,
    );
    componentOnQueryTypeResult.push(result);
    return null;
  };

  const ChildForwardPaginationComponent: React.FC<{ user: { id: any } }> = (
    props,
  ) => {
    const result = useCompiledPaginationFragment(
      compiledHooks_ForwardPaginationFragment_documents as any,
      props.user,
    );
    forwardUsePaginationFragmentResult.push(result);

    return result.data.conversations.edges.map((edge: any, index: number) => {
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
      props.conversation,
    );
    backwardUsePaginationFragmentResult.push(result);
    return null;
  };

  const RootComponent: React.FC<{
    variables: compiledHooks_Root_executionQueryVariables;
  }> = (props) => {
    const result = useCompiledLazyLoadQuery(
      compiledHooks_Root_executionQuery_documents,
      { variables: props.variables },
    );
    useLazyLoadQueryResult = result;
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
    useLazyLoadQueryResult = null;
    useFragmentResult = [];
    useRefetchableFragmentResult = [];
    forwardUsePaginationFragmentResult = [];
    backwardUsePaginationFragmentResult = [];
    componentOnQueryTypeResult = [];
    client = createMockClient(schema, {
      cache: {
        possibleTypes: {
          Node: ["User"],
          NodeWithPetAvatarAndConversations: ["User"],
        },
        typePolicies,
        ...(typePolicies === typePoliciesWithDefaultApolloClientStoreKeys
          ? {}
          : {
              dataIdFromObject(responseObject) {
                return (
                  responseObject.id?.toString() ||
                  defaultDataIdFromObject(responseObject)
                );
              },
            }),
      },
    });
    act(() => {
      testRenderer = createTestRenderer(
        <ApolloReactRelayDuctTapeProvider client={client}>
          <ErrorBoundary>
            <RootComponent
              variables={{
                userId: 42,
                messagesBackwardCount: 1,
                messagesBeforeCursor: "",
              }}
            />
          </ErrorBoundary>
        </ApolloReactRelayDuctTapeProvider>,
      );
    });
  });

  describe(useCompiledLazyLoadQuery, () => {
    it("correctly returns loading state", async () => {
      expect(useLazyLoadQueryResult).toEqual({
        data: undefined,
        error: undefined,
      });
      await act(() =>
        client.mock.resolveMostRecentOperation((operation) =>
          MockPayloadGenerator.generate(operation),
        ),
      );
      expect(useLazyLoadQueryResult).toEqual({
        data: expect.objectContaining({}),
        error: undefined,
      });
    });

    it("cancels the execution query while in-flight on unmount", async () => {
      expect(activeQueries(client).map((query) => query.queryName)).toEqual([
        "compiledHooks_Root_executionQuery",
      ]);

      await act(async () => {
        testRenderer.unmount();
        return new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(client.getObservableQueries().size).toBe(0);
    });

    describe("once loaded", () => {
      let executionQueryId: string;

      beforeEach(async () => {
        executionQueryId = last(activeQueries(client)).queryId;
        await act(() =>
          client.mock.resolveMostRecentOperation((operation) =>
            MockPayloadGenerator.generate(operation, {
              User: (options, generateId) => {
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
            }),
          ),
        );
      });

      it("unsubscribes from the execution query", async () => {
        expect(
          activeQueries(client).map((query) => query.queryId),
        ).not.toContain(executionQueryId);
      });

      it("loads all data of the execution query into the store", () => {
        expect(client.cache.extract()).toMatchSnapshot();
      });

      it("only returns the fields selected in the watch query to the component", () => {
        expect(useLazyLoadQueryResult?.data).toMatchSnapshot();
      });

      it("does not re-render when a field that was not selected in the watch query is updated in the store", async () => {
        const before = useLazyLoadQueryResult?.data;
        await act(async () => {
          client.cache.modify({
            id: "User:42",
            fields: {
              petName: () => "Phoenix",
            },
          });
          return new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(useLazyLoadQueryResult?.data).toBe(before);
      });

      it("does re-render when a field that was selected in the watch query is updated in the store", async () => {
        const before = useLazyLoadQueryResult?.data;
        await act(async () => {
          client.cache.modify({
            id:
              typePolicies === typePoliciesWithDefaultApolloClientStoreKeys
                ? "User:42"
                : "42",
            fields: {
              name: () => "Satya",
            },
          });
          return new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(useLazyLoadQueryResult?.data).not.toBe(before);
        expect(useLazyLoadQueryResult?.data).toMatchSnapshot();
      });

      it("fetches new data when variables change", async () => {
        act(() => {
          testRenderer.update(
            <ApolloReactRelayDuctTapeProvider client={client}>
              <ErrorBoundary>
                <RootComponent
                  variables={{
                    userId: 21,
                    messagesBackwardCount: 1,
                    messagesBeforeCursor: "",
                  }}
                />
              </ErrorBoundary>
            </ApolloReactRelayDuctTapeProvider>,
          );
        });
        await act(() =>
          client.mock.resolveMostRecentOperation((operation) =>
            MockPayloadGenerator.generate(operation, {
              User: () => ({ id: operation.request.variables.userId }),
            }),
          ),
        );
        expect(
          client.cache.extract()[
            typePolicies === typePoliciesWithDefaultApolloClientStoreKeys
              ? "User:21"
              : "21"
          ],
        ).toMatchSnapshot();
      });

      it("does not try to kick-off a new query when the variables object deep equals the previous one", async () => {
        const spy = jest.spyOn(client, "query");
        await act(async () => {
          testRenderer.update(
            <ApolloReactRelayDuctTapeProvider client={client}>
              <ErrorBoundary>
                <RootComponent
                  variables={{
                    userId: 42,
                    messagesBackwardCount: 1,
                    messagesBeforeCursor: "",
                  }}
                />
              </ErrorBoundary>
            </ApolloReactRelayDuctTapeProvider>,
          );
          return new Promise((resolve) => setTimeout(resolve, 100));
        });
        expect(spy).not.toHaveBeenCalled();
      });

      it("removes all watch queries on unmount", async () => {
        await act(async () => {
          testRenderer.unmount();
          return new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(client.getObservableQueries().size).toBe(0);
      });
    });
  });

  function itBehavesLikeFragment(
    returnedResults: () => { id: number }[],
    fragmentSpecificFieldSelections?: object,
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
        }),
      );
    });

    it("only returns the fields selected in the watch query to the component", () => {
      // TODO: Should we get rid of the type refinement transform that adds __isFoo selections?
      expect(last(returnedResults())).toMatchObject({
        __fragments: {
          avatarSize: 21,
          messagesBackwardCount: 1,
          messagesBeforeCursor: "",
          userId: 42,
        },
        __typename: "User",
        id: "42",
        petName: '<mock-value-for-field-"petName">',
        ...fragmentSpecificFieldSelections,
      });
    });

    it("returns the same object when a field that was not selected in the watch query is updated in the store", async () => {
      const before = last(returnedResults());
      await act(async () => {
        client.cache.modify({
          id: "User:42",
          fields: {
            name: () => "Satya",
          },
        });
        return new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(last(returnedResults())).toBe(before);
    });

    it("returns a new object when a field that was selected in the watch query is updated in the store", async () => {
      await act(async () => {
        client.cache.modify({
          id:
            typePolicies === typePoliciesWithDefaultApolloClientStoreKeys
              ? "User:42"
              : "42",
          fields: {
            petName: () => "some new value",
          },
        });
        return new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(returnedResults().length).toBe(2);
      expect(last(returnedResults())).toMatchObject({
        petName: "some new value",
      });
    });

    it("returns data synchronously", () => {
      expect(returnedResults().length).toBe(1);
    });

    it("fetches new data when variables change", async () => {
      act(() => {
        testRenderer.update(
          <ApolloReactRelayDuctTapeProvider client={client}>
            <ErrorBoundary>
              <RootComponent
                variables={{
                  userId: 21,
                  messagesBackwardCount: 1,
                  messagesBeforeCursor: "",
                }}
              />
            </ErrorBoundary>
          </ApolloReactRelayDuctTapeProvider>,
        );
      });
      await act(() =>
        client.mock.resolveMostRecentOperation((operation) =>
          MockPayloadGenerator.generate(operation, {
            User: () => ({ id: operation.request.variables.userId }),
          }),
        ),
      );
      expect(last(returnedResults()).id).toBe("21");
    });
  }

  describe(useCompiledFragment, () => {
    itBehavesLikeFragment(() => useFragmentResult, {
      petName: '<mock-value-for-field-"petName">',
    });

    it("also works with fragments on the Query type", () => {
      expect(last(componentOnQueryTypeResult)).toMatchInlineSnapshot(`
        {
          "__fragments": {
            "avatarSize": 21,
            "id": "shouldNotOverrideCompiledFragmentId",
            "messagesBackwardCount": 1,
            "messagesBeforeCursor": "",
            "userId": 42,
          },
          "__typename": "Query",
          "nonNode": {
            "__typename": "NonNode",
            "id": "<mock-value-for-field-"id">",
          },
        }
      `);
    });
  });

  function itBehavesLikeRefetchableFragment(
    returnedResults: () => [data: { id: number }, refetch: RefetchFn][],
  ) {
    it.todo(
      "supports variables with default values on either operations or with @argumentDefinitions",
    );

    describe("when refetching", () => {
      let onCompleted: jest.Mock;
      let disposable: Disposable;

      beforeEach(() => {
        const [_data, refetch] = last(returnedResults());
        onCompleted = jest.fn();
        disposable = refetch({ avatarSize: 42 }, { onCompleted });
      });

      it("can be cancelled", () => {
        const query = last(activeQueries(client));
        disposable.dispose();
        expect(client.getObservableQueries().has(query.queryId)).toBeFalsy();
      });

      it("cancels when unmounting", async () => {
        await act(async () => {
          const query = last(activeQueries(client));
          testRenderer.unmount();
          await new Promise((resolve) => setTimeout(resolve, 0));
          expect(client.getObservableQueries().has(query.queryId)).toBeFalsy();
        });
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
              }),
            );
            return new Promise((resolve) => setTimeout(resolve, 0));
          });
        });

        it("returns a new object from the hook", () => {
          expect(last(returnedResults())[0]).toMatchObject({
            __typename: "User",
            avatarUrl: "avatarUrl-with-size-42",
            id: "42",
          });
        });

        it("updates the fragment reference request variables for future requests", () => {
          expect(last(returnedResults())[0]).toMatchObject({
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
          const [_data, refetch] = last(returnedResults());
          refetch({});
          expect(
            client.mock.getMostRecentOperation().request.variables.avatarSize,
          ).toBe(21);
        });
      });
    });
  }

  describe(useCompiledRefetchableFragment, () => {
    itBehavesLikeFragment(
      () =>
        useRefetchableFragmentResult.map(
          ([data, _refetch]) => data as { id: number },
        ),
      { avatarUrl: '<mock-value-for-field-"avatarUrl">' },
    );

    itBehavesLikeRefetchableFragment(
      () =>
        useRefetchableFragmentResult as [
          data: { id: number },
          refetch: RefetchFn,
        ][],
    );
  });

  describe(useCompiledPaginationFragment, () => {
    itBehavesLikeFragment(
      () =>
        forwardUsePaginationFragmentResult.map(
          ({ data }) => data as { id: number },
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
      },
    );

    itBehavesLikeRefetchableFragment(() =>
      forwardUsePaginationFragmentResult.map(({ data, refetch }) => [
        data as { id: number },
        refetch,
      ]),
    );

    describe("when paginating forward", () => {
      it("returns that next data is available", () => {
        const { hasNext } = last(forwardUsePaginationFragmentResult);
        expect(hasNext).toBeTruthy();
      });

      it("uses the correct count and cursor values", () => {
        act(() => {
          const { loadNext } = last(forwardUsePaginationFragmentResult);
          loadNext(123);
        });

        const operation = client.mock.getMostRecentOperation();
        expect(operation.request.variables).toMatchObject({
          conversationsForwardCount: 123,
          conversationsAfterCursor: "first-page-end-cursor",
        });
      });

      it("returns that a pagination operation is in-flight", () => {
        act(() => {
          const { loadNext } = last(forwardUsePaginationFragmentResult);
          loadNext(123);
        });
        const { isLoadingNext } = last(forwardUsePaginationFragmentResult);
        expect(isLoadingNext).toBeTruthy();
      });

      it("can be cancelled", () => {
        act(() => {
          const { loadNext } = last(forwardUsePaginationFragmentResult);
          const disposable = loadNext(123);
          const query = last(activeQueries(client));
          disposable.dispose();
          expect(client.getObservableQueries().has(query.queryId)).toBeFalsy();
        });
      });

      it("cancels when unmounting", async () => {
        await act(async () => {
          const { loadNext } = last(forwardUsePaginationFragmentResult);
          loadNext(123);
          const query = last(activeQueries(client));

          testRenderer.unmount();
          await new Promise((resolve) => setTimeout(resolve, 0));

          expect(client.getObservableQueries().has(query.queryId)).toBeFalsy();
        });
      });

      it("invokes the onComplete callback when an error occurs", async () => {
        const onCompleted = jest.fn();
        const error = new Error("oh noes");

        const { loadNext } = last(forwardUsePaginationFragmentResult);
        await act(async () => {
          loadNext(1, { onCompleted });
          await client.mock.rejectMostRecentOperation(error);
        });

        expect(onCompleted).toHaveBeenCalledWith(error);
      });

      describe("and when refetch is called before loading next page", () => {
        it("uses correct variable value in load next request", async () => {
          await act(async () => {
            const { refetch } = last(forwardUsePaginationFragmentResult);
            refetch({ addExtra: true });
            client.mock.resolveMostRecentOperation((operation) =>
              MockPayloadGenerator.generate(operation),
            );
            await new Promise((resolve) => setTimeout(resolve, 0));
          });

          act(() => {
            const { loadNext } = last(forwardUsePaginationFragmentResult);
            loadNext(123);
          });

          const operation = client.mock.getMostRecentOperation();
          expect(operation.request.variables).toMatchObject({
            conversationsForwardCount: 123,
            conversationsAfterCursor: "first-page-end-cursor",
            addExtra: true,
          });
        });

        [true, false].forEach((addExtra) => {
          it(`returns complete result based on the value of variable used for refetch (${addExtra})`, async () => {
            await act(async () => {
              const { refetch } = last(forwardUsePaginationFragmentResult);
              refetch({ addExtra });
              client.mock.resolveMostRecentOperation((operation) => {
                const { variables } = operation.request;
                return MockPayloadGenerator.generate(operation, {
                  Conversation: () => ({
                    id: "first-paged-conversation",
                    title: `title-1${variables.addExtra ? "-with-extra" : ""}`,
                  }),
                });
              });
              await new Promise((resolve) => setTimeout(resolve, 0));
            });
            const result = last(forwardUsePaginationFragmentResult);
            expect(
              (result.data as any).conversations.edges.map(
                (edge: any) => edge.node.title,
              ),
            ).toMatchInlineSnapshot(`
              [
                "title-1${addExtra ? "-with-extra" : ""}",
              ]
            `);

            await act(async () => {
              const { loadNext } = last(forwardUsePaginationFragmentResult);
              loadNext(1);
              client.mock.resolveMostRecentOperation((operation) => {
                const { variables } = operation.request;
                return MockPayloadGenerator.generate(operation, {
                  Conversation: () => ({
                    id: "second-paged-conversation",
                    title: `title-2${variables.addExtra ? "-with-extra" : ""}`,
                  }),
                  PageInfo: () => ({
                    endCursor: "second-page-end-cursor",
                    hasNextPage: false,
                  }),
                });
              });
              await new Promise((resolve) => setTimeout(resolve, 0));
            });

            const loadNextResult = last(forwardUsePaginationFragmentResult);
            expect(
              (loadNextResult.data as any).conversations.edges.map(
                (edge: any) => edge.node.title,
              ),
            ).toMatchInlineSnapshot(`
              [
                "title-1${addExtra ? "-with-extra" : ""}",
                "title-2${addExtra ? "-with-extra" : ""}",
              ]
            `);
          });
        });
      });

      describe("and having received the response", () => {
        let onCompleted: jest.Mock;

        beforeEach(async () => {
          onCompleted = jest.fn();
          await act(async () => {
            const { loadNext } = last(forwardUsePaginationFragmentResult);
            loadNext(1, { onCompleted });

            // Introduce a slight delay before resolving the request as a
            // regression test with a pagination requst being disposed early.
            await new Promise((resolve) => setTimeout(resolve, 0));

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
              }),
            );
            return new Promise((resolve) => setTimeout(resolve, 0));
          });
        });

        it("returns that no pagination operation is in-flight", () => {
          const { isLoadingNext } = last(forwardUsePaginationFragmentResult);
          expect(isLoadingNext).toBeFalsy();
        });

        it("loads the new data into the store", () => {
          expect(client.cache.extract()).toMatchObject({
            [typePolicies === typePoliciesWithDefaultApolloClientStoreKeys
              ? "Conversation:second-paged-conversation"
              : "second-paged-conversation"]: {
              id: "second-paged-conversation",
              __typename: "Conversation",
              title: '<mock-value-for-field-"title">',
            },
          });
        });

        it("returns the complete list data (previous+new) from the hook", () => {
          const result = last(forwardUsePaginationFragmentResult);
          expect(
            (result.data as any).conversations.edges.map(
              (edge: any) => edge.node.id,
            ),
          ).toMatchInlineSnapshot(`
            [
              "first-paged-conversation",
              "second-paged-conversation",
            ]
          `);
        });

        it("uses the new cursor value", () => {
          act(() => {
            const { loadNext } = last(forwardUsePaginationFragmentResult);
            loadNext(123);
          });

          const operation = client.mock.getMostRecentOperation();
          expect(operation.request.variables).toMatchObject({
            conversationsAfterCursor: "second-page-end-cursor",
          });
        });

        it("returns that no next data is available", () => {
          const { hasNext } = last(forwardUsePaginationFragmentResult);
          expect(hasNext).toBeFalsy();
        });

        it("invokes the onComplete callback without error", () => {
          expect(onCompleted).toHaveBeenCalledWith(null);
        });
      });
    });

    describe("when paginating backward", () => {
      it("returns that previous data is available", () => {
        const { hasPrevious } = last(backwardUsePaginationFragmentResult);
        expect(hasPrevious).toBeTruthy();
      });

      it("uses the correct count and cursor values", () => {
        act(() => {
          const { loadPrevious } = last(backwardUsePaginationFragmentResult);
          loadPrevious(123);
        });

        const operation = client.mock.getMostRecentOperation();
        expect(operation.request.variables).toMatchObject({
          messagesBackwardCount: 123,
          messagesBeforeCursor: "first-page-start-cursor",
        });
      });

      it("returns that a pagination operation is in-flight", () => {
        act(() => {
          const { loadPrevious } = last(backwardUsePaginationFragmentResult);
          loadPrevious(123);
        });
        const { isLoadingPrevious } = last(backwardUsePaginationFragmentResult);
        expect(isLoadingPrevious).toBeTruthy();
      });

      it("can be cancelled", () => {
        act(() => {
          const { loadPrevious } = last(backwardUsePaginationFragmentResult);
          const disposable = loadPrevious(123);
          const query = last(activeQueries(client));
          disposable.dispose();
          expect(client.getObservableQueries().has(query.queryId)).toBeFalsy();
        });
      });

      it("cancels when unmounting", async () => {
        await act(async () => {
          const { loadPrevious } = last(backwardUsePaginationFragmentResult);
          loadPrevious(123);
          const query = last(activeQueries(client));

          testRenderer.unmount();
          await new Promise((resolve) => setTimeout(resolve, 0));

          expect(client.getObservableQueries().has(query.queryId)).toBeFalsy();
        });
      });

      it("invokes the onComplete callback when an error occurs", async () => {
        const onCompleted = jest.fn();
        const error = new Error("oh noes");

        const { loadPrevious } = last(backwardUsePaginationFragmentResult);
        await act(async () => {
          loadPrevious(1, { onCompleted });
          await client.mock.rejectMostRecentOperation(error);
        });

        expect(onCompleted).toHaveBeenCalledWith(error);
      });

      describe("and having received the response", () => {
        let onCompleted: jest.Mock;

        beforeEach(async () => {
          onCompleted = jest.fn();
          await act(() => {
            const { loadPrevious } = last(backwardUsePaginationFragmentResult);
            loadPrevious(1, { onCompleted });

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
              }),
            );
            return new Promise((resolve) => setTimeout(resolve, 0));
          });
        });

        it("returns that no pagination operation is in-flight", () => {
          const { isLoadingPrevious } = last(
            backwardUsePaginationFragmentResult,
          );
          expect(isLoadingPrevious).toBeFalsy();
        });

        it("loads the new data into the store", () => {
          expect(client.cache.extract()).toMatchObject({
            [typePolicies === typePoliciesWithDefaultApolloClientStoreKeys
              ? "Message:second-paged-message"
              : "second-paged-message"]: {
              id: "second-paged-message",
              __typename: "Message",
              text: '<mock-value-for-field-"text">',
            },
          });
        });

        it("returns the complete list data (previous+new) from the hook", () => {
          const result = last(backwardUsePaginationFragmentResult);
          expect(
            (result.data as any).messages.edges.map(
              (edge: any) => edge.node.id,
            ),
          ).toMatchInlineSnapshot(`
            [
              "second-paged-message",
              "first-paged-message",
            ]
          `);
        });

        it("uses the new cursor value", () => {
          act(() => {
            const { loadPrevious } = last(backwardUsePaginationFragmentResult);
            loadPrevious(123);
          });

          const operation = client.mock.getMostRecentOperation();
          expect(operation.request.variables).toMatchObject({
            messagesBeforeCursor: "second-page-start-cursor",
          });
        });

        it("returns that no previous data is available", () => {
          const { hasPrevious } = last(backwardUsePaginationFragmentResult);
          expect(hasPrevious).toBeFalsy();
        });

        it("invokes the onComplete callback without error", () => {
          expect(onCompleted).toHaveBeenCalledWith(null);
        });
      });
    });
  });
});

class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError(_error: Error) {
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

function last<T>(list: T[]): T {
  return list[list.length - 1];
}

function activeQueries(client: ApolloClient<any>) {
  return Array.from(client.getObservableQueries().values());
}
