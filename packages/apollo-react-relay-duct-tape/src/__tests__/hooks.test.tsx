import * as React from "react";
import { buildSchema } from "graphql";
import { readFileSync } from "fs";
import { join } from "path";
import {
  act,
  create as createTestRenderer,
  ReactTestRenderer,
} from "react-test-renderer";
import { ApolloProvider } from "@apollo/client";

import { graphql } from "@graphitation/graphql-js-tag";
import * as MockPayloadGenerator from "@graphitation/graphql-js-operation-payload-generator";
import {
  ApolloMockClient,
  createMockClient,
} from "@graphitation/apollo-mock-client/src/index"; // FIXME

import {
  GraphQLTaggedNode,
  useFragment,
  useLazyLoadQuery,
  useSubscription,
} from "../hooks";
// import { GraphQLTaggedNode } from "./taggedNode";
import { FragmentRefs } from "../types";

import { hooksTestQuery } from "./__generated__/hooksTestQuery.graphql";
import { hooksTestSubscription } from "./__generated__/hooksTestSubscription.graphql";

const schema = buildSchema(
  readFileSync(join(__dirname, "schema.graphql"), "utf8")
);

const query = graphql`
  query hooksTestQuery($id: ID!) {
    user(id: $id) {
      __typename
      id
      name
    }
  }
`;

let client: ApolloMockClient;

beforeEach(() => {
  client = createMockClient(schema);
});

describe(useLazyLoadQuery, () => {
  it("uses Apollo's useQuery hook", async () => {
    const Subject: React.FC = () => {
      const { data, error } = useLazyLoadQuery<hooksTestQuery>(query, {
        id: "some-user-id",
      });
      if (error) {
        return <div id="error">{error.message}</div>;
      } else if (data) {
        return <div id={data.user.__typename}>{data.user.name}</div>;
      } else {
        return <div id="loading">Loading...</div>;
      }
    };

    let tree: ReactTestRenderer;
    act(() => {
      tree = createTestRenderer(
        <ApolloProvider client={client}>
          <Subject />
        </ApolloProvider>
      );
    });

    const operation = client.mock.getMostRecentOperation();
    expect(operation.request.node).toBe(query);
    expect(operation.request.variables).toEqual({ id: "some-user-id" });

    await act(() =>
      client.mock.resolve(operation, MockPayloadGenerator.generate(operation))
    );

    expect(tree!.root.findByType("div").props).toMatchObject({
      id: "User",
      children: `<mock-value-for-field-"name">`,
    });
  });
});

describe(useFragment, () => {
  it("currently simply passes through the data it receives", () => {
    const fragment = ({} as unknown) as GraphQLTaggedNode;
    const fragmentRef = { someKey: "some-data" } as any;
    expect(useFragment(fragment, fragmentRef)).toEqual(fragmentRef);
  });

  it("unmasks the opaque data's typing that gets emitted by the compiler", () => {
    type SomeFragment$data = { someKey: string };
    type SomeFragment$key = {
      readonly " $data"?: SomeFragment$data;
      readonly " $fragmentRefs": FragmentRefs<"SomeFragment">;
    };

    const fragment = ({} as unknown) as GraphQLTaggedNode;
    const opaqueFragmentRef = ({} as unknown) as SomeFragment$key;

    // This test just checks that there are no TS errors. Alas the test suite currently won't fail if that were the
    // case, but at least there's a test that covers the intent.
    const data: SomeFragment$data = useFragment(fragment, opaqueFragmentRef);
    void data;
  });
});

describe(useSubscription, () => {
  const subscription = graphql`
    subscription hooksTestSubscription($id: ID!) {
      userNameChanged(id: $id) {
        __typename
        id
        name
      }
    }
  `;

  type SubscriptionHookParams = Parameters<typeof useSubscription>[0];
  interface SubjectProps {
    onNext?: SubscriptionHookParams["onNext"];
    onError?: SubscriptionHookParams["onError"] | null;
  }

  const Subject: React.FC<SubjectProps> = ({
    onNext = jest.fn(),
    onError = jest.fn(),
    children,
  }) => {
    useSubscription<hooksTestSubscription>({
      subscription,
      variables: { id: "some-user-id" },
      onNext,
      onError: onError || undefined,
    });
    return <>{children}</>;
  };

  it("uses Apollo's useSubscription hook", async () => {
    const QueryComponent = () => {
      const { data } = useLazyLoadQuery<hooksTestQuery>(query, {
        id: "some-user-id",
      });
      return data ? <div>{data.user.name}</div> : null;
    };

    let tree: ReactTestRenderer;
    act(() => {
      tree = createTestRenderer(
        <ApolloProvider client={client}>
          <Subject>
            <QueryComponent />
          </Subject>
        </ApolloProvider>
      );
    });

    const [
      subscriptionOperation,
      queryOperation,
    ] = client.mock.getAllOperations();

    expect(subscriptionOperation.request.node).toBe(subscription);
    expect(subscriptionOperation.request.variables).toEqual({
      id: "some-user-id",
    });

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
        })
      )
    );
    // ...and verify
    expect(tree!.root.findByType("div").props.children).toEqual(
      "user-name-from-query"
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
        })
      )
    );
    // ...and verify
    expect(tree!.root.findByType("div").props.children).toEqual(
      "user-name-from-subscription"
    );
  });

  describe("concerning callbacks", () => {
    it("invokes the onNext callback when new data arrives", async () => {
      const onNext = jest.fn();

      act(() => {
        createTestRenderer(
          <ApolloProvider client={client}>
            <Subject onNext={onNext} />
          </ApolloProvider>
        );
      });

      await act(() =>
        client.mock.resolveMostRecentOperation((operation) =>
          MockPayloadGenerator.generate(operation)
        )
      );

      expect(onNext).toHaveBeenCalledWith(
        expect.objectContaining({
          userNameChanged: {
            __typename: "User",
            id: "<User-mock-id-1>",
            name: '<mock-value-for-field-"name">',
          },
        })
      );
    });

    it("invokes the onError callback when an error occurs", async () => {
      const onError = jest.fn();
      const expectedError = new Error("Oh noes");

      act(() => {
        createTestRenderer(
          <ApolloProvider client={client}>
            <Subject onError={onError} />
          </ApolloProvider>
        );
      });

      await act(() =>
        client.mock.rejectMostRecentOperation(() => expectedError)
      );

      expect(onError).toHaveBeenCalledWith(expectedError);
    });

    it("logs an error when it occurs but no onError callback is provided", async () => {
      const spy = jest.spyOn(console, "warn");
      spy.mockImplementation(() => {});

      act(() => {
        createTestRenderer(
          <ApolloProvider client={client}>
            <Subject onError={null} />
          </ApolloProvider>
        );
      });

      await act(() =>
        client.mock.rejectMostRecentOperation(() => new Error("Oh noes"))
      );

      expect(spy).toHaveBeenCalledWith(expect.stringContaining("Oh noes"));
    });
  });
});
