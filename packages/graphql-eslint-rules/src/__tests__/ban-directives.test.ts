import { GraphQLRuleTester } from "@graphql-eslint/eslint-plugin";
import rule from "../ban-directives";

const ruleTester = new GraphQLRuleTester();

ruleTester.runGraphQLTests("ban-directives", rule, {
  valid: [
    {
      code: `
query myOperation {
  user
  description
}`,
      options: [{ bannedDirectives: ["client"] }],
    },
    {
      code: `
query myOperation {
  user @foobar
  description
}`,
      options: [{ bannedDirectives: ["client"] }],
    },
  ],
  invalid: [
    {
      code: `
query myOperation {
  user @client
  description @foobar
}`,
      options: [{ bannedDirectives: ["client"] }],
      errors: 1,
    },
    {
      code: `
query myOperation {
  user @client
  description @foobar
}`,
      options: [{ bannedDirectives: ["client", "foobar"] }],
      errors: 2,
    },
  ],
});
