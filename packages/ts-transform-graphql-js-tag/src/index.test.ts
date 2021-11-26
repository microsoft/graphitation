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
        content: `export const graphql:any = () => {}`,
      })
      .setFilePath("/index.tsx");

    const actual = transformer.transform(`
       import { graphql } from "@graphitation/graphql-js-tag"

       export const query = graphql\`
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
        content: `export const graphql:any = () => {}`,
      })
      .setFilePath("/index.tsx");

    const actual = transformer.transform(`
       import { graphql } from "@graphitation/graphql-js-tag"

       const fragment = graphql\`
         fragment FooFragment on Foo {
           bar
         }
       \`

       export const query = graphql\`
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

  it("should apply transformer", () => {
    expect.assertions(1);
    const transformer = new Transformer()
      .addTransformer((program: ts.Program) =>
        getTransformer({
          transformer: (document) => "haha, imma here, breaking your graphql",
        })
      )
      .addMock({
        name: "@graphitation/graphql-js-tag",
        content: `export const graphql:any = () => {}`,
      })
      .setFilePath("/index.tsx");

    const actual = transformer.transform(`
    import { graphql } from "@graphitation/graphql-js-tag"

    export const query = graphql\`
      query Foo {
        foo
      }
     \`
   `);
    expect(actual).toMatchInlineSnapshot(`
      "export const query = { kind: \\"Document\\", definitions: [\\"haha, imma here, breaking your graphql\\"].concat([]) };
      "
    `);
  });

  describe("graphql tag options", () => {
    it("should remove single import", () => {
      expect.assertions(1);
      const transformer = new Transformer()
        .addTransformer((program: ts.Program) =>
          getTransformer({
            graphqlTagModule: "graphql-tag",
            graphqlTagModuleExport: "gql",
          })
        )
        .addMock({
          name: "graphql-tag",
          content: `export const gql:any = () => {}`,
        })
        .setFilePath("/index.tsx");

      const actual = transformer.transform(`
      import { gql } from "graphql-tag"

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
    it("should remove single default import", () => {
      expect.assertions(1);
      const transformer = new Transformer()
        .addTransformer((program: ts.Program) =>
          getTransformer({
            graphqlTagModuleExport: "default",
          })
        )
        .addMock({
          name: "@graphitation/graphql-js-tag",
          content: `export default const graphql:any = () => {}`,
        })
        .setFilePath("/index.tsx");

      const actual = transformer.transform(`
      import graphql from "@graphitation/graphql-js-tag"

      export const query = graphql\`
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
    it("should keep different single import", () => {
      expect.assertions(1);
      const transformer = new Transformer()
        .addTransformer((program: ts.Program) => getTransformer({}))
        .addMock({
          name: "@graphitation/graphql-js-tag",
          content: `export const graphql:any = () => {}, someOtherExport: any = 1;`,
        })
        .setFilePath("/index.tsx");

      const actual = transformer.transform(`
      import { someOtherExport } from "@graphitation/graphql-js-tag"
      `);
      expect(actual).toMatchInlineSnapshot(`
        "import { someOtherExport } from \\"@graphitation/graphql-js-tag\\";
        "
      `);
    });
    it("should keep different default import", () => {
      expect.assertions(1);
      const transformer = new Transformer()
        .addTransformer((program: ts.Program) => getTransformer({}))
        .addMock({
          name: "@graphitation/graphql-js-tag",
          content: `export const graphql:any = () => {}; const defaultExport = 1; export default defaultExport ;`,
        })
        .setFilePath("/index.tsx");

      const actual = transformer.transform(`
        import someOtherDefault from "@graphitation/graphql-js-tag"
        `);
      expect(actual).toMatchInlineSnapshot(`
        "import someOtherDefault from \\"@graphitation/graphql-js-tag\\";
        "
      `);
    });
    it("should remove import, but keep default", () => {
      expect.assertions(1);
      const transformer = new Transformer()
        .addTransformer((program: ts.Program) => getTransformer({}))
        .addMock({
          name: "@graphitation/graphql-js-tag",
          content: `export const graphql:any = () => {}; const defaultExport = 1; export default defaultExport ;`,
        })
        .setFilePath("/index.tsx");

      const actual = transformer.transform(`
        import someOtherDefault, { graphql } from "@graphitation/graphql-js-tag"

        export const query = graphql\`
          query Foo {
            foo
          }
        \`
        `);
      expect(actual).toMatchInlineSnapshot(`
        "import someOtherDefault from \\"@graphitation/graphql-js-tag\\";
        export const query = { kind: \\"Document\\", definitions: [{ kind: \\"OperationDefinition\\", operation: \\"query\\", name: { kind: \\"Name\\", value: \\"Foo\\", loc: undefined }, variableDefinitions: [], directives: [], selectionSet: { kind: \\"SelectionSet\\", selections: [{ kind: \\"Field\\", alias: undefined, name: { kind: \\"Name\\", value: \\"foo\\", loc: undefined }, arguments: [], directives: [], selectionSet: undefined, loc: undefined }], loc: undefined }, loc: undefined }].concat([]) };
        "
      `);
    });
    it("should remove default, but keep imports", () => {
      expect.assertions(1);
      const transformer = new Transformer()
        .addTransformer((program: ts.Program) =>
          getTransformer({
            graphqlTagModuleExport: "default",
          })
        )
        .addMock({
          name: "@graphitation/graphql-js-tag",
          content: `export default const graphql:any = () => {}; export const someOtherExport: any = 5;`,
        })
        .setFilePath("/index.tsx");

      const actual = transformer.transform(`
      import graphql, { someOtherExport } from "@graphitation/graphql-js-tag"

      export const query = graphql\`
        query Foo {
          foo
        }
      \`
      `);
      expect(actual).toMatchInlineSnapshot(`
        "import { someOtherExport } from \\"@graphitation/graphql-js-tag\\";
        export const query = { kind: \\"Document\\", definitions: [{ kind: \\"OperationDefinition\\", operation: \\"query\\", name: { kind: \\"Name\\", value: \\"Foo\\", loc: undefined }, variableDefinitions: [], directives: [], selectionSet: { kind: \\"SelectionSet\\", selections: [{ kind: \\"Field\\", alias: undefined, name: { kind: \\"Name\\", value: \\"foo\\", loc: undefined }, arguments: [], directives: [], selectionSet: undefined, loc: undefined }], loc: undefined }, loc: undefined }].concat([]) };
        "
      `);
    });
  });
});
