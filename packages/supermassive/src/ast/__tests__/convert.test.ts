import { buildASTSchema, parse as graphqlParse, print } from "graphql";
import { graphql } from "@graphitation/graphql-js-tag";
import { addTypesToRequestDocument } from "../addTypesToRequestDocument";
import { convertToPrintableDocument, convertToTypedDocument } from "../convert";

const schema = buildASTSchema(graphql`
  directive @preload(minutes: Int = 10) on FIELD

  type Query {
    film(id: ID!): Film
    allFilms: [Film]
  }

  type Mutation {
    createFilm(input: CreateFilmInput!): Film
  }

  enum DateFormat {
    US
    ISO
  }

  type Film {
    title: String!
    actors: [String!]
    cast(filter: CastFilterInput): [String!]!
    releaseDate(format: DateFormat = ISO): String
    sequels: [Film]
  }

  input CastFilterInput {
    name: String
    alsoSeenIn: ID
  }

  input CreateFilmInput {
    title: String!
  }
`);

describe("Conversion to printable document", () => {
  function parse(query: string) {
    const document = graphqlParse(query, { noLocation: true });
    const supermassiveDocument = addTypesToRequestDocument(schema, document);

    // Sanity-check: check conversion symmetry
    const printable = convertToPrintableDocument(supermassiveDocument);
    const reverted = convertToTypedDocument(printable);
    expect(reverted).toEqual(supermassiveDocument);

    return { document, supermassiveDocument };
  }

  it("provides type annotations for fields", () => {
    const { supermassiveDocument } = parse(`
      {
        allFilms {
          title
        }
      }
    `);
    const printable = convertToPrintableDocument(supermassiveDocument);
    const printed = print(printable);

    expect(printed).toMatchInlineSnapshot(`
      "query @types(fields: ["[Film]", "String!"], args: []) {
        allFilms {
          title
        }
      }
      "
    `);
  });

  it("provides type annotations for __typename field", () => {
    const { supermassiveDocument } = parse(`
      {
        __typename
        allFilms {
          title
          __typename
        }
      }
    `);
    const printable = convertToPrintableDocument(supermassiveDocument);
    const printed = print(printable);

    expect(printed).toMatchInlineSnapshot(`
      "query @types(fields: ["String!", "[Film]", "String!", "String!"], args: []) {
        __typename
        allFilms {
          title
          __typename
        }
      }
      "
    `);
  });

  it("provides type annotations for multiple level of fields", () => {
    const { supermassiveDocument } = parse(`
      {
        allFilms {
          title
          sequels {
            title
            sequels {
              title
              __typename
            }
          }
        }
      }
    `);
    const printable = convertToPrintableDocument(supermassiveDocument);
    const printed = print(printable);

    expect(printed).toMatchInlineSnapshot(`
      "query @types(fields: ["[Film]", "String!", "[Film]", "String!", "[Film]", "String!", "String!"], args: []) {
        allFilms {
          title
          sequels {
            title
            sequels {
              title
              __typename
            }
          }
        }
      }
      "
    `);
  });

  it("provides type annotations for fields inside inline fragments", () => {
    const { supermassiveDocument } = parse(`
      {
        allFilms {
          title
          ... {
            title
            sequels { title }
          }
        }
      }
    `);
    const printable = convertToPrintableDocument(supermassiveDocument);
    const printed = print(printable);

    expect(printed).toMatchInlineSnapshot(`
      "query @types(fields: ["[Film]", "String!", "String!", "[Film]", "String!"], args: []) {
        allFilms {
          title
          ... {
            title
            sequels {
              title
            }
          }
        }
      }
      "
    `);
  });

  it("provides type annotations for fields inside named fragments", () => {
    const { supermassiveDocument } = parse(`
      {
        allFilms {
          title
          ...FilmSequels
        }
      }
      fragment FilmSequels on Film {
        sequels { title }
      }
    `);
    const printable = convertToPrintableDocument(supermassiveDocument);
    const printed = print(printable);

    expect(printed).toMatchInlineSnapshot(`
      "query @types(fields: ["[Film]", "String!"], args: []) {
        allFilms {
          title
          ...FilmSequels
        }
      }

      fragment FilmSequels on Film @types(fields: ["[Film]", "String!"], args: []) {
        sequels {
          title
        }
      }
      "
    `);
  });

  it("provides type annotations for arguments", () => {
    const { supermassiveDocument } = parse(`
      {
        film(id: "1") {
          title
        }
      }
    `);
    const printable = convertToPrintableDocument(supermassiveDocument);
    const printed = print(printable);

    expect(printed).toMatchInlineSnapshot(`
      "query @types(fields: ["Film", "String!"], args: ["ID!"]) {
        film(id: "1") {
          title
        }
      }
      "
    `);
  });

  it("provides type annotations for arguments of nested fields", () => {
    const { supermassiveDocument } = parse(`
      {
        film(id: "1") {
          releaseDate(format: US)
        }
      }
    `);
    const printable = convertToPrintableDocument(supermassiveDocument);
    const printed = print(printable);

    expect(printed).toMatchInlineSnapshot(`
      "query @types(fields: ["Film", "String"], args: ["ID!", "DateFormat"]) {
        film(id: "1") {
          releaseDate(format: US)
        }
      }
      "
    `);
  });

  it("provides type annotations for arguments inside named fragments", () => {
    const { supermassiveDocument } = parse(`
      {
        film(id: "1") {
          ...SequelReleaseDate
        }
      }
      fragment SequelReleaseDate on Film {
        sequels { releaseDate(format: US) }
      }
    `);
    const printable = convertToPrintableDocument(supermassiveDocument);
    const printed = print(printable);

    expect(printed).toMatchInlineSnapshot(`
      "query @types(fields: ["Film"], args: ["ID!"]) {
        film(id: "1") {
          ...SequelReleaseDate
        }
      }

      fragment SequelReleaseDate on Film @types(fields: ["[Film]", "String"], args: ["DateFormat"]) {
        sequels {
          releaseDate(format: US)
        }
      }
      "
    `);
  });

  it("provides type annotations for directive arguments", () => {
    const { supermassiveDocument } = parse(`
      {
        film(id: "1") @preload(minutes: 5) {
          title
        }
      }
    `);
    const printable = convertToPrintableDocument(supermassiveDocument);
    const printed = print(printable);

    expect(printed).toMatchInlineSnapshot(`
      "query @types(fields: ["Film", "String!"], args: ["ID!", "Int"]) {
        film(id: "1") @preload(minutes: 5) {
          title
        }
      }
      "
    `);
  });

  // TODO!
  it.skip("inlines directive argument default value when argument is omitted", () => {
    const { supermassiveDocument } = parse(`
      {
        film(id: "1") @preload {
          title
        }
      }
    `);
    const printable = convertToPrintableDocument(supermassiveDocument);
    const printed = print(printable);

    expect(printed).toMatchInlineSnapshot(`
      "query @types(fields: ["Film", "String!"], args: ["ID!"]) {
        film(id: "1") @preload(minutes: 10) {
          title
        }
      }
      "
    `);
  });

  it("provides type annotation for directive argument default value when variable is used", () => {
    const { supermassiveDocument } = parse(`
      query($preloadMinutes: Int) {
        film(id: "1") @preload(minutes: $preloadMinutes) {
          title
        }
      }
    `);
    const printable = convertToPrintableDocument(supermassiveDocument);
    const printed = print(printable);

    expect(printed).toMatchInlineSnapshot(`
      "query ($preloadMinutes: Int) @types(fields: ["Film", "String!"], args: ["ID!", "'Int=10'"]) {
        film(id: "1") @preload(minutes: $preloadMinutes) {
          title
        }
      }
      "
    `);
  });

  it("inlines argument default value when argument is omitted", () => {
    const { supermassiveDocument } = parse(`
      {
        film(id: "1") {
          releaseDate
        }
      }
    `);
    const printable = convertToPrintableDocument(supermassiveDocument);
    const printed = print(printable);

    expect(printed).toMatchInlineSnapshot(`
      "query @types(fields: ["Film", "String"], args: ["ID!", "DateFormat"]) {
        film(id: "1") {
          releaseDate(format: ISO)
        }
      }
      "
    `);
  });

  it("provides type annotation for default argument value when variable is used", () => {
    const { supermassiveDocument } = parse(`
      query ($id: ID!, $dateFormat: DateFormat) {
        film(id: $id) {
          releaseDate(format: $dateFormat)
        }
      }
    `);
    const printable = convertToPrintableDocument(supermassiveDocument);
    const printed = print(printable);

    expect(printed).toMatchInlineSnapshot(`
      "query ($id: ID!, $dateFormat: DateFormat) @types(fields: ["Film", "String"], args: ["ID!", "'DateFormat=ISO'"]) {
        film(id: $id) {
          releaseDate(format: $dateFormat)
        }
      }
      "
    `);
  });

  it("is not confused by different argument default values in schema and variables", () => {
    const { supermassiveDocument } = parse(`
      query ($id: ID!, $dateFormat: DateFormat=US) {
        film(id: $id) {
          releaseDate(format: $dateFormat)
        }
      }
    `);
    const printable = convertToPrintableDocument(supermassiveDocument);
    const printed = print(printable);

    expect(printed).toMatchInlineSnapshot(`
      "query ($id: ID!, $dateFormat: DateFormat = US) @types(fields: ["Film", "String"], args: ["ID!", "'DateFormat=ISO'"]) {
        film(id: $id) {
          releaseDate(format: $dateFormat)
        }
      }
      "
    `);
  });
});
