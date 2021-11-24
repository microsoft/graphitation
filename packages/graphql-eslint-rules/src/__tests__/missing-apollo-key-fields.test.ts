/*
 * Taken from https://github.com/dotansimha/graphql-eslint/blob/300f73be802bdd06432a5df34939521d1ce0d93b/packages/plugin/tests/require-id-when-available.spec.ts
 * MIT license https://github.com/dotansimha/graphql-eslint/blob/300f73be802bdd06432a5df34939521d1ce0d93b/LICENSE
 */

import { TextDecoder } from "util";
global.TextDecoder = TextDecoder as any;

import {
  GraphQLRuleTester,
  ParserOptions,
} from "@graphql-eslint/eslint-plugin";
import rule, {
  REQUIRE_KEY_FIELDS_WHEN_AVAILABLE,
} from "../missing-apollo-key-fields";

const TEST_SCHEMA = /* GraphQL */ `
  type Query {
    hasId: HasId!
    noId: NoId!
    vehicles: [Vehicle!]!
    keyField: [KeyFieldType]!
    flying: [Flying!]!
  }
  type NoId {
    name: String!
  }
  interface Vehicle {
    id: ID!
  }
  type Car implements Vehicle {
    id: ID!
    mileage: Int
  }
  interface Flying {
    hasWings: Boolean!
  }
  type Bird implements Flying {
    id: ID!
    hasWings: Boolean!
  }
  type KeyFieldType {
    objectId: ID!
    name: String!
  }
  type HasId {
    id: ID!
    name: String!
  }
`;

const WITH_SCHEMA = {
  parserOptions: <ParserOptions>{
    schema: TEST_SCHEMA,
    operations: [
      `fragment HasIdFields on HasId {
        id
      }`,
    ],
  },
};
const ruleTester = new GraphQLRuleTester();

export const typePolicies = {
  KeyFieldType: {
    keyFields: ["objectId"],
  },
};

ruleTester.runGraphQLTests("missing-apollo-key-fields", rule, {
  valid: [
    {
      ...WITH_SCHEMA,
      code: `query { noId { name } }`,
      options: [{ typePolicies }],
    },
    {
      ...WITH_SCHEMA,
      code: `query { hasId { id name } }`,
      options: [{ typePolicies }],
    },
    {
      ...WITH_SCHEMA,
      code: `query { keyField { objectId name } }`,
      options: [{ typePolicies }],
    },
    {
      ...WITH_SCHEMA,
      code: `query { hasId { ...HasIdFields } }`,
      options: [{ typePolicies }],
    },
    {
      ...WITH_SCHEMA,
      code: `query { vehicles { id ...on Car { id mileage } } }`,
      options: [{ typePolicies }],
    },
    {
      ...WITH_SCHEMA,
      code: `query { vehicles { ...on Car { id mileage } } }`,
      options: [{ typePolicies }],
    },
    {
      ...WITH_SCHEMA,
      code: `query { flying { ...on Bird { id } } }`,
      options: [{ typePolicies }],
    },
    {
      ...WITH_SCHEMA,
      code: `query { vehicles { id ...on Car { mileage } } }`,
      options: [{ typePolicies }],
    },
  ],
  invalid: [
    {
      ...WITH_SCHEMA,
      code: `query { hasId { name } }`,
      errors: [{ messageId: REQUIRE_KEY_FIELDS_WHEN_AVAILABLE }],
      options: [{ typePolicies }],
    },
    {
      ...WITH_SCHEMA,
      code: `query { keyField { id name } }`,
      errors: [{ messageId: REQUIRE_KEY_FIELDS_WHEN_AVAILABLE }],
      options: [{ typePolicies }],
    },
  ],
});
