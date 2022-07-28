import { generateResolvers } from "../resolvers";
import ts from "typescript";
import { parse } from "graphql";
import graphql from "../../utilities/blankGraphQLTag";
import { extractContext } from "../directives";

describe(generateResolvers, () => {
  it("generates resolvers", () => {
    let resolvers = runResolverTest(graphql`
      type User {
        id: ID!
        name: String
      }

      extend type Query {
        userById(id: ID!): User
      }
    `);
    expect(resolvers).toMatchInlineSnapshot(`
      "import type { Context } from \\"./context.interface.ts\\";
      import type { ResolveInfo } from \\"@graphitation/supermassive\\";
      import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
      export declare module User {
          export type id = (model: models.UserModel, args: {}, context: Context, info: ResolveInfo) => PromiseOrValue<string>;
          export type name = (model: models.UserModel, args: {}, context: Context, info: ResolveInfo) => PromiseOrValue<string | null>;
      }
      export declare module Query {
          export type userById = (model: unknown, args: {
              id: string;
          }, context: Context, info: ResolveInfo) => PromiseOrValue<models.UserModel | null>;
      }
      "
    `);
  });
});

function runResolverTest(doc: string): string {
  let document = parse(doc);
  let context = extractContext({}, document);
  let resolvers = generateResolvers(context, document);
  let printer = ts.createPrinter();
  return printer.printFile(resolvers);
}
