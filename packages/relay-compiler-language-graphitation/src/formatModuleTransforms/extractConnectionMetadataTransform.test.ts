import { graphql } from "@graphitation/graphql-js-tag";
import { print } from "graphql";
import { extractConnectionMetadataTransform } from "./extractConnectionMetadataTransform";

describe(extractConnectionMetadataTransform, () => {
  it("extracts the connection metadata needed at runtime to perform pagination", () => {
    const result = extractConnectionMetadataTransform(graphql`
      query UserWithFriendsQuery($friendsCount: Int!, $friendsCursor: String!) {
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
      countVariable: "friendsCount",
      cursorVariable: "friendsCursor",
      selectionPath: ["me", "friends"],
    });
  });

  it("returns nothing if no connection is declared", () => {
    const result = extractConnectionMetadataTransform(graphql`
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
    expect(result).toBeNull();
  });

  it("throws if more than 1 connection is found", () => {
    expect(() => {
      extractConnectionMetadataTransform(graphql`
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
