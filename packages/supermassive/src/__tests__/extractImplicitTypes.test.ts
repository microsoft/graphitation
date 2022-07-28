import * as fs from "fs";
import * as path from "path";
import ts from "typescript";
import { isInputType, parse } from "graphql";
import { extractImplicitTypesToTypescript } from "../extractors/extractImplicitTypesToTypescript";
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
    expect(printedSource).toMatchSnapshot();
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
    expect(resolvers).toMatchSnapshot();
  });
});
