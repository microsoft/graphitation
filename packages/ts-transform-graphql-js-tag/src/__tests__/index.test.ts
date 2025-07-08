import ts from "typescript";
import { Transformer } from "../transformerTestUtils";
import {
  getArtefactImportTransformer,
  getRelayTransformer,
  getTransformer,
} from "../index";

describe("transformer tests", () => {
  it("should convert simple queries", () => {
    expect.assertions(1);
    const transformer = new Transformer()
      .addTransformer((_program: ts.Program) => getTransformer({}))
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
      "export const query = { kind: "Document", definitions: [{ kind: "OperationDefinition", operation: "query", name: { kind: "Name", value: "Foo", loc: undefined }, variableDefinitions: [], directives: [], selectionSet: { kind: "SelectionSet", selections: [{ kind: "Field", alias: undefined, name: { kind: "Name", value: "foo", loc: undefined }, arguments: [], directives: [], selectionSet: undefined, loc: undefined }], loc: undefined }, loc: undefined }].concat([]) };
      "
    `);
  });

  it("should use fragments", () => {
    expect.assertions(1);
    const transformer = new Transformer()
      .addTransformer((_program: ts.Program) => getTransformer({}))
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
      "const fragment = { kind: "Document", definitions: [{ kind: "FragmentDefinition", name: { kind: "Name", value: "FooFragment", loc: undefined }, typeCondition: { kind: "NamedType", name: { kind: "Name", value: "Foo", loc: undefined }, loc: undefined }, directives: [], selectionSet: { kind: "SelectionSet", selections: [{ kind: "Field", alias: undefined, name: { kind: "Name", value: "bar", loc: undefined }, arguments: [], directives: [], selectionSet: undefined, loc: undefined }], loc: undefined }, loc: undefined }].concat([]) };
      export const query = { kind: "Document", definitions: [{ kind: "OperationDefinition", operation: "query", name: { kind: "Name", value: "Foo", loc: undefined }, variableDefinitions: [], directives: [], selectionSet: { kind: "SelectionSet", selections: [{ kind: "Field", alias: undefined, name: { kind: "Name", value: "foo", loc: undefined }, arguments: [], directives: [], selectionSet: undefined, loc: undefined }, { kind: "FragmentSpread", name: { kind: "Name", value: "FooFragment", loc: undefined }, directives: [], loc: undefined }], loc: undefined }, loc: undefined }].concat(fragment.definitions) };
      "
    `);
  });

  it("should use multiple documents", () => {
    expect.assertions(1);
    const transformer = new Transformer()
      .addTransformer((_program: ts.Program) => getTransformer({}))
      .addMock({
        name: "@graphitation/graphql-js-tag",
        content: `export const graphql:any = () => {}`,
      })
      .setFilePath("/index.tsx");

    const actual = transformer.transform(`
      import { graphql } from "@graphitation/graphql-js-tag"

      const documents = graphql\`
        fragment FooFragment on Foo {
          bar
        }

        query Foo {
          foo
          ...FooFragment
        }
      \`
    `);
    expect(actual).toMatchInlineSnapshot(`
      "const documents = { kind: "Document", definitions: [{ kind: "FragmentDefinition", name: { kind: "Name", value: "FooFragment", loc: undefined }, typeCondition: { kind: "NamedType", name: { kind: "Name", value: "Foo", loc: undefined }, loc: undefined }, directives: [], selectionSet: { kind: "SelectionSet", selections: [{ kind: "Field", alias: undefined, name: { kind: "Name", value: "bar", loc: undefined }, arguments: [], directives: [], selectionSet: undefined, loc: undefined }], loc: undefined }, loc: undefined }, { kind: "OperationDefinition", operation: "query", name: { kind: "Name", value: "Foo", loc: undefined }, variableDefinitions: [], directives: [], selectionSet: { kind: "SelectionSet", selections: [{ kind: "Field", alias: undefined, name: { kind: "Name", value: "foo", loc: undefined }, arguments: [], directives: [], selectionSet: undefined, loc: undefined }, { kind: "FragmentSpread", name: { kind: "Name", value: "FooFragment", loc: undefined }, directives: [], loc: undefined }], loc: undefined }, loc: undefined }].concat([]) };
      export {};
      "
    `);
  });

  it("should apply transformer", () => {
    expect.assertions(1);
    const transformer = new Transformer()
      .addTransformer((_program: ts.Program) =>
        getTransformer({
          transformer: (_document) => "haha, imma here, breaking your graphql",
        }),
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
      "export const query = { kind: "Document", definitions: ["haha, imma here, breaking your graphql"].concat([]) };
      "
    `);
  });

  describe("graphql tag options", () => {
    it("should remove single import", () => {
      expect.assertions(1);
      const transformer = new Transformer()
        .addTransformer((_program: ts.Program) =>
          getTransformer({
            graphqlTagModule: "graphql-tag",
            graphqlTagModuleExport: "gql",
          }),
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
        "export const query = { kind: "Document", definitions: [{ kind: "OperationDefinition", operation: "query", name: { kind: "Name", value: "Foo", loc: undefined }, variableDefinitions: [], directives: [], selectionSet: { kind: "SelectionSet", selections: [{ kind: "Field", alias: undefined, name: { kind: "Name", value: "foo", loc: undefined }, arguments: [], directives: [], selectionSet: undefined, loc: undefined }], loc: undefined }, loc: undefined }].concat([]) };
        "
      `);
    });
    it("should remove single default import", () => {
      expect.assertions(1);
      const transformer = new Transformer()
        .addTransformer((_program: ts.Program) =>
          getTransformer({
            graphqlTagModuleExport: "default",
          }),
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
        "export const query = { kind: "Document", definitions: [{ kind: "OperationDefinition", operation: "query", name: { kind: "Name", value: "Foo", loc: undefined }, variableDefinitions: [], directives: [], selectionSet: { kind: "SelectionSet", selections: [{ kind: "Field", alias: undefined, name: { kind: "Name", value: "foo", loc: undefined }, arguments: [], directives: [], selectionSet: undefined, loc: undefined }], loc: undefined }, loc: undefined }].concat([]) };
        "
      `);
    });
    it("should keep different single import", () => {
      expect.assertions(1);
      const transformer = new Transformer()
        .addTransformer((_program: ts.Program) => getTransformer({}))
        .addMock({
          name: "@graphitation/graphql-js-tag",
          content: `export const graphql:any = () => {}, someOtherExport: any = 1;`,
        })
        .setFilePath("/index.tsx");

      const actual = transformer.transform(`
      import { someOtherExport } from "@graphitation/graphql-js-tag"
      `);
      expect(actual).toMatchInlineSnapshot(`
        "import { someOtherExport } from "@graphitation/graphql-js-tag";
        "
      `);
    });
    it("should keep different single import but remove itself", () => {
      expect.assertions(1);
      const transformer = new Transformer()
        .addTransformer((_program: ts.Program) => getTransformer({}))
        .addMock({
          name: "@graphitation/graphql-js-tag",
          content: `export const graphql:any = () => {}, someOtherExport: any = 1;`,
        })
        .setFilePath("/index.tsx");

      const actual = transformer.transform(`
      import { someOtherExport, graphql } from "@graphitation/graphql-js-tag"
      `);
      expect(actual).toMatchInlineSnapshot(`
        "import { someOtherExport } from "@graphitation/graphql-js-tag";
        "
      `);
    });
    it("should keep different default import", () => {
      expect.assertions(1);
      const transformer = new Transformer()
        .addTransformer((_program: ts.Program) => getTransformer({}))
        .addMock({
          name: "@graphitation/graphql-js-tag",
          content: `export const graphql:any = () => {}; const defaultExport = 1; export default defaultExport ;`,
        })
        .setFilePath("/index.tsx");

      // Needs usage to not be eliminated for some reason
      const actual = transformer.transform(`
        import someOtherDefault from "@graphitation/graphql-js-tag"

        someOtherDefault;
        `);
      expect(actual).toMatchInlineSnapshot(`
        "import someOtherDefault from "@graphitation/graphql-js-tag";
        someOtherDefault;
        "
      `);
    });
    it("should remove import, but keep default", () => {
      expect.assertions(1);
      const transformer = new Transformer()
        .addTransformer((_program: ts.Program) => getTransformer({}))
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
        "import someOtherDefault from "@graphitation/graphql-js-tag";
        export const query = { kind: "Document", definitions: [{ kind: "OperationDefinition", operation: "query", name: { kind: "Name", value: "Foo", loc: undefined }, variableDefinitions: [], directives: [], selectionSet: { kind: "SelectionSet", selections: [{ kind: "Field", alias: undefined, name: { kind: "Name", value: "foo", loc: undefined }, arguments: [], directives: [], selectionSet: undefined, loc: undefined }], loc: undefined }, loc: undefined }].concat([]) };
        "
      `);
    });
    it("should remove default, but keep imports", () => {
      expect.assertions(1);
      const transformer = new Transformer()
        .addTransformer((_program: ts.Program) =>
          getTransformer({
            graphqlTagModuleExport: "default",
          }),
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
        "import { someOtherExport } from "@graphitation/graphql-js-tag";
        export const query = { kind: "Document", definitions: [{ kind: "OperationDefinition", operation: "query", name: { kind: "Name", value: "Foo", loc: undefined }, variableDefinitions: [], directives: [], selectionSet: { kind: "SelectionSet", selections: [{ kind: "Field", alias: undefined, name: { kind: "Name", value: "foo", loc: undefined }, arguments: [], directives: [], selectionSet: undefined, loc: undefined }], loc: undefined }, loc: undefined }].concat([]) };
        "
      `);
    });
  });

  describe("relay transform mode", () => {
    it("should convert queries", () => {
      expect.assertions(1);
      const transformer = new Transformer()
        .addTransformer((_program: ts.Program) => getRelayTransformer({}))
        .addMock({
          name: "relay-runtime",
          content: `export type ConcreteRequest = any; export type Query = any;`,
        })
        .setFilePath("/index.tsx");

      const actual = transformer.transform(`
    import { ConcreteRequest, Query } from 'relay-runtime';

    const node: ConcreteRequest = (function(){
      return {
        "fragment": {},
        "kind": "Request",
        "operation": {},
        "params": {
          "cacheID": "d40e68211358413fd00f0d3e3a480fda",
          "id": null,
          "metadata": {},
          "name": "useSimpleCollabConversationFolderNameValidationQuery",
          "operationKind": "query",
          "text": "query Foo { foo }"
        }
      };
      })();
      
      (node as any).hash = "7b70df8117cf21bf42464a3c9e910ebd";
      
      export default node;
    `);
      expect(actual).toMatchInlineSnapshot(`
              "const node = (function () {
                  return {
                      "fragment": {},
                      "kind": "Request",
                      "operation": {},
                      "params": {
                          "cacheID": "d40e68211358413fd00f0d3e3a480fda",
                          "id": null,
                          "metadata": {},
                          "name": "useSimpleCollabConversationFolderNameValidationQuery",
                          "operationKind": "query",
                          "text": { kind: "Document", definitions: [{ kind: "OperationDefinition", operation: "query", name: { kind: "Name", value: "Foo", loc: undefined }, variableDefinitions: [], directives: [], selectionSet: { kind: "SelectionSet", selections: [{ kind: "Field", alias: undefined, name: { kind: "Name", value: "foo", loc: undefined }, arguments: [], directives: [], selectionSet: undefined, loc: undefined }], loc: undefined }, loc: undefined }].concat([]) }
                      }
                  };
              })();
              node.hash = "7b70df8117cf21bf42464a3c9e910ebd";
              export default node;
              "
          `);
    });
  });

  describe("import embedded document artefact", () => {
    it("replaces the embedded document with an import of the generated artefact", () => {
      expect.assertions(1);
      const transformer = new Transformer()
        .addTransformer((_program: ts.Program) =>
          getArtefactImportTransformer({}),
        )
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
        "import __graphql_tag_import_Foo from "./__generated__/Foo.graphql";
        import someOtherDefault from "@graphitation/graphql-js-tag";
        export const query = __graphql_tag_import_Foo;
        "
      `);
    });
  });

  describe("namespace imports", () => {
    it("should handle namespace imports without throwing error", () => {
      expect.assertions(1);
      const transformer = new Transformer()
        .addTransformer((_program: ts.Program) => getTransformer({}))
        .addMock({
          name: "@graphitation/graphql-js-tag",
          content: `export const graphql:any = () => {}`,
        })
        .setFilePath("/index.tsx");

      const actual = transformer.transform(`
      import * as GraphQLTag from "@graphitation/graphql-js-tag"
      `);
      // Should not throw an error and should produce some output
      expect(typeof actual).toBe("string");
    });

    it("should remove unused namespace import", () => {
      expect.assertions(1);
      const transformer = new Transformer()
        .addTransformer((_program: ts.Program) => getTransformer({}))
        .addMock({
          name: "@graphitation/graphql-js-tag",
          content: `export const graphql:any = () => {}`,
        })
        .setFilePath("/index.tsx");

      const actual = transformer.transform(`
      import * as GraphQLTag from "@graphitation/graphql-js-tag"
      `);
      expect(actual).toMatchInlineSnapshot(`
        "export {};
        "
      `);
    });

    it("should handle namespace import with used graphql tag", () => {
      expect.assertions(1);
      const transformer = new Transformer()
        .addTransformer((_program: ts.Program) => getTransformer({}))
        .addMock({
          name: "@graphitation/graphql-js-tag",
          content: `export const graphql:any = () => {}`,
        })
        .setFilePath("/index.tsx");

      const actual = transformer.transform(`
      import * as GraphQLTag from "@graphitation/graphql-js-tag"

      export const query = GraphQLTag.graphql\`
        query Foo {
          foo
        }
      \`
      `);
      expect(actual).toMatchInlineSnapshot(`
        "export const query = { kind: "Document", definitions: [{ kind: "OperationDefinition", operation: "query", name: { kind: "Name", value: "Foo", loc: undefined }, variableDefinitions: [], directives: [], selectionSet: { kind: "SelectionSet", selections: [{ kind: "Field", alias: undefined, name: { kind: "Name", value: "foo", loc: undefined }, arguments: [], directives: [], selectionSet: undefined, loc: undefined }], loc: undefined }, loc: undefined }].concat([]) };
        "
      `);
    });

    it("should handle namespace import with mixed usage", () => {
      expect.assertions(1);
      const transformer = new Transformer()
        .addTransformer((_program: ts.Program) => getTransformer({}))
        .addMock({
          name: "@graphitation/graphql-js-tag",
          content: `export const graphql:any = () => {}, someOtherExport: any = 1;`,
        })
        .setFilePath("/index.tsx");

      const actual = transformer.transform(`
      import * as GraphQLTag from "@graphitation/graphql-js-tag"

      export const query = GraphQLTag.graphql\`
        query Foo {
          foo
        }
      \`
      GraphQLTag.someOtherExport;
      `);
      expect(actual).toMatchInlineSnapshot(`
        "import * as GraphQLTag from "@graphitation/graphql-js-tag";
        export const query = { kind: "Document", definitions: [{ kind: "OperationDefinition", operation: "query", name: { kind: "Name", value: "Foo", loc: undefined }, variableDefinitions: [], directives: [], selectionSet: { kind: "SelectionSet", selections: [{ kind: "Field", alias: undefined, name: { kind: "Name", value: "foo", loc: undefined }, arguments: [], directives: [], selectionSet: undefined, loc: undefined }], loc: undefined }, loc: undefined }].concat([]) };
        GraphQLTag.someOtherExport;
        "
      `);
    });

    it("should handle multiple namespace imports from different modules", () => {
      expect.assertions(1);
      const transformer = new Transformer()
        .addTransformer((_program: ts.Program) => getTransformer({}))
        .addMock({
          name: "@graphitation/graphql-js-tag",
          content: `export const graphql:any = () => {}`,
        })
        .addMock({
          name: "other-module",
          content: `export const something:any = () => {}`,
        })
        .setFilePath("/index.tsx");

      const actual = transformer.transform(`
      import * as GraphQLTag from "@graphitation/graphql-js-tag"
      import * as Other from "other-module"

      export const query = GraphQLTag.graphql\`
        query Foo {
          foo
        }
      \`
      Other.something;
      `);
      expect(actual).toMatchInlineSnapshot(`
        "import * as Other from "other-module";
        export const query = { kind: "Document", definitions: [{ kind: "OperationDefinition", operation: "query", name: { kind: "Name", value: "Foo", loc: undefined }, variableDefinitions: [], directives: [], selectionSet: { kind: "SelectionSet", selections: [{ kind: "Field", alias: undefined, name: { kind: "Name", value: "foo", loc: undefined }, arguments: [], directives: [], selectionSet: undefined, loc: undefined }], loc: undefined }, loc: undefined }].concat([]) };
        Other.something;
        "
      `);
    });

    it("should handle namespace import with default export mode", () => {
      expect.assertions(1);
      const transformer = new Transformer()
        .addTransformer((_program: ts.Program) => getTransformer({
          graphqlTagModuleExport: "default"
        }))
        .addMock({
          name: "@graphitation/graphql-js-tag",
          content: `const graphql:any = () => {}; export default graphql;`,
        })
        .setFilePath("/index.tsx");

      const actual = transformer.transform(`
      import * as GraphQLTag from "@graphitation/graphql-js-tag"

      export const query = GraphQLTag.default\`
        query Foo {
          foo
        }
      \`
      `);
      expect(actual).toMatchInlineSnapshot(`
        "export const query = { kind: "Document", definitions: [{ kind: "OperationDefinition", operation: "query", name: { kind: "Name", value: "Foo", loc: undefined }, variableDefinitions: [], directives: [], selectionSet: { kind: "SelectionSet", selections: [{ kind: "Field", alias: undefined, name: { kind: "Name", value: "foo", loc: undefined }, arguments: [], directives: [], selectionSet: undefined, loc: undefined }], loc: undefined }, loc: undefined }].concat([]) };
        "
      `);
    });
  });
});
