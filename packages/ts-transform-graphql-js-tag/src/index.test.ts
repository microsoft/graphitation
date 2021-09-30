import ts from "typescript";
import { Transformer } from "./transformerTestUtils";
import { getTransformer } from "./index";

describe("transformer tests", () => {
  it("should convert simple queries", () => {
    expect.assertions(1);
    const transformer = new Transformer()
      .addTransformer((program: ts.Program) => getTransformer({}))
      .addMock({
        name: "@graphitation/graphql-js-tag",
        content: `export const gql:any = () => {}`,
      })
      .setFilePath("/index.tsx");

    const actual = transformer.transform(`
       import { gql } from "@graphitation/graphql-js-tag"

       export const query = gql\`
         query Foo {
           foo
         }
        \`
    `);
    expect(actual).toMatchInlineSnapshot(`
      "export const query = { kind: \\"Document\\", definitions: [{ kind: \\"OperationDefinition\\", operation: \\"query\\", name: { kind: \\"Name\\", value: \\"Foo\\", loc: undefined }, variableDefinitions: [], directives: [], selectionSet: { kind: \\"SelectionSet\\", selections: [{ kind: \\"Field\\", alias: undefined, name: { kind: \\"Name\\", value: \\"foo\\", loc: undefined }, arguments: [], directives: [], selectionSet: undefined, loc: undefined }], loc: undefined }, loc: undefined }].concat([]) };
      "
    `);
  });

  it("should use fragments", () => {
    expect.assertions(1);
    const transformer = new Transformer()
      .addTransformer((program: ts.Program) => getTransformer({}))
      .addMock({
        name: "@graphitation/graphql-js-tag",
        content: `export const gql:any = () => {}`,
      })
      .setFilePath("/index.tsx");

    const actual = transformer.transform(`
       import { gql } from "@graphitation/graphql-js-tag"

       const fragment = gql\`
         fragment FooFragment on Foo {
           bar
         }
       \`

       export const query = gql\`
         query Foo {
           foo
           ...FooFragment
         }

         \${fragment}
        \`
    `);
    expect(actual).toMatchInlineSnapshot(`
      "const fragment = { kind: \\"Document\\", definitions: [{ kind: \\"FragmentDefinition\\", name: { kind: \\"Name\\", value: \\"FooFragment\\", loc: undefined }, typeCondition: { kind: \\"NamedType\\", name: { kind: \\"Name\\", value: \\"Foo\\", loc: undefined }, loc: undefined }, directives: [], selectionSet: { kind: \\"SelectionSet\\", selections: [{ kind: \\"Field\\", alias: undefined, name: { kind: \\"Name\\", value: \\"bar\\", loc: undefined }, arguments: [], directives: [], selectionSet: undefined, loc: undefined }], loc: undefined }, loc: undefined }].concat([]) };
      export const query = { kind: \\"Document\\", definitions: [{ kind: \\"OperationDefinition\\", operation: \\"query\\", name: { kind: \\"Name\\", value: \\"Foo\\", loc: undefined }, variableDefinitions: [], directives: [], selectionSet: { kind: \\"SelectionSet\\", selections: [{ kind: \\"Field\\", alias: undefined, name: { kind: \\"Name\\", value: \\"foo\\", loc: undefined }, arguments: [], directives: [], selectionSet: undefined, loc: undefined }, { kind: \\"FragmentSpread\\", name: { kind: \\"Name\\", value: \\"FooFragment\\", loc: undefined }, directives: [], loc: undefined }], loc: undefined }, loc: undefined }].concat(fragment.definitions) };
      "
    `);
  });
});
