import { parse, execute as graphQLExecute, isInputType } from "graphql";
import { executeWithoutSchema, executeWithSchema } from "..";
import schema, { typeDefs } from "../benchmarks/swapi-schema";
import models from "../benchmarks/swapi-schema/models";
import resolvers from "../benchmarks/swapi-schema/resolvers";
import { addTypesToRequestDocument } from "../ast/addTypesToRequestDocument";
import { extractImplicitTypes } from "../extractImplicitTypes";
import { Resolvers } from "../types";
import { specifiedScalars } from "../values";

interface TestCase {
  name: string;
  document: string;
  variables?: Record<string, unknown>;
}

const testCases: Array<TestCase> = [
  {
    name: "basic query",
    document: `
  {
    person(id: 1) {
      name
      gender
    }
  }`,
  },
  {
    name: "basic query with variables",
    document: `
  query Person($id: Int!) {
    person(id: $id) {
      name
      gender
    }
  }
 `,
    variables: {
      id: 1,
    },
  },
  {
    name: "benchmark kitchen-sink query",
    document: `
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
    `,
  },
  {
    name: "query with union",
    document: `
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
    `,
  },
  {
    name: "query with interfaces",
    document: `
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
    `,
  },
  {
    name: "with __typename",
    document: `
query Person($id: Int!) {
  person(id: $id) {
    __typename
  }
}
`,
    variables: {
      id: 1,
    },
  },
];

describe("executeWithSchema", () => {
  testCases.forEach(({ name, document, variables }: TestCase) => {
    it(name, async () => {
      await compareResultsForExecuteWithSchema(document, variables);
    });
  });
});

describe("executeWithoutSchema", () => {
  testCases.forEach(({ name, document, variables }: TestCase) => {
    it(name, async () => {
      await compareResultsForExecuteWithoutSchema(document, variables);
    });
  });
});

async function compareResultsForExecuteWithSchema(
  query: string,
  variables?: Record<string, unknown>
) {
  expect.assertions(1);
  const document = parse(query);
  const result = await executeWithSchema({
    typeDefs,
    resolvers: (resolvers as unknown) as Resolvers<any, any>,
    document,
    contextValue: {
      models,
    },
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

async function compareResultsForExecuteWithoutSchema(
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
  const extractedResolvers: Resolvers<any, any> = extractImplicitTypes(
    typeDefs,
    getTypeByName
  );
  fullResolvers = {
    ...extractedResolvers,
    ...((resolvers as unknown) as Resolvers<any, any>),
  };
  const document = parse(query);
  const result = await executeWithoutSchema({
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
