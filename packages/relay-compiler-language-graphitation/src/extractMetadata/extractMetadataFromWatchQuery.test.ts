import { graphql } from "@graphitation/graphql-js-tag";
import { extractMetadataFromWatchQuery } from "./extractMetadataFromWatchQuery";

describe(extractMetadataFromWatchQuery, () => {
  describe("concerning the root of resolved watch query data", () => {
    it("indicates the watch data starts at the node field", () => {
      const result = extractMetadataFromWatchQuery(graphql`
        query WatchQueryOnNodeType {
          node(id: $id) {
            ...SomeFragment
          }
        }
      `);
      expect(result?.rootSelection).toEqual("node");
    });

    it("indicates the watch data starting at the root by not emitting a root field selection", () => {
      const result = extractMetadataFromWatchQuery(graphql`
        query WatchQueryOnQueryType {
          ...SomeFragment
          __fragments @client
        }
      `);
      expect(result).toBeUndefined();
    });
  });

  describe("concerning the main fragment", () => {
    it("works with a node type", () => {
      const result = extractMetadataFromWatchQuery(graphql`
        query WatchQueryOnNodeType {
          node(id: $id) {
            ...SomeFragment
          }
        }
        fragment SomeFragment on User {
          id
        }
      `);
      expect(result?.mainFragment).toEqual({
        name: "SomeFragment",
        typeCondition: "User",
      });
    });
  });

  describe("concerning connections", () => {
    it("extracts the connection metadata needed at runtime to perform pagination", () => {
      const result = extractMetadataFromWatchQuery(graphql`
        query UserWithFriendsQuery(
          $friendsForwardCount: Int!
          $friendsAfterCursor: String!
        ) {
          ...UserFriendsFragment
        }
        fragment UserFriendsFragment on Query {
          me {
            friends(
              first: $friendsForwardCount
              after: $friendsAfterCursor
              last: $friendsBackwardCount
              before: $friendsBeforeCursor
            ) @connection(key: "UserFriends") {
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
      expect(result).toMatchObject({
        connection: {
          forwardCountVariable: "friendsForwardCount",
          forwardCursorVariable: "friendsAfterCursor",
          backwardCountVariable: "friendsBackwardCount",
          backwardCursorVariable: "friendsBeforeCursor",
          selectionPath: ["me", "friends"],
        },
      });
    });

    it("returns nothing if no connection is declared", () => {
      const result = extractMetadataFromWatchQuery(graphql`
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
        extractMetadataFromWatchQuery(graphql`
          query {
            me {
              friends(first: $friendsForwardCount, after: $friendsAfterCursor)
                @connection(key: "UserFriends") {
                edges {
                  node {
                    friends(
                      first: $friendfriendsForwardCount
                      after: $friendfriendsAfterCursor
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
