import {
  buildASTSchema,
  GraphQLSchema,
  Kind,
  OperationDefinitionNode,
  parse,
  print,
} from "graphql";
import { addMinimalViableSchemaToRequestDocument } from "../addMinimalViableSchemaToRequestDocument";
import { filmSDL } from "./fixtures/filmSDL";

const schema = buildASTSchema(filmSDL.document);

describe(addMinimalViableSchemaToRequestDocument, () => {
  function testHelper(schema: GraphQLSchema, doc: string) {
    const processedDoc = addMinimalViableSchemaToRequestDocument(
      schema,
      parse(doc),
    );
    return {
      processedDoc,
      printedDoc: print(processedDoc),
      operationDefinition: processedDoc.definitions.find(
        (def): def is OperationDefinitionNode =>
          def.kind === Kind.OPERATION_DEFINITION,
      ),
    };
  }

  it("adds minimal viable schema to operation definition", () => {
    const { printedDoc } = testHelper(
      schema,
      `query @i18n(locale: "en_US") {
        film(id: 42) {
          __typename
        }
      }`,
    );
    expect(printedDoc).toMatchInlineSnapshot(`
      "query @i18n(locale: "en_US") @schema(definitions: "{\\"types\\":{\\"Query\\":[2,{\\"film\\":[\\"Film\\",{\\"id\\":9}]}],\\"Film\\":[2,{},[\\"Node\\"]]},\\"directives\\":[[\\"i18n\\",{\\"locale\\":0}]]}") {
        film(id: 42) {
          __typename
        }
      }"
    `);
  });

  it("adds minimal viable schema to a fragment", () => {
    const { printedDoc } = testHelper(
      schema,
      `fragment FilmFragment on Film {
        id
      }`,
    );
    expect(printedDoc).toMatchInlineSnapshot(`
      "fragment FilmFragment on Film @schema(definitions: "{\\"types\\":{\\"Film\\":[2,{\\"id\\":9},[\\"Node\\"]]}}") {
        id
      }"
    `);
  });

  it("adds minimal viable schema to every executable definition", () => {
    const { printedDoc } = testHelper(
      schema,
      `query {
        film(id: 42) {
          ...FilmFragment
        }
      }
      fragment FilmFragment on Film {
        ...FilmTitle
        ...FilmActors
      }
      fragment FilmTitle on Film {
        title
      }
      fragment FilmActors on Film {
        actors
      }
      `,
    );
    expect(printedDoc).toMatchInlineSnapshot(`
      "query @schema(definitions: "{\\"types\\":{\\"Query\\":[2,{\\"film\\":[\\"Film\\",{\\"id\\":9}]}],\\"Film\\":[2,{},[\\"Node\\"]]}}") {
        film(id: 42) {
          ...FilmFragment
        }
      }

      fragment FilmFragment on Film @schema(definitions: "{\\"types\\":{\\"Film\\":[2,{},[\\"Node\\"]]}}") {
        ...FilmTitle
        ...FilmActors
      }

      fragment FilmTitle on Film @schema(definitions: "{\\"types\\":{\\"Film\\":[2,{\\"title\\":[5,{\\"foo\\":[0,\\"Bar\\"]}]},[\\"Node\\"]]}}") {
        title
      }

      fragment FilmActors on Film @schema(definitions: "{\\"types\\":{\\"Film\\":[2,{\\"actors\\":15},[\\"Node\\"]]}}") {
        actors
      }"
    `);
  });

  it("is idempotent", () => {
    const run1 = testHelper(
      schema,
      `query @i18n(locale: "en_US") {
        film(id: 42) {
          __typename
        }
      }`,
    );
    const run2 = testHelper(schema, run1.printedDoc);
    expect(run2.printedDoc).toEqual(run1.printedDoc);
  });
});
