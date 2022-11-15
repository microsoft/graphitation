import * as fs from "fs";
import * as path from "path";
import { isInputType, parse } from "graphql";
import { extractImplicitTypes } from "../extractImplicitTypesRuntime";
import { specifiedScalars } from "../values";
import { Resolvers } from "..";

describe(extractImplicitTypes, () => {
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
