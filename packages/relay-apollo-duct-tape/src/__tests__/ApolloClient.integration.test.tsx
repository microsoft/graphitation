import { RelayApolloCache } from "../Cache";

import {
  ApolloCache,
  ApolloProvider,
  useMutation,
  useQuery,
  useSubscription,
} from "@apollo/client";
import { getOperationName } from "@apollo/client/utilities";
import * as ReactTestRenderer from "react-test-renderer";
import {
  ApolloMockClient,
  createMockClient,
  OperationDescriptor,
} from "@graphitation/apollo-mock-client";
import * as React from "react";
import { readFileSync } from "fs";
import { buildSchema } from "graphql";
import * as MockPayloadGenerator from "@graphitation/graphql-js-operation-payload-generator";

import {
  ApolloClientIntegrationTestQueryDocument as ApolloClientIntegrationTestQuery,
  ApolloClientIntegrationTestMutationDocument as ApolloClientIntegrationTestMutation,
  ApolloClientIntegrationTestCreateMessageMutationDocument as TestCreateMessageMutation,
  ApolloClientIntegrationTestConversationUpdatedSubscriptionDocument as TestConversationUpdatedSubscription,
  ApolloClientIntegrationTestMessageCreatedSubscriptionDocument as TestMessageCreatedSubscription,
} from "../__generated__/operations";

const schema = buildSchema(
  readFileSync(require.resolve("./__fixtures__/schema.graphql"), "utf8"),
);

const TestComponent: React.FC = () => {
  useSubscription(TestConversationUpdatedSubscription);
  const { data: props, error, subscribeToMore } = useQuery(
    ApolloClientIntegrationTestQuery,
    {
      variables: { id: "42" },
    },
  );
  if (props) {
    subscribeToMore({
      document: TestMessageCreatedSubscription,
      variables: { conversationId: "42" },
      updateQuery: (prev, { subscriptionData }) => {
        return {
          ...prev,
          conversation: {
            ...prev.conversation,
            messages: {
              edges: [
                { node: subscriptionData.data.messageCreated },
                ...prev.conversation.messages.edges,
              ],
            },
          },
        };
      },
    });
    return (
      <>
        <div>{props.conversation.title}</div>
        <ul>
          {props.conversation.messages.edges.map(({ node }, i) => (
            <li key={i}>{node.text}</li>
          ))}
        </ul>
      </>
    );
  } else if (error) {
    return <div id="error">{error.message}</div>;
  }
  return <div id="loading">Loading...</div>;
};

const TestComponentWrapper: React.FC = () => {
  return (
    <>
      <TestComponent />
      <TestMutationComponent />
    </>
  );
};

const TestMutationComponent: React.FC = () => {
  const [updateConversation] = useMutation(ApolloClientIntegrationTestMutation);
  const [createMessage] = useMutation(TestCreateMessageMutation, {
    update(cache, { data }) {
      if (data?.createMessage) {
        const existingData = cache.readQuery({
          query: ApolloClientIntegrationTestQuery,
          variables: { id: "42" },
        });
        cache.writeQuery({
          query: ApolloClientIntegrationTestQuery,
          variables: { id: "42" },
          data: {
            conversation: {
              ...existingData!.conversation,
              messages: {
                edges: [
                  { node: data.createMessage },
                  ...existingData!.conversation.messages!.edges,
                ],
              },
            },
          },
        });
      }
    },
  });
  return (
    <>
      <button
        onClick={() => {
          updateConversation({
            variables: { id: "42", title: "Mutated title" },
          });
        }}
      >
        Mutate title
      </button>
      <button
        onClick={() => {
          createMessage({
            variables: { conversationId: "42" },
          });
        }}
      >
        Create message
      </button>
    </>
  );
};

describe.each([
  { cache: () => new RelayApolloCache(), scenario: "RelayApolloCache" },
  { cache: undefined, scenario: "InMemoryCache" },
] as { cache?: () => ApolloCache<any>; scenario: string }[])(
  "ApolloClient integration with $scenario",
  ({ cache }) => {
    let client: ApolloMockClient;
    let testComponentTree: ReactTestRenderer.ReactTestRenderer;

    beforeEach(async () => {
      client = createMockClient(schema as any, {
        cache: cache?.(),
      });
      ReactTestRenderer.act(() => {
        testComponentTree = ReactTestRenderer.create(
          <ApolloProvider client={client}>
            <TestComponentWrapper />
          </ApolloProvider>,
        );
      });
      await ReactTestRenderer.act(() =>
        client.mock.resolveMostRecentOperation((operation) =>
          MockPayloadGenerator.generate(operation, {
            Conversation: () => ({
              id: "42",
              title: "Original title",
            }),
          }),
        ),
      );
    });

    function itUpdatesTheCacheAutomatically(
      getOperationDescriptor: () => OperationDescriptor,
    ) {
      it("updates the cache automatically and re-renders", async () => {
        await ReactTestRenderer.act(() => {
          const operation = getOperationDescriptor();
          return client.mock.resolve(
            operation,
            MockPayloadGenerator.generate(operation, {
              Conversation: () => ({
                id: "42",
                title: "Mutated title",
              }),
            }),
          );
        });
        const div = testComponentTree.root.findByType("div");
        expect(div.children[0]).toEqual("Mutated title");
      });
    }

    function itUpdatesTheCacheWithUpdater(
      getOperationDescriptor: () => OperationDescriptor,
    ) {
      it("updates the cache using an updater and re-renders", async () => {
        await ReactTestRenderer.act(() => {
          const operation = getOperationDescriptor();
          return client.mock.resolve(
            operation,
            MockPayloadGenerator.generate(operation, {
              Message: () => ({
                id: "message-42",
                text: "New message",
              }),
            }),
          );
        });
        const ul = testComponentTree.root.findByType("ul");
        expect(ul.children.length).toBe(2);
        expect(
          (ul.children[0] as ReactTestRenderer.ReactTestInstance).children[0],
        ).toEqual("New message");
      });
    }

    describe("concerning mutations", () => {
      itUpdatesTheCacheAutomatically(() => {
        testComponentTree.root
          .findAllByType("button")
          .find((button) => button.props.children === "Mutate title")!
          .props.onClick();
        const operation = client.mock.getMostRecentOperation();
        expect(getOperationName(operation.request.node)).toEqual(
          "ApolloClientIntegrationTestMutation",
        );
        return operation;
      });

      itUpdatesTheCacheWithUpdater(() => {
        testComponentTree.root
          .findAllByType("button")
          .find((button) => button.props.children === "Create message")!
          .props.onClick();
        const operation = client.mock.getMostRecentOperation();
        expect(getOperationName(operation.request.node)).toEqual(
          "ApolloClientIntegrationTestCreateMessageMutation",
        );
        return operation;
      });
    });

    describe("concerning subscriptions", () => {
      itUpdatesTheCacheAutomatically(() => {
        const [operation] = client.mock.getAllOperations();
        expect(getOperationName(operation.request.node)).toEqual(
          "ApolloClientIntegrationTestConversationUpdatedSubscription",
        );
        return operation;
      });

      itUpdatesTheCacheWithUpdater(() => {
        const [_, operation] = client.mock.getAllOperations();
        expect(getOperationName(operation.request.node)).toEqual(
          "ApolloClientIntegrationTestMessageCreatedSubscription",
        );
        return operation;
      });
    });

    describe("concerning connections", () => {});
  },
);
