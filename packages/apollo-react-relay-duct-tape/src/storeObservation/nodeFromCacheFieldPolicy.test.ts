import { ApolloClient, InMemoryCache } from "@apollo/client";
import { graphql } from "@graphitation/graphql-js-tag";
import { nodeFromCacheFieldPolicy } from "./nodeFromCacheFieldPolicy";

const FRAGMENTS = graphql`
  fragment SomeFragment on SomeType {
    __typename
    id
    name
    anotherType {
      ...AnotherFragment
    }
  }
  fragment AnotherFragment on AnotherType {
    __typename
    name
  }
`;

const MOCK_DATA = {
  __typename: "SomeType",
  id: 42,
  name: "something something",
  anotherType: {
    __typename: "AnotherType",
    name: "another another",
  },
};

describe(nodeFromCacheFieldPolicy, () => {
  let client: ApolloClient<any>;

  beforeAll(() => {
    client = new ApolloClient({
      cache: new InMemoryCache({
        typePolicies: {
          Query: {
            fields: {
              node: {
                read: nodeFromCacheFieldPolicy,
              },
            },
          },
        },
      }),
    });
  });

  it("returns a subset of a query result set as if it were requested through the node root-field", async () => {
    client.writeQuery({
      query: graphql`
        query FatQuery {
          notTheNodeField {
            yetAnotherField {
              ...SomeFragment
            }
          }
        }
        ${FRAGMENTS}
      `,
      data: {
        notTheNodeField: {
          yetAnotherField: MOCK_DATA,
        },
      },
    });

    const response = await client.query({
      query: graphql`
        query SingleNodeQuery {
          node(id: 42) {
            ...SomeFragment
          }
        }
        ${FRAGMENTS}
      `,
    });

    expect(response.data.node).toMatchObject(MOCK_DATA);
  });
});
