import { parse } from "graphql";
import { mergeSchemaDefinitions } from "../mergeSchemaDefinitions";
import { encodeASTSchema } from "../encodeASTSchema";
import { SchemaDefinitions } from "../../schema/definition";

function schema(sdl: string): SchemaDefinitions[] {
  const doc = parse(sdl);
  return encodeASTSchema(doc);
}

describe("mergeSchemaDefinitions", () => {
  it("should copy interfaces from source when target interface has none", () => {
    const defs = schema(`
      interface Entity {
        id: ID
      }
      
      interface Entity implements Node & Named {
        name: String
      }
    `);
    const result = mergeSchemaDefinitions({ types: {}, directives: [] }, defs);
    expect(result).toMatchInlineSnapshot(`
      {
        "directives": [],
        "types": {
          "Entity": [
            3,
            {
              "id": 5,
              "name": 1,
            },
            [
              "Node",
              "Named",
            ],
          ],
        },
      }
    `);
  });

  it("should copy interfaces from source when interface extension has none", () => {
    const defs1 = schema(`
      extend interface Entity {
        id: ID
      }
    `);

    const defs2 = schema(` 
      interface Entity implements Node & Named {
        name: String
      }
    `);
    const mergeResult1 = mergeSchemaDefinitions(
      { types: {}, directives: [] },
      defs1,
    );

    const mergeResult2 = mergeSchemaDefinitions(mergeResult1, defs2);
    expect(mergeResult2).toMatchInlineSnapshot(`
      {
        "directives": [],
        "types": {
          "Entity": [
            3,
            {
              "id": 5,
              "name": 1,
            },
            [
              "Node",
              "Named",
            ],
          ],
        },
      }
    `);
  });
});
