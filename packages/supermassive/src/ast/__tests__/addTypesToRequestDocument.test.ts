import {
  addTypesToRequestDocument,
  FieldNode,
  OperationDefinitionNode,
} from "../addTypesToRequestDocument";

import { graphql } from "@graphitation/graphql-js-tag";
import { buildASTSchema } from "graphql";
import { FragmentDefinitionNode, InlineFragmentNode } from "../TypedAST";

const schema = buildASTSchema(graphql`
  type Query {
    film(id: ID!): Film
    allFilms: [Film]
  }

  type Mutation {
    createFilm(input: CreateFilmInput!): Film
  }

  type Film {
    title: String!
    actors: [String!]
  }

  input CreateFilmInput {
    title: String!
  }
`);

describe(addTypesToRequestDocument, () => {
  describe("concerning field selections", () => {
    it("adds a named type node", () => {
      const document = addTypesToRequestDocument(
        schema,
        graphql`
          query {
            film(id: 42) {
              title
            }
          }
        `,
      );

      const operationNode = document.definitions[0] as OperationDefinitionNode;
      const fieldNode = operationNode.selectionSet.selections[0] as FieldNode;

      expect(fieldNode.__type).toMatchInlineSnapshot(`
        Object {
          "kind": "NamedType",
          "name": Object {
            "kind": "Name",
            "value": "Film",
          },
        }
      `);
    });

    it("adds a non-null type node", () => {
      const document = addTypesToRequestDocument(
        schema,
        graphql`
          fragment FilmFragment on Film {
            title
          }
        `,
      );

      const fragmentNode = document.definitions[0] as FragmentDefinitionNode;
      const fieldNode = fragmentNode.selectionSet.selections[0] as FieldNode;

      expect(fieldNode.__type).toMatchInlineSnapshot(`
        Object {
          "kind": "NonNullType",
          "type": Object {
            "kind": "NamedType",
            "name": Object {
              "kind": "Name",
              "value": "String",
            },
          },
        }
      `);
    });

    it("adds a list type node", () => {
      const document = addTypesToRequestDocument(
        schema,
        graphql`
          query {
            ... on Query {
              allFilms {
                title
              }
            }
          }
        `,
      );

      const operationNode = document.definitions[0] as OperationDefinitionNode;
      const inlineFragmentNode = operationNode.selectionSet
        .selections[0] as InlineFragmentNode;
      const fieldNode = inlineFragmentNode.selectionSet
        .selections[0] as FieldNode;

      expect(fieldNode.__type).toMatchInlineSnapshot(`
        Object {
          "kind": "ListType",
          "type": Object {
            "kind": "NamedType",
            "name": Object {
              "kind": "Name",
              "value": "Film",
            },
          },
        }
      `);
    });

    it("adds a list type with non-null type node", () => {
      const document = addTypesToRequestDocument(
        schema,
        graphql`
          fragment FilmFragment on Film {
            actors
          }
        `,
      );

      const fragmentNode = document.definitions[0] as FragmentDefinitionNode;
      const fieldNode = fragmentNode.selectionSet.selections[0] as FieldNode;

      expect(fieldNode.__type).toMatchInlineSnapshot(`
        Object {
          "kind": "ListType",
          "type": Object {
            "kind": "NonNullType",
            "type": Object {
              "kind": "NamedType",
              "name": Object {
                "kind": "Name",
                "value": "String",
              },
            },
          },
        }
      `);
    });
  });

  describe("concerning field arguments", () => {
    it("adds a scalar type node", () => {
      const document = addTypesToRequestDocument(
        schema,
        graphql`
          query {
            film(id: 42) {
              title
            }
          }
        `,
      );

      const operationNode = document.definitions[0] as OperationDefinitionNode;
      const fieldNode = operationNode.selectionSet.selections[0] as FieldNode;
      const argumentNode = fieldNode.arguments![0];

      expect(argumentNode.__type).toMatchInlineSnapshot(`
        Object {
          "kind": "NonNullType",
          "type": Object {
            "kind": "NamedType",
            "name": Object {
              "kind": "Name",
              "value": "ID",
            },
          },
        }
      `);
    });

    it("adds an input object type node", () => {
      const document = addTypesToRequestDocument(
        schema,
        graphql`
          mutation {
            createFilm(input: { title: "The Phantom Menace" }) {
              title
            }
          }
        `,
      );

      const operationNode = document.definitions[0] as OperationDefinitionNode;
      const fieldNode = operationNode.selectionSet.selections[0] as FieldNode;
      const argumentNode = fieldNode.arguments![0];

      expect(argumentNode.__type).toMatchInlineSnapshot(`
        Object {
          "kind": "NonNullType",
          "type": Object {
            "kind": "NamedType",
            "name": Object {
              "kind": "Name",
              "value": "CreateFilmInput",
            },
          },
        }
      `);
    });
  });
});
