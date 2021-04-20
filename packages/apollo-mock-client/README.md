# ApolloMockClient

An Apollo Client that allows mocking of payloads in response to operations, rather than having to provide them all upfront. It is API-wise a port of [Relay’s RelayMockEnvironment](https://relay.dev/docs/guides/testing-relay-components/#relaymockenvironment-api-overview).

While not required, it works hand-in-hand with `@graphitation/graphql-js-operation-payload-generator`.

## Example

_NOTE: In the following examples, the components under test are defined in the subsequent example section._

```tsx
import {
  ApolloMockClient,
  createMockClient,
} from "@graphitation/apollo-mock-client";
import * as MockPayloadGenerator from "@graphitation/graphql-js-operation-payload-generator";

import { ApolloProvider } from "@apollo/client";
import {
  act,
  create as createTestRenderer,
  ReactTestRenderer,
} from "react-test-renderer";

let client: ApolloMockClient;
let testRenderer: ReactTestRenderer;

beforeAll(() => {
  const schema = buildSchema(readFileSync("path/to/schema.graphql", "utf8"));

  client = createMockClient(schema);

  act(() => {
    testRenderer = createTestRenderer(
      <ApolloProvider client={client}>
        <FeedbackApp />
      </ApolloProvider>
    );
  });
});

afterEach(() => {
  client.mock.mockClear();
});
```

### Query

```tsx
import { graphql } from "@graphitation/graphql-js-tag";
import { useState } from "react";
import { useQuery } from "@apollo/client";

const FeedbackQuery = graphql`
  query FeedbackQuery($id: ID!) {
    feedback(id: $id) {
      id
      message {
        text
      }
      doesViewerLike
    }
  }
`;

const FeedbackApp: React.FC = () => {
  const { data, error } = useQuery(FeedbackQuery);
  if (data) {
    return <FeedbackComponent feedback={data.feedback} />;
  } else if (error) {
    return <div id="error">{error.message}</div>;
  }
  return <div id="loading">Loading...</div>;
};
```

```tsx
it("has pending operations in the queue", () => {
  expect(client.mock.getAllOperations().length).toEqual(1);
});

it("resolves a query", async () => {
  expect(() => {
    testRenderer.root.find((node) => node.props.id === "loading");
  }).not.toThrow();

  // Resolve the query operation and await the promise
  await act(() =>
    client.mock.resolveMostRecentOperation((operation) =>
      MockPayloadGenerator.generate(operation)
    )
  );

  expect(() => {
    testRenderer.root.findByType(FeedbackComponent);
  }).not.toThrow();
});

it("rejects a query", async () => {
  await act(() => client.mock.rejectMostRecentOperation(new Error("Uh-oh")));

  const errorMessage = testRenderer.root.find(
    (node) => node.props.id === "error"
  );
  expect(errorMessage.props.children).toBe("Uh-oh");
});
```

### Mutation

```tsx
import { graphql } from "@graphitation/graphql-js-tag";
import { useState } from "react";
import { useMutation } from "@apollo/client";

const FeedbackLikeMutation = graphql`
  mutation FeedbackLikeMutation($input: FeedbackLikeInput) {
    feedbackLike(input: $input) {
      feedback {
        id
        doesViewerLike
      }
    }
  }
`;

const FeedbackComponent: React.FC = (props) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [like] = useMutation(FeedbackLikeMutation, {
    onError: (e) => {
      setErrorMessage(e.message);
    },
  });
  return (
    <div>
      {errorMessage != null && <span id="error-message">{errorMessage}</span>}
      Feedback: {props.feedback.message.text}
      <button
        onClick={() => {
          like({
            variables: {
              input: {
                feedbackId: props.feedback.id,
              },
            },
          });
        }}
      >
        {props.feedback.doesViewerLike ? "Unlike" : "Like"}
      </button>
    </div>
  );
};
```

```tsx
it("resolves a mutation", async () => {
  const likeButton = testRenderer.root.find(
    (node) => node.props.id === "likeButton"
  );
  await act(async () => {
    likeButton.props.onClick();
  });

  // Resolve the mutation operation and await the promise
  await act(async () =>
    client.mock.resolveMostRecentOperation((operation) =>
      MockPayloadGenerator.generate(operation, {
        Feedback() {
          return {
            id: operation.request.variables.input?.feedbackId,
            doesViewerLike: true,
          };
        },
      })
    )
  );

  expect(likeButton.props.children).toEqual("Unlike");
});

it("rejects a mutation", async () => {
  const likeButton = testRenderer.root.find(
    (node) => node.props.id === "likeButton"
  );
  await act(async () => {
    likeButton.props.onClick();
  });

  // Trigger an error
  await act(() => client.mock.rejectMostRecentOperation(new Error("Uh-oh")));
  expect(() => {
    testRenderer.root.find((node) => node.props.id === "error-message");
  }).not.toThrow();
});
```

### Subscription

```tsx
import { useSubscription } from "@apollo/client";

const FeedbackLikeSubscription = graphql`
  subscription FeedbackLikeSubscription($input: FeedbackLikeInput) {
    feedbackLikeSubscribe(input: $input) {
      feedback {
        id
        doesViewerLike
      }
    }
  }
`;

const FeedbackComponent: React.FC = (props) => {
  useSubscription(FeedbackLikeSubscription, {
    variables: {
      input: {
        feedbackId: props.feedback.id,
      },
    },
  });
  // Rest of the component as shown in the mutation example...
};
```

```tsx
it("resolves a subscription", async () => {
  const reaction = testRenderer.root.find(
    (node) => node.props.id === "reaction"
  );
  expect(reaction.props.children).toBe("Viewer does not like it");

  const operation = client.mock.getMostRecentOperation();
  expect(getOperationName(operation.request.node)).toBe(
    "FeedbackLikeSubscription"
  );
  expect(operation.request.variables).toEqual({
    input: {
      feedbackId: "my-feedback-id",
    },
  });

  await act(() =>
    client.mock.nextValue(
      operation,
      MockPayloadGenerator.generate(operation, {
        Feedback() {
          return {
            id: operation.request.variables.input?.feedbackId,
            doesViewerLike: true,
          };
        },
      })
    )
  );
  expect(reaction.props.children).toBe("Viewer likes it");
});
```
