import { CompilerContext, Printer } from "relay-compiler";
import {
  transform as connectionTransform,
  SCHEMA_EXTENSION,
} from "relay-compiler/lib/transforms/ConnectionTransform";
import { emitApolloClientConnectionTransform } from "../emitApolloClientConnectionTransform";

const { TestSchema, parseGraphQLText } = require("relay-test-utils-internal");

const ExtendedSchema = TestSchema.extend([SCHEMA_EXTENSION]);

function transform(
  text: string,
  opts: { renameFiltersArgument?: boolean } = {},
) {
  const { renameFiltersArgument = true } = opts;
  const { definitions } = parseGraphQLText(ExtendedSchema, text);

  const transformedText = new CompilerContext(ExtendedSchema)
    .addAll(definitions)
    .applyTransforms([
      emitApolloClientConnectionTransform({ renameFiltersArgument })(
        connectionTransform,
      ),
    ])
    .documents()
    .map((doc) => (Printer.print as any)(ExtendedSchema, doc))
    .join("\n");

  return transformedText;
}

describe(emitApolloClientConnectionTransform, () => {
  it("invokes the wrapped connection transform and retains the directive", () => {
    const text = `
      fragment SomeConnectionFragment on User {
        comments(first: $commentCount, after: $commentCursor) @connection(key: "SomeUser_comments", filters: ["foo"]) {
          edges {
            node {
              canViewerComment
            }
          }
        }
      }
    `;

    expect(transform(text)).toMatchInlineSnapshot(`
      "fragment SomeConnectionFragment on User {
        comments(first: $commentCount, after: $commentCursor) @connection(key: "SomeUser_comments", filter: ["foo"]) {
          edges {
            node {
              canViewerComment
            }
            ... on CommentsEdge {
              cursor
              node {
                __typename
              }
            }
          }
          pageInfo {
            ... on PageInfo {
              endCursor
              hasNextPage
            }
          }
        }
      }
      "
    `);
  });

  it("keeps 'filters' argument name when renameFiltersArgument is false", () => {
    const text = `
      fragment SomeConnectionFragment on User {
        comments(first: $commentCount, after: $commentCursor) @connection(key: "SomeUser_comments", filters: ["foo"]) {
          edges {
            node {
              canViewerComment
            }
          }
        }
      }
    `;

    expect(transform(text, { renameFiltersArgument: false }))
      .toMatchInlineSnapshot(`
      "fragment SomeConnectionFragment on User {
        comments(first: $commentCount, after: $commentCursor) @connection(key: "SomeUser_comments", filters: ["foo"]) {
          edges {
            node {
              canViewerComment
            }
            ... on CommentsEdge {
              cursor
              node {
                __typename
              }
            }
          }
          pageInfo {
            ... on PageInfo {
              endCursor
              hasNextPage
            }
          }
        }
      }
      "
    `);
  });
});
