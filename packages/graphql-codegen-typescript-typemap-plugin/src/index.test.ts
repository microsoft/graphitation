import { typeMapPlugin } from ".";
import { buildSchema } from "graphql";

describe(typeMapPlugin, () => {
  it("only includes public schema types", () => {
    const schema = buildSchema(`
      type Query {
        foo: Foo!
      }
      type Foo {
        id: ID!
      }
    `);
    const result = typeMapPlugin(schema);
    expect(result).toMatchInlineSnapshot(`
      "export type TypeMap = {
        \\"Boolean\\": Scalars[\\"Boolean\\"];
        \\"Foo\\": Foo;
        \\"ID\\": Scalars[\\"ID\\"];
        \\"Query\\": Query;
        \\"String\\": Scalars[\\"String\\"];
      };
      "
    `);
  });
});
