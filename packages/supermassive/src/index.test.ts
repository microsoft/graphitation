import {
  parse,
  execute as graphQLExecute,
  TypedQueryDocumentNode,
} from "graphql";
import { execute } from ".";
import schema from "../benchmarks/swapi-schema";
import models from "../benchmarks/swapi-schema/models";
import resolvers from "../benchmarks/swapi-schema/resolvers";
import { Resolvers, TypeAnnotatedDocumentNode } from "./types";

describe("execute", () => {
  it.skip("executes a basic query", async () => {
    const query = `
    {
      person(id: 1) {
        name
        gender
      }
    }`;
    const document = parse(query);
    // console.log(JSON.stringify(document));

    expect.assertions(1);

    const args = {
      document: (document as unknown) as TypeAnnotatedDocumentNode,
      contextValue: {
        models,
      },
    };

    const result = await execute({
      ...args,
      resolvers: (resolvers as unknown) as Resolvers<any, any>,
    });
    const validResult = await graphQLExecute({ ...args, schema });
    expect(result).toEqual(validResult);
  });
});
