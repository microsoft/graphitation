import { readFileSync } from "fs";
import { join } from "path";
import {
  parse,
  execute as graphQLExecute,
  TypedQueryDocumentNode,
  isInputType,
} from "graphql";
import { execute } from "..";
import schema from "../../benchmarks/swapi-schema";
import models from "../../benchmarks/swapi-schema/models";
import resolvers from "../../benchmarks/swapi-schema/resolvers";
import { addTypesToRequestDocument } from "../ast/addTypesToRequestDocument";
import { extractImplicitTypes } from "../extractImplicitTypes";
import { Resolvers } from "../types";
import { specifiedScalars } from "../values";

describe("execute", () => {
  it("executes a basic query", async () => {
    await compareQueryResults(`
    {
      person(id: 1) {
        name
        gender
      }
    }`);
  });

  it("executes basic query with variables", async () => {
    await compareQueryResults(
      `
    query Person($id: Int!) {
      person(id: $id) {
        name
        gender
      }
    }
   `,
      {
        id: 1,
      }
    );
  });

  it("executes benchmark kitchen-sink query", async () => {
    await compareQueryResults(`
    {
      empireHero: person(id: 1) {
        ...PersonFields
        height
        mass
      }
    
      jediHero: person(id: 4) {
        ...PersonFields
      }
    }
    
    fragment PersonFields on Person {
      name
      gender
      birth_year
      starships {
        name
      }
    }  
    `);
  });

  it("executes query with unions", async () => {
    await compareQueryResults(`
    {
      search(search: "Lu") {
        __typename
        ...on Person {
          name
        }
        ...on Planet {
          name
        }
        ... on Transport {
          name
        }
        ... on Species {
          name
        }
        ... on Vehicle{
          name
        }
      }
    }
    `);
  });

  it("executes query with interfaces", async () => {
    await compareQueryResults(`
    {
      person: node(nodeType: Person, id: 1) {
        ... on Person {
          name
        }
      }
      vehicle: node(nodeType: Vehicle, id: 14) {
        ... on Vehicle {
          name
        }
      }
    }
    `);
  });
});

async function compareQueryResults(
  query: string,
  variables: Record<string, unknown> = {}
) {
  expect.assertions(1);
  let fullResolvers: Resolvers<any, any> = {};
  const getTypeByName = (name: string) => {
    const type = specifiedScalars[name] || extractedResolvers[name];
    if (isInputType(type)) {
      return type;
    } else {
      throw new Error("Invalid type");
    }
  };
  const typeDefs = readFileSync(
    join(__dirname, "../../benchmarks/swapi-schema/schema.graphql"),
    {
      encoding: "utf-8",
    }
  );
  const extractedResolvers: Resolvers<any, any> = extractImplicitTypes(
    parse(typeDefs),
    getTypeByName
  );
  fullResolvers = {
    ...extractedResolvers,
    ...((resolvers as unknown) as Resolvers<any, any>),
  };
  const document = parse(query);
  const result = await execute({
    document: addTypesToRequestDocument(schema, document),
    contextValue: {
      models,
    },
    resolvers: fullResolvers,
    variableValues: variables,
  });
  const validResult = await graphQLExecute({
    document,
    contextValue: {
      models,
    },
    schema,
    variableValues: variables,
  });
  expect(result).toEqual(validResult);
}
