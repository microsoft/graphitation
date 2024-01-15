import { DocumentNode, visit, print } from "graphql";
import { decodeASTSchema } from "../decodeASTSchema";
import { encodeASTSchema } from "../encodeASTSchema";
import { kitchenSinkSDL } from "./fixtures/kitchenSinkSDL";
import { swapiSDL } from "./fixtures/swapiSDL";
import { mergeSchemaDefinitions } from "../mergeSchemaDefinitions";
import { schemaWithBooleanParameter } from "./fixtures/schemaWithBooleanParameter";

describe(decodeASTSchema, () => {
  test("correctly encodes swapi AST schema", () => {
    const doc = cleanUpDocument(swapiSDL.document);
    const encoded = encodeASTSchema(doc);
    const decoded = decodeASTSchema(encoded);

    expect(decoded).toEqual(doc);
    expect(encodeASTSchema(decoded)).toEqual(encoded);
    expect(print(decoded)).toMatchSnapshot();
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

  test("correctly encodes a schema with a Boolean parameter", () => {
    const doc = cleanUpDocument(schemaWithBooleanParameter.document);
    const encoded = encodeASTSchema(doc);
    const decoded = decodeASTSchema(encoded);

    expect(decoded).toEqual(doc);
    expect(encodeASTSchema(decoded)).toEqual(encoded);
    expect(print(decoded)).toMatchSnapshot();
  });
});

function cleanUpDocument(doc: DocumentNode): DocumentNode {
  return visit(doc, {
    enter(node: any) {
      delete node.description;
      delete node.loc;
      delete node.block;
      if (node.directives?.length === 0) {
        delete node.directives;
      }
      return node;
    },
  });
}
