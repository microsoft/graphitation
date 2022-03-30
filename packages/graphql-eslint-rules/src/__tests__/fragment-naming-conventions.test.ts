import { TextDecoder } from "util";
global.TextDecoder = TextDecoder as any;

import {
  GraphQLRuleTester,
  ParserOptions,
} from "@graphql-eslint/eslint-plugin";
import rule from "../fragment-naming-conventions";

const ruleTester = new GraphQLRuleTester();

const TEST_SCHEMA = /* GraphQL */ `
  type User {
    id: ID!
    name: String
  }
`;

const WITH_SCHEMA = {
  parserOptions: <ParserOptions>{
    schema: TEST_SCHEMA,
  },
};

const errorMessage =
  "Fragment should follow the naming conventions, the expected name is GraphqlEslintRulesUserFragment OR GraphqlEslintRulesUserFragment_optionalSuffix It's possible to chain suffixes using underscore";

ruleTester.runGraphQLTests(
  "fragment-naming-conventions",
  rule as any, // FIXME: Not casting this as any leads to ts(2590) error
  {
    valid: [
      {
        ...WITH_SCHEMA,
        filename: "src/user-query.graphql",
        code: `fragment GraphqlEslintRulesUserFragment on User { id name }`,
      },
      {
        ...WITH_SCHEMA,
        filename: "src/user-query.graphql",
        code: `fragment GraphqlEslintRulesUserFragment_optionalSuffix on User { id name }`,
      },
      {
        ...WITH_SCHEMA,
        filename: "src/user-query.graphql",
        code: `fragment GraphqlEslintRulesUserFragment_optionalSuffix_anotherOptionalSuffix on User { id name }`,
      },
    ],
    invalid: [
      {
        ...WITH_SCHEMA,
        filename: "src/user-query.graphql",
        code: `fragment graphql_eslint_rules_user_fragment on User { id name }`,
        output: "fragment GraphqlEslintRulesUserFragment on User { id name }",
        errors: [
          {
            message: errorMessage,
          },
        ],
      },
      {
        ...WITH_SCHEMA,
        filename: "src/user-query.graphql",
        code: `fragment GraphqlEslintRulesUserFragment_ on User { id name }`,
        output: "fragment GraphqlEslintRulesUserFragment on User { id name }",
        errors: [
          {
            message: errorMessage,
          },
        ],
      },
      {
        ...WITH_SCHEMA,
        filename: "src/user-query.graphql",
        code: `fragment GraphqlEslintRulesUser on User { id name }`,
        output: "fragment GraphqlEslintRulesUserFragment on User { id name }",
        errors: [
          {
            message: errorMessage,
          },
        ],
      },
      {
        ...WITH_SCHEMA,
        filename: "src/user-query.graphql",
        code: `fragment UserFragment on User { id name }`,
        output: "fragment GraphqlEslintRulesUserFragment on User { id name }",
        errors: [
          {
            message: errorMessage,
          },
        ],
      },
    ],
  },
);
