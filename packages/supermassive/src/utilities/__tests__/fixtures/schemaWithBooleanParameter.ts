import { gql } from "../../../__testUtils__/gql";

export const schemaWithBooleanParameter = gql`
  type Query {
    person(id: Int!): Person
  }

  type Person {
    name: String!
    phones(includeDefault: Boolean = true): [String!]!
  }
`;
