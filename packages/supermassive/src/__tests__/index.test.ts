import {
  parse,
  execute as graphQLExecute,
  TypedQueryDocumentNode,
} from "graphql";
import { execute } from "..";
import schema from "../../benchmarks/swapi-schema";
import models from "../../benchmarks/swapi-schema/models";
import resolvers from "../../benchmarks/swapi-schema/resolvers";
import { addTypesToRequestDocument } from "../ast/addTypesToRequestDocument";
import { Resolvers } from "../types";

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
      document: addTypesToRequestDocument(schema, document),
      contextValue: {
        models,
      },
      resolvers: (resolvers as unknown) as Resolvers<any, any>,
    });
    const validResult = await graphQLExecute({
      document,
      contextValue: {
        models,
      },
      schema,
    });
    expect(result).toEqual(validResult);
  });
});
