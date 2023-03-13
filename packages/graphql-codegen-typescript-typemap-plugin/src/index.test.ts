import { plugin } from ".";
import { buildSchema } from "graphql";

describe(plugin, () => {
  it("only includes public schema types", () => {
    const schema = buildSchema(`
      type Query {
        lowerCaseTypeName: lowerCaseTypeName!
        field: TypeWITHUnderscore_AndSomeCapitalCharacters
      }
      type lowerCaseTypeName {
        id: ID!
      }
      type HTML {
        text: String
      }
      type TypeWITHUnderscore_AndSomeCapitalCharacters {
        someField: String
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
        \"TypeWITHUnderscore_AndSomeCapitalCharacters\": TypeWithUnderscore_AndSomeCapitalCharacters;
        \"lowerCaseTypeName\": LowerCaseTypeName;
      };
      "
    `);
  });
});
