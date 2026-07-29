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
import missingApolloKeyFieldsRule, {
  parseKeySpecifier,
  keyFieldsForType,
} from "../missing-apollo-key-fields";
import { buildSchema, GraphQLObjectType } from "graphql";

const TEST_SCHEMA = /* GraphQL */ `
  type Query {
    hasId: HasId!
    noId: NoId!
    vehicles: [Vehicle!]!
    keyField: [KeyFieldType]!
    flying: [Flying!]!
    books: [Book!]!
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
  type Book {
    title: String!
    author: Author!
  }
  type Author {
    name: String!
    age: Int
  }
`;

const WITH_SCHEMA = {
  parserOptions: <ParserOptions>{
    schema: TEST_SCHEMA,
    operations: [
      `fragment HasIdFields on HasId {
        id
      }`,
      `fragment NestedHasIdFields on HasId {
        ...HasIdFields
      }`,
      `fragment DeeplyNestedHasIdFields on HasId {
        ...NestedHasIdFields
      }`,
      `fragment NestedNameOnly on HasId {
        ...NameOnly
      }`,
      `fragment NameOnly on HasId {
        name
      }`,
      `fragment InlineFragmentWithId on Vehicle {
        ...on Car {
          id
        }
      }`,
      `fragment BookAuthorName on Book {
        author {
          name
        }
      }`,
      `fragment AuthorName on Author {
        name
      }`,
    ],
  },
};
const ruleTester = new GraphQLRuleTester();

export const typePolicies = {
  KeyFieldType: {
    keyFields: ["objectId"],
  },
  Book: {
    keyFields: ["title", "author", ["name"]],
  },
};

ruleTester.runGraphQLTests(
  "missing-apollo-key-fields",
  missingApolloKeyFieldsRule as any, // FIXME: Not casting this as any leads to ts(2590) error
  {
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
        code: `query { hasId { ...NestedHasIdFields } }`,
        options: [{ typePolicies }],
      },
      {
        ...WITH_SCHEMA,
        code: `query { hasId { ...DeeplyNestedHasIdFields } }`,
        options: [{ typePolicies }],
      },
      {
        ...WITH_SCHEMA,
        code: `query { vehicles { ...InlineFragmentWithId } }`,
        options: [{ typePolicies }],
      },
      {
        ...WITH_SCHEMA,
        code: `query { books { title author { name } } }`,
        options: [{ typePolicies }],
      },
      {
        ...WITH_SCHEMA,
        code: `query { books { title author { name age } } }`,
        options: [{ typePolicies }],
      },
      {
        ...WITH_SCHEMA,
        code: `query { books { title ...BookAuthorName } }`,
        options: [{ typePolicies }],
      },
      {
        ...WITH_SCHEMA,
        code: `query { books { title author { ...AuthorName } } }`,
        options: [{ typePolicies }],
      },
      {
        ...WITH_SCHEMA,
        code: `query { hasId { name } }`,
        options: [{ typePolicies: { HasId: { keyFields: false } } }],
      },
      {
        ...WITH_SCHEMA,
        code: `query { hasId { name } }`,
        options: [{ typePolicies: { HasId: { keyFields: () => "id" } } }],
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
        output: `query { hasId { id\nname } }`,
        errors: [
          {
            message: `The key-field "id" must be selected for proper Apollo Client store denormalisation purposes.`,
          },
        ],
        options: [{ typePolicies }],
      },
      {
        ...WITH_SCHEMA,
        code: `query { keyField { id name } }`,
        output: `query { keyField { objectId\nid name } }`,
        errors: [
          {
            message: `The key-field "objectId" must be selected for proper Apollo Client store denormalisation purposes.`,
          },
        ],
        options: [{ typePolicies }],
      },
      {
        ...WITH_SCHEMA,
        code: `query { hasId { name ...NestedNameOnly } }`,
        output: `query { hasId { id\nname ...NestedNameOnly } }`,
        errors: [
          {
            message: `The key-field "id" must be selected for proper Apollo Client store denormalisation purposes.`,
          },
        ],
        options: [{ typePolicies }],
      },
      {
        ...WITH_SCHEMA,
        code: `query { books { author { name } } }`,
        output: `query { books { title\nauthor { name } } }`,
        errors: [
          {
            message: `The key-field "title" must be selected for proper Apollo Client store denormalisation purposes.`,
          },
        ],
        options: [{ typePolicies }],
      },
      {
        ...WITH_SCHEMA,
        code: `query { books { title author { age } } }`,
        errors: [
          {
            message: `The key-field "author.name" must be selected for proper Apollo Client store denormalisation purposes.`,
          },
        ],
        options: [{ typePolicies }],
      },
      {
        ...WITH_SCHEMA,
        code: `query { books { author { age } } }`,
        output: `query { books { title\nauthor { age } } }`,
        errors: [
          {
            message: `The key-fields "title and author.name" must be selected for proper Apollo Client store denormalisation purposes.`,
          },
        ],
        options: [{ typePolicies }],
      },
    ],
  },
);

describe("parseKeySpecifier", () => {
  it("parses a flat list of string key fields", () => {
    expect(parseKeySpecifier(["objectId"])).toEqual([{ name: "objectId" }]);
  });

  it("parses nested key specifiers attached to the preceding field", () => {
    expect(parseKeySpecifier(["title", "author", ["name"]])).toEqual([
      { name: "title" },
      { name: "author", nested: [{ name: "name" }] },
    ]);
  });

  it("parses deeply nested key specifiers", () => {
    expect(
      parseKeySpecifier(["author", ["name", "address", ["street"]]]),
    ).toEqual([
      {
        name: "author",
        nested: [
          { name: "name" },
          { name: "address", nested: [{ name: "street" }] },
        ],
      },
    ]);
  });

  it("throws when a key field is neither a string nor a nested specifier", () => {
    expect(() => parseKeySpecifier([42 as unknown as string])).toThrowError(
      "Expected keyFields to be an array of strings and nested key specifiers",
    );
  });

  it("throws when a nested specifier does not follow a field name", () => {
    expect(() => parseKeySpecifier([["name"]])).toThrowError(
      "Expected a field name to precede nested keyFields",
    );
  });
});

describe("keyFieldsForType", () => {
  const schema = buildSchema(TEST_SCHEMA);
  const hasId = schema.getType("HasId") as GraphQLObjectType;
  const noId = schema.getType("NoId") as GraphQLObjectType;

  it("falls back to `id` when no type policy is configured", () => {
    expect(keyFieldsForType(hasId, {})).toEqual([{ name: "id" }]);
  });

  it("returns no key fields for a type without `id` and no policy", () => {
    expect(keyFieldsForType(noId, {})).toEqual([]);
  });

  it("returns no required key fields when normalization is disabled with `false`", () => {
    expect(keyFieldsForType(hasId, { HasId: { keyFields: false } })).toEqual(
      [],
    );
  });

  it("returns no required key fields when keyFields is a function", () => {
    expect(
      keyFieldsForType(hasId, { HasId: { keyFields: () => "id" } }),
    ).toEqual([]);
  });

  it("parses configured array key fields", () => {
    expect(keyFieldsForType(hasId, { HasId: { keyFields: ["name"] } })).toEqual(
      [{ name: "name" }],
    );
  });
});
