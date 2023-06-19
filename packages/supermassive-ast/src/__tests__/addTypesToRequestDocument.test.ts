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
      const document = addTypesToRequestDocument(
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
      const document = addTypesToRequestDocument(
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
        addTypesToRequestDocument(
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
        addTypesToRequestDocument(
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
        addTypesToRequestDocument(
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

  it("supports built-in directives", () => {
    const document = addTypesToRequestDocument(
      schema,
      graphql`
        query {
          film(id: 42)
            @skip(if: false)
            @include(if: true)
            @stream(initialCount: 5) {
            title
          }
          ... on Query @defer(label: "DeferLabel") {
            film(id: 42) {
              title
            }
          }
        }
      `,
    );

    const operationNode = document.definitions[0] as OperationDefinitionNode;
    const fieldNode = operationNode.selectionSet.selections[0] as FieldNode;
    expect(fieldNode.directives?.map((d) => d.arguments))
      .toMatchInlineSnapshot(`
      [
        [
          {
            "__type": {
              "kind": "NonNullType",
              "type": {
                "kind": "NamedType",
                "name": {
                  "kind": "Name",
                  "value": "Boolean",
                },
              },
            },
            "kind": "Argument",
            "name": {
              "kind": "Name",
              "value": "if",
            },
            "value": {
              "kind": "BooleanValue",
              "value": false,
            },
          },
        ],
        [
          {
            "__type": {
              "kind": "NonNullType",
              "type": {
                "kind": "NamedType",
                "name": {
                  "kind": "Name",
                  "value": "Boolean",
                },
              },
            },
            "kind": "Argument",
            "name": {
              "kind": "Name",
              "value": "if",
            },
            "value": {
              "kind": "BooleanValue",
              "value": true,
            },
          },
        ],
        [
          {
            "__type": {
              "kind": "NamedType",
              "name": {
                "kind": "Name",
                "value": "Int",
              },
            },
            "kind": "Argument",
            "name": {
              "kind": "Name",
              "value": "initialCount",
            },
            "value": {
              "kind": "IntValue",
              "value": "5",
            },
          },
          {
            "__type": {
              "kind": "NonNullType",
              "type": {
                "kind": "NamedType",
                "name": {
                  "kind": "Name",
                  "value": "Boolean",
                },
              },
            },
            "kind": "Argument",
            "name": {
              "kind": "Name",
              "value": "if",
            },
            "value": {
              "kind": "BooleanValue",
              "value": true,
            },
          },
        ],
      ]
    `);
    const fragmentNode = operationNode.selectionSet
      .selections[1] as InlineFragmentNode;
    expect(fragmentNode.directives?.map((d) => d.arguments))
      .toMatchInlineSnapshot(`
      [
        [
          {
            "__type": {
              "kind": "NamedType",
              "name": {
                "kind": "Name",
                "value": "String",
              },
            },
            "kind": "Argument",
            "name": {
              "kind": "Name",
              "value": "label",
            },
            "value": {
              "block": false,
              "kind": "StringValue",
              "value": "DeferLabel",
            },
          },
          {
            "__type": {
              "kind": "NonNullType",
              "type": {
                "kind": "NamedType",
                "name": {
                  "kind": "Name",
                  "value": "Boolean",
                },
              },
            },
            "kind": "Argument",
            "name": {
              "kind": "Name",
              "value": "if",
            },
            "value": {
              "kind": "BooleanValue",
              "value": true,
            },
          },
        ],
      ]
    `);
  });

  it("do not error on ignored directives", () => {
    const document = addTypesToRequestDocument(
      schema,
      graphql`
        query {
          film(id: 42) {
            title @frobnirator(frobnarion: true)
          }
        }
      `,
      {
        ignoredDirectives: ["frobnirator"],
      },
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
});
