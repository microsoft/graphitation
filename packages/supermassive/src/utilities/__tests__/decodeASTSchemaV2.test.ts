import { DocumentNode, visit, print } from "graphql";
import { decodeASTSchema } from "../decodeASTSchemaV2";
import { decodeASTSchema as decodeASTSchemaV1 } from "../decodeASTSchema";
import { encodeASTSchema } from "../encodeASTSchemaV2";
import { encodeASTSchema as encodeASTSchemaV1 } from "../encodeASTSchema";
import { kitchenSinkSDL } from "./fixtures/kitchenSinkSDL";
import { swapiSDL } from "./fixtures/swapiSDL";
import { mergeSchemaDefinitions } from "../mergeSchemaDefinitionsV2";
import { schemaWithBooleanParameter } from "./fixtures/schemaWithBooleanParameter";
import { descriptionsSDL } from "./fixtures/descriptionsSDL";

describe(decodeASTSchema, () => {
  test("correctly encodes swapi AST schema", () => {
    const doc = cleanUpDocument(swapiSDL.document);
    const encoded = encodeASTSchema(doc);
    const decoded = decodeASTSchema(encoded);

    expect(decoded).toEqual(doc);
    expect(encodeASTSchema(decoded)).toEqual(encoded);
    expect(print(decoded)).toMatchSnapshot();
  }); 

  test("correctly encodes description AST schema", () => {
    const decoded = decodeASTSchema(
      encodeASTSchema(descriptionsSDL.document, {
        includeDescriptions: true,
        includeDirectives: true,
      }),
    );
    expect(print(decoded)).toMatchInlineSnapshot(`
      """"Type Description"""
      type TypeWithDescription implements Node {
        """Field Description"""
        fieldWithDescription: Int
      }

      """
      Input Description
      second line
      third line
      """
      input AdvancedInputWithDescription {
        enumField: NodeType!
      }

      """Enum Description"""
      enum EnumWithDescription {
        VALUE_WITH_DESCRIPTION
      }

      """Directive Description"""
      directive @i18n(locale: String) on QUERY
      "
    `);
  });

  test("correctly encodes kitchen sink AST schema", () => {
    const doc = cleanUpDocument(kitchenSinkSDL.document);
    const encoded = [
      mergeSchemaDefinitions(
        { types: {}, directives: [] },
        encodeASTSchema(doc),
      ),
    ];
    const decoded = decodeASTSchema(encoded);
    expect(encodeASTSchema(decoded)).toEqual(encoded);
    expect(print(decoded)).toMatchSnapshot();
  });

  test("correctly encodes kitchen sink AST schema WITH enum values merged", () => {
    const doc = cleanUpDocument(kitchenSinkSDL.document);
    const encoded = [
      mergeSchemaDefinitions(
        { types: {}, directives: [] },
        encodeASTSchema(doc),
        { mergeEnumValues: true },
      ),
    ];
    const decoded = decodeASTSchema(encoded);
    expect(encodeASTSchema(decoded)).toEqual(encoded);
    expect(print(decoded)).toMatchSnapshot();
  });

  test("correctly encodes swapi AST schema with directives", () => {
    const doc = cleanUpDocument(swapiSDL.document);
    const encoded = encodeASTSchema(doc, { includeDirectives: true });
    const decoded = decodeASTSchema(encoded);

    expect(decoded).toEqual(doc);
    expect(encodeASTSchema(decoded, { includeDirectives: true })).toEqual(
      encoded,
    );
    expect(print(decoded)).toMatchSnapshot();
  });

  test("correctly encodes kitchen sink AST schema with directives", () => {
    const doc = cleanUpDocument(kitchenSinkSDL.document);
    const encoded = [
      mergeSchemaDefinitions(
        { types: {}, directives: [] },
        encodeASTSchema(doc, { includeDirectives: true }),
      ),
    ];
    const decoded = decodeASTSchema(encoded);
    expect(encodeASTSchema(decoded, { includeDirectives: true })).toEqual(
      encoded,
    );
    expect(print(decoded)).toMatchSnapshot();
  });

  test("correctly encodes a schema with a Boolean parameter", () => {
    const doc = cleanUpDocument(schemaWithBooleanParameter.document);
    const encoded = encodeASTSchema(doc);
    const decoded = decodeASTSchema(encoded);

    expect(decoded).toEqual(doc);
    expect(encodeASTSchema(decoded)).toEqual(encoded);
    expect(print(decoded)).toMatchSnapshot();
  });

  test("correctly handles schema directives", () => {
    const doc = cleanUpDocument(kitchenSinkSDL.document);
    const encoded = [
      mergeSchemaDefinitions(
        { types: {}, directives: [] },
        encodeASTSchema(doc, { includeDirectives: true }),
      ),
    ];
    const decoded = decodeASTSchema(encoded);

    const reEncoded = encodeASTSchema(decoded, { includeDirectives: true });
    expect(reEncoded).toEqual(encoded);
  });

  test("correctly handles schema descriptions", () => {
    const doc = cleanUpDocument(kitchenSinkSDL.document);
    const encoded = [
      mergeSchemaDefinitions(
        { types: {}, directives: [] },
        encodeASTSchema(doc, { includeDescriptions: true }),
      ),
    ];
    const decoded = decodeASTSchema(encoded);

    const reEncoded = encodeASTSchema(decoded, { includeDescriptions: true });
    expect(reEncoded).toEqual(encoded);
  });

  test("V1 and V2 round-trip produce the same output for swapi schema", () => {
    const doc = cleanUpDocument(swapiSDL.document);

    const v1Decoded = decodeASTSchemaV1(encodeASTSchemaV1(doc));
    const v2Decoded = decodeASTSchema(encodeASTSchema(doc));

    expect(print(v2Decoded)).toEqual(print(v1Decoded));
  });
});

function cleanUpDocument(doc: DocumentNode): DocumentNode {
  return visit(doc, {
    enter(node: any) {
      delete node.description;
      delete node.loc;
      delete node.block;
      if (node.directives?.length === 0 || node.directives == null) {
        delete node.directives;
      }
      // Enable for Gql 17
      // if (node.interfaces?.length === 0) {
      //   delete node.interfaces;
      // }
      return node;
    },
  });
}
