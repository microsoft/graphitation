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
import { graphql } from "@graphitation/graphql-js-tag";
import {
  ApolloMockClient,
  createMockClient,
  OperationDescriptor,
} from "@graphitation/apollo-mock-client";
import * as React from "react";
import { readFileSync } from "fs";
import { buildSchema } from "graphql";
import * as MockPayloadGenerator from "@graphitation/graphql-js-operation-payload-generator";

import ApolloClientIntegrationTestQueryRelayIR, {
  ApolloClientIntegrationTestQuery,
} from "./__generated__/ApolloClientIntegrationTestQuery.graphql";
import ApolloClientIntegrationTestMutationRelayIR from "./__generated__/ApolloClientIntegrationTestMutation.graphql";
import TestCreateMessageMutationRelayIR, {
  ApolloClientIntegrationTestCreateMessageMutation,
} from "./__generated__/ApolloClientIntegrationTestCreateMessageMutation.graphql";
import TestConversationUpdatedSubscriptionRelayIR from "./__generated__/ApolloClientIntegrationTestConversationUpdatedSubscription.graphql";
import TestMessageCreatedSubscriptionRelayIR, {
  ApolloClientIntegrationTestMessageCreatedSubscription,
} from "./__generated__/ApolloClientIntegrationTestMessageCreatedSubscription.graphql";

const schema = buildSchema(
  readFileSync(require.resolve("./schema.graphql"), "utf8"),
);

const ApolloClientIntegrationTestQuery = graphql`
  query ApolloClientIntegrationTestQuery($id: String!) {
    conversation(id: $id) {
      __typename
      id
      title
      messages {
        __typename
        id
        text
      }
    }
  }
`;
(ApolloClientIntegrationTestQuery as any).__relay = ApolloClientIntegrationTestQueryRelayIR;

const ApolloClientIntegrationTestMutation = graphql`
  mutation ApolloClientIntegrationTestMutation($id: String!, $title: String!) {
    updateConversation(id: $id, title: $title) {
      __typename
      id
      title
    }
  }
`;
(ApolloClientIntegrationTestMutation as any).__relay = ApolloClientIntegrationTestMutationRelayIR;

const TestCreateMessageMutation = graphql`
  mutation ApolloClientIntegrationTestCreateMessageMutation(
    $conversationId: String!
  ) {
    createMessage(conversationId: $conversationId) {
      __typename
      id
      text
    }
  }
`;
(TestCreateMessageMutation as any).__relay = TestCreateMessageMutationRelayIR;

const TestConversationUpdatedSubscription = graphql`
  subscription ApolloClientIntegrationTestConversationUpdatedSubscription {
    conversationUpdated {
      __typename
      id
      title
    }
  }
`;
(TestConversationUpdatedSubscription as any).__relay = TestConversationUpdatedSubscriptionRelayIR;

const TestMessageCreatedSubscription = graphql`
  subscription ApolloClientIntegrationTestMessageCreatedSubscription(
    $conversationId: String!
  ) {
    messageCreated(conversationId: $conversationId) {
      __typename
      id
      text
    }
  }
`;
(TestMessageCreatedSubscription as any).__relay = TestMessageCreatedSubscriptionRelayIR;

const TestComponent: React.FC = () => {
  useSubscription(TestConversationUpdatedSubscription);
  const { data: props, error, subscribeToMore } = useQuery<
    ApolloClientIntegrationTestQuery["response"],
    ApolloClientIntegrationTestQuery["variables"]
  >(ApolloClientIntegrationTestQuery, {
    variables: { id: "42" },
  });
  if (props) {
    subscribeToMore<
      ApolloClientIntegrationTestMessageCreatedSubscription["response"],
      ApolloClientIntegrationTestMessageCreatedSubscription["variables"]
    >({
      document: TestMessageCreatedSubscription,
      variables: { conversationId: "42" },
      updateQuery: (prev, { subscriptionData }) => {
        return {
          ...prev,
          conversation: {
            ...prev.conversation,
            messages: [
              subscriptionData.data.messageCreated,
              ...prev.conversation.messages,
            ],
          },
        };
      },
    });
    return (
      <>
        <div>{props.conversation.title}</div>
        <ul>
          {props.conversation.messages.map((message, i) => (
            <li key={i}>{message.text}</li>
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
  const [createMessage] = useMutation<
    ApolloClientIntegrationTestCreateMessageMutation["response"]
  >(TestCreateMessageMutation, {
    update(cache, { data }) {
      if (data?.createMessage) {
        const existingData = cache.readQuery<
          ApolloClientIntegrationTestQuery["response"]
        >({
          query: ApolloClientIntegrationTestQuery,
          variables: { id: "42" },
        });
        cache.writeQuery({
          query: ApolloClientIntegrationTestQuery,
          variables: { id: "42" },
          data: {
            conversation: {
              ...existingData!.conversation,
              messages: [
                data.createMessage,
                ...existingData!.conversation.messages!,
              ],
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
      client = createMockClient(schema, {
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
  },
);
