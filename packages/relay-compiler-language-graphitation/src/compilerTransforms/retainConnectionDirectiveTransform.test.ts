import { CompilerContext, Printer } from "relay-compiler";
import { transform as filterDirectivesTransform } from "relay-compiler/lib/transforms/FilterDirectivesTransform";
import { SCHEMA_EXTENSION } from "relay-compiler/lib/transforms/ConnectionTransform";
import { retainConnectionDirectiveTransform } from "./retainConnectionDirectiveTransform";

const { TestSchema, parseGraphQLText } = require("relay-test-utils-internal");

const ExtendedSchema = TestSchema.extend([SCHEMA_EXTENSION]);

function transform(text: string) {
  const { definitions } = parseGraphQLText(ExtendedSchema, text);

  const transformedText = new CompilerContext(ExtendedSchema)
    .addAll(definitions)
    .applyTransforms([
      retainConnectionDirectiveTransform(filterDirectivesTransform),
    ])
    .documents()
    .map((doc) => (Printer.print as any)(ExtendedSchema, doc))
    .join("\n");

  return transformedText;
}

describe(retainConnectionDirectiveTransform, () => {
  it("retains the connection directive", () => {
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
        comments(first: $commentCount, after: $commentCursor) @connection(key: \\"SomeUser_comments\\", filters: [\\"foo\\"]) {
          edges {
            node {
              canViewerComment
            }
          }
        }
      }
      "
    `);
  });
});
