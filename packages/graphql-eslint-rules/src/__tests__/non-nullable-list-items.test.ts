import { GraphQLRuleTester } from "@graphql-eslint/eslint-plugin";
import rule from "../non-nullable-list-items";

const ruleTester = new GraphQLRuleTester();

ruleTester.runGraphQLTests("non-nullable-list-items", rule, {
  valid: [
    {
      code: `
type SomeType {
  someArray: [Item!]
}`,
    },
  ],
  invalid: [
    {
      code: `
type SomeType {
  someArray: [Item]
}`,
      errors: 1,
    },
  ],
});
