import fs from "fs";
import path from "path";
import { parse, execute as graphQLExecute } from "graphql";
import { execute } from ".";
import schema from "../benchmarks/swapi-schema";
import resolvers from "../benchmarks/swapi-schema/resolvers";

describe("execute", () => {
  it("executes a basic query", async () => {
    const query = `
    {
      person(id: 1) {
        name
        gender
      }
    }`;
    const document = parse(query);

    expect.assertions(1);
    const result = await execute({
      resolvers,
      document,
    });
    const validResult = await graphQLExecute({
      schema,
      document,
    });
    expect(result).toEqual(validResult);
  });
});
