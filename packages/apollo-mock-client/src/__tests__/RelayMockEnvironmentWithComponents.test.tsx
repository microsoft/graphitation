/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * https://github.com/facebook/relay/blob/5d7e2d4a318c5015e2ac91f5f4e7ca602658890c/LICENSE
 */

import React from "react";
import { graphql } from "@graphitation/graphql-js-tag";
import { readFileSync } from "fs";
import { buildSchema, DocumentNode } from "graphql";
import * as ReactTestRenderer from "react-test-renderer";
import {
  ApolloProvider,
  useMutation,
  useQuery,
  useSubscription,
} from "@apollo/client";
import { getOperationName } from "@apollo/client/utilities";
import * as MockPayloadGenerator from "@graphitation/graphql-js-operation-payload-generator";

import { ApolloMockClient, createMockClient } from "../index";

const schema = buildSchema(
  readFileSync(
    require.resolve("relay-test-utils-internal/lib/testschema.graphql"),
    "utf8",
  ),
);

describe("ReactRelayTestMocker with Containers", () => {
  let client: ApolloMockClient;

  beforeEach(() => {
    client = createMockClient(schema);
  });

  describe("Basic Resolve/Reject Operations", () => {
    let testComponentTree: ReactTestRenderer.ReactTestRenderer;

    beforeEach(() => {
      const TestQuery = graphql`
        query RelayMockEnvironmentWithComponentsTestFantasticEffortQuery(
          $id: ID = "<default>"
        ) {
          user: node(id: $id) {
            id
            name
          }
        }
      `;
      const TestComponent: React.FC = () => {
        const { data: props, error } = useQuery<{
          user: { id: string; name: string };
        }>(TestQuery as any);
        if (props) {
          return `My id ${props.user.id} and name is ${props.user.name}` as any;
        } else if (error) {
          return <div id="error">{error.message}</div>;
        }
        return <div id="loading">Loading...</div>;
      };
      ReactTestRenderer.act(() => {
        testComponentTree = ReactTestRenderer.create(
          <ApolloProvider client={client}>
            <TestComponent />
          </ApolloProvider>,
        );
      });
    });

    it("should have pending operations in the queue", () => {
      expect(client.mock.getAllOperations().length).toEqual(1);
    });

    it("should return most recent operation", () => {
      const operation = client.mock.getMostRecentOperation();
      expect(getOperationName(operation.request.node)).toBe(
        "RelayMockEnvironmentWithComponentsTestFantasticEffortQuery",
      );
      expect(operation.request.variables).toEqual({
        id: "<default>",
      });
    });

    it("should resolve query", async () => {
      // Should render loading state
      expect(() => {
        testComponentTree.root.find((node) => node.props.id === "loading");
      }).not.toThrow();

      await ReactTestRenderer.act(() =>
        // Make sure request was issued
        client.mock.resolveMostRecentOperation((operation) =>
          MockPayloadGenerator.generate(operation),
        ),
      );

      // Should render some data
      expect(testComponentTree).toMatchSnapshot();
    });

    it("should reject query", async () => {
      await ReactTestRenderer.act(() =>
        client.mock.rejectMostRecentOperation(new Error("Uh-oh")),
      );

      const errorMessage = testComponentTree.root.find(
        (node) => node.props.id === "error",
      );
      // Should render error
      expect(errorMessage.props.children).toBe("Uh-oh");
    });

    it("should reject query with function", async () => {
      await ReactTestRenderer.act(() =>
        client.mock.rejectMostRecentOperation(
          (operation) =>
            new Error(`Uh-oh: ${getOperationName(operation.request.node)}`),
        ),
      );

      const errorMessage = testComponentTree.root.find(
        (node) => node.props.id === "error",
      );
      // Should render error
      expect(errorMessage.props.children).toBe(
        "Uh-oh: RelayMockEnvironmentWithComponentsTestFantasticEffortQuery",
      );
    });

    it("should throw if it unable to find operation", () => {
      expect(client.mock.getAllOperations().length).toEqual(1);
      expect(() => {
        client.mock.findOperation((_operation) => false);
      }).toThrow(/Operation was not found/);
    });
  });

  describe("Test Mutations", () => {
    let testComponentTree: ReactTestRenderer.ReactTestRenderer;

    beforeEach(async () => {
      const FeedbackFragment = graphql`
        fragment RelayMockEnvironmentWithComponentsTestNoticeableResultFragment on Feedback {
          id
          message {
            text
          }
          doesViewerLike
        }
      `;

      const FeedbackQuery = graphql`
        query RelayMockEnvironmentWithComponentsTestWorldClassAwesomenessQuery(
          $id: ID!
        ) {
          feedback: node(id: $id) {
            ...RelayMockEnvironmentWithComponentsTestNoticeableResultFragment
          }
        }
        ${FeedbackFragment}
      `;

      const FeedbackLikeMutation = graphql`
        mutation RelayMockEnvironmentWithComponentsTestDisruptiveSuccessMutation(
          $input: FeedbackLikeInput
        ) {
          feedbackLike(input: $input) {
            feedback {
              id
              doesViewerLike
            }
          }
        }
      `;

      function FeedbackComponent(props: {
        feedback: {
          id: string;
          message: { text: string };
          doesViewerLike: boolean;
        };
      }) {
        const [busy, setBusy] = React.useState(false);
        const [errorMessage, setErrorMessage] = React.useState<string | null>(
          null,
        );
        const [like] = useMutation(FeedbackLikeMutation, {
          onCompleted: () => {
            setBusy(false);
          },
          onError: (e) => {
            setBusy(false);
            setErrorMessage(e.message);
          },
          optimisticResponse: {
            feedbackLike: {
              __typename: "FeedbackLikeResponsePayload",
              feedback: {
                __typename: "Feedback",
                id: props.feedback.id,
                doesViewerLike: true,
              },
            },
          },
        });
        return (
          <div>
            {errorMessage != null && (
              <span id="errorMessage">{errorMessage}</span>
            )}
            Feedback: {props.feedback.message.text}
            <button
              id="likeButton"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                like({
                  variables: {
                    input: {
                      feedbackId: props.feedback.id,
                    },
                  },
                });
              }}
            >
              {props.feedback.doesViewerLike ?? false ? "Unlike" : "Like"}
            </button>
          </div>
        );
      }

      const TestComponent: React.FC = () => {
        const { data: props, error } = useQuery<{
          feedback: {
            id: string;
            message: { text: string };
            doesViewerLike: boolean;
          };
        }>(FeedbackQuery, { variables: { id: "feedback-id-42" } });
        if (props) {
          return <FeedbackComponent feedback={props.feedback} />;
        } else if (error) {
          return <div id="error">error.message</div>;
        }
        return <div id="loading">Loading...</div>;
      };
      ReactTestRenderer.act(() => {
        testComponentTree = ReactTestRenderer.create(
          <ApolloProvider client={client}>
            <TestComponent />
          </ApolloProvider>,
        );
      });
      await ReactTestRenderer.act(() =>
        client.mock.resolveMostRecentOperation((operation) =>
          MockPayloadGenerator.generate(operation, {
            ID() {
              return operation.request.variables.id;
            },
            Feedback() {
              return {
                doesViewerLike: false,
              };
            },
          }),
        ),
      );
    });

    it("should resolve mutation", async () => {
      const likeButton = testComponentTree.root.find(
        (node) => node.props.id === "likeButton",
      );
      expect(likeButton.props.disabled).toBe(false);
      expect(likeButton.props.children).toEqual("Like");
      expect(testComponentTree).toMatchSnapshot(
        'Button should be enabled. Text should be "Like".',
      );

      // Should apply optimistic updates
      await ReactTestRenderer.act(async () => {
        likeButton.props.onClick();
      });

      expect(likeButton.props.disabled).toBe(true);
      expect(likeButton.props.children).toEqual("Unlike");
      expect(testComponentTree).toMatchSnapshot(
        'Should apply optimistic update. Button should says "Unlike". And it should be disabled',
      );
      await ReactTestRenderer.act(async () => {
        client.mock.resolveMostRecentOperation((operation) =>
          MockPayloadGenerator.generate(operation, {
            Feedback() {
              return {
                id: operation.request.variables.input?.feedbackId,
                doesViewerLike: true,
              };
            },
          }),
        );
      });
      expect(likeButton.props.disabled).toBe(false);
      expect(likeButton.props.children).toEqual("Unlike");
      expect(testComponentTree).toMatchSnapshot(
        'Should render response from the server. Button should be enabled. And text still "Unlike"',
      );
    });

    it("should reject mutation", async () => {
      const likeButton = testComponentTree.root.find(
        (node) => node.props.id === "likeButton",
      );
      // Should apply optimistic updates
      ReactTestRenderer.act(() => {
        likeButton.props.onClick();
      });

      // Trigger error
      await ReactTestRenderer.act(() =>
        client.mock.rejectMostRecentOperation(new Error("Uh-oh")),
      );
      expect(testComponentTree).toMatchSnapshot("Should render error message");
    });
  });

  describe("Subscription Tests", () => {
    let testComponentTree: ReactTestRenderer.ReactTestRenderer;

    beforeEach(async () => {
      const FeedbackFragment = graphql`
        fragment RelayMockEnvironmentWithComponentsTestImpactfulAwesomenessFragment on Feedback {
          id
          message {
            text
          }
          doesViewerLike
        }
      `;

      const FeedbackQuery = graphql`
        query RelayMockEnvironmentWithComponentsTestRemarkableImpactQuery(
          $id: ID!
        ) {
          feedback: node(id: $id) {
            ...RelayMockEnvironmentWithComponentsTestImpactfulAwesomenessFragment
          }
        }
        ${FeedbackFragment}
      `;

      const FeedbackLikeSubscription = graphql`
        subscription RelayMockEnvironmentWithComponentsTestRemarkableFixSubscription(
          $input: FeedbackLikeInput
        ) {
          feedbackLikeSubscribe(input: $input) {
            feedback {
              id
              doesViewerLike
            }
          }
        }
      `;

      function FeedbackComponent(props: {
        feedback: {
          id: string;
          message: { text: string };
          doesViewerLike: boolean;
        };
      }) {
        useSubscription(FeedbackLikeSubscription, {
          variables: {
            input: {
              feedbackId: props.feedback.id,
            },
          },
        });
        return (
          <div>
            Feedback: {props.feedback.message.text}
            <span id="reaction">
              {props.feedback.doesViewerLike ?? false
                ? "Viewer likes it"
                : "Viewer does not like it"}
            </span>
          </div>
        );
      }

      const TestComponent: React.FC = () => {
        const { data: props, error } = useQuery<{
          feedback: {
            id: string;
            message: { text: string };
            doesViewerLike: boolean;
          };
        }>(FeedbackQuery, { variables: { id: "my-feedback-id" } });
        if (props) {
          return <FeedbackComponent feedback={props.feedback} />;
        } else if (error) {
          return <div id="error">error.message</div>;
        }
        return <div id="loading">Loading...</div>;
      };
      ReactTestRenderer.act(() => {
        testComponentTree = ReactTestRenderer.create(
          <ApolloProvider client={client}>
            <TestComponent />
          </ApolloProvider>,
        );
      });
      await ReactTestRenderer.act(() =>
        client.mock.resolveMostRecentOperation((operation) =>
          MockPayloadGenerator.generate(operation, {
            ID() {
              return operation.request.variables.id;
            },
            Feedback() {
              return {
                doesViewerLike: false,
              };
            },
          }),
        ),
      );
    });

    it("should resolve subscription", async () => {
      ReactTestRenderer.act(() => {
        expect(testComponentTree).toMatchSnapshot();
      });

      const reaction = testComponentTree.root.find(
        (node) => node.props.id === "reaction",
      );
      expect(reaction.props.children).toBe("Viewer does not like it");

      const operation = client.mock.getMostRecentOperation();
      expect(getOperationName(operation.request.node)).toBe(
        "RelayMockEnvironmentWithComponentsTestRemarkableFixSubscription",
      );
      expect(operation.request.variables).toEqual({
        input: {
          feedbackId: "my-feedback-id",
        },
      });

      await ReactTestRenderer.act(() =>
        client.mock.nextValue(
          operation,
          MockPayloadGenerator.generate(operation, {
            Feedback() {
              return {
                id: operation.request.variables.input?.feedbackId,
                doesViewerLike: true,
              };
            },
          }),
        ),
      );
      expect(reaction.props.children).toBe("Viewer likes it");
    });
  });

  describe("Multiple Query Renderers", () => {
    let testComponentTree: ReactTestRenderer.ReactTestRenderer;

    beforeEach(() => {
      const UserQuery = graphql`
        query RelayMockEnvironmentWithComponentsTestSwiftPerformanceQuery(
          $userId: ID!
        ) @relay_test_operation {
          user: node(id: $userId) {
            id
            name
          }
        }
      `;

      const PageQuery = graphql`
        query RelayMockEnvironmentWithComponentsTestRedefiningSolutionQuery(
          $pageId: ID!
        ) @relay_test_operation {
          page: node(id: $pageId) {
            id
            name
          }
        }
      `;

      const QueryComponent: React.FC<{
        document: DocumentNode;
        type: "user" | "page";
        variables: Record<string, any>;
      }> = ({ document, type, variables }) => {
        const { data: props, error } = useQuery<
          Record<typeof type, { id: string; name: string }>
        >(document, { variables });
        if (props) {
          return <div id={type}>{props[type].name}</div>;
        } else if (error) {
          return <div id="error">{error.message}</div>;
        }
        return <div id="loading">Loading...</div>;
      };
      const TestComponent: React.FC = () => {
        return (
          <ApolloProvider client={client}>
            <QueryComponent
              document={UserQuery}
              variables={{ userId: "my-user-id" }}
              type="user"
            />
            <QueryComponent
              document={PageQuery}
              variables={{ pageId: "my-page-id" }}
              type="page"
            />
          </ApolloProvider>
        );
      };

      ReactTestRenderer.act(() => {
        testComponentTree = ReactTestRenderer.create(<TestComponent />);
      });
    });

    it("should resolve both queries", async () => {
      const userQuery = client.mock.findOperation(
        (operation) =>
          getOperationName(operation.request.node) ===
          "RelayMockEnvironmentWithComponentsTestSwiftPerformanceQuery",
      );
      const pageQuery = client.mock.findOperation(
        (operation) =>
          getOperationName(operation.request.node) ===
          "RelayMockEnvironmentWithComponentsTestRedefiningSolutionQuery",
      );
      await ReactTestRenderer.act(async () => {
        client.mock.resolve(
          userQuery,
          MockPayloadGenerator.generate(userQuery, {
            Node: () => ({
              id: userQuery.request.variables.userId,
              name: "Alice",
            }),
          }),
        );
        client.mock.resolve(
          pageQuery,
          MockPayloadGenerator.generate(pageQuery, {
            Node: () => ({
              id: pageQuery.request.variables.pageId,
              name: "My Page",
            }),
          }),
        );
      });
      expect(
        testComponentTree.root.find((node) => node.props.id === "user")
          .children,
      ).toEqual(["Alice"]);
      expect(
        testComponentTree.root.find((node) => node.props.id === "page")
          .children,
      ).toEqual(["My Page"]);
      expect(testComponentTree).toMatchSnapshot();
    });
  });

  describe("resolve/reject next with components", () => {
    let TestComponent: React.FC;

    beforeEach(() => {
      const UserQuery = graphql`
        query RelayMockEnvironmentWithComponentsTestWorldClassFeatureQuery(
          $userId: ID!
        ) @relay_test_operation {
          user: node(id: $userId) {
            id
            name
          }
        }
      `;

      TestComponent = () => {
        const { data: props, error } = useQuery<{
          user: { id: string; name: string };
        }>(UserQuery, { variables: { userId: "my-user-id" } });
        if (props) {
          return <div id="user">{props.user.name}</div>;
        } else if (error) {
          return <div id="error">{error.message}</div>;
        }
        return <div id="loading">Loading...</div>;
      };
    });

    it("should resolve next operation", async () => {
      client.mock.queueOperationResolver((operation) =>
        MockPayloadGenerator.generate(operation),
      );
      let testComponentTree;
      await ReactTestRenderer.act(async () => {
        testComponentTree = ReactTestRenderer.create(
          <ApolloProvider client={client}>
            <TestComponent />
          </ApolloProvider>,
        );
      });
      expect(testComponentTree).toMatchSnapshot(
        "should render component with the data",
      );
    });

    it("should reject next operation", async () => {
      client.mock.queueOperationResolver(() => new Error("Uh-oh"));
      let testComponentTree;
      await ReactTestRenderer.act(async () => {
        testComponentTree = ReactTestRenderer.create(
          <ApolloProvider client={client}>
            <TestComponent />
          </ApolloProvider>,
        );
      });
      expect(testComponentTree).toMatchSnapshot(
        "should render component with the error",
      );
    });
  });
});
