import { parse, execute as graphQLExecute } from "graphql";
import { execute } from ".";
import schema from "../benchmarks/swapi-schema";
import models from "../benchmarks/swapi-schema/models";
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

    const args = {
      document,
      contextValue: {
        models,
      },
    };

    const result = await execute({ ...args, resolvers });
    const validResult = await graphQLExecute({ ...args, schema });
    expect(result).toEqual(validResult);
  });
});
