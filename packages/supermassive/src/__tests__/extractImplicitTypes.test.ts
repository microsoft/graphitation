import * as fs from "fs";
import * as path from "path";
import ts from "typescript";
import { isInputType, parse } from "graphql";
import { extractImplicitTypesToTypescript } from "../extractImplicitTypesToTypescript";
import { extractImplicitTypes } from "../extractImplicitTypesRuntime";
import { specifiedScalars } from "../values";
import { Resolvers } from "..";

describe(extractImplicitTypesToTypescript, () => {
  it("benchmark schema extract", () => {
    expect.assertions(1);
    const typeDefs = fs.readFileSync(
      path.join(__dirname, "../benchmarks/swapi-schema/schema.graphql"),
      {
        encoding: "utf-8",
      },
    );
    const sourceFile = extractImplicitTypesToTypescript(parse(typeDefs));
    const printer = ts.createPrinter();
    const printedSource = printer.printNode(
      ts.EmitHint.SourceFile,
      sourceFile,
      sourceFile,
    );
    expect(printedSource).toMatchInlineSnapshot(`
    "import { GraphQLList, GraphQLNonNull, GraphQLID, GraphQLString, GraphQLInt, GraphQLFloat, GraphQLBoolean, GraphQLEnumType } from \\"graphql\\";
    const SearchResult = { __types: [\\"Person\\", \\"Starship\\", \\"Transport\\", \\"Species\\", \\"Vehicle\\", \\"Planet\\", \\"Film\\"], __resolveType: undefined };
    const NodeType = new GraphQLEnumType({ name: \\"NodeType\\", description: \\"\\", values: { Person: { description: \\"\\" }, Starship: { description: \\"\\" }, Transport: { description: \\"\\" }, Species: { description: \\"\\" }, Vehicle: { description: \\"\\" }, Planet: { description: \\"\\" }, Film: { description: \\"\\" } } });
    const Subscription = {};
    const Query = {};
    const Alive = { __types: [\\"Person\\", \\"Species\\"], __resolveType: undefined };
    const Film = {};
    const Vehicle = {};
    const Person = {};
    const Starship = {};
    const Planet = {};
    const Species = {};
    const Transport = {};
    const Node = { __implementedBy: [\\"Film\\", \\"Vehicle\\", \\"Person\\", \\"Starship\\", \\"Planet\\", \\"Species\\", \\"Transport\\"], __resolveType: undefined };
    export const resolvers = { SearchResult, NodeType, Subscription, Query, Node, Alive, Film, Vehicle, Person, Starship, Planet, Species, Transport };
    "
	    `);
  });
});

describe(extractImplicitTypes, () => {
  it("benchmark schema extract", () => {
    expect.assertions(1);
    const typeDefs = fs.readFileSync(
      path.join(__dirname, "../benchmarks/swapi-schema/schema.graphql"),
      {
        encoding: "utf-8",
      },
    );
    let resolvers: Resolvers = {};
    const getTypeByName = (name: string) => {
      const type = specifiedScalars[name] || resolvers[name];
      if (isInputType(type)) {
        return type;
      } else {
        throw new Error("Invalid type");
      }
    };
    resolvers = extractImplicitTypes(parse(typeDefs), getTypeByName);
    expect(resolvers).toMatchInlineSnapshot(`
    Object {
      "Alive": Object {
        "__resolveType": undefined,
        "__types": Array [
          "Person",
          "Species",
        ],
      },
      "Film": Object {},
      "Node": Object {
        "__implementedBy": Array [
          "Film",
          "Vehicle",
          "Person",
          "Starship",
          "Planet",
          "Species",
          "Transport",
        ],
        "__resolveType": undefined,
      },
      "NodeType": "NodeType",
      "Person": Object {},
      "Planet": Object {},
      "Query": Object {},
      "SearchResult": Object {
        "__resolveType": undefined,
        "__types": Array [
          "Person",
          "Starship",
          "Transport",
          "Species",
          "Vehicle",
          "Planet",
          "Film",
        ],
      },
      "Species": Object {},
      "Starship": Object {},
      "Subscription": Object {},
      "Transport": Object {},
      "Vehicle": Object {},
    }
  `);
  });
});
