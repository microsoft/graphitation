import { parse, execute as graphQLExecute, isInputType } from "graphql";
import { executeWithoutSchema, executeWithSchema } from "..";
import schema, { typeDefs } from "../benchmarks/swapi-schema";
import models from "../benchmarks/swapi-schema/models";
import resolvers from "../benchmarks/swapi-schema/resolvers";
import { addTypesToRequestDocument } from "../ast/addTypesToRequestDocument";
import { extractImplicitTypes } from "../extractImplicitTypesRuntime";
import { Resolvers, Resolver, UserResolvers } from "../types";
import { specifiedScalars } from "../values";
import { mergeResolvers } from "../utilities/mergeResolvers";
import { resolvers as extractedResolvers } from "../benchmarks/swapi-schema/__generated__/schema";

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
    name: "include directive TRUE",
    document: `
  query Person($id: Int!, $include: Boolean!) {
    person(id: $id) {
      name
      gender @include(if: $include)
    }
  }
 `,
    variables: {
      id: 1,
      include: true,
    },
  },
  {
    name: "include directive FALSE",
    document: `
  query Person($id: Int!, $include: Boolean!) {
    person(id: $id) {
      name
      gender @include(if: $include)
    }
  }
 `,
    variables: {
      id: 1,
      include: false,
    },
  },
  {
    name: "skip directive TRUE",
    document: `
  query Person($id: Int!, $skip: Boolean!) {
    person(id: $id) {
      name
      gender @skip(if: $skip)
    }
  }
 `,
    variables: {
      id: 1,
      skip: true,
    },
  },
  {
    name: "skip directive FALSE",
    document: `
  query Person($id: Int!, $skip: Boolean!) {
    person(id: $id) {
      name
      gender @skip(if: $skip)
    }
  }
 `,
    variables: {
      id: 1,
      skip: false,
    },
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
  {
    name: "union in interface fragment spread",
    document: `
    {
      person: node(nodeType: Person, id: 1) {
        ... on Alive {
          ... on Person {
            name
          }
        }
      }
    }
    `,
  },
  {
    name: "interface in union fragment spread",
    document: `
    {
      person: node(nodeType: Person, id: 1) {
        ... on Alive {
          ... on Node {
            id
          }
        }
      }
    }
    `,
  },
  {
    name: "interface in object fragment spread",
    document: `
    {
      person(id: 1) {
        ... on Node {
          id
        }
      }
    }
    `,
  },
  {
    name: "union in object fragment spread",
    document: `
    {
      person(id: 1) {
        ... on Alive {
          ... on Person {
            name
          }
        }
      }
    }
    `,
  },
  {
    name: "union in object fragment spread",
    document: `
    {
      person(id: 1) {
        ... on Vehicle {
          ... on Person {
            name
          }
        }
      }
    }
    `,
  },
  {
    name: "Default value in variables",
    document: `
    query ($title: String! = "The Empire Strikes Back") {
      searchFilmsByTitle(search: $title) {
        title
      }
    }`,
  },
  {
    name: "Default value",
    document: `
    {
      searchFilmsByTitle {
        title
      }
    }`,
  },
  {
    name: "Advanced Default value in variables",
    document: `
    query ($input: AdvancedInput! = { enumField: Film, otherField: "The Empire Strikes Back" }) {
      advancedDefaultInput(input: $input)
    }`,
  },
  {
    name: "Advanced Default value",
    document: `
    {
      advancedDefaultInput
    }`,
  },
  {
    name: "Not passing arg value vs passing arg value",
    document: `
    {
      multiArger
    }
    `,
  },
  {
    name: "Not passing arg value vs passing arg value",
    document: `
    {
      multiArger(a:null)
    }
    `,
  },
];

describe("executeWithSchema", () => {
  test.each(testCases)(
    "$name",
    async ({ name, document, variables }: TestCase) => {
      await compareResultsForExecuteWithSchema(document, variables);
    },
  );
});

describe("executeWithoutSchema", () => {
  test.each(testCases)(
    "$name",
    async ({ name, document, variables }: TestCase) => {
      await compareResultsForExecuteWithoutSchema(document, variables);
    },
  );
});

async function compareResultsForExecuteWithSchema(
  query: string,
  variables?: Record<string, unknown>,
) {
  expect.assertions(1);
  const document = parse(query);
  const result = await executeWithSchema({
    typeDefs,
    resolvers: resolvers as UserResolvers<any, any>,
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
  variables: Record<string, unknown> = {},
) {
  expect.assertions(1);
  const document = parse(query);
  const result = await executeWithoutSchema({
    document: addTypesToRequestDocument(schema, document),
    contextValue: {
      models,
    },
    resolvers: resolvers as UserResolvers,
    schemaResolvers: extractedResolvers,
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
  if (result.errors) {
    for (const error of result.errors) {
      console.error(error);
    }
  }
  expect(result).toEqual(validResult);
}
