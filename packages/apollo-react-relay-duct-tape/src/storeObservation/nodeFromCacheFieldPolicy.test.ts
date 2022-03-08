import {
  ApolloClient,
  defaultDataIdFromObject,
  InMemoryCache,
} from "@apollo/client";
import { graphql } from "@graphitation/graphql-js-tag";
import {
  nodeFromCacheFieldPolicyWithDefaultApolloClientStoreKeys,
  nodeFromCacheFieldPolicyWithGlobalObjectIdStoreKeys,
} from "./nodeFromCacheFieldPolicy";

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

describe(nodeFromCacheFieldPolicyWithDefaultApolloClientStoreKeys, () => {
  let client: ApolloClient<any>;

  function defineTests() {
    beforeAll(() => {
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
    });

    it("returns a subset of a query result set as if it were requested through the node root-field", async () => {
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
  }

  describe("with default Apollo Client store key generation", () => {
    beforeAll(() => {
      client = new ApolloClient({
        cache: new InMemoryCache({
          typePolicies: {
            Query: {
              fields: {
                node: {
                  read: nodeFromCacheFieldPolicyWithDefaultApolloClientStoreKeys,
                },
              },
            },
          },
        }),
      });
    });

    defineTests();

    it("uses a default AC store key", () => {
      expect(client.cache.extract()["SomeType:42"]).not.toBeUndefined();
    });
  });

  describe("with strict Global Object Identification spec store keys", () => {
    beforeAll(() => {
      client = new ApolloClient({
        cache: new InMemoryCache({
          dataIdFromObject(responseObject) {
            return (
              responseObject.id?.toString() ||
              defaultDataIdFromObject(responseObject)
            );
          },
          typePolicies: {
            Query: {
              fields: {
                node: {
                  read: nodeFromCacheFieldPolicyWithGlobalObjectIdStoreKeys,
                },
              },
            },
          },
        }),
      });
    });

    defineTests();

    it("uses a strict Global Object Id store key", () => {
      expect(client.cache.extract()["42"]).not.toBeUndefined();
    });
  });
});
