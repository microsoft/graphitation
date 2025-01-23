import {
  parse,
  execute as graphQLExecute,
  subscribe as graphQLSubscribe,
  GraphQLSchema,
} from "graphql";
import { makeSchema } from "../benchmarks/swapi-schema";
import models from "../benchmarks/swapi-schema/models";
import { createExecutionUtils } from "../__testUtils__/execute";
import { executeWithoutSchema } from "../executeWithoutSchema";
import { encodeASTSchema } from "../utilities/encodeASTSchema";
import { ResolveInfo } from "../types";

const {
  compareResultsForExecuteWithSchema,
  compareResultForExecuteWithoutSchemaWithMVSAnnotation,
  drainExecution,
  graphqlExecuteOrSubscribe,
} = createExecutionUtils(graphQLExecute, graphQLSubscribe);

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
    __typename
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
      # TODO: separate field / arg for starships as async iterator (today it breaks with graphql-js >= 16)
      # starships {
      #  name
      # }
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
  // errors
  {
    name: "errors and nulls",
    document: `
    {
      person(id: 1) {
        name
        bubblingError
        bubblingListError
      }
    }
    `,
  },
  // subscription
  {
    name: "basic subscription with variables",
    document: `
  subscription emitPersons($limit: Int!) {
    emitPersons(limit: $limit) {
      name
      gender
    }
  }
 `,
    variables: {
      limit: 5,
    },
  },
  {
    name: "basic subscription with unused non-required variable",
    document: `
  subscription emitPersons($limit: Int!, $throwError: Boolean) {
    emitPersons(limit: $limit, throwError: $throwError) {
      name
      gender
    }
  }
 `,
    variables: {
      limit: 5,
    },
  },
  {
    name: "subscription throw an error",
    document: `
  subscription emitPersons($limit: Int!, $throwError: Boolean) {
    emitPersons(limit: $limit, throwError: $throwError) {
      name
      gender
    }
  }
 `,
    variables: {
      limit: 5,
      throwError: true,
    },
  },
  {
    name: "subscription throw an error in the middle",
    document: `
  subscription emitPersonsV2($limit: Int!, $emitError: Boolean) {
    emitPersonsV2(limit: $limit, emitError: $emitError) {
      name
      gender
    }
  }
 `,
    variables: {
      limit: 5,
      emitError: true,
    },
  },
  {
    name: "non-null query return null",
    document: `query { nonNullWithNull }`,
  },
  {
    name: "non-null subscription return null",
    document: `subscription { nonNullWithNull }`,
  },
  {
    name: "non-null query throw an error",
    document: `query { nonNullWithError }`,
  },
  {
    name: "non-null subscription throw in subscribe",
    document: `subscription { nonNullWithError }`,
  },
  {
    name: "non-null subscription throw in resolve",
    document: `subscription { nonNullWithErrorEvent }`,
  },
];

describe("graphql-js snapshot check to ensure test stability", () => {
  let schema: GraphQLSchema;
  beforeEach(() => {
    jest.resetAllMocks();
    schema = makeSchema();
  });

  test.each(testCases)("$name", async ({ document, variables }: TestCase) => {
    expect.assertions(1);
    const parsedDocument = parse(document);
    const result = await drainExecution(
      await graphqlExecuteOrSubscribe({
        schema,
        document: parsedDocument,
        contextValue: {
          models,
        },
        variableValues: variables,
      }),
    );
    expect(result).toMatchSnapshot();
  });
});

describe("executeWithSchema", () => {
  let schema: GraphQLSchema;
  beforeEach(() => {
    jest.resetAllMocks();
    schema = makeSchema();
  });

  test.each(testCases)("$name", async ({ document, variables }: TestCase) => {
    await compareResultsForExecuteWithSchema(schema, document, variables);
  });
});

describe("executeWithoutSchema - minimal viable schema annotation", () => {
  let schema: GraphQLSchema;
  beforeEach(() => {
    jest.resetAllMocks();
    schema = makeSchema();
  });
  test.each(testCases)("$name", async ({ document, variables }: TestCase) => {
    await compareResultForExecuteWithoutSchemaWithMVSAnnotation(
      schema,
      document,
      variables,
    );
  });
});

describe("executeWithoutSchema - regression tests", () => {
  test("Supports fieldNodes in ResolveInfo for backwards compatibility", async () => {
    let infoAtCallTime: ResolveInfo | undefined;

    const resolvers = {
      Query: {
        foo(_: unknown, __: unknown, ___: unknown, info: ResolveInfo) {
          infoAtCallTime = info;
        },
      },
    };
    const definitions = encodeASTSchema(parse("type Query { foo: String }"))[0];
    const document = parse(`{ foo, ... { foo } }`);

    await executeWithoutSchema({
      document,
      schemaFragment: { schemaId: "test", definitions, resolvers },
    });

    expect(infoAtCallTime?.fieldNodes?.length).toEqual(2);
    expect(infoAtCallTime?.fieldNodes[0].name.value).toEqual("foo");
    expect(infoAtCallTime?.fieldNodes[1].name.value).toEqual("foo");
  });
});
