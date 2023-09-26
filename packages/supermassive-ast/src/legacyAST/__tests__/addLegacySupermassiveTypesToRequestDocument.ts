import { addLegacySupermassiveTypesToRequestDocument } from "../addLegacySupermassiveTypesToRequestDocument";

import { graphql } from "@graphitation/graphql-js-tag";
import { buildASTSchema } from "graphql";
import {
  FragmentDefinitionNode,
  InlineFragmentNode,
  FieldNode,
  OperationDefinitionNode,
} from "../LegacyTypedAST";

const schema = buildASTSchema(graphql`
  type Query {
    film(id: ID!): Film
    allFilms: [Film]
  }

  type Mutation {
    createFilm(
      input: CreateFilmInput! = { filmType: GOOD, title: "Default" }
      enumInput: FilmType!
    ): Film
  }

  type Film {
    title(foo: String = "Bar"): String!
    actors: [String!]
  }

  enum FilmType {
    GOOD
    BAD
  }

  input CreateFilmInput {
    title: String!
    filmType: FilmType!
  }
`);

describe(addLegacySupermassiveTypesToRequestDocument, () => {
  describe("concerning field selections", () => {
    it("adds a named type node", () => {
      const document = addLegacySupermassiveTypesToRequestDocument(
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
        {
          "kind": "NamedType",
          "name": {
            "kind": "Name",
            "value": "Film",
          },
        }
      `);
    });

    it("adds a non-null type node", () => {
      const document = addLegacySupermassiveTypesToRequestDocument(
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
        {
          "kind": "NonNullType",
          "type": {
            "kind": "NamedType",
            "name": {
              "kind": "Name",
              "value": "String",
            },
          },
        }
      `);
    });

    it("adds a list type node", () => {
      const document = addLegacySupermassiveTypesToRequestDocument(
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
        {
          "kind": "ListType",
          "type": {
            "kind": "NamedType",
            "name": {
              "kind": "Name",
              "value": "Film",
            },
          },
        }
      `);
    });

    it("adds a list type with non-null type node", () => {
      const document = addLegacySupermassiveTypesToRequestDocument(
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
        {
          "kind": "ListType",
          "type": {
            "kind": "NonNullType",
            "type": {
              "kind": "NamedType",
              "name": {
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
      const document = addLegacySupermassiveTypesToRequestDocument(
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
      const argumentNode = fieldNode.arguments?.[0];

      expect(argumentNode?.__type).toMatchInlineSnapshot(`
        {
          "kind": "NonNullType",
          "type": {
            "kind": "NamedType",
            "name": {
              "kind": "Name",
              "value": "ID",
            },
          },
        }
      `);
    });

    it("adds an input object type node", () => {
      const document = addLegacySupermassiveTypesToRequestDocument(
        schema,
        graphql`
          mutation Test($filmType: FilmType) {
            createFilm(
              input: { title: "The Phantom Menace", filmType: $filmType }
              enumInput: $filmType
            ) {
              title
            }
          }
        `,
      );

      const operationNode = document.definitions[0] as OperationDefinitionNode;
      const fieldNode = operationNode.selectionSet.selections[0] as FieldNode;
      const argumentNode = fieldNode.arguments?.[0];

      expect(argumentNode?.__type).toMatchInlineSnapshot(`
        {
          "kind": "NonNullType",
          "type": {
            "kind": "NamedType",
            "name": {
              "kind": "Name",
              "value": "CreateFilmInput",
            },
          },
        }
      `);

      expect(fieldNode.arguments?.[1]?.__type).toMatchInlineSnapshot(`
        {
          "kind": "NonNullType",
          "type": {
            "kind": "NamedType",
            "name": {
              "kind": "Name",
              "value": "FilmType",
            },
          },
        }
      `);

      const secondArgument = fieldNode.arguments?.[1];

      expect(secondArgument?.__type).toMatchInlineSnapshot(`
        {
          "kind": "NonNullType",
          "type": {
            "kind": "NamedType",
            "name": {
              "kind": "Name",
              "value": "FilmType",
            },
          },
        }
      `);

      expect(secondArgument?.__defaultValue).toMatchInlineSnapshot(`undefined`);
    });

    it("adds missing types with default values", () => {
      const document = addLegacySupermassiveTypesToRequestDocument(
        schema,
        graphql`
          mutation {
            createFilm(enumInput: GOOD) {
              title
            }
          }
        `,
      );

      const operationNode = document.definitions[0] as OperationDefinitionNode;
      const fieldNode = operationNode.selectionSet.selections[0] as FieldNode;
      const argumentNode = fieldNode.arguments?.[0];

      expect(argumentNode?.__type).toMatchInlineSnapshot(`
        {
          "kind": "NonNullType",
          "type": {
            "kind": "NamedType",
            "name": {
              "kind": "Name",
              "value": "FilmType",
            },
          },
        }
      `);

      expect(fieldNode.arguments?.[1]?.__type).toMatchInlineSnapshot(`
        {
          "kind": "NonNullType",
          "type": {
            "kind": "NamedType",
            "name": {
              "kind": "Name",
              "value": "CreateFilmInput",
            },
          },
        }
      `);
    });

    it("errors nicely for unknown fields", () => {
      expect(() => {
        addLegacySupermassiveTypesToRequestDocument(
          schema,
          graphql`
            query filmQuery {
              film(id: 42) {
                title
                format
              }
            }
          `,
        );
      }).toThrowError(
        "Cannot find type for field: query filmQuery.film.format",
      );

      expect(() => {
        addLegacySupermassiveTypesToRequestDocument(
          schema,
          graphql`
            query {
              film(id: 42) {
                title
                format
              }
            }
          `,
        );
      }).toThrowError("Cannot find type for field: query.film.format");

      expect(() => {
        addLegacySupermassiveTypesToRequestDocument(
          schema,
          graphql`
            query {
              film(ido: 42) {
                title
              }
            }
          `,
        );
      }).toThrowError("Cannot find type for argument: query.film.ido");
    });
  });
});
