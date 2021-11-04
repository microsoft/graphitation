import { CompilerContext, Printer } from "relay-compiler";
import { annotateFragmentReferenceTransform } from "./annotateFragmentReferenceTransform";

const { TestSchema, parseGraphQLText } = require("relay-test-utils-internal");

function transform(text: string) {
  const { definitions } = parseGraphQLText(TestSchema, text);

  const transformedText = new CompilerContext(TestSchema)
    .addAll(definitions)
    .applyTransforms([annotateFragmentReferenceTransform])
    .documents()
    .map((doc) => (Printer.print as any)(TestSchema, doc))
    .join("\n");

  return transformedText;
}

describe(annotateFragmentReferenceTransform, () => {
  it("annotates a fragment spread such that the hooks know where to inject the fragment reference metadata using an Apollo Client local-only field", () => {
    const text = `
      fragment SomeModule_someFragment on User {
        id
      }
      fragment SomeModule_anotherFragment on User {
        id
        ... {
          ...SomeModule_someFragment
        }
      }
      query SomeModuleQuery {
        me {
          id
          ...SomeModule_someFragment
        }
      }
    `;
    expect(transform(text)).toMatchInlineSnapshot(`
      "fragment SomeModule_someFragment on User {
        id
      }

      fragment SomeModule_anotherFragment on User {
        id
        ... on User {
          ...SomeModule_someFragment
          ... on Node {
            __fragments @client
          }
        }
      }

      query SomeModuleQuery {
        me {
          id
          ...SomeModule_someFragment
          ... on Node {
            __fragments @client
          }
        }
      }
      "
    `);
  });
});
