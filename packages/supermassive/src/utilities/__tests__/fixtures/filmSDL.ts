import { gql } from "../../../__testUtils__/gql";

export const filmSDL = gql`
  type Query {
    film(id: ID!): Film
    allFilms: [Film!]!
    node(id: ID!): Node
    screenable(id: ID!): Screenable
    countFilms(filter: FilmFilterInput): Int!
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
    deleteFilm(id: ID!): Boolean
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
`;
