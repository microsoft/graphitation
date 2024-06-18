import { GraphQLRuleTester } from "@graphql-eslint/eslint-plugin";
import rule from "../non-nullable-fields";

const ruleTester = new GraphQLRuleTester();

ruleTester.runGraphQLTests("non-nullable-fields", rule, {
  valid: [
    {
      code: `
type ChatMessage {
  id: String!
  content: String
}`,
      options: [{ fields: ["id"] }],
    },
  ],
  invalid: [
    {
      code: `
type ChatMessage {
  id: String
  content: String
  someOtherImportantField: String
}`,
      options: [{ fields: ["id", "someOtherImportantField"] }],
      errors: 2,
    },
  ],
});
