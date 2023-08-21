import {
  parse,
  experimentalExecuteIncrementally as graphQLExecute,
  subscribe as graphQLSubscribe,
  ExecutionArgs as GraphQLExecutionArgs,
  Kind,
  ExecutionResult as GraphQLExecutionResult,
  ExperimentalIncrementalExecutionResults as GraphQLExperimentalExecutionResult,
  GraphQLSchema,
  TypeDefinitionNode,
} from "graphql";
import { executeWithoutSchema, executeWithSchema } from "..";
import { makeSchema, typeDefs } from "../benchmarks/swapi-schema";
import models from "../benchmarks/swapi-schema/models";
import resolvers from "../benchmarks/swapi-schema/resolvers";
import {
  DocumentNode,
  OperationDefinitionNode,
  OperationTypeNode,
  addTypesToRequestDocument,
} from "../supermassive-ast";
import { ExecutionResult, UserResolvers } from "../types";
import { resolvers as extractedResolvers } from "../benchmarks/swapi-schema/__generated__/schema";
import { forAwaitEach, isAsyncIterable } from "iterall";
import { ObjMap } from "../jsutils/ObjMap";
import { PromiseOrValue } from "graphql/jsutils/PromiseOrValue";
import { extractMinimalViableSchemaForRequestDocument } from "../supermassive-ast/addMinimalViableSchemaToRequestDocument";
import { specifiedDirectivesSDL } from "../types/directives";

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
      # This is async iterator
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

describe.skip("executeWithSchema", () => {
  let schema: GraphQLSchema;
  beforeEach(() => {
    jest.resetAllMocks();
    schema = makeSchema();
  });

  test.each(testCases)("$name", async ({ document, variables }: TestCase) => {
    await compareResultsForExecuteWithSchema(schema, document, variables);
  });
});

describe.skip("executeWithoutSchema", () => {
  let schema: GraphQLSchema;
  beforeEach(() => {
    jest.resetAllMocks();
    schema = makeSchema();
  });
  test.each(testCases)("$name", async ({ document, variables }: TestCase) => {
    await compareResultsForExecuteWithoutSchema(schema, document, variables);
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

async function compareResultsForExecuteWithSchema(
  schema: GraphQLSchema,
  query: string,
  variables?: Record<string, unknown>,
) {
  expect.assertions(1);
  const document = parse(query);
  const result = await drainExecution(
    await executeWithSchema({
      typeDefs,
      resolvers: resolvers as UserResolvers<any, any>,
      document,
      contextValue: {
        models,
      },
      variableValues: variables,
    }),
  );
  const validResult = await drainExecution(
    await graphqlExecuteOrSubscribe({
      document,
      contextValue: {
        models,
      },
      schema,
      variableValues: variables,
    }),
  );
  expect(result).toEqual(validResult);
}

async function compareResultsForExecuteWithoutSchema(
  schema: GraphQLSchema,
  query: string,
  variables: Record<string, unknown> = {},
) {
  expect.assertions(1);
  const document = parse(query);
  const result = await drainExecution(
    await executeWithoutSchema({
      document: addTypesToRequestDocument(schema, document),
      contextValue: {
        models,
      },
      resolvers: resolvers as UserResolvers,
      schemaResolvers: extractedResolvers,
      variableValues: variables,
    }),
  );
  const validResult = await drainExecution(
    await graphqlExecuteOrSubscribe({
      document,
      contextValue: {
        models,
      },
      schema,
      variableValues: variables,
    }),
  );
  expect(result).toEqual(validResult);
}

async function compareResultForExecuteWithoutSchemaWithMVSAnnotation(
  schema: GraphQLSchema,
  query: string,
  variables: Record<string, unknown> = {},
) {
  expect.assertions(1);
  const document = parse(query);
  const result = await drainExecution(
    await executeWithoutSchema({
      document,
      contextValue: {
        models,
      },
      resolvers: resolvers as UserResolvers,
      schemaResolvers: extractedResolvers,
      schemaFragment: parse(
        extractMinimalViableSchemaForRequestDocument(schema, document) +
          "\n\n" +
          specifiedDirectivesSDL,
      ).definitions as TypeDefinitionNode[],
      variableValues: variables,
    }),
  );
  const validResult = await drainExecution(
    await graphqlExecuteOrSubscribe({
      document,
      contextValue: {
        models,
      },
      schema,
      variableValues: variables,
    }),
  );
  expect(result).toEqual(validResult);
}

function graphqlExecuteOrSubscribe(
  args: GraphQLExecutionArgs,
): PromiseOrValue<GraphQLResult> {
  const operationName = args.operationName;
  let operation: OperationDefinitionNode | undefined;
  for (const definition of (args.document as unknown as DocumentNode)
    .definitions) {
    switch (definition.kind) {
      case Kind.OPERATION_DEFINITION:
        if (operationName == null) {
          if (operation !== undefined) {
            throw new Error("Bad operation in test");
          }
          operation = definition;
        } else if (definition.name?.value === operationName) {
          operation = definition;
        }
        break;
    }
  }
  if (!operation) {
    throw new Error("Bad operation in test");
  }

  if (operation.operation === OperationTypeNode.SUBSCRIPTION) {
    return graphQLSubscribe(args);
  } else {
    return graphQLExecute(args);
  }
}

type GraphQLResult<TData = ObjMap<unknown>, TExtensions = ObjMap<unknown>> =
  | GraphQLExecutionResult<TData, TExtensions>
  | AsyncGenerator<GraphQLExecutionResult<TData, TExtensions>, void, void>
  | GraphQLExperimentalExecutionResult<TData, TExtensions>;

async function drainExecution(
  result: ExecutionResult | GraphQLResult,
): Promise<unknown> {
  let processedResult;
  if (isAsyncIterable(result)) {
    processedResult = await drainAsyncGeneratorToArray(result);
  } else if ("subsequentResults" in result) {
    processedResult = {
      ...result,
      subsequentResults: await drainAsyncGeneratorToArray(
        result.subsequentResults,
      ),
    };
  } else {
    processedResult = result;
  }
  return processedResult;
}

async function drainAsyncGeneratorToArray<T>(
  collection: AsyncGenerator<T, void, void>,
): Promise<T[]> {
  const result: T[] = [];
  await forAwaitEach(collection, (item) => result.push(item));
  return result;
}
