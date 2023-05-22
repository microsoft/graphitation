import { reduceNodeWatchQueryTransform } from "../reduceNodeWatchQueryTransform";
import { graphql } from "@graphitation/graphql-js-tag";
import { buildASTSchema, print } from "graphql";

const schema = buildASTSchema(graphql`
  interface Node {
    id: ID!
  }

  type Query {
    me: User!
    node(id: ID!): Node
  }

  interface UserLike implements Node {
    id: ID!
    name: String!
    assets: UserAssets!
  }

  type User implements UserLike & Node {
    id: ID!
    name: String!
    assets: UserAssets!
  }

  # Not a Node
  type UserAssets {
    avatar: Avatar!
  }

  type Avatar implements Node {
    url: String!
    dimensions: Size
  }

  # Not a Node
  type Size {
    width: Int!
    height: Int!
  }
`);

describe(reduceNodeWatchQueryTransform, () => {
  it("removes fragment definitions/spreads on types that implement the Node interface", () => {
    const result = reduceNodeWatchQueryTransform(
      schema,
      graphql`
        query {
          me {
            name
            # This is on a Node and should get removed
            ...User_fragment
            assets {
              # This is NOT on a Node and should remain
              ...UserAssets_fragment
            }
          }
        }
        fragment User_fragment on User {
          name
        }
        fragment UserAssets_fragment on UserAssets {
          avatar {
            size {
              width
            }
            # This is on a Node and should get removed
            ...Avatar_fragment
          }
        }
        fragment Avatar_fragment on Avatar {
          size {
            height
          }
        }
      `,
    );
    expect(print(result)).toEqual(
      print(graphql`
        query {
          me {
            name
            assets {
              ...UserAssets_fragment
            }
          }
        }
        fragment UserAssets_fragment on UserAssets {
          avatar {
            size {
              width
            }
          }
        }
      `),
    );
  });

  it("removes fragment definitions/spreads referred to from fragments on the Query type", () => {
    const result = reduceNodeWatchQueryTransform(
      schema,
      graphql`
        query {
          ...FragmentOnQueryType
          __fragments @client
        }
        fragment FragmentOnQueryType on Query {
          me {
            id
          }
          ...AnotherFragmentOnQueryType
          __fragments @client
        }
        fragment AnotherFragmentOnQueryType on Query {
          __typename
        }
      `,
    );
    expect(print(result)).toEqual(
      print(graphql`
        query {
          ...FragmentOnQueryType
          __fragments @client
        }
        fragment FragmentOnQueryType on Query {
          me {
            id
          }
          __fragments @client
        }
      `),
    );
  });

  it("does NOT remove the first fragment spread (with object constraint) on the node field of a refetch query", () => {
    const result = reduceNodeWatchQueryTransform(
      schema,
      graphql`
        query {
          node(id: "some-id") {
            __typename
            id
            # This is on the node root-field and should remain
            ...RootNode_fragment
            ... on Node {
              __fragments @client
            }
          }
        }
        fragment RootNode_fragment on User {
          name
          # This is on a Node and should get removed
          ...User_fragment
          assets {
            # This is NOT on a Node and should remain
            ...UserAssets_fragment
          }
        }
        fragment User_fragment on User {
          name
        }
        fragment UserAssets_fragment on UserAssets {
          avatar {
            size {
              width
            }
            # This is on a Node and should get removed
            ...Avatar_fragment
          }
        }
        fragment Avatar_fragment on Avatar {
          size {
            height
          }
        }
      `,
    );
    expect(print(result)).toEqual(
      print(graphql`
        query {
          node(id: "some-id") {
            __typename
            id
            ...RootNode_fragment
            ... on Node {
              __fragments @client
            }
          }
        }
        fragment RootNode_fragment on User {
          name
          assets {
            ...UserAssets_fragment
          }
        }
        fragment UserAssets_fragment on UserAssets {
          avatar {
            size {
              width
            }
          }
        }
      `),
    );
  });

  it("does NOT remove the first fragment spread (with interface constraint) on the node field of a refetch query", () => {
    const result = reduceNodeWatchQueryTransform(
      schema,
      graphql`
        query {
          node(id: "some-id") {
            __typename
            id
            # This is on the node root-field and should remain
            ...RootNode_fragment
            ... on Node {
              __fragments @client
            }
          }
        }
        fragment RootNode_fragment on User {
          name
          # This is on a Node and should get removed
          ...User_fragment
          assets {
            # This is NOT on a Node and should remain
            ...UserAssets_fragment
          }
        }
        fragment User_fragment on UserLike {
          name
        }
        fragment UserAssets_fragment on UserAssets {
          avatar {
            size {
              width
            }
            # This is on a Node and should get removed
            ...Avatar_fragment
          }
        }
        fragment Avatar_fragment on Avatar {
          size {
            height
          }
        }
      `,
    );
    expect(print(result)).toEqual(
      print(graphql`
        query {
          node(id: "some-id") {
            __typename
            id
            ...RootNode_fragment
            ... on Node {
              __fragments @client
            }
          }
        }
        fragment RootNode_fragment on User {
          name
          assets {
            ...UserAssets_fragment
          }
        }
        fragment UserAssets_fragment on UserAssets {
          avatar {
            size {
              width
            }
          }
        }
      `),
    );
  });
});
