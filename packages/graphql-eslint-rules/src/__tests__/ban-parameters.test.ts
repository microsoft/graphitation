import { GraphQLRuleTester } from "@graphql-eslint/eslint-plugin";
import rule from "../ban-parameters";

const ruleTester = new GraphQLRuleTester();

ruleTester.runGraphQLTests("ban-parameters", rule, {
  valid: [
    {
      code: `
extend type Query {
  messageOfTheDay(date: Date!): String
}`,
      options: [
        {
          bannedParameters: [
            {
              keywords: ["force", "correlationId"],
              description: "42",
            },
          ],
        },
      ],
    },
  ],
  invalid: [
    {
      code: `
extend type Query {
  messageOfTheDay(date: Date!, force: Boolean): String
}`,
      options: [
        {
          bannedParameters: [{ keywords: ["force"], description: "42" }],
        },
      ],
      errors: 1,
    },
    {
      code: `
extend type Query {
  messageOfTheDay(date: Date!, cacheBuster: Boolean): String
}`,
      options: [
        {
          bannedParameters: [
            { keywords: ["cache"], partialMatch: true, description: "42" },
          ],
        },
      ],
      errors: 1,
    },
    {
      code: `
extend type Query {
  messageOfTheDay(date: Date!, noCache: Boolean): String
}`,
      options: [
        {
          bannedParameters: [
            { keywords: ["cache"], partialMatch: true, description: "42" },
          ],
        },
      ],
      errors: 1,
    },
    {
      code: `
extend type Query {
  messageOfTheDay(date: Date!, cacheBuster: Boolean, force: Boolean): String
}`,
      options: [
        {
          bannedParameters: [
            { keywords: ["cache"], partialMatch: true, description: "42" },
            {
              keywords: ["force"],
              description: "don't do that.",
            },
          ],
        },
      ],
      errors: 2,
    },
  ],
});
