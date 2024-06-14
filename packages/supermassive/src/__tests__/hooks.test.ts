import { parse, DocumentNode } from "graphql";
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
  BaseExecuteFieldHookArgs,
  ExecutionHooks,
} from "../hooks/types";
import { pathToArray } from "../jsutils/Path";

interface TestCase {
  name: string;
  query: string;
  resolvers: UserResolvers;
  expectedHookCalls: string[];
  resultHasErrors: boolean;
}

interface HookExceptionTestCase {
  name: string;
  query: string;
  hooks: ExecutionHooks;
  expectedErrorMessage: string;
}

describe.each([
  {
    name: "executeWithoutSchema",
    execute: (
      document: DocumentNode,
      resolvers: UserResolvers,
      hooks: ExecutionHooks,
    ) => {
      const { definitions } = extractMinimalViableSchemaForRequestDocument(
        schema,
        document,
      );
      return executeWithoutSchema({
        document,
        schemaFragment: {
          schemaId: "test",
          resolvers,
          definitions,
        },
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
    ) => {
      return executeWithSchema({
        definitions: typeDefs,
        resolvers,
        document,
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
    const hooks: ExecutionHooks = {
      beforeFieldResolve: jest
        .fn()
        .mockImplementation(
          ({ resolveInfo }: BaseExecuteFieldHookArgs<unknown>) => {
            hookCalls.push(`BFR|${pathToArray(resolveInfo.path).join(".")}`);
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

    beforeEach(() => {
      jest.clearAllMocks();
      hookCalls = [];
    });

    const testCases: Array<TestCase> = [
      {
        name: "succeeded sync resolver",
        query: `
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
          "BFR|person",
          "AFR|person|[object]|undefined",
          "BFR|person.name",
          "AFR|person.name|Luke Skywalker|undefined",
          "AFC|person.name|Luke Skywalker|undefined",
          "AFC|person|[object]|undefined",
        ],
        resultHasErrors: false,
      },
      {
        name: "succeeded async resolver",
        query: `
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
          "BFR|person",
          "AFR|person|[object]|undefined",
          "BFR|person.name",
          "AFR|person.name|Luke Skywalker|undefined",
          "AFC|person.name|Luke Skywalker|undefined",
          "AFC|person|[object]|undefined",
        ],
        resultHasErrors: false,
      },
      {
        name: "error in sync resolver for nullable field",
        query: `
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
          "BFR|film",
          "AFR|film|[object]|undefined",
          "BFR|film.producer",
          "AFR|film.producer|undefined|Resolver error",
          "AFC|film.producer|undefined|Resolver error",
          "AFC|film|[object]|undefined",
        ],
        resultHasErrors: true,
      },
      {
        name: "error in async resolver for nullable field",
        query: `
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
          "BFR|film",
          "AFR|film|[object]|undefined",
          "BFR|film.producer",
          "AFR|film.producer|undefined|Resolver error",
          "AFC|film.producer|undefined|Resolver error",
          "AFC|film|[object]|undefined",
        ],
        resultHasErrors: true,
      },
      {
        name: "error in sync resolver for non-nullable field",
        query: `
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
          "BFR|film",
          "AFR|film|[object]|undefined",
          "BFR|film.title",
          "AFR|film.title|undefined|Resolver error",
          "AFC|film.title|undefined|Resolver error",
          "AFC|film|undefined|Resolver error",
        ],
        resultHasErrors: true,
      },
      {
        name: "error in async resolver for non-nullable field",
        query: `
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
          "BFR|film",
          "AFR|film|[object]|undefined",
          "BFR|film.title",
          "AFR|film.title|undefined|Resolver error",
          "AFC|film.title|undefined|Resolver error",
          "AFC|film|undefined|Resolver error",
        ],
        resultHasErrors: true,
      },
      {
        name: "do not invoke hooks for the field with default resolver",
        query: `
        {
          film(id: 1) {
            title
          }
        }`,
        resolvers: resolvers as UserResolvers,
        expectedHookCalls: [
          "BFR|film",
          "AFR|film|[object]|undefined",
          "AFC|film|[object]|undefined",
        ],
        resultHasErrors: false,
      },
      {
        name: "do not invoke hooks for the __typename",
        query: `
        {
          film(id: 1) {
            __typename
            title
          }
        }`,
        resolvers: resolvers as UserResolvers,
        expectedHookCalls: [
          "BFR|film",
          "AFR|film|[object]|undefined",
          "AFC|film|[object]|undefined",
        ],
        resultHasErrors: false,
      },
    ];

    it.each(testCases)(
      "$name",
      async ({ query, resolvers, expectedHookCalls, resultHasErrors }) => {
        expect.assertions(4);
        const document = parse(query);

        const result = await execute(document, resolvers, hooks);

        // for async resolvers order of resolving isn't strict,
        // so just verify whether corresponding hook calls happened
        expect(hookCalls).toEqual(expect.arrayContaining(expectedHookCalls));
        expect(hookCalls).toHaveLength(expectedHookCalls.length);
        expect(isTotalExecutionResult(result)).toBe(true);
        expect(((result as TotalExecutionResult).errors?.length ?? 0) > 0).toBe(
          resultHasErrors,
        );
      },
    );
  });

  describe("Error thrown in the hook doesn't break execution and is returned in response 'errors'", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    const testCases: Array<HookExceptionTestCase> = [
      {
        name: "beforeFieldResolve (Error is thrown)",
        query: `
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
          "Unexpected error in beforeFieldResolve hook: Hook error",
      },
      {
        name: "beforeFieldResolve (string is thrown)",
        query: `
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
          'Unexpected error in beforeFieldResolve hook: "Hook error"',
      },
      {
        name: "afterFieldResolve (Error is thrown)",
        query: `
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
          "Unexpected error in afterFieldResolve hook: Hook error",
      },
      {
        name: "afterFieldResolve (string is thrown)",
        query: `
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
          'Unexpected error in afterFieldResolve hook: "Hook error"',
      },
      {
        name: "afterFieldComplete (Error is thrown)",
        query: `
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
          "Unexpected error in afterFieldComplete hook: Hook error",
      },
      {
        name: "afterFieldComplete (string is thrown)",
        query: `
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
          'Unexpected error in afterFieldComplete hook: "Hook error"',
      },
    ];

    it.each(testCases)(
      "$name",
      async ({ query, hooks, expectedErrorMessage }) => {
        expect.assertions(5);
        const document = parse(query);

        const response = (await execute(
          document,
          resolvers as UserResolvers,
          hooks,
        )) as TotalExecutionResult;
        expect(isTotalExecutionResult(response)).toBe(true);
        const errors = response.errors;

        expect(response.data).toBeTruthy();
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
});
