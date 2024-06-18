import {
  GraphQLRuleTester,
  ParserOptions,
} from "@graphql-eslint/eslint-plugin";
import rule from "../strict-non-nullable-variables";

const ruleTester = new GraphQLRuleTester();

const TEST_SCHEMA = /* GraphQL */ `
  type Query {
    sum(numbers: [Int!]!): Int
    sumSafe(numbers: [Int]!): Int
    addOne(number: Int!): Int
    addOneSafe(number: Int): Int
    addTwo(input: AddTwoInput!): Int
    addTwoSafe(input: AddTwoSafeInput!): Int
  }

  input AddTwoInput {
    left: Int!
    right: Int!
  }

  input AddTwoSafeInput {
    left: Int
    right: Int
  }
`;

const parserOptions: ParserOptions = {
  schema: TEST_SCHEMA,
  filePath: "test.graphql",
};

ruleTester.runGraphQLTests("strict-non-nullable-variables", rule, {
  valid: [
    {
      code: `
query Q ($number: Int! = 3) {
  sum(numbers: [1, $number, 3])
}`,
      parserOptions,
    },
    {
      code: `
query Q ($number: Int = 3) {
  sumSafe(numbers: [1, $number, 3])
}`,
      parserOptions,
    },
    {
      code: `
query Q ($number: Int! = 3) {
  addOne(number: $number)
}`,
      parserOptions,
    },
    {
      code: `
query Q ($number: Int = 3) {
  addOneSafe(number: $number)
}`,
      parserOptions,
    },
    {
      code: `
query Q ($number: Int! = 3) {
  addTwo(input: { left: $number, right: 4 })
}`,
      parserOptions,
    },
    {
      code: `
query Q ($number: Int = 3) {
  addTwoSafe(input: { left: 2, right: $number })
}`,
      parserOptions,
    },
  ],
  invalid: [
    {
      code: `
query Q ($number: Int = 3) {
  sum(numbers: [1, $number, 3])
}`,
      parserOptions,
      errors: 1,
    },
    {
      code: `
query Q ($number: Int = 3) {
  addOne(number: $number)
  addOneSafe(number: $number)
}`,
      parserOptions,
      errors: 1,
    },
    {
      code: `
query Q ($number: Int = 3) {
  addTwo(input: { left: $number, right: 2 })
}`,
      parserOptions,
      errors: 1,
    },
  ],
});
