import { encodeASTSchema } from "../encodeASTSchema";
import { swapiSDL } from "./fixtures/swapiSDL";
import { kitchenSinkSDL } from "./fixtures/kitchenSinkSDL";
import { descriptionsSDL } from "./fixtures/descriptionsSDL";

describe(encodeASTSchema, () => {
  test("correctly encodes swapi AST schema", () => {
    const encoded = encodeASTSchema(swapiSDL.document);
    expect(encoded).toMatchSnapshot();
  });

  test("correctly encodes kitchen sink AST schema", () => {
    const encoded = encodeASTSchema(kitchenSinkSDL.document);
    expect(encoded).toMatchSnapshot();
  });

  test("correctly encodes schema with directives when includeDirectives is true", () => {
    const encoded = encodeASTSchema(kitchenSinkSDL.document, {
      includeDirectives: true,
    });

    const schemaDefinitions = encoded[0];

    expect(schemaDefinitions.directives).toBeDefined();
    expect(schemaDefinitions.directives?.length).toBeGreaterThan(0);

    expect(encoded).toMatchSnapshot();
  });

  test("correctly encodes schema with descriptions when includeDescriptions is true", () => {
    const encoded = encodeASTSchema(descriptionsSDL.document, {
      includeDescriptions: true,
    });
    expect(encoded).toMatchSnapshot();

    const schemaDefinitions = encoded[0];
    const typeWithDescription = schemaDefinitions.types["TypeWithDescription"];
    expect(typeWithDescription).toMatchInlineSnapshot(`
      [
        2,
        {
          "fieldWithDescription": [
            3,
            undefined,
            {
              "description": {
                "block": true,
                "value": "Field Description",
              },
            },
          ],
        },
        [
          "Node",
        ],
        {
          "description": {
            "block": true,
            "value": "Type Description",
          },
        },
      ]
    `);

    const inputWithDescription =
      schemaDefinitions.types["AdvancedInputWithDescription"];

    expect(inputWithDescription).toMatchInlineSnapshot(`
      [
        6,
        {
          "enumField": "NodeType!",
        },
        {
          "description": {
            "block": true,
            "value": "Input Description
      second line
      third line",
          },
        },
      ]
    `);

    const enumWithDescription = schemaDefinitions.types["EnumWithDescription"];
    expect(enumWithDescription).toMatchInlineSnapshot(`
      [
        5,
        [
          "VALUE_WITH_DESCRIPTION",
        ],
        {
          "description": {
            "block": true,
            "value": "Enum Description",
          },
        },
      ]
    `);
  });

  test("correctly encodes schema with both directives and descriptions", () => {
    const encoded = encodeASTSchema(kitchenSinkSDL.document, {
      includeDirectives: true,
      includeDescriptions: true,
    });

    expect(encoded).toMatchSnapshot();
  });
});
