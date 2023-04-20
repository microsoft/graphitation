import React from "react";
import { buildSchema } from "graphql";
import { readFileSync } from "fs";
import { join } from "path";
import {
  act,
  create as createTestRenderer,
  ReactTestRenderer,
} from "react-test-renderer";
import { ApolloProvider } from "@apollo/client";
import { expectType } from "ts-expect";

import { graphql } from "@graphitation/graphql-js-tag";
import * as MockPayloadGenerator from "@graphitation/graphql-js-operation-payload-generator";
import {
  ApolloMockClient,
  createMockClient,
} from "@graphitation/apollo-mock-client/src/index"; // FIXME

import {
  useFragment,
  useLazyLoadQuery,
  useMutation,
  useSubscription,
} from "../hooks";

import { hooksTestQuery } from "./__generated__/hooksTestQuery.graphql";
import { hooksTestSubscription } from "./__generated__/hooksTestSubscription.graphql";
import { hooksTestFragment$key } from "./__generated__/hooksTestFragment.graphql";
import { hooksTestMutation as hooksTestMutation$key } from "./__generated__/hooksTestMutation.graphql";
import { getOperationName } from "@apollo/client/utilities";

const schema = buildSchema(
  readFileSync(join(__dirname, "schema.graphql"), "utf8"),
);

/**
 * Fragment test subject
 */

const fragment = graphql`
  fragment hooksTestFragment on User {
    __typename
    id
    name
  }
`;

const FragmentComponent: React.FC<{ user: hooksTestFragment$key }> = (
  props,
) => {
  const user = useFragment(fragment, props.user);
  return <div id={user.__typename}>{user.name}</div>;
};

/**
 * Query test subject
 */

const query = graphql`
  query hooksTestQuery($id: ID!) {
    user(id: $id) {
      ...hooksTestFragment
    }
  }
  ${fragment}
`;

const QueryComponent: React.FC = () => {
  const { data, error } = useLazyLoadQuery<hooksTestQuery>(
    query,
    {
      id: "some-user-id",
    },
    { context: { callerInfo: "query-component" } },
  );
  if (error) {
    return <div id="error">{error.message}</div>;
  } else if (data) {
    return <FragmentComponent user={data.user} />;
  } else {
    return <div id="loading">Loading...</div>;
  }
};

/**
 * Subscription test subject
 */

const subscription = graphql`
  subscription hooksTestSubscription($id: ID!) {
    userNameChanged(id: $id) {
      ...hooksTestFragment
    }
  }
  ${fragment}
`;

/**
 * Mutation test subject
 */

const mutation = graphql`
  mutation hooksTestMutation($id: ID!, $name: String!) {
    updateUserName(id: $id, name: $name) {
      ...hooksTestFragment
    }
  }

  ${fragment}
`;

type SubscriptionHookParams = Parameters<typeof useSubscription>[0];
interface SubjectProps {
  onNext?: SubscriptionHookParams["onNext"];
  onError?: SubscriptionHookParams["onError"] | null;
}

const SubscriptionComponent: React.FC<SubjectProps> = ({
  onNext = jest.fn(),
  onError = jest.fn(),
  children,
}) => {
  useSubscription<hooksTestSubscription>({
    subscription,
    variables: { id: "some-user-id" },
    context: { callerInfo: "subscription-component" },
    onNext,
    onError: onError || undefined,
  });
  return <>{children}</>;
};

const MutationComponent: React.FC<{
  variables: any;
  optimisticResponse: any;
  context?: any;
}> = (props) => {
  const { variables, optimisticResponse, context } = props;
  const [commit, isInFlight] = useMutation<hooksTestMutation$key>(mutation);
  const [result, setResult] = React.useState<any>(null);
  React.useEffect(() => {
    (async function () {
      const result = await commit({ variables, optimisticResponse, context });
      setResult(result);
    })();
  }, [variables, optimisticResponse]);
  if (isInFlight) {
    return <div>Loading</div>;
  } else if (result) {
    return <div>{JSON.stringify(result)}</div>;
  } else {
    return <div>Not loading</div>;
  }
};

/**
 * Tests
 */

let client: ApolloMockClient;

beforeEach(() => {
  client = createMockClient(schema);
});

describe(useLazyLoadQuery, () => {
  it("uses Apollo's useQuery hook", async () => {
    let tree: ReactTestRenderer;
    act(() => {
      tree = createTestRenderer(
        <ApolloProvider client={client}>
          <QueryComponent />
        </ApolloProvider>,
      );
    });

    const operation = client.mock.getMostRecentOperation();
    expect(getOperationName(operation.request.node)).toBe("hooksTestQuery");
    expect(operation.request.variables).toEqual({ id: "some-user-id" });
    expect(operation.request.context).toHaveProperty(
      "callerInfo",
      "query-component",
    );

    await act(() =>
      client.mock.resolve(operation, MockPayloadGenerator.generate(operation)),
    );

    expect(tree!.root.findByType("div").props).toMatchObject({
      id: "User",
      children: `<mock-value-for-field-"name">`,
    });
  });
});

describe(useFragment, () => {
  it("currently simply passes through the data it receives", () => {
    const fragmentRef: hooksTestFragment$key = {} as any;
    expect(useFragment(fragment, fragmentRef)).toEqual(fragmentRef);
  });

  it("unmasks the opaque data's typing that gets emitted by the compiler", () => {
    const fragmentRef: hooksTestFragment$key = {} as any;
    const user = useFragment(fragment, fragmentRef);
    expectType<string>(user.id);
    expectType<string>(user.name);
  });
});

describe(useSubscription, () => {
  it("uses Apollo's useSubscription hook and updates the store", async () => {
    let tree: ReactTestRenderer;
    act(() => {
      tree = createTestRenderer(
        <ApolloProvider client={client}>
          <SubscriptionComponent>
            <QueryComponent />
          </SubscriptionComponent>
        </ApolloProvider>,
      );
    });

    const [subscriptionOperation, queryOperation] =
      client.mock.getAllOperations();

    expect(getOperationName(subscriptionOperation.request.node)).toBe(
      "hooksTestSubscription",
    );
    expect(subscriptionOperation.request.variables).toEqual({
      id: "some-user-id",
    });
    expect(subscriptionOperation.request.context).toHaveProperty(
      "callerInfo",
      "subscription-component",
    );

    // First resolve query...
    await act(() =>
      client.mock.resolve(
        queryOperation,
        MockPayloadGenerator.generate(queryOperation, {
          User() {
            return {
              id: "some-user-id",
              name: "user-name-from-query",
            };
          },
        }),
      ),
    );
    // ...and verify
    expect(tree!.root.findByType("div").props.children).toEqual(
      "user-name-from-query",
    );

    // Now update subscription...
    await act(() =>
      client.mock.resolve(
        subscriptionOperation,
        MockPayloadGenerator.generate(subscriptionOperation, {
          User() {
            return {
              id: "some-user-id",
              name: "user-name-from-subscription",
            };
          },
        }),
      ),
    );
    // ...and verify
    expect(tree!.root.findByType("div").props.children).toEqual(
      "user-name-from-subscription",
    );
  });

  describe("concerning callbacks", () => {
    it("invokes the onNext callback when new data arrives", async () => {
      const onNext = jest.fn();

      act(() => {
        createTestRenderer(
          <ApolloProvider client={client}>
            <SubscriptionComponent onNext={onNext} />
          </ApolloProvider>,
        );
      });

      await act(() =>
        client.mock.resolveMostRecentOperation((operation) =>
          MockPayloadGenerator.generate(operation),
        ),
      );

      expect(onNext).toHaveBeenCalledWith(
        expect.objectContaining({
          userNameChanged: {
            __typename: "User",
            id: "<User-mock-id-1>",
            name: '<mock-value-for-field-"name">',
          },
        }),
      );
    });

    it("invokes the onError callback when an error occurs", async () => {
      const onError = jest.fn();
      const expectedError = new Error("Oh noes");

      act(() => {
        createTestRenderer(
          <ApolloProvider client={client}>
            <SubscriptionComponent onError={onError} />
          </ApolloProvider>,
        );
      });

      await act(() =>
        client.mock.rejectMostRecentOperation(() => expectedError),
      );

      expect(onError).toHaveBeenCalledWith(expectedError);
    });

    it("logs an error when it occurs but no onError callback is provided", async () => {
      const spy = jest.spyOn(console, "warn");
      spy.mockImplementation(() => {});

      act(() => {
        createTestRenderer(
          <ApolloProvider client={client}>
            <SubscriptionComponent onError={null} />
          </ApolloProvider>,
        );
      });

      await act(() =>
        client.mock.rejectMostRecentOperation(() => new Error("Oh noes")),
      );

      expect(spy).toHaveBeenCalledWith(expect.stringContaining("Oh noes"));
    });
  });
});

describe("useMutation", () => {
  it("uses Apollo's useMutation hook", async () => {
    let tree: ReactTestRenderer;
    tree = createTestRenderer(
      <ApolloProvider client={client}>
        <MutationComponent
          variables={{ name: "foo", id: "1" }}
          optimisticResponse={null}
          context={{ callerInfo: "mutation-component" }}
        />
      </ApolloProvider>,
    );
    expect(tree).toMatchInlineSnapshot(`
      <div>
        Not loading
      </div>
    `);
    act(() => {
      tree.update(
        <ApolloProvider client={client}>
          <MutationComponent
            variables={{ name: "foo", id: "1" }}
            optimisticResponse={{
              __typename: "Mutation",
              updateUserName: {
                __typename: "User",
                id: "&lt;User-mock-id-1&gt;",
                name: '&lt;mock-value-for-field-"name"&gt;',
              },
            }}
            context={{ callerInfo: "mutation-component" }}
          />
        </ApolloProvider>,
      );
    });
    expect(tree).toMatchInlineSnapshot(`
      <div>
        Loading
      </div>
    `);
    await act(async () => {
      await client.mock.resolveMostRecentOperation((operation) =>
        MockPayloadGenerator.generate(operation),
      );
    });
    expect(tree).toMatchInlineSnapshot(`
      <div>
        {"data":{"updateUserName":{"__typename":"User","id":"&lt;User-mock-id-1&gt;","name":"&lt;mock-value-for-field-\\"name\\"&gt;"}}}
      </div>
    `);

    const [mutationOperation] = client.mock.getAllOperations();

    expect(getOperationName(mutationOperation.request.node)).toBe(
      "hooksTestMutation",
    );
    expect(mutationOperation.request.variables).toEqual({
      name: "foo",
      id: "1",
    });
    expect(mutationOperation.request.context).toHaveProperty(
      "callerInfo",
      "mutation-component",
    );
  });
});
