import * as fs from "fs";
import * as path from "path";
import ts from "typescript";
import { parse } from "graphql";
import { extractImplicitTypesToTypescript } from "../extractImplicitTypesToTypescript";

describe(extractImplicitTypesToTypescript, () => {
  it("benchmark schema extract", () => {
    expect.assertions(1);
    const typeDefs = fs.readFileSync(
      path.join(
        __dirname,
        "../../../../examples/supermassive-benchmarks/src/swapi-schema/schema.graphql",
      ),
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
