import { CompilerContext, Printer } from "relay-compiler";
import { annotateFragmentReferenceTransform } from "../annotateFragmentReferenceTransform";

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
  describe("in order for hooks to know where to inject the fragment reference metadata using an Apollo Client local-only field", () => {
    it("annotates a Node fragment spread", () => {
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

    it("annotates a Query fragment spread", () => {
      const text = `
        fragment AnotherFragmentOnQuery on Query {
          __typename
        }
        fragment SomeFragmentOnQuery on Query {
          ... {
            ...AnotherFragmentOnQuery
          }
        }
        query SomeModuleQuery {
          ...SomeFragmentOnQuery
        }
      `;
      expect(transform(text)).toMatchInlineSnapshot(`
        "fragment AnotherFragmentOnQuery on Query {
          __typename
        }

        fragment SomeFragmentOnQuery on Query {
          ... on Query {
            ...AnotherFragmentOnQuery
            __fragments @client
          }
        }

        query SomeModuleQuery {
          ...SomeFragmentOnQuery
          __fragments @client
        }
        "
      `);
    });

    it("does not annotate fragment spreads on other types", () => {
      const text = `
        fragment AnotherFragmentOnNonNode on NonNode {
          __typename
        }
        fragment FragmentOnNonNode on NonNode {
          id
          ...AnotherFragmentOnNonNode
        }
        query SomeModuleQuery {
          neverNode {
            ...FragmentOnNonNode
          }
        }
      `;
      expect(transform(text)).toMatchInlineSnapshot(`
        "fragment AnotherFragmentOnNonNode on NonNode {
          __typename
        }

        fragment FragmentOnNonNode on NonNode {
          id
          ...AnotherFragmentOnNonNode
        }

        query SomeModuleQuery {
          neverNode {
            ...FragmentOnNonNode
          }
        }
        "
      `);
    });
  });
});
