import { TextDecoder } from "util";
global.TextDecoder = TextDecoder as any;

import {
  GraphQLRuleTester,
  ParserOptions,
} from "@graphql-eslint/eslint-plugin";
import rule from "../operation-naming-conventions";

const ruleTester = new GraphQLRuleTester();

ruleTester.runGraphQLTests(
  "operation-naming-conventions",
  rule as any, // FIXME: Not casting this as any leads to ts(2590) error
  {
    valid: [
      {
        filename: "src/user-query.graphql",
        code: `query GraphqlEslintRulesUserQuery { user { id name } }`,
      },
    ],
    invalid: [
      {
        filename: "src/user-query.graphql",
        code: `query wrongName { user { id name } }`,
        output: `query GraphqlEslintRulesUserQuery { user { id name } }`,
        errors: [
          {
            message:
              "Operation should follow the naming conventions, the expected name is GraphqlEslintRulesUserQuery",
          },
        ],
      },
      {
        filename: "src/user.graphql",
        code: `query wrongNameQuery { user { id name } }`,
        output: `query wrongNameQuery { user { id name } }`,
        errors: [
          {
            message:
              "Filename should end with the operation name (query/mutation/subscription) e.g. foo-query.graphql",
          },
        ],
      },
    ],
  },
);
