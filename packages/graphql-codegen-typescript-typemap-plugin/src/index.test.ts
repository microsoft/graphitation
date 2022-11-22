import { plugin } from ".";
import { buildSchema } from "graphql";

describe(plugin, () => {
  it("only includes public schema types", () => {
    const schema = buildSchema(`
      type Query {
        lowerCaseTypeName: lowerCaseTypeName!
      }
      type lowerCaseTypeName {
        id: ID!
      }
      type HTML {
        text: String
      }
    `);
    const result = plugin(schema, [], null);
    expect(result).toMatchInlineSnapshot(`
      "export type TypeMap = {
        \"Boolean\": Scalars[\"Boolean\"];
        \"HTML\": Html;
        \"ID\": Scalars[\"ID\"];
        \"Query\": Query;
        \"String\": Scalars[\"String\"];
        \"lowerCaseTypeName\": LowerCaseTypeName;
      };
      "
    `);
  });
});
