import { DocumentNode, visit } from "graphql";
import { decodeASTSchema } from "../decodeASTSchema";
import { encodeASTSchema } from "../encodeASTSchema";
import { kitchenSinkSDL } from "./fixtures/kitchenSinkSDL";
import { swapiSDL } from "./fixtures/swapiSDL";
import { mergeSchemaDefinitions } from "../mergeSchemaDefinitions";

describe(encodeASTSchema, () => {
  test("correctly encodes swapi AST schema", () => {
    const doc = cleanUpDocument(swapiSDL.document);
    const encoded = encodeASTSchema(doc);
    const decoded = decodeASTSchema(encoded);

    expect(decoded).toEqual(doc);
    expect(encodeASTSchema(decoded)).toEqual(encoded);
    expect(decoded).toMatchSnapshot();
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
    expect(decoded).toMatchSnapshot();
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
