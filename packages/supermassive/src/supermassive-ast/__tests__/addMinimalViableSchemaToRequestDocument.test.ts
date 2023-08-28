import { extractMinimalViableSchemaForRequestDocument } from "../addMinimalViableSchemaToRequestDocument";

import { buildASTSchema, GraphQLSchema, parse, print } from "graphql";
import { decodeSchema } from "../../utilities/decodeASTSchema";

function extractSchemaFragmentForTest(
  schema: GraphQLSchema,
  doc: string,
  options?: {
    ignoredDirectives?: string[];
  },
) {
  const encodedFragment = extractMinimalViableSchemaForRequestDocument(
    schema,
    parse(doc),
    options,
  );
  return print(decodeSchema(encodedFragment));
}

const schema = buildASTSchema(
  parse(`
  type Query {
    film(id: ID!): Film
    allFilms: [Film!]!
    node(id: ID!): Node
    screenable(id: ID!): Screenable
    countFilms(filter: FilmFilterInput!): Int!
  }

  interface Node {
    id: ID!
  }

  union Screenable = Film | Series | Episode

  type Mutation {
    createFilm(
      input: CreateFilmInput! = { filmType: GOOD, title: "Default" }
      enumInput: FilmType!
    ): Film
  }

  type Film implements Node {
    id: ID!
    title(foo: String = "Bar"): String!
    actors: [String!]
  }

  type Series implements Node {
    id: ID!
    title: String!
    episodes: [Episode!]!
  }

  type Episode implements Node {
    id: ID!
    title: String!
  }

  enum FilmType {
    GOOD
    BAD
  }

  input CreateFilmInput {
    title: String!
    filmType: FilmType!
  }
  
  input FilmFilterInput {
    genre: FilmGenre
  }

  enum FilmGenre {
    COMEDY
    DRAMA
  }

  directive @i18n(locale: String) on QUERY
`),
);

describe(extractMinimalViableSchemaForRequestDocument, () => {
  it("extracts from operation", () => {
    const mvs = extractSchemaFragmentForTest(
      schema,
      `query {
        film(id: 42) {
          title
        }
      }`,
    );
    expect(mvs).toMatchInlineSnapshot(`
      "type Query {
        film(id: ID!): Film
      }

      type Film implements Node {
        title(foo: String = "Bar"): String!
      }"
    `);
  });

  it("extracts from a fragment", () => {
    const mvs = extractSchemaFragmentForTest(
      schema,
      `fragment MyQuery on Query {
        film(id: 42) {
          title
        }
      }`,
    );

    expect(mvs).toMatchInlineSnapshot(`
      "type Query {
        film(id: ID!): Film
      }

      type Film implements Node {
        title(foo: String = "Bar"): String!
      }"
    `);
  });

  it("extracts from inline fragment", () => {
    const mvs = extractSchemaFragmentForTest(
      schema,
      `query {
        ... on Query {
          allFilms {
            title
          }
        }
      }`,
    );

    expect(mvs).toMatchInlineSnapshot(`
      "type Query {
        allFilms: [Film!]!
      }

      type Film implements Node {
        title(foo: String = "Bar"): String!
      }"
    `);
  });

  it("extracts from an operation with fragments", () => {
    const mvs = extractSchemaFragmentForTest(
      schema,
      `query {
        ... on Query {
          film(id: 42) {
            ...FilmFragment
          }
        }
      }
      fragment FilmFragment on Film {
        title
      }`,
    );

    expect(mvs).toMatchInlineSnapshot(`
      "type Query {
        film(id: ID!): Film
      }

      type Film implements Node {
        title(foo: String = "Bar"): String!
      }"
    `);
  });

  it("extracts from multiple nested fragments", () => {
    const mvs = extractSchemaFragmentForTest(
      schema,
      `query {
        ... on Query {
          film(id: 42) {
            ...FilmFragment
          }
        }
      }
      fragment FilmFragment on Film {
        title
        ... on Film {
          ... on Film {
            ...FilActors
          }
        }
      }
      fragment FilmActors on Film {
        title
        actors
      }`,
    );

    expect(mvs).toMatchInlineSnapshot(`
      "type Query {
        film(id: ID!): Film
      }

      type Film implements Node {
        title(foo: String = "Bar"): String!
        actors: [String!]
      }"
    `);
  });

  describe("complex selections", () => {
    it("selects __typename on object", () => {
      const mvs = extractSchemaFragmentForTest(
        schema,
        `query {
          film(id: 42) {
            __typename
          }
        }`,
      );
      expect(mvs).toMatchInlineSnapshot(`
        "type Query {
          film(id: ID!): Film
        }

        type Film implements Node"
      `);
    });

    it("selects __typename on union", () => {
      const mvs = extractSchemaFragmentForTest(
        schema,
        `query {
          screenable(id: 42) {
            __typename
          }
        }`,
      );
      expect(mvs).toMatchInlineSnapshot(`
        "type Query {
          screenable(id: ID!): Screenable
        }

        union Screenable = Film | Series | Episode"
      `);
    });

    it("selects __typename only on interface", () => {
      const mvs = extractSchemaFragmentForTest(
        schema,
        `query {
          node(id: 42) {
            __typename
          }
        }`,
      );
      expect(mvs).toMatchInlineSnapshot(`
        "type Query {
          node(id: ID!): Node
        }

        interface Node"
      `);
    });

    it("selects interface fields only", () => {
      // Note: listing all implementations can be extremely expensive for shared interfaces
      //   instead, we use interface field definitions at runtime for object types
      // TODO: list all possible implementations as a part of encoded fragment
      const mvs = extractSchemaFragmentForTest(
        schema,
        `query {
          node(id: 42) {
            id
          }
        }`,
      );
      expect(mvs).toMatchInlineSnapshot(`
        "type Query {
          node(id: ID!): Node
        }

        interface Node {
          id: ID!
        }"
      `);
    });

    it("selects a mix of interface and specific object fields", () => {
      const mvs = extractSchemaFragmentForTest(
        schema,
        `query {
          node(id: 42) {
            id
            ... on Film {
              title
            }
          }
        }`,
      );
      expect(mvs).toMatchInlineSnapshot(`
        "type Query {
          node(id: ID!): Node
        }

        interface Node {
          id: ID!
        }

        type Film implements Node {
          title(foo: String = "Bar"): String!
        }"
      `);
    });

    it("selects interface fields on concrete types", () => {
      const mvs = extractSchemaFragmentForTest(
        schema,
        `query {
          node(id: 42) {
            ... on Film {
              id
            }
            ... on Series {
              id
              title
            }
          }
        }`,
      );
      expect(mvs).toMatchInlineSnapshot(`
        "type Query {
          node(id: ID!): Node
        }

        interface Node

        type Film implements Node {
          id: ID!
        }

        type Series implements Node {
          id: ID!
          title: String!
        }"
      `);
    });

    it("selects union member fields", () => {
      const mvs = extractSchemaFragmentForTest(
        schema,
        `query {
          screenable(id: 42) {
            ... on Film {
              id
              title
            }
          }
        }`,
      );
      expect(mvs).toMatchInlineSnapshot(`
        "type Query {
          screenable(id: ID!): Screenable
        }

        union Screenable = Film | Series | Episode

        type Film implements Node {
          id: ID!
          title(foo: String = "Bar"): String!
        }"
      `);
    });

    it("selects on union and interface", () => {
      const mvs = extractSchemaFragmentForTest(
        schema,
        `query {
        screenable(id: 42) {
          ... on Node {
            id
          }
          ... on Film {
            id
            title
          }
        }
      }`,
      );
      expect(mvs).toMatchInlineSnapshot(`
        "type Query {
          screenable(id: ID!): Screenable
        }

        union Screenable = Film | Series | Episode

        interface Node {
          id: ID!
        }

        type Film implements Node {
          id: ID!
          title(foo: String = "Bar"): String!
        }"
      `);
    });
  });

  describe("complex arguments", () => {
    it("supports inputs and enums", () => {
      const mvs = extractSchemaFragmentForTest(
        schema,
        `mutation Test($filmType: FilmType) {
          createFilm(
            input: { title: "The Phantom Menace", filmType: $filmType }
            enumInput: $filmType
          ) {
            title
          }
        }`,
      );
      expect(mvs).toMatchInlineSnapshot(`
        "type Mutation {
          createFilm(input: CreateFilmInput! = { title: "Default", filmType: GOOD }, enumInput: FilmType!): Film
        }

        type Film implements Node {
          title(foo: String = "Bar"): String!
        }

        input CreateFilmInput {
          title: String!
          filmType: FilmType!
        }

        enum FilmType {
          GOOD
          BAD
        }"
      `);
    });

    it("supports enums inside input objects", () => {
      const mvs = extractSchemaFragmentForTest(
        schema,
        `query ($input: FilmFilterInput! = { genre: COMEDY }) {
          countFilms(filter: $input)
        }`,
      );
      expect(mvs).toMatchInlineSnapshot(`
        "type Query {
          countFilms(filter: FilmFilterInput!): Int!
        }

        input FilmFilterInput {
          genre: FilmGenre
        }

        enum FilmGenre {
          COMEDY
          DRAMA
        }"
      `);
    });
  });

  describe("directives", () => {
    it("supports built-in directives", () => {
      const mvs = extractSchemaFragmentForTest(
        schema,
        `query {
          film(id: 42)
            @skip(if: false)
            @include(if: true)
            @stream(initialCount: 5) @defer(label: "DeferLabel") {
            title
          }
          ... on Query {
            film(id: 42) {
              title
            }
          }
        }`,
      );
      expect(mvs).toMatchInlineSnapshot(`
        "type Query {
          film(id: ID!): Film
        }

        type Film implements Node {
          title(foo: String = "Bar"): String!
        }"
      `);
    });

    it("errors on unknown directives", () => {
      expect(() => {
        extractSchemaFragmentForTest(
          schema,
          `query {
            film(id: 42) {
              title @frobnirator(frobnarion: true)
            }
          }`,
        );
      }).toThrowError(
        "Cannot find definition for directive: query.film.title @frobnirator",
      );
    });

    it("does not error on ignored directives", () => {
      expect(() => {
        extractSchemaFragmentForTest(
          schema,
          `query {
              film(id: 42) {
                title @frobnirator(frobnarion: true)
              }
            }
          `,
          {
            ignoredDirectives: ["frobnirator"],
          },
        );
      }).not.toThrow();
    });

    it("supports custom directives", () => {
      const mvs = extractSchemaFragmentForTest(
        schema,
        `query @i18n(locale: "en_US") {
          film(id: 42) {
            title
          }
        }`,
      );
      expect(mvs).toMatchInlineSnapshot(`
        "type Query {
          film(id: ID!): Film
        }

        type Film implements Node {
          title(foo: String = "Bar"): String!
        }

        directive @i18n(locale: String) on "
      `);
    });
  });

  it("errors nicely for unknown fields", () => {
    expect(() => {
      extractSchemaFragmentForTest(
        schema,
        `query filmQuery {
          film(id: 42) {
            title
            format
          }
        }`,
      );
    }).toThrowError("Cannot find field: query filmQuery.film.format");

    expect(() => {
      extractSchemaFragmentForTest(
        schema,
        `query {
          film(id: 42) {
            title
            format
          }
        }`,
      );
    }).toThrowError("Cannot find field: query.film.format");

    expect(() => {
      extractSchemaFragmentForTest(
        schema,
        `query {
          film(ido: 42) {
            title
          }
        }`,
      );
    }).toThrowError("Cannot find type for argument: query.film(ido: ...)");
  });
});
