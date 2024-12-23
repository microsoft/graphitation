import {
  parse,
  DocumentNode,
  execute as graphQLExecute,
  subscribe as graphQLSubscribe,
} from "graphql";
import {
  executeWithoutSchema,
  isTotalExecutionResult,
} from "../executeWithoutSchema";
import { executeWithSchema } from "../executeWithSchema";
import schema, { typeDefs } from "../benchmarks/swapi-schema";
import models from "../benchmarks/swapi-schema/models";
import resolvers from "../benchmarks/swapi-schema/resolvers";
import { extractMinimalViableSchemaForRequestDocument } from "../utilities/extractMinimalViableSchemaForRequestDocument";
import type { UserResolvers, TotalExecutionResult } from "../types";
import type {
  AfterFieldCompleteHookArgs,
  AfterFieldResolveHookArgs,
  AfterFieldSubscribeHookArgs,
  BaseExecuteFieldHookArgs,
  BaseExecuteOperationHookArgs,
  BeforeSubscriptionEventEmitHookArgs,
  ExecutionHooks,
} from "../hooks/types";
import { pathToArray } from "../jsutils/Path";
import type { Maybe } from "../jsutils/Maybe";
import { createExecutionUtils } from "../__testUtils__/execute";

const { drainExecution } = createExecutionUtils(
  graphQLExecute,
  graphQLSubscribe,
);

interface TestCase {
  name: string;
  document: string;
  resolvers: UserResolvers;
  expectedHookCalls: string[];
  resultHasErrors: boolean;
  variables?: Maybe<{ [variable: string]: unknown }>;
  isStrictHookCallsOrder: boolean;
}

interface HookExceptionTestCase {
  name: string;
  document: string;
  hooks: ExecutionHooks;
  expectedErrorMessage: string;
  variables?: Maybe<{ [variable: string]: unknown }>;
}

describe.each([
  {
    name: "executeWithoutSchema",
    execute: (
      document: DocumentNode,
      resolvers: UserResolvers,
      hooks: ExecutionHooks,
      variables?: Maybe<{ [variable: string]: unknown }>,
    ) => {
      const { definitions } = extractMinimalViableSchemaForRequestDocument(
        schema,
        document,
      );
      return executeWithoutSchema({
        schemaFragment: {
          schemaId: "test",
          resolvers,
          definitions,
        },
        document,
        variableValues: variables,
        contextValue: {
          models,
        },
        fieldExecutionHooks: hooks,
      });
    },
  },
  {
    name: "executeWithSchema",
    execute: (
      document: DocumentNode,
      resolvers: UserResolvers,
      hooks: ExecutionHooks,
      variables?: Maybe<{ [variable: string]: unknown }>,
    ) => {
      return executeWithSchema({
        definitions: typeDefs,
        resolvers,
        document,
        variableValues: variables,
        contextValue: {
          models,
        },
        fieldExecutionHooks: hooks,
      });
    },
  },
])("$name", ({ execute }) => {
  describe("Execution hooks are invoked", () => {
    let hookCalls: string[];

    // Used hook acronyms:
    //   BFR: beforeFieldResolve
    //   AFR: afterFieldResolve
    //   AFC: afterFieldComplete
    //   BOE: beforeOperationExecute
    //   BSE: beforeSubscriptionEventEmit
    //   ABR: afterBuildResponse
    const syncAfterHooks: ExecutionHooks = {
      afterBuildResponse: jest
        .fn()
        .mockImplementation(
          ({ operation }: BaseExecuteOperationHookArgs<unknown>) => {
            hookCalls.push(`ABR|${operation.name?.value}`);
          },
        ),
      afterFieldResolve: jest
        .fn()
        .mockImplementation(
          ({
            resolveInfo,
            result,
            error,
          }: AfterFieldResolveHookArgs<unknown, unknown>) => {
            const resultValue =
              typeof result === "object" && result !== null
                ? "[object]"
                : result;
            const errorMessage = error instanceof Error ? error.message : error;
            hookCalls.push(
              `AFR|${pathToArray(resolveInfo.path).join(
                ".",
              )}|${resultValue}|${errorMessage}`,
            );
          },
        ),
      afterFieldSubscribe: jest
        .fn()
        .mockImplementation(
          ({
            resolveInfo,
            result,
            error,
          }: AfterFieldSubscribeHookArgs<unknown, unknown>) => {
            const resultValue =
              typeof result === "object" && result !== null
                ? "[object]"
                : result;
            const errorMessage = error instanceof Error ? error.message : error;
            hookCalls.push(
              `AFS|${pathToArray(resolveInfo.path).join(
                ".",
              )}|${resultValue}|${errorMessage}`,
            );
          },
        ),
      afterFieldComplete: jest
        .fn()
        .mockImplementation(
          ({
            resolveInfo,
            result,
            error,
          }: AfterFieldCompleteHookArgs<unknown, unknown>) => {
            const resultValue =
              typeof result === "object" && result !== null
                ? "[object]"
                : result;
            const errorMessage = error instanceof Error ? error.message : error;
            hookCalls.push(
              `AFC|${pathToArray(resolveInfo.path).join(
                ".",
              )}|${resultValue}|${errorMessage}`,
            );
          },
        ),
    };

    const syncBeforeHooks: ExecutionHooks = {
      beforeOperationExecute: jest
        .fn()
        .mockImplementation(
          ({ operation }: BaseExecuteOperationHookArgs<unknown>) => {
            hookCalls.push(`BOE|${operation.name?.value}`);
          },
        ),
      beforeSubscriptionEventEmit: jest
        .fn()
        .mockImplementation(
          ({
            operation,
            eventPayload,
          }: BeforeSubscriptionEventEmitHookArgs<unknown>) => {
            hookCalls.push(
              `BSE|${operation.name?.value}|${
                (eventPayload as any).emitPersons.name
              }`,
            );
          },
        ),
      beforeFieldResolve: jest
        .fn()
        .mockImplementation(
          ({ resolveInfo }: BaseExecuteFieldHookArgs<unknown>) => {
            hookCalls.push(`BFR|${pathToArray(resolveInfo.path).join(".")}`);
          },
        ),
      beforeFieldSubscribe: jest
        .fn()
        .mockImplementation(
          ({ resolveInfo }: BaseExecuteFieldHookArgs<unknown>) => {
            hookCalls.push(`BFS|${pathToArray(resolveInfo.path).join(".")}`);
          },
        ),
    };

    const asyncBeforeHooks: ExecutionHooks = {
      beforeOperationExecute: jest
        .fn()
        .mockImplementation(
          async ({ operation }: BaseExecuteOperationHookArgs<unknown>) => {
            hookCalls.push(`ABOE|${operation.name?.value}`);
          },
        ),
      beforeSubscriptionEventEmit: jest
        .fn()
        .mockImplementation(
          async ({
            operation,
            eventPayload,
          }: BeforeSubscriptionEventEmitHookArgs<unknown>) => {
            hookCalls.push(
              `ABSE|${operation.name?.value}|${
                (eventPayload as any).emitPersons.name
              }`,
            );
          },
        ),
      beforeFieldResolve: jest
        .fn()
        .mockImplementation(
          async ({ resolveInfo }: BaseExecuteFieldHookArgs<unknown>) => {
            hookCalls.push(`ABFR|${pathToArray(resolveInfo.path).join(".")}`);
          },
        ),
      beforeFieldSubscribe: jest
        .fn()
        .mockImplementation(
          async ({ resolveInfo }: BaseExecuteFieldHookArgs<unknown>) => {
            hookCalls.push(`ABFR|${pathToArray(resolveInfo.path).join(".")}`);
          },
        ),
    };

    beforeEach(() => {
      jest.clearAllMocks();
      hookCalls = [];
    });

    const testCases: Array<TestCase> = [
      {
        name: "succeeded sync resolver",
        document: `query GetPerson
        {
          person(id: 1) {
            name
          }
        }`,
        resolvers: {
          ...resolvers,
          Person: {
            name: (parent: any, _args: unknown, _context: any) => {
              return parent.name;
            },
          },
        } as UserResolvers,
        expectedHookCalls: [
          "BOE|GetPerson",
          "BFR|person",
          "AFR|person|[object]|undefined",
          "BFR|person.name",
          "AFR|person.name|Luke Skywalker|undefined",
          "AFC|person.name|Luke Skywalker|undefined",
          "AFC|person|[object]|undefined",
          "ABR|GetPerson",
        ],
        resultHasErrors: false,
        isStrictHookCallsOrder: true,
      },
      {
        name: "succeeded async resolver",
        document: `query GetPerson
        {
          person(id: 1) {
            name
          }
        }`,
        resolvers: {
          ...resolvers,
          Person: {
            name: async (parent: any, _args: unknown, _context: any) => {
              return Promise.resolve(parent.name);
            },
          },
        } as UserResolvers,
        expectedHookCalls: [
          "BOE|GetPerson",
          "BFR|person",
          "AFR|person|[object]|undefined",
          "BFR|person.name",
          "AFR|person.name|Luke Skywalker|undefined",
          "AFC|person.name|Luke Skywalker|undefined",
          "AFC|person|[object]|undefined",
          "ABR|GetPerson",
        ],
        resultHasErrors: false,
        isStrictHookCallsOrder: false,
      },
      {
        name: "error in sync resolver for nullable field",
        document: `query GetFilm
        {
          film(id: 1) {
            producer
          }
        }`,
        resolvers: {
          ...resolvers,
          Film: {
            producer: (_parent: any, _args: unknown, _context: any) => {
              throw new Error("Resolver error");
            },
          },
        } as UserResolvers,
        expectedHookCalls: [
          "BOE|GetFilm",
          "BFR|film",
          "AFR|film|[object]|undefined",
          "BFR|film.producer",
          "AFR|film.producer|undefined|Resolver error",
          "AFC|film.producer|undefined|Resolver error",
          "AFC|film|[object]|undefined",
          "ABR|GetFilm",
        ],
        resultHasErrors: true,
        isStrictHookCallsOrder: true,
      },
      {
        name: "error in async resolver for nullable field",
        document: `query GetFilm
        {
          film(id: 1) {
            producer
          }
        }`,
        resolvers: {
          ...resolvers,
          Film: {
            producer: async (_parent: any, _args: unknown, _context: any) => {
              return Promise.reject(new Error("Resolver error"));
            },
          },
        } as UserResolvers,
        expectedHookCalls: [
          "BOE|GetFilm",
          "BFR|film",
          "AFR|film|[object]|undefined",
          "BFR|film.producer",
          "AFR|film.producer|undefined|Resolver error",
          "AFC|film.producer|undefined|Resolver error",
          "AFC|film|[object]|undefined",
          "ABR|GetFilm",
        ],
        resultHasErrors: true,
        isStrictHookCallsOrder: false,
      },
      {
        name: "error in sync resolver for non-nullable field",
        document: `query GetFilm
        {
          film(id: 1) {
            title
          }
        }`,
        resolvers: {
          ...resolvers,
          Film: {
            title: (_parent: any, _args: unknown, _context: any) => {
              throw new Error("Resolver error");
            },
          },
        } as UserResolvers,
        expectedHookCalls: [
          "BOE|GetFilm",
          "BFR|film",
          "AFR|film|[object]|undefined",
          "BFR|film.title",
          "AFR|film.title|undefined|Resolver error",
          "AFC|film.title|undefined|Resolver error",
          "AFC|film|undefined|Resolver error",
          "ABR|GetFilm",
        ],
        resultHasErrors: true,
        isStrictHookCallsOrder: true,
      },
      {
        name: "error in sync resolver for non-nullable field 2",
        document: `query GetPersonX
        {
          person(id: 1) {
            name
            xField
          }
        }`,
        resolvers: {
          ...resolvers,
          Person: {
            name: async () => {
              // NOTE: this has to be async
              return "John Doe";
            },
            xField: () => {
              // NOTE this has to be sync, to make sure it throws before Person.name is resolved
              throw new Error("Resolver error");
            },
          },
        } as UserResolvers,
        expectedHookCalls: [
          "BOE|GetPersonX",
          "BFR|person",
          "AFR|person|[object]|undefined",
          "BFR|person.name",
          "BFR|person.xField",
          "AFR|person.xField|undefined|Resolver error",
          "AFC|person.xField|undefined|Resolver error",
          "AFR|person.name|John Doe|undefined",
          "AFC|person.name|John Doe|undefined",
          "AFC|person|undefined|Resolver error",
          "ABR|GetPersonX",
        ],
        resultHasErrors: true,
        isStrictHookCallsOrder: true,
      },
      {
        name: "error in async resolver for non-nullable field",
        document: `query GetFilm
        {
          film(id: 1) {
            title
          }
        }`,
        resolvers: {
          ...resolvers,
          Film: {
            title: async (_parent: any, _args: unknown, _context: any) => {
              return Promise.reject(new Error("Resolver error"));
            },
          },
        } as UserResolvers,
        expectedHookCalls: [
          "BOE|GetFilm",
          "BFR|film",
          "AFR|film|[object]|undefined",
          "BFR|film.title",
          "AFR|film.title|undefined|Resolver error",
          "AFC|film.title|undefined|Resolver error",
          "AFC|film|undefined|Resolver error",
          "ABR|GetFilm",
        ],
        resultHasErrors: true,
        isStrictHookCallsOrder: false,
      },
      {
        name: "do not invoke hooks for the field with default resolver",
        document: `query GetFilm
        {
          film(id: 1) {
            title
          }
        }`,
        resolvers: resolvers as UserResolvers,
        expectedHookCalls: [
          "BOE|GetFilm",
          "BFR|film",
          "AFR|film|[object]|undefined",
          "AFC|film|[object]|undefined",
          "ABR|GetFilm",
        ],
        resultHasErrors: false,
        isStrictHookCallsOrder: true,
      },
      {
        name: "do not invoke hooks for the __typename",
        document: `query GetFilm
        {
          film(id: 1) {
            __typename
            title
          }
        }`,
        resolvers: resolvers as UserResolvers,
        expectedHookCalls: [
          "BOE|GetFilm",
          "BFR|film",
          "AFR|film|[object]|undefined",
          "AFC|film|[object]|undefined",
          "ABR|GetFilm",
        ],
        resultHasErrors: false,
        isStrictHookCallsOrder: true,
      },
      {
        name: "multiple root fields in selection set",
        document: `query GetFilmAndPerson
        {
          film(id: 1) {
            title
          }
          person(id: 1) {
            name
          }
        }`,
        resolvers: resolvers as UserResolvers,
        expectedHookCalls: [
          "BOE|GetFilmAndPerson",
          "BFR|film",
          "AFR|film|[object]|undefined",
          "AFC|film|[object]|undefined",
          "BFR|person",
          "AFR|person|[object]|undefined",
          "AFC|person|[object]|undefined",
          "ABR|GetFilmAndPerson",
        ],
        resultHasErrors: false,
        isStrictHookCallsOrder: true,
      },
      {
        name: "subscription hooks",
        document: `subscription EmitPersons($limit: Int!)
        {
          emitPersons(limit: $limit) {
            name
          }
        }`,
        variables: {
          limit: 3,
        },
        resolvers: resolvers as UserResolvers,
        expectedHookCalls: [
          "BOE|EmitPersons",
          "BFS|emitPersons",
          "AFS|emitPersons|[object]|undefined",
          "BSE|EmitPersons|Luke Skywalker",
          "ABR|EmitPersons",
          "BSE|EmitPersons|C-3PO",
          "ABR|EmitPersons",
          "BSE|EmitPersons|R2-D2",
          "ABR|EmitPersons",
        ],
        resultHasErrors: false,
        isStrictHookCallsOrder: true,
      },
      {
        name: "error in sync subscribe() resolver",
        document: `subscription EmitPersons($limit: Int!)
        {
          emitPersons(limit: $limit) {
            name
          }
        }`,
        resolvers: {
          ...resolvers,
          Subscription: {
            emitPersons: {
              subscribe: (_parent: any, _args: unknown, _context: any) => {
                throw new Error("Subscribe error");
              },
            },
          },
        } as UserResolvers,
        variables: {
          limit: 1,
        },
        expectedHookCalls: [
          "BOE|EmitPersons",
          "BFS|emitPersons",
          "AFS|emitPersons|undefined|Subscribe error",
        ],
        resultHasErrors: true,
        isStrictHookCallsOrder: true,
      },
      {
        name: "error in async subscribe() resolver",
        document: `subscription EmitPersons($limit: Int!)
        {
          emitPersons(limit: $limit) {
            name
          }
        }`,
        resolvers: {
          ...resolvers,
          Subscription: {
            emitPersons: {
              subscribe: async (
                _parent: any,
                _args: unknown,
                _context: any,
              ) => {
                return Promise.reject(new Error("Subscribe error"));
              },
            },
          },
        } as UserResolvers,
        variables: {
          limit: 1,
        },
        expectedHookCalls: [
          "BOE|EmitPersons",
          "BFS|emitPersons",
          "AFS|emitPersons|undefined|Subscribe error",
        ],
        resultHasErrors: true,
        isStrictHookCallsOrder: true,
      },
    ];

    const asyncHooksTestCases: Array<TestCase> = [
      {
        name: "succeeded sync resolver with async hooks",
        document: `query GetPerson
        {
          person(id: 1) {
            name
          }
        }`,
        resolvers: {
          ...resolvers,
          Person: {
            name: (parent: any, _args: unknown, _context: any) => {
              return parent.name;
            },
          },
        } as UserResolvers,
        expectedHookCalls: [
          "ABOE|GetPerson",
          "ABFR|person",
          "AFR|person|[object]|undefined",
          "ABFR|person.name",
          "AFR|person.name|Luke Skywalker|undefined",
          "AFC|person.name|Luke Skywalker|undefined",
          "AFC|person|[object]|undefined",
          "ABR|GetPerson",
        ],
        resultHasErrors: false,
        isStrictHookCallsOrder: true,
      },
      {
        name: "succeeded async resolver with async hooks",
        document: `query GetPerson
        {
          person(id: 1) {
            name
          }
        }`,
        resolvers: {
          ...resolvers,
          Person: {
            name: async (parent: any, _args: unknown, _context: any) => {
              return Promise.resolve(parent.name);
            },
          },
        } as UserResolvers,
        expectedHookCalls: [
          "ABOE|GetPerson",
          "ABFR|person",
          "AFR|person|[object]|undefined",
          "ABFR|person.name",
          "AFR|person.name|Luke Skywalker|undefined",
          "AFC|person.name|Luke Skywalker|undefined",
          "AFC|person|[object]|undefined",
          "ABR|GetPerson",
        ],
        resultHasErrors: false,
        isStrictHookCallsOrder: false,
      },
      {
        name: "error in sync resolver for nullable field with async hooks",
        document: `query GetFilm
        {
          film(id: 1) {
            producer
          }
        }`,
        resolvers: {
          ...resolvers,
          Film: {
            producer: (_parent: any, _args: unknown, _context: any) => {
              throw new Error("Resolver error");
            },
          },
        } as UserResolvers,
        expectedHookCalls: [
          "ABOE|GetFilm",
          "ABFR|film",
          "AFR|film|[object]|undefined",
          "ABFR|film.producer",
          "AFR|film.producer|undefined|Resolver error",
          "AFC|film.producer|undefined|Resolver error",
          "AFC|film|[object]|undefined",
          "ABR|GetFilm",
        ],
        resultHasErrors: true,
        isStrictHookCallsOrder: true,
      },
      {
        name: "error in async resolver for nullable field with async hooks",
        document: `query GetFilm
        {
          film(id: 1) {
            producer
          }
        }`,
        resolvers: {
          ...resolvers,
          Film: {
            producer: async (_parent: any, _args: unknown, _context: any) => {
              return Promise.reject(new Error("Resolver error"));
            },
          },
        } as UserResolvers,
        expectedHookCalls: [
          "ABOE|GetFilm",
          "ABFR|film",
          "AFR|film|[object]|undefined",
          "ABFR|film.producer",
          "AFR|film.producer|undefined|Resolver error",
          "AFC|film.producer|undefined|Resolver error",
          "AFC|film|[object]|undefined",
          "ABR|GetFilm",
        ],
        resultHasErrors: true,
        isStrictHookCallsOrder: false,
      },
      {
        name: "error in sync resolver for non-nullable field with async hooks",
        document: `query GetFilm
        {
          film(id: 1) {
            title
          }
        }`,
        resolvers: {
          ...resolvers,
          Film: {
            title: (_parent: any, _args: unknown, _context: any) => {
              throw new Error("Resolver error");
            },
          },
        } as UserResolvers,
        expectedHookCalls: [
          "ABOE|GetFilm",
          "ABFR|film",
          "AFR|film|[object]|undefined",
          "ABFR|film.title",
          "AFR|film.title|undefined|Resolver error",
          "AFC|film.title|undefined|Resolver error",
          "AFC|film|undefined|Resolver error",
          "ABR|GetFilm",
        ],
        resultHasErrors: true,
        isStrictHookCallsOrder: true,
      },
      {
        name: "error in async resolver for non-nullable field with async hooks",
        document: `query GetFilm
        {
          film(id: 1) {
            title
          }
        }`,
        resolvers: {
          ...resolvers,
          Film: {
            title: async (_parent: any, _args: unknown, _context: any) => {
              return Promise.reject(new Error("Resolver error"));
            },
          },
        } as UserResolvers,
        expectedHookCalls: [
          "ABOE|GetFilm",
          "ABFR|film",
          "AFR|film|[object]|undefined",
          "ABFR|film.title",
          "AFR|film.title|undefined|Resolver error",
          "AFC|film.title|undefined|Resolver error",
          "AFC|film|undefined|Resolver error",
          "ABR|GetFilm",
        ],
        resultHasErrors: true,
        isStrictHookCallsOrder: false,
      },
      {
        name: "do not invoke hooks for the field with default resolver with async hooks",
        document: `query GetFilm
        {
          film(id: 1) {
            title
          }
        }`,
        resolvers: resolvers as UserResolvers,
        expectedHookCalls: [
          "ABOE|GetFilm",
          "ABFR|film",
          "AFR|film|[object]|undefined",
          "AFC|film|[object]|undefined",
          "ABR|GetFilm",
        ],
        resultHasErrors: false,
        isStrictHookCallsOrder: true,
      },
      {
        name: "do not invoke hooks for the __typename with async hooks",
        document: `query GetFilm
        {
          film(id: 1) {
            __typename
            title
          }
        }`,
        resolvers: resolvers as UserResolvers,
        expectedHookCalls: [
          "ABOE|GetFilm",
          "ABFR|film",
          "AFR|film|[object]|undefined",
          "AFC|film|[object]|undefined",
          "ABR|GetFilm",
        ],
        resultHasErrors: false,
        isStrictHookCallsOrder: true,
      },
      {
        name: "multiple root fields in selection set with async hooks",
        document: `query GetFilmAndPerson
        {
          film(id: 1) {
            title
          }
          person(id: 1) {
            name
          }
        }`,
        resolvers: resolvers as UserResolvers,
        expectedHookCalls: [
          "ABOE|GetFilmAndPerson",
          "ABFR|film",
          "ABFR|person",
          "AFR|film|[object]|undefined",
          "AFR|person|[object]|undefined",
          "AFC|film|[object]|undefined",
          "AFC|person|[object]|undefined",
          "ABR|GetFilmAndPerson",
        ],
        resultHasErrors: false,
        isStrictHookCallsOrder: true,
      },
      {
        name: "subscription hooks",
        document: `subscription EmitPersons($limit: Int!)
        {
          emitPersons(limit: $limit) {
            name
          }
        }`,
        variables: {
          limit: 3,
        },
        resolvers: resolvers as UserResolvers,
        expectedHookCalls: [
          "ABOE|EmitPersons",
          "ABFR|emitPersons",
          "AFS|emitPersons|[object]|undefined",
          "ABSE|EmitPersons|Luke Skywalker",
          "ABR|EmitPersons",
          "ABSE|EmitPersons|C-3PO",
          "ABR|EmitPersons",
          "ABSE|EmitPersons|R2-D2",
          "ABR|EmitPersons",
        ],
        resultHasErrors: false,
        isStrictHookCallsOrder: true,
      },
      {
        name: "error in sync subscribe() resolver with async hooks",
        document: `subscription EmitPersons($limit: Int!)
        {
          emitPersons(limit: $limit) {
            name
          }
        }`,
        resolvers: {
          ...resolvers,
          Subscription: {
            emitPersons: {
              subscribe: (_parent: any, _args: unknown, _context: any) => {
                throw new Error("Subscribe error");
              },
            },
          },
        } as UserResolvers,
        variables: {
          limit: 1,
        },
        expectedHookCalls: [
          "ABOE|EmitPersons",
          "ABFR|emitPersons",
          "AFS|emitPersons|undefined|Subscribe error",
        ],
        resultHasErrors: true,
        isStrictHookCallsOrder: true,
      },
      {
        name: "error in async subscribe() resolver with async hooks",
        document: `subscription EmitPersons($limit: Int!)
        {
          emitPersons(limit: $limit) {
            name
          }
        }`,
        resolvers: {
          ...resolvers,
          Subscription: {
            emitPersons: {
              subscribe: async (
                _parent: any,
                _args: unknown,
                _context: any,
              ) => {
                return Promise.reject(new Error("Subscribe error"));
              },
            },
          },
        } as UserResolvers,
        variables: {
          limit: 1,
        },
        expectedHookCalls: [
          "ABOE|EmitPersons",
          "ABFR|emitPersons",
          "AFS|emitPersons|undefined|Subscribe error",
        ],
        resultHasErrors: true,
        isStrictHookCallsOrder: true,
      },
    ];

    it.each(asyncHooksTestCases)(
      "$name",
      async ({
        document,
        resolvers,
        expectedHookCalls,
        resultHasErrors,
        isStrictHookCallsOrder,
        variables,
      }) => {
        expect.assertions(4);
        const parsedDocument = parse(document);

        const result = await drainExecution(
          await execute(
            parsedDocument,
            resolvers,
            { ...asyncBeforeHooks, ...syncAfterHooks },
            variables,
          ),
        );

        if (isStrictHookCallsOrder) {
          expect(hookCalls).toEqual(expectedHookCalls);
        } else {
          // for async resolvers order of resolving isn't strict,
          // so just verify whether corresponding hook calls happened
          expect(hookCalls).toEqual(expect.arrayContaining(expectedHookCalls));
        }
        expect(hookCalls).toHaveLength(expectedHookCalls.length);
        expect(isTotalExecutionResult(result as TotalExecutionResult)).toBe(
          true,
        );
        expect(((result as TotalExecutionResult).errors?.length ?? 0) > 0).toBe(
          resultHasErrors,
        );
      },
    );

    it.each(testCases)(
      "$name",
      async ({
        document,
        resolvers,
        expectedHookCalls,
        resultHasErrors,
        isStrictHookCallsOrder,
        variables,
      }) => {
        expect.assertions(4);
        const parsedDocument = parse(document);

        const result = await drainExecution(
          await execute(
            parsedDocument,
            resolvers,
            { ...syncAfterHooks, ...syncBeforeHooks },
            variables,
          ),
        );

        if (isStrictHookCallsOrder) {
          expect(hookCalls).toEqual(expectedHookCalls);
        } else {
          // for async resolvers order of resolving isn't strict,
          // so just verify whether corresponding hook calls happened
          expect(hookCalls).toEqual(expect.arrayContaining(expectedHookCalls));
        }
        expect(hookCalls).toHaveLength(expectedHookCalls.length);
        expect(isTotalExecutionResult(result as TotalExecutionResult)).toBe(
          true,
        );
        expect(((result as TotalExecutionResult).errors?.length ?? 0) > 0).toBe(
          resultHasErrors,
        );
      },
    );

    test("BFR returns promise conditionally", async () => {
      const result = await drainExecution(
        await execute(
          parse(`query GetFilmAndPerson
            {
              film(id: 1) {
                title
              }
              person(id: 1) {
                name
              }
            }`),
          resolvers as UserResolvers,
          {
            ...asyncBeforeHooks,
            ...syncAfterHooks,
            beforeFieldResolve: jest
              .fn()
              .mockImplementation(
                ({ resolveInfo }: BaseExecuteFieldHookArgs<unknown>) => {
                  if (resolveInfo.fieldName === "film") {
                    hookCalls.push(
                      `ABFR|${pathToArray(resolveInfo.path).join(".")}`,
                    );
                    return Promise.resolve();
                  }
                  hookCalls.push(
                    `BFR|${pathToArray(resolveInfo.path).join(".")}`,
                  );
                  return;
                },
              ),
          },
          {
            limit: 1,
          },
        ),
      );

      const expectedHookCalls = [
        "ABOE|GetFilmAndPerson",
        "ABFR|film",
        "BFR|person",
        "AFR|person|[object]|undefined",
        "AFC|person|[object]|undefined",
        "AFR|film|[object]|undefined",
        "AFC|film|[object]|undefined",
        "ABR|GetFilmAndPerson",
      ];
      expect(hookCalls).toEqual(expectedHookCalls);

      expect(hookCalls).toHaveLength(expectedHookCalls.length);
      expect(isTotalExecutionResult(result as TotalExecutionResult)).toBe(true);
      expect(((result as TotalExecutionResult).errors?.length ?? 0) > 0).toBe(
        false,
      );
    });
  });

  describe("error in beforeSubscriptionEventEmit", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    const testCases: Array<HookExceptionTestCase> = [
      {
        name: "beforeSubscriptionEventEmit (Error is thrown)",
        document: `subscription EmitPersons($limit: Int!)
        {
          emitPersons(limit: $limit) {
            name
          }
        }`,
        variables: {
          limit: 1,
        },
        hooks: {
          beforeSubscriptionEventEmit: jest.fn().mockImplementation(() => {
            throw new Error("Hook error");
          }),
        },
        expectedErrorMessage:
          "Unexpected error thrown by beforeSubscriptionEventEmit hook (operation: EmitPersons): Hook error",
      },
      {
        name: "async beforeSubscriptionEventEmit (Error is thrown)",
        document: `subscription EmitPersons($limit: Int!)
        {
          emitPersons(limit: $limit) {
            name
          }
        }`,
        variables: {
          limit: 1,
        },
        hooks: {
          beforeSubscriptionEventEmit: jest
            .fn()
            .mockImplementation(async () => {
              throw new Error("Hook error");
            }),
        },
        expectedErrorMessage:
          "Unexpected error thrown by beforeSubscriptionEventEmit hook (operation: EmitPersons): Hook error",
      },
    ];

    it.each(testCases)(
      "$name",
      async ({ document, hooks, expectedErrorMessage, variables }) => {
        expect.assertions(5);
        const parsedDocument = parse(document);

        const response = await drainExecution(
          await execute(
            parsedDocument,
            resolvers as UserResolvers,
            hooks,
            variables,
          ),
        );
        const result = Array.isArray(response) ? response[0] : response;

        expect(isTotalExecutionResult(result)).toBe(true);

        const errors = result.errors;
        expect(result.data).toBeNull();
        expect(errors).toBeDefined();
        expect(errors).toHaveLength(1);
        expect(errors?.[0].message).toBe(expectedErrorMessage);
      },
    );
  });

  describe("afterFieldSubscribe and beforeFieldSubscribe hook errors during creating event stream. It should throw if an error is thrown or returned", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    const testCases: Array<HookExceptionTestCase> = [
      {
        name: "afterFieldSubscribe (Error is returned)",
        document: `subscription EmitPersons($limit: Int!)
        {
          emitPersons(limit: $limit) {
            name
          }
        }`,
        variables: {
          limit: 1,
        },
        hooks: {
          afterFieldSubscribe: jest.fn().mockImplementation(() => {
            return new Error("Hook error");
          }),
        },
        expectedErrorMessage:
          "Unexpected error returned from afterFieldSubscribe hook: Hook error",
      },
      {
        name: "afterFieldSubscribe (Error is thrown)",
        document: `subscription EmitPersons($limit: Int!)
        {
          emitPersons(limit: $limit) {
            name
          }
        }`,
        variables: {
          limit: 1,
        },
        hooks: {
          afterFieldSubscribe: jest.fn().mockImplementation(() => {
            throw new Error("Hook error");
          }),
        },
        expectedErrorMessage:
          "Unexpected error thrown by afterFieldSubscribe hook: Hook error",
      },
      {
        name: "afterFieldSubscribe (string is thrown)",
        document: `subscription EmitPersons($limit: Int!)
        {
          emitPersons(limit: $limit) {
            name
          }
        }`,
        variables: {
          limit: 1,
        },
        hooks: {
          afterFieldSubscribe: jest.fn().mockImplementation(() => {
            throw "Hook error";
          }),
        },
        expectedErrorMessage:
          'Unexpected error thrown by afterFieldSubscribe hook: "Hook error"',
      },
      {
        name: "beforeFieldSubscribe (Error is thrown)",
        document: `subscription EmitPersons($limit: Int!)
        {
          emitPersons(limit: $limit) {
            name
          }
        }`,
        variables: {
          limit: 1,
        },
        hooks: {
          beforeFieldSubscribe: jest.fn().mockImplementation(() => {
            throw new Error("Hook error");
          }),
        },
        expectedErrorMessage:
          "Unexpected error thrown by beforeFieldSubscribe hook: Hook error",
      },
      {
        name: "beforeFieldSubscribe (Error is returned)",
        document: `subscription EmitPersons($limit: Int!)
        {
          emitPersons(limit: $limit) {
            name
          }
        }`,
        variables: {
          limit: 1,
        },
        hooks: {
          beforeFieldSubscribe: jest.fn().mockImplementation(() => {
            return new Error("Hook error");
          }),
        },
        expectedErrorMessage:
          "Unexpected error returned from beforeFieldSubscribe hook: Hook error",
      },
      {
        name: "beforeFieldSubscribe (string is thrown)",
        document: `subscription EmitPersons($limit: Int!)
        {
          emitPersons(limit: $limit) {
            name
          }
        }`,
        variables: {
          limit: 1,
        },
        hooks: {
          beforeFieldSubscribe: jest.fn().mockImplementation(() => {
            throw "Hook error";
          }),
        },
        expectedErrorMessage:
          'Unexpected error thrown by beforeFieldSubscribe hook: "Hook error"',
      },
    ];

    it.each(testCases)(
      "$name",
      async ({ document, hooks, expectedErrorMessage, variables }) => {
        expect.assertions(5);
        const parsedDocument = parse(document);

        const response = await drainExecution(
          await execute(
            parsedDocument,
            resolvers as UserResolvers,
            hooks,
            variables,
          ),
        );
        const result = Array.isArray(response) ? response[0] : response;
        expect(isTotalExecutionResult(result)).toBe(true);
        const errors = result.errors;
        expect(result.data).toBeUndefined();
        expect(errors).toBeDefined();
        expect(errors).toHaveLength(1);
        expect(errors?.[0].message).toBe(expectedErrorMessage);
      },
    );
  });

  describe("Error is thrown by hooks during field resolution", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    const testCases: Array<HookExceptionTestCase> = [
      {
        name: "beforeFieldResolve (Error is thrown)",
        document: `
        {
          film(id: 1) {
            title
          }
        }`,
        hooks: {
          beforeFieldResolve: jest.fn().mockImplementation(() => {
            throw new Error("Hook error");
          }),
        },
        expectedErrorMessage:
          "Unexpected error thrown by beforeFieldResolve hook: Hook error",
      },
      {
        name: "beforeFieldResolve (string is thrown)",
        document: `
        {
          film(id: 1) {
            title
          }
        }`,
        hooks: {
          beforeFieldResolve: jest.fn().mockImplementation(() => {
            throw "Hook error";
          }),
        },
        expectedErrorMessage:
          'Unexpected error thrown by beforeFieldResolve hook: "Hook error"',
      },
      {
        name: "afterFieldResolve (Error is thrown)",
        document: `
        {
          film(id: 1) {
            title
          }
        }`,
        hooks: {
          afterFieldResolve: jest.fn().mockImplementation(() => {
            throw new Error("Hook error");
          }),
        },
        expectedErrorMessage:
          "Unexpected error thrown by afterFieldResolve hook: Hook error",
      },
      {
        name: "afterFieldResolve (string is thrown)",
        document: `
        {
          film(id: 1) {
            title
          }
        }`,
        hooks: {
          afterFieldResolve: jest.fn().mockImplementation(() => {
            throw "Hook error";
          }),
        },
        expectedErrorMessage:
          'Unexpected error thrown by afterFieldResolve hook: "Hook error"',
      },
      {
        name: "afterFieldComplete (Error is thrown)",
        document: `
        {
          film(id: 1) {
            title
          }
        }`,
        hooks: {
          afterFieldComplete: jest.fn().mockImplementation(() => {
            throw new Error("Hook error");
          }),
        },
        expectedErrorMessage:
          "Unexpected error thrown by afterFieldComplete hook: Hook error",
      },
      {
        name: "afterFieldComplete (string is thrown)",
        document: `
        {
          film(id: 1) {
            title
          }
        }`,
        hooks: {
          afterFieldComplete: jest.fn().mockImplementation(() => {
            throw "Hook error";
          }),
        },
        expectedErrorMessage:
          'Unexpected error thrown by afterFieldComplete hook: "Hook error"',
      },
    ];

    it.each(testCases)(
      "$name",
      async ({ document, hooks, expectedErrorMessage, variables }) => {
        expect.assertions(5);
        const parsedDocument = parse(document);

        const response = await drainExecution(
          await execute(
            parsedDocument,
            resolvers as UserResolvers,
            hooks,
            variables,
          ),
        );
        const result = Array.isArray(response) ? response[0] : response;

        expect(isTotalExecutionResult(result)).toBe(true);
        const errors = result.errors;

        expect(result.data.film).toBeNull();
        expect(errors).toBeDefined();
        expect(errors).toHaveLength(1);
        expect(errors?.[0].message).toBe(expectedErrorMessage);
      },
    );
  });

  describe("Error is returned by hooks during field resolution", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    const testCases: Array<HookExceptionTestCase> = [
      {
        name: "beforeFieldResolve (Error is returned)",
        document: `
        {
          film(id: 1) {
            title
          }
        }`,
        hooks: {
          beforeFieldResolve: jest.fn().mockImplementation(() => {
            return new Error("Hook error");
          }),
        },
        expectedErrorMessage:
          "Unexpected error returned from beforeFieldResolve hook: Hook error",
      },
      {
        name: "afterFieldResolve (Error is returned)",
        document: `
        {
          film(id: 1) {
            title
          }
        }`,
        hooks: {
          afterFieldResolve: jest.fn().mockImplementation(() => {
            return new Error("Hook error");
          }),
        },
        expectedErrorMessage:
          "Unexpected error returned from afterFieldResolve hook: Hook error",
      },
      {
        name: "afterFieldComplete (Error is returned)",
        document: `
        {
          film(id: 1) {
            title
          }
        }`,
        hooks: {
          afterFieldComplete: jest.fn().mockImplementation(() => {
            return new Error("Hook error");
          }),
        },
        expectedErrorMessage:
          "Unexpected error returned from afterFieldComplete hook: Hook error",
      },
    ];

    it.each(testCases)(
      "$name",
      async ({ document, hooks, expectedErrorMessage, variables }) => {
        expect.assertions(5);
        const parsedDocument = parse(document);

        const response = await drainExecution(
          await execute(
            parsedDocument,
            resolvers as UserResolvers,
            hooks,
            variables,
          ),
        );
        const result = Array.isArray(response) ? response[0] : response;
        expect(isTotalExecutionResult(result)).toBe(true);
        const errors = result.errors;
        expect(result.data.film).not.toBeNull();
        expect(errors).toBeDefined();
        expect(errors).toHaveLength(1);
        expect(errors?.[0].message).toBe(expectedErrorMessage);
      },
    );
  });

  describe("Error in afterBuildResponse", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test("afterBuildResponse (Error is thrown)", async () => {
      expect.assertions(5);

      const response = await drainExecution(
        await execute(
          parse(`query GetFilm{
              film(id: 1) {
                title
              }
            }`),
          resolvers as UserResolvers,
          {
            afterBuildResponse: jest.fn().mockImplementation(() => {
              throw new Error("Hook error");
            }),
          },
        ),
      );
      const result = Array.isArray(response) ? response[0] : response;
      expect(isTotalExecutionResult(result)).toBe(true);
      const errors = result.errors;
      expect(result.data).toBeUndefined();
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors?.[0].message).toBe(
        "Unexpected error thrown by afterBuildResponse hook (operation: GetFilm): Hook error",
      );
    });

    test("afterBuildResponse (Error is returned)", async () => {
      expect.assertions(5);

      const response = await drainExecution(
        await execute(
          parse(`{
              film(id: 1) {
                title
              }
            }`),
          resolvers as UserResolvers,
          {
            afterBuildResponse: jest.fn().mockImplementation(() => {
              return new Error("Hook error");
            }),
          },
        ),
      );
      const result = Array.isArray(response) ? response[0] : response;
      expect(isTotalExecutionResult(result)).toBe(true);
      const errors = result.errors;
      expect(result.data).toBeDefined();
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors?.[0].message).toBe(
        "Unexpected error returned from afterBuildResponse hook (operation: unknown): Hook error",
      );
    });
  });

  describe("Error thrown in the BEFORE OPERATION hook breaks execution", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    const testCases: Array<HookExceptionTestCase> = [
      {
        name: "beforeOperationExecute (Error is thrown)",
        document: `
        {
          film(id: 1) {
            title
          }
        }`,
        hooks: {
          beforeOperationExecute: jest.fn().mockImplementation(() => {
            throw new Error("Hook error");
          }),
        },
        expectedErrorMessage:
          "Unexpected error thrown by beforeOperationExecute hook (operation: unknown): Hook error",
      },
      {
        name: "beforeOperationExecute (string is thrown)",
        document: `
        {
          film(id: 1) {
            title
          }
        }`,
        hooks: {
          beforeOperationExecute: jest.fn().mockImplementation(() => {
            throw "Hook error";
          }),
        },
        expectedErrorMessage:
          'Unexpected error thrown by beforeOperationExecute hook (operation: unknown): "Hook error"',
      },
    ];

    it.each(testCases)(
      "$name",
      async ({ document, hooks, expectedErrorMessage, variables }) => {
        expect.assertions(5);
        const parsedDocument = parse(document);

        const response = await drainExecution(
          await execute(
            parsedDocument,
            resolvers as UserResolvers,
            hooks,
            variables,
          ),
        );

        const result = Array.isArray(response) ? response[0] : response;
        expect(isTotalExecutionResult(result)).toBe(true);
        const errors = result.errors;

        expect(result.data).toBeNull();
        expect(errors).toBeDefined();
        expect(errors).toHaveLength(1);
        expect(errors?.[0].message).toBe(expectedErrorMessage);
      },
    );
  });

  describe("Error returned in the hook doesn't break execution and is returned in response 'errors'", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    const testCases: Array<HookExceptionTestCase> = [
      {
        name: "beforeFieldResolve (Error is thrown)",
        document: `
        {
          film(id: 1) {
            title
          }
        }`,
        hooks: {
          beforeFieldResolve: jest.fn().mockImplementation(() => {
            return new Error("Hook error");
          }),
        },
        expectedErrorMessage:
          "Unexpected error returned from beforeFieldResolve hook: Hook error",
      },
      {
        name: "beforeOperationExecute (Error is thrown)",
        document: `
        {
          film(id: 1) {
            title
          }
        }`,
        hooks: {
          beforeOperationExecute: jest.fn().mockImplementation(() => {
            return new Error("Hook error");
          }),
        },
        expectedErrorMessage:
          "Unexpected error returned from beforeOperationExecute hook (operation: unknown): Hook error",
      },
      {
        name: "afterFieldResolve (Error is thrown)",
        document: `
        {
          film(id: 1) {
            title
          }
        }`,
        hooks: {
          afterFieldResolve: jest.fn().mockImplementation(() => {
            return new Error("Hook error");
          }),
        },
        expectedErrorMessage:
          "Unexpected error returned from afterFieldResolve hook: Hook error",
      },
      {
        name: "afterFieldComplete (Error is thrown)",
        document: `
        {
          film(id: 1) {
            title
          }
        }`,
        hooks: {
          afterFieldComplete: jest.fn().mockImplementation(() => {
            return new Error("Hook error");
          }),
        },
        expectedErrorMessage:
          "Unexpected error returned from afterFieldComplete hook: Hook error",
      },
      {
        name: "beforeSubscriptionEventEmit (Error is thrown)",
        document: `subscription EmitPersons($limit: Int!)
        {
          emitPersons(limit: $limit) {
            name
          }
        }`,
        variables: {
          limit: 1,
        },
        hooks: {
          beforeSubscriptionEventEmit: jest.fn().mockImplementation(() => {
            return new Error("Hook error");
          }),
        },
        expectedErrorMessage:
          "Unexpected error returned from beforeSubscriptionEventEmit hook (operation: EmitPersons): Hook error",
      },
      {
        name: "async beforeSubscriptionEventEmit (Error is thrown)",
        document: `subscription EmitPersons($limit: Int!)
        {
          emitPersons(limit: $limit) {
            name
          }
        }`,
        variables: {
          limit: 1,
        },
        hooks: {
          beforeSubscriptionEventEmit: jest
            .fn()
            .mockImplementation(async () => {
              return new Error("Hook error");
            }),
        },
        expectedErrorMessage:
          "Unexpected error returned from beforeSubscriptionEventEmit hook (operation: EmitPersons): Hook error",
      },
    ];

    it.each(testCases)(
      "$name",
      async ({ document, hooks, expectedErrorMessage, variables }) => {
        expect.assertions(5);
        const parsedDocument = parse(document);

        const response = await drainExecution(
          await execute(
            parsedDocument,
            resolvers as UserResolvers,
            hooks,
            variables,
          ),
        );
        const result = Array.isArray(response) ? response[0] : response;
        expect(isTotalExecutionResult(result)).toBe(true);
        const errors = result.errors;

        expect(result.data).toBeTruthy();
        expect(errors).toBeDefined();
        expect(errors).toHaveLength(1);
        expect(errors?.[0].message).toBe(expectedErrorMessage);
      },
    );
  });

  it("passes hook context", async () => {
    expect.assertions(2);

    const query = `
    {
      film(id: 1) {
        title
      }
    }`;
    const beforeHookContext = {
      foo: "foo",
    };
    const afterHookContext = {
      bar: "bar",
    };
    const hooks: ExecutionHooks = {
      beforeFieldResolve: jest.fn(() => beforeHookContext),
      afterFieldResolve: jest.fn(() => afterHookContext),
      afterFieldComplete: jest.fn(),
    };

    await execute(parse(query), resolvers as UserResolvers, hooks);

    expect(hooks.afterFieldResolve).toHaveBeenCalledWith(
      expect.objectContaining({ hookContext: beforeHookContext }),
    );
    expect(hooks.afterFieldComplete).toHaveBeenCalledWith(
      expect.objectContaining({ hookContext: afterHookContext }),
    );
  });

  it('passes async "before" hook context but "after" hook should already receive resolved promise', async () => {
    expect.assertions(2);

    const query = `
    {
      film(id: 1) {
        title
      }
    }`;
    const beforeHookContext = {
      foo: "foo",
    };
    const afterHookContext = {
      bar: "bar",
    };
    const hooks: ExecutionHooks = {
      beforeFieldResolve: jest.fn(async () => beforeHookContext),
      afterFieldResolve: jest.fn(() => afterHookContext),
      afterFieldComplete: jest.fn(),
    };

    await execute(parse(query), resolvers as UserResolvers, hooks);

    expect(hooks.afterFieldResolve).toHaveBeenCalledWith(
      expect.objectContaining({ hookContext: beforeHookContext }),
    );
    expect(hooks.afterFieldComplete).toHaveBeenCalledWith(
      expect.objectContaining({ hookContext: afterHookContext }),
    );
  });
});
