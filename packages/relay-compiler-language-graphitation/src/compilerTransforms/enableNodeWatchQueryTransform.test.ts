import { CompilerContext, Printer } from "relay-compiler";
import { enableNodeWatchQueryTransform } from "./enableNodeWatchQueryTransform";

const { TestSchema, parseGraphQLText } = require("relay-test-utils-internal");

function transform(text: string) {
  const { definitions } = parseGraphQLText(TestSchema, text);

  const transformedText = new CompilerContext(TestSchema)
    .addAll(definitions)
    .applyTransforms([enableNodeWatchQueryTransform])
    .documents()
    .map((doc) => (Printer.print as any)(TestSchema, doc))
    .join("\n");

  return transformedText;
}

describe(enableNodeWatchQueryTransform, () => {
  it("adds Relay's @refetchable directive to fragments on types that implement Node", () => {
    const text = `
      fragment SomeModule_onNodeTypeFragment on User {
        id
      }
    `;

    expect(transform(text)).toMatchInlineSnapshot(`
      "fragment SomeModule_onNodeTypeFragment on User @refetchable(queryName: "SomeModule_onNodeTypeWatchNodeQuery") {
        id
      }
      "
    `);
  });

  it("adds Relay's @refetchable directive to fragments on the Query type", () => {
    const text = `
      fragment SomeModule_onQueryTypeFragment on Query {
        neverNode {
          ... on NonNode {
            id
          }
        }
      }
    `;

    expect(transform(text)).toMatchInlineSnapshot(`
      "fragment SomeModule_onQueryTypeFragment on Query @refetchable(queryName: "SomeModule_onQueryTypeWatchNodeQuery") {
        neverNode {
          ... on NonNode {
            id
          }
        }
      }
      "
    `);
  });

  it("does not add to fragments on other types", () => {
    const text = `
      fragment SomeModule_notOnNodeTypeFragment on FakeNode {
        id
      }
    `;
    expect(transform(text)).toMatchInlineSnapshot(`
      "fragment SomeModule_notOnNodeTypeFragment on FakeNode {
        id
      }
      "
    `);
  });
});
