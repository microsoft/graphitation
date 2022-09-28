import { RelayApolloCache } from "../Cache";

import {
  ApolloCache,
  ApolloProvider,
  useApolloClient,
  useMutation,
  useQuery,
} from "@apollo/client";
import * as ReactTestRenderer from "react-test-renderer";
import { graphql } from "@graphitation/graphql-js-tag";
import {
  ApolloMockClient,
  createMockClient,
} from "@graphitation/apollo-mock-client";
import React from "react";
import { readFileSync } from "fs";
import { buildSchema } from "graphql";
import * as MockPayloadGenerator from "@graphitation/graphql-js-operation-payload-generator";

import QueryRelayIR, {
  ApolloClientIntegrationTestQuery,
} from "./__generated__/ApolloClientIntegrationTestQuery.graphql";
import MutationRelayIR from "./__generated__/ApolloClientIntegrationTestMutation.graphql";
import TestCreateMessageMutationRelayIR, {
  ApolloClientIntegrationTestCreateMessageMutation,
} from "./__generated__/ApolloClientIntegrationTestCreateMessageMutation.graphql";

const schema = buildSchema(
  readFileSync(require.resolve("./schema.graphql"), "utf8"),
);

const TestQuery = graphql`
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
(TestQuery as any).__relay = QueryRelayIR;

const TestMutation = graphql`
  mutation ApolloClientIntegrationTestMutation($id: String!, $title: String!) {
    updateConversation(id: $id, title: $title) {
      __typename
      id
      title
    }
  }
`;
(TestMutation as any).__relay = MutationRelayIR;

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

const TestComponent: React.FC = () => {
  const { data: props, error } = useQuery<
    ApolloClientIntegrationTestQuery["response"],
    ApolloClientIntegrationTestQuery["variables"]
  >(TestQuery, {
    variables: { id: "42" },
  });
  if (props) {
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
  const [updateConversation] = useMutation(TestMutation);
  const [createMessage] = useMutation<
    ApolloClientIntegrationTestCreateMessageMutation["response"]
  >(TestCreateMessageMutation, {
    update(cache, { data }) {
      if (data?.createMessage) {
        const existingData = cache.readQuery<
          ApolloClientIntegrationTestQuery["response"]
        >({
          query: TestQuery,
          variables: { id: "42" },
        });
        cache.writeQuery({
          query: TestQuery,
          variables: { id: "42" },
          data: {
            conversation: {
              ...existingData!.conversation,
              messages: [
                ...existingData!.conversation.messages!,
                data.createMessage,
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

    describe("concerning mutations", () => {
      it("updates the cache automatically and re-renders", async () => {
        await ReactTestRenderer.act(() => {
          testComponentTree.root
            .findAllByType("button")
            .find((button) => button.props.children === "Mutate title")!
            .props.onClick();
          return client.mock.resolveMostRecentOperation((operation) =>
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

      it("updates the cache using an updater and re-renders", async () => {
        await ReactTestRenderer.act(() => {
          testComponentTree.root
            .findAllByType("button")
            .find((button) => button.props.children === "Create message")!
            .props.onClick();
          return client.mock.resolveMostRecentOperation((operation) =>
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
          (ul.children[1] as ReactTestRenderer.ReactTestInstance).children[0],
        ).toEqual("New message");
      });
    });

    describe("concerning subscriptions", () => {
      it.todo("updates the cache automatically and re-renders");
      it.todo("updates the cache using an updater and re-renders");
    });
  },
);
