import {
  parse,
  GraphQLSchema,
  experimentalExecuteIncrementally as graphQLExecute,
  experimentalSubscribeIncrementally as graphQLSubscribe,
} from "graphql";
import { makeSchema } from "../benchmarks/swapi-schema";
import models from "../benchmarks/swapi-schema/models";
import { createExecutionUtils } from "../__testUtils__/execute";
import { executeWithSchema } from "../executeWithSchema";

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

describe("executeWithSchema - @defer non-blocking semantics", () => {
  function createDeferred<T>() {
    let resolve: (value: T) => void;
    const promise = new Promise<T>((innerResolve) => {
      resolve = innerResolve;
    });
    return { promise, resolve: resolve! };
  }

  const definitions = parse(`
    type Query { obj: Obj }
    type Obj {
      critical: String
      deferred: String
    }
  `);

  const document = parse(`
    {
      obj {
        critical
        ... on Obj @defer {
          deferred
        }
      }
    }
  `);

  type Resolver = () => string | Promise<string>;

  function executeTestQuery(Obj: { critical: Resolver; deferred: Resolver }) {
    return Promise.resolve(
      executeWithSchema({
        document,
        definitions,
        resolvers: {
          Query: {
            obj: () => ({}),
          },
          Obj,
        },
      }),
    );
  }

  test("returns the initial response as soon as critical fields are ready", async () => {
    const critical = createDeferred<string>();
    const deferred = createDeferred<string>();

    const resultPromise = executeTestQuery({
      critical: () => critical.promise,
      deferred: () => deferred.promise,
    });

    critical.resolve("critical");
    const result = await Promise.race([
      resultPromise,
      new Promise<"blocked">((resolve) => setTimeout(resolve, 0, "blocked")),
    ]);

    if (result === "blocked") {
      throw new Error("Initial response waited for deferred field");
    }

    expect(result).toMatchObject({
      initialResult: {
        data: {
          obj: {
            critical: "critical",
          },
        },
        hasNext: true,
      },
    });

    if (!("initialResult" in result)) {
      throw new Error("Expected an incremental result");
    }

    const subsequentResultPromise = result.subsequentResults.next();
    deferred.resolve("deferred");

    await expect(subsequentResultPromise).resolves.toMatchObject({
      value: {
        incremental: [
          {
            data: {
              deferred: "deferred",
            },
            path: ["obj"],
          },
        ],
        hasNext: false,
      },
      done: false,
    });
  });

  test("includes deferred fields in the initial response when they complete before the critical fields", async () => {
    const critical = createDeferred<string>();

    const resultPromise = executeTestQuery({
      // The deferred resolver settles during microtask processing, well before
      // the critical field, which is only resolved on a later macrotask below.
      deferred: () => Promise.resolve("deferred"),
      critical: () => critical.promise,
    });

    setTimeout(() => critical.resolve("critical"), 0);

    await expect(resultPromise).resolves.toEqual({
      data: {
        obj: {
          critical: "critical",
          deferred: "deferred",
        },
      },
    });
  });

  test("surfaces deferred errors at the top level when piggybacked onto the initial response", async () => {
    // When a deferred fragment is piggybacked onto the initial response (because
    // it completed before an asynchronous critical field), its errors are
    // promoted to the top-level `errors` array, mirroring how they would appear
    // had the field never been deferred. graphql-js instead reports them inside
    // a separate incremental payload - this is the intended divergence captured
    // by the `@stream/defer errors` parity case.
    const critical = createDeferred<string>();

    const resultPromise = executeTestQuery({
      deferred: () => {
        throw new Error("Deferred boom");
      },
      critical: () => critical.promise,
    });

    setTimeout(() => critical.resolve("critical"), 0);

    const result = await resultPromise;

    expect(result).toMatchObject({
      data: {
        obj: {
          critical: "critical",
          deferred: null,
        },
      },
    });
    expect("initialResult" in (result as object)).toBe(false);
    expect(
      (result as { errors?: ReadonlyArray<{ message: string }> }).errors,
    ).toHaveLength(1);
    expect(
      (result as { errors: ReadonlyArray<{ message: string }> }).errors[0]
        .message,
    ).toBe("Deferred boom");
  });

  test("streams a synchronous deferred field when the critical fields are ready first", async () => {
    // Both resolvers are synchronous. A synchronous resolver may still be
    // expensive, so marking the field with @defer must keep it off the
    // critical path: the critical field is flushed first and the deferred
    // field is streamed as a subsequent payload rather than forced inline.
    const result = await executeTestQuery({
      critical: () => "critical",
      deferred: () => "deferred",
    });

    expect(result).toMatchObject({
      initialResult: {
        data: {
          obj: {
            critical: "critical",
          },
        },
        hasNext: true,
      },
    });

    if (!("initialResult" in result)) {
      throw new Error("Expected an incremental result");
    }

    expect(result.initialResult.data).toEqual({
      obj: { critical: "critical" },
    });

    await expect(result.subsequentResults.next()).resolves.toMatchObject({
      value: {
        incremental: [
          {
            data: {
              deferred: "deferred",
            },
            path: ["obj"],
          },
        ],
        hasNext: false,
      },
      done: false,
    });
  });
});
