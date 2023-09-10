import {
  parse,
  GraphQLSchema,
  experimentalExecuteIncrementally as graphQLExecute,
  experimentalSubscribeIncrementally as graphQLSubscribe,
} from "graphql";
import { makeSchema } from "../benchmarks/swapi-schema";
import models from "../benchmarks/swapi-schema/models";
import { createExecutionUtils } from "../__testUtils__/execute";

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
      # This is async iterator
      starships {
        name
      }
    }  
    `,
  },
  // defer
  {
    name: "@defer on inline fragment",
    document: `
    {
      person(id: 1) {
        name
        ... on Person @defer {
          gender
          birth_year
        }
      }
    }
    `,
  },
  {
    name: "@defer on fragment",
    document: `
    {
      person(id: 1) {
        name
        ...DeferredPerson @defer
      }
    }

    fragment DeferredPerson on Person {
      gender
      birth_year
    }
    `,
  },
  {
    name: "@defer multiple fragments",
    document: `
    {
      person(id: 1) {
        name
        ... on Person @defer {
          gender
        }
        ...DeferredPerson @defer
      }
    }

    fragment DeferredPerson on Person {
      birth_year
    }
    `,
  },
  {
    name: "@defer overlapping fragment",
    document: `
    {
      person(id: 1) {
        name
        ... on Person @defer {
          gender
        }
        ...DeferredPerson @defer
      }
    }

    fragment DeferredPerson on Person {
      gender
      birth_year
    }
    `,
  },

  {
    name: "@defer nested",
    document: `
    {
      person(id: 1) {
        name
        ...DeferredPerson @defer
      }
    }

    fragment DeferredPerson on Person {
      birth_year
      ... on Person @defer {
        films {
          title
        }
      }
    }
    `,
  },

  {
    name: "@defer label simple",
    document: `
   {
      person(id: 1) {
        name
        ... on Person @defer(label: "INLINE") {
          gender
        }
        ...DeferredPerson @defer(label: null)
      }
    }

    fragment DeferredPerson on Person {
      birth_year
    }
    `,
  },

  {
    name: "@defer on list",
    document: `
    {
      person(id: 1) {
        name
        films {
          ... on Film @defer {
            title
          }
        }
      }
    }
    `,
  },

  {
    name: "@defer on query with union",
    document: `
    {
      search(search: "Lu") {
        __typename
        ...on Person @defer {
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

  // TODO: Does not error in graphql-js even though it should in spec
  // {
  //   name: "@defer label as  variable error",
  //   document: `
  //   query ($label: String) {
  //     person(id: 1) {
  //       name
  //       ... on Person @defer(label: $label) {
  //         gender
  //       }
  //       ...DeferredPerson @defer
  //     }
  //   }

  //   fragment DeferredPerson on Person {
  //     birth_year
  //   }
  //   `,
  //   variables: {
  //     inlineLabel: "INLINE",
  //   },
  // },

  /// TODO: Does not error in graphql-js even though it should by spec
  // {
  //   name: "@defer label duplicate labels",
  //   document: `
  //   query  {
  //     person(id: 1) {
  //       name
  //       ... on Person @defer(label: "SAME") {
  //         gender
  //       }
  //       ...DeferredPerson @defer(label: "SAME")
  //     }
  //   }

  //   fragment DeferredPerson on Person {
  //     birth_year
  //   }
  //   `,
  // },

  {
    name: "@defer if",
    document: `
   {
      person(id: 1) {
        name
        ... on Person @defer(if: true) {
          gender
        }
        ...DeferredPerson @defer(if: false)
      }
    }

    fragment DeferredPerson on Person {
      birth_year
    }
    `,
  },

  {
    name: "@defer crossselection",
    document: `
   {
      person(id: 1) {
        name
        gender
        ... on Person @defer {
          gender
        }
      }
    }
    `,
  },

  {
    name: "@defer skip/include",
    document: `
   {
      person(id: 1) {
        name
        ... on Person @defer {
          gender @skip(if: true)
        }
        ... on Person @defer {
          birth_year @include(if: false)
        }
        ... on Person @defer @skip(if: true) {
          skin_color
        }
        ... on Person @defer @include(if: false) {
          hair_color
        }
      }
    }
    `,
  },

  {
    name: "@stream basic",
    document: `
    {
      person(id: 1) {
        name
        films @stream {
          title
        }
      }
    }
    `,
  },

  {
    name: "@stream inside @defer",
    document: `
    {
      person(id: 1) {
        name
        ...DeferredPerson @defer
      }
    }

    fragment DeferredPerson on Person {
      birth_year
      ... on Person @defer {
        films @stream {
          title
        }
      }
    }`,
  },

  {
    name: "@stream if",
    document: `
    {
      person(id: 1) {
        name
        films @stream(if: true) {
          title
        }
        starships @stream(if: false) {
          name
        }
      }
    }
    `,
  },

  {
    name: "@stream multiple",
    document: `
      {
        person(id: 1) {
          name
          films @stream {
            title
          }
          starships @stream {
            name
          }
        }
      }
      `,
  },

  {
    name: "@stream nested",
    document: `
      {
        person(id: 1) {
          name
          films @stream {
            title
            planets @stream
          }
        }
      }
      `,
  },

  {
    name: "@stream label",
    document: `
      {
        person(id: 1) {
          name
          films @stream(label: "FILMS") {
            title
          }
          starships @stream(label: "STARSHIPS") {
            name
          }
        }
      }
      `,
  },
  // TODO: not throwing in graphql-js but should by spec - duplicate labels, labels as vars

  {
    name: "@stream initialCount",
    document: `
    {
      person(id: 1) {
        name
        films @stream(label: "FILMS", initialCount: 2) {
          title
        }
      }
    }
    `,
  },

  {
    name: "@stream/defer errors",
    document: `
      {
        person(id: 1) {
          name
          ... on Person @defer {
            bubblingError
          }
          bubblingListError @stream
        }
      }`,
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
