import { stripFragmentReferenceFieldSelectionTransform } from "../stripFragmentReferenceFieldSelectionTransform";
import { graphql } from "@graphitation/graphql-js-tag";
import { print } from "graphql";

describe(stripFragmentReferenceFieldSelectionTransform, () => {
  it("removes the fragment reference sentinel field selection", () => {
    const result = stripFragmentReferenceFieldSelectionTransform(graphql`
      query {
        me {
          ... on Node {
            id
            __fragments @client
          }
        }
      }
    `);
    expect(print(result)).toEqual(
      print(graphql`
        query {
          me {
            ... on Node {
              id
            }
          }
        }
      `),
    );
  });

  it("removes the inline fragment if it would be left empty", () => {
    const result = stripFragmentReferenceFieldSelectionTransform(graphql`
      query {
        me {
          id
          ... on Node {
            __fragments @client
          }
        }
      }
    `);
    expect(print(result)).toEqual(
      print(graphql`
        query {
          me {
            id
          }
        }
      `),
    );
  });

  it("removes __fragments from subscription documents", () => {
    const result = stripFragmentReferenceFieldSelectionTransform(graphql`
      subscription UserUpdated {
        userUpdated {
          id
          ... on Node {
            __fragments @client
          }
        }
      }
    `);
    expect(print(result)).toEqual(
      print(graphql`
        subscription UserUpdated {
          userUpdated {
            id
          }
        }
      `),
    );
  });

  it("removes __fragments from mutation documents", () => {
    const result = stripFragmentReferenceFieldSelectionTransform(graphql`
      mutation UpdateUser($id: ID!, $name: String!) {
        updateUser(id: $id, name: $name) {
          id
          ... on Node {
            __fragments @client
          }
        }
      }
    `);
    expect(print(result)).toEqual(
      print(graphql`
        mutation UpdateUser($id: ID!, $name: String!) {
          updateUser(id: $id, name: $name) {
            id
          }
        }
      `),
    );
  });
});
