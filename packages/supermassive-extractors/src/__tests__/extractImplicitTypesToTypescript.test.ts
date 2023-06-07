import * as fs from "fs";
import * as path from "path";
import ts from "typescript";
import { parse } from "graphql";
import {
  extractAndPrintImplicitTypesToTypescript,
  extractImplicitTypesToTypescript,
} from "../extractImplicitTypesToTypescript";

describe(extractImplicitTypesToTypescript, () => {
  it("benchmark schema extract", () => {
    expect.assertions(2);
    const typeDefs = fs.readFileSync(
      path.join(
        __dirname,
        "../../../supermassive/src/benchmarks/swapi-schema/schema.graphql",
      ),
      {
        encoding: "utf-8",
      },
    );
    const document = parse(typeDefs);
    const sourceFile = extractImplicitTypesToTypescript(document);
    const printer = ts.createPrinter();
    const printedSource = printer.printNode(
      ts.EmitHint.SourceFile,
      sourceFile,
      sourceFile,
    );
    const printed = extractAndPrintImplicitTypesToTypescript(document);
    expect(printedSource).toMatchSnapshot();
    expect(printed).toEqual(printedSource);
  });
});
