import { parse, DocumentNode } from "graphql";
import { executeWithoutSchema, executeWithSchema } from "..";
import schema, { typeDefs } from "../benchmarks/swapi-schema";
import models from "../benchmarks/swapi-schema/models";
import resolvers from "../benchmarks/swapi-schema/resolvers";
import { addTypesToRequestDocument } from "../ast/addTypesToRequestDocument";
import { Resolvers, UserResolvers } from "../types";
import { resolvers as extractedResolvers } from "../benchmarks/swapi-schema/__generated__/schema";
import {
  AfterFieldCompleteHookArgs,
  AfterFieldResolveHookArgs,
  BeforeFieldResolveHookArgs,
  ExecutionHooks,
} from "../hooks/types";
import { pathToArray } from "../jsutils/Path";

interface TestCase {
  name: string;
  query: string;
  resolvers: Resolvers;
  expectedHookCalls: string[];
}

describe.each([
  {
    name: "executeWithoutSchema",
    execute: (
      document: DocumentNode,
      resolvers: UserResolvers,
      hooks: ExecutionHooks,
    ) => {
      return executeWithoutSchema({
        document: addTypesToRequestDocument(schema, document),
        resolvers,
        schemaResolvers: extractedResolvers,
        contextValue: {
          models,
        },
        hooks,
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
        typeDefs,
        resolvers,
        document,
        contextValue: {
          models,
        },
        hooks,
      });
    },
  },
])("$name", ({ execute }) => {
  let hookCalls: string[];

  // Used hook acronyms:
  //   BFR: beforeFieldResolve
  //   AFR: afterFieldResolve
  //   AFC: afterFieldComplete
  const hooks: ExecutionHooks = {
    beforeFieldResolve: jest
      .fn()
      .mockImplementation(({ path }: BeforeFieldResolveHookArgs) => {
        hookCalls.push(`BFR|${pathToArray(path).join(".")}`);
      }),
    afterFieldResolve: jest
      .fn()
      .mockImplementation(
        ({ path, result, error }: AfterFieldResolveHookArgs) => {
          const resultValue =
            typeof result === "object" && result !== null ? "[object]" : result;
          hookCalls.push(
            `AFR|${pathToArray(path).join(".")}|${resultValue}|${
              error?.message
            }`,
          );
        },
      ),
    afterFieldComplete: jest
      .fn()
      .mockImplementation(
        ({ path, result, error }: AfterFieldCompleteHookArgs) => {
          const resultValue =
            typeof result === "object" && result !== null ? "[object]" : result;
          hookCalls.push(
            `AFC|${pathToArray(path).join(".")}|${resultValue}|${
              error?.message
            }`,
          );
        },
      ),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    hookCalls = [];
  });

  describe("Execution hooks are invoked", () => {
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
            name: (parent: any, _args: {}, _context: any) => {
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
            name: async (parent: any, _args: {}, _context: any) => {
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
            producer: (_parent: any, _args: {}, _context: any) => {
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
            producer: async (_parent: any, _args: {}, _context: any) => {
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
            title: (_parent: any, _args: {}, _context: any) => {
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
            title: async (_parent: any, _args: {}, _context: any) => {
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
      },
    ];

    it.each(testCases)(
      "$name",
      async ({ query, resolvers, expectedHookCalls }) => {
        expect.assertions(2);
        const document = parse(query);

        await execute(document, resolvers, hooks);

        // for async resolvers order of resolving isn't strict,
        // so just verify whether corresponding hook calls happened
        expect(hookCalls).toHaveLength(expectedHookCalls.length);
        expect(hookCalls).toEqual(expect.arrayContaining(expectedHookCalls));
      },
    );
  });
});
