import { graphql } from "@graphitation/graphql-js-tag";
import { extractMetadataTransform } from "./extractMetadataTransform";

describe(extractMetadataTransform, () => {
  describe("concerning the root of resolved watch query data", () => {
    it("indicates the watch data starts at the node field", () => {
      const result = extractMetadataTransform(graphql`
        query WatchQueryOnNodeType {
          node(id: $id) {
            ...SomeFragment
          }
        }
      `);
      expect(result?.rootSelection).toEqual("node");
    });

    it("indicates the watch data starting at the root by not emitting a root field selection", () => {
      const result = extractMetadataTransform(graphql`
        query WatchQueryOnQueryType {
          ...SomeFragment
          __fragments @client
        }
      `);
      expect(result).toBeUndefined();
    });
  });

  describe("concerning connections", () => {
    it("extracts the connection metadata needed at runtime to perform pagination", () => {
      const result = extractMetadataTransform(graphql`
        query UserWithFriendsQuery(
          $friendsCount: Int!
          $friendsCursor: String!
        ) {
          ...UserFriendsFragment
        }
        fragment UserFriendsFragment on Query {
          me {
            friends(first: $friendsCount, after: $friendsCursor)
              @connection(key: "UserFriends") {
              edges {
                node {
                  ...FriendFragment
                }
              }
              pageInfo {
                endCursor
              }
            }
          }
        }
        fragment FriendFragment on User {
          name
        }
      `);
      expect(result).toEqual({
        connection: {
          countVariable: "friendsCount",
          cursorVariable: "friendsCursor",
          selectionPath: ["me", "friends"],
        },
      });
    });

    it("returns nothing if no connection is declared", () => {
      const result = extractMetadataTransform(graphql`
        query {
          me {
            friends {
              edges {
                node {
                  name
                }
              }
            }
          }
        }
      `);
      expect(result).toBeUndefined();
    });

    it("throws if more than 1 connection is found", () => {
      expect(() => {
        extractMetadataTransform(graphql`
          query {
            me {
              friends(first: $friendsCount, after: $friendsCursor)
                @connection(key: "UserFriends") {
                edges {
                  node {
                    friends(
                      first: $friendFriendsCount
                      after: $friendFriendsCursor
                    ) @connection(key: "UserFriendFriends") {
                      edges {
                        node {
                          name
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        `);
      }).toThrow();
    });
  });
});
