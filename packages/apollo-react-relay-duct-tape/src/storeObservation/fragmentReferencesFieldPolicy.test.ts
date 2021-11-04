import { fragmentReferencesFieldPolicy } from "./fragmentReferencesFieldPolicy";
import { graphql } from "@graphitation/graphql-js-tag";
import { ApolloClient, InMemoryCache } from "@apollo/client";

describe(fragmentReferencesFieldPolicy, () => {
  let client: ApolloClient<any>;

  beforeAll(() => {
    client = new ApolloClient({
      cache: new InMemoryCache({
        possibleTypes: {
          Node: ["User"],
        },
        typePolicies: {
          Node: {
            fields: {
              __fragments: {
                read: fragmentReferencesFieldPolicy,
              },
            },
          },
        },
      }),
    });
    client.writeQuery({
      query: graphql`
        query {
          user(id: 42) {
            id
          }
        }
      `,
      data: {
        user: {
          __typename: "User",
          id: 42,
        },
      },
    });
  });

  it("returns the request variables for the fragment references sentinel field", async () => {
    const variables = { userId: 42 };

    const result = await client.query({
      query: graphql`
        query TestQuery($userId: ID!) {
          user(id: $userId) {
            ... on Node {
              __fragments @client
            }
          }
        }
      `,
      variables,
    });

    expect(result.data.user.__fragments).toEqual(variables);
  });

  it("passes on the original request variables", async () => {
    const variables = { userId: 42 };

    const result = await client.query({
      query: graphql`
        query TestQuery($userId: ID!) {
          user(id: $userId) {
            ... on Node {
              __fragments @client
            }
          }
        }
      `,
      variables: { ...variables, __fragments: variables },
    });

    expect(result.data.user.__fragments).toEqual(variables);
  });
});
