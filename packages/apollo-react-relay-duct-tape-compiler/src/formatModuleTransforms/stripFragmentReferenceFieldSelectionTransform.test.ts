import { stripFragmentReferenceFieldSelectionTransform } from "./stripFragmentReferenceFieldSelectionTransform";
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
      `)
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
      `)
    );
  });
});
