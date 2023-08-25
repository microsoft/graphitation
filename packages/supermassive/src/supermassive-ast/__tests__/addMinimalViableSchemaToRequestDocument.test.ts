import { extractMinimalViableSchemaForRequestDocument } from "../addMinimalViableSchemaToRequestDocument";

import { buildASTSchema, parse } from "graphql";
// import { FragmentDefinitionNode, InlineFragmentNode } from "../TypedAST";

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
`),
);

describe(extractMinimalViableSchemaForRequestDocument, () => {
  it("adds a named type node", () => {
    const mvs = extractMinimalViableSchemaForRequestDocument(
      schema,
      parse(`
      query {
        film(id: 42) {
          title
        }
      }
    `),
    );
    expect(mvs).toMatchInlineSnapshot(`
      "type Film implements Node {
        title(foo: String = "Bar"): String!
      }
      type Query {
        film(id: ID!): Film
      }"
    `);
  });

  it("with __typename only", () => {
    const mvs = extractMinimalViableSchemaForRequestDocument(
      schema,
      parse(`
        query {
          film(id: 42) {
            __typename
          }
        }
      `),
    );
    expect(mvs).toMatchInlineSnapshot(`
      "type Film implements Node
      type Query {
        film(id: ID!): Film
      }"
    `);
  });

  it("complex input objects", () => {
    const mvs = extractMinimalViableSchemaForRequestDocument(
      schema,
      parse(`
        query ($input: FilmFilterInput! = { genre: COMEDY }) {
          countFilms(filter: $input)
        }
      `),
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

  it("with interface - selected on interface, so all implementations are required", () => {
    const mvs = extractMinimalViableSchemaForRequestDocument(
      schema,
      parse(`
      query {
        node(id: 42) {
          id
          ... on Film {
            title
          }
        }
      }
    `),
    );
    expect(mvs).toMatchInlineSnapshot(`
      "type Film implements Node {
        id: ID!
        title(foo: String = "Bar"): String!
      }
      type Series implements Node {
        id: ID!
      }
      type Episode implements Node {
        id: ID!
      }
      interface Node {
        id: ID!
      }
      type Query {
        node(id: ID!): Node
      }"
    `);
  });

  it("with interface - selected on concrete fields, only those implementations are required", () => {
    const mvs = extractMinimalViableSchemaForRequestDocument(
      schema,
      parse(`
      query {
        node(id: 42) {
          ... on Film {
            id
            title
          }
          ... on Series {
            id
            title
          }
        }
      }
    `),
    );
    expect(mvs).toMatchInlineSnapshot(`
      "type Film implements Node {
        id: ID!
        title(foo: String = "Bar"): String!
      }
      interface Node {
        id: ID!
      }
      type Series implements Node {
        id: ID!
        title: String!
      }
      type Query {
        node(id: ID!): Node
      }"
    `);
  });

  it("with union", () => {
    const mvs = extractMinimalViableSchemaForRequestDocument(
      schema,
      parse(`
      query {
        screenable(id: 42) {
          ... on Film {
            id
            title
          }
        }
      }
    `),
    );
    expect(mvs).toMatchInlineSnapshot(`
      "type Film implements Node {
        id: ID!
        title(foo: String = "Bar"): String!
      }
      union Screenable = Film | Series | Episode
      type Query {
        screenable(id: ID!): Screenable
      }"
    `);
  });

  it("with union and interface", () => {
    const mvs = extractMinimalViableSchemaForRequestDocument(
      schema,
      parse(`
      query {
        screenable(id: 42) {
          ... on Node {
            id
          }
          ... on Film {
            id
            title
          }
        }
      }
    `),
    );
    expect(mvs).toMatchInlineSnapshot(`
      "type Film implements Node {
        id: ID!
        title(foo: String = "Bar"): String!
      }
      type Series implements Node {
        id: ID!
      }
      type Episode implements Node {
        id: ID!
      }
      interface Node {
        id: ID!
      }
      union Screenable = Film | Series | Episode
      type Query {
        screenable(id: ID!): Screenable
      }"
    `);
  });

  it("inputs and unions", () => {
    const mvs = extractMinimalViableSchemaForRequestDocument(
      schema,
      parse(`
      mutation Test($filmType: FilmType) {
        createFilm(
          input: { title: "The Phantom Menace", filmType: $filmType }
          enumInput: $filmType
        ) {
          title
        }
      }
    `),
    );
    expect(mvs).toMatchInlineSnapshot(`
      "type Film implements Node {
        title(foo: String = "Bar"): String!
      }
      type Mutation {
        createFilm(input: CreateFilmInput! = { title: "Default", filmType: GOOD }, enumInput: FilmType!): Film
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
});
