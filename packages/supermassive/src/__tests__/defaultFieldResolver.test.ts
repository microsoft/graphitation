import { execute, parse, subscribe } from "graphql";
import {
  defaultFieldResolver,
  executeWithoutSchema,
} from "../executeWithoutSchema";
import { encodeASTSchema } from "../utilities/encodeASTSchema";
import { CommonExecutionArgs, UserResolvers } from "../types";
import { createExecutionUtils } from "../__testUtils__/execute";

const { drainExecution } = createExecutionUtils(execute, subscribe);

function executeDefaultFields(
  schema: string,
  document: string,
  rootValue: unknown,
  options: Partial<CommonExecutionArgs> = {},
  resolvers: UserResolvers = {},
) {
  return executeWithoutSchema({
    ...options,
    document: parse(document),
    rootValue,
    schemaFragment: {
      schemaId: "default-field-resolver-tests",
      definitions: encodeASTSchema(parse(schema))[0],
      resolvers,
    },
  });
}

describe("lightweight default field resolution", () => {
  test.each(["query", "mutation"])(
    "resolves property fields without invoking hooks in a %s",
    async (operation) => {
      const beforeFieldResolve = jest.fn();
      const afterFieldResolve = jest.fn();
      const afterFieldComplete = jest.fn();
      const result = await executeDefaultFields(
        `
          type Query { item: Item! }
          type Mutation { item: Item! }
          type Item { value: String! values: [String!]! }
        `,
        `${operation} { __typename item { __typename alias: value values } }`,
        { item: { value: "hello", values: ["one", "two"] } },
        {
          fieldExecutionHooks: {
            beforeFieldResolve,
            afterFieldResolve,
            afterFieldComplete,
          },
        },
      );

      expect(result).toEqual({
        data: {
          __typename: operation === "query" ? "Query" : "Mutation",
          item: {
            __typename: "Item",
            alias: "hello",
            values: ["one", "two"],
          },
        },
      });
      expect(beforeFieldResolve).not.toHaveBeenCalled();
      expect(afterFieldResolve).not.toHaveBeenCalled();
      expect(afterFieldComplete).not.toHaveBeenCalled();
    },
  );

  test("function properties receive arguments, context, info and their source as this", async () => {
    const contextValue = { prefix: "hello" };
    const property = jest.fn(function (
      this: { name: string },
      args,
      context,
      info,
    ) {
      expect(this.name).toBe("world");
      expect(args).toEqual({ suffix: "!" });
      expect(context).toBe(contextValue);
      expect(info).toMatchObject({
        fieldName: "greeting",
        parentTypeName: "Query",
        returnTypeName: "String",
        path: { key: "alias", typename: "Query" },
        isInIncrementalExecution: false,
      });
      return Promise.resolve(`${context.prefix} ${this.name}${args.suffix}`);
    });
    const getter = jest.fn(() => property);
    const source = {
      name: "world",
      get greeting() {
        return getter();
      },
    };
    const result = await executeDefaultFields(
      `type Query { greeting(suffix: String = "!"): String! }`,
      `{ alias: greeting }`,
      source,
      { contextValue },
    );

    expect(result).toEqual({ data: { alias: "hello world!" } });
    expect(property).toHaveBeenCalledTimes(1);
    expect(getter).toHaveBeenCalledTimes(1);
  });

  test("custom fallback resolvers still receive full info and arguments", async () => {
    const fieldResolver = jest.fn((_source, args, _context, info) => {
      expect(args).toEqual({ suffix: "!" });
      expect(info).toMatchObject({
        fieldName: "greeting",
        parentTypeName: "Query",
        returnTypeName: "String",
      });
      return "hello";
    });
    const result = await executeDefaultFields(
      `type Query { greeting(suffix: String = "!"): String! }`,
      `{ greeting }`,
      {},
      { fieldResolver },
    );
    expect(result).toEqual({ data: { greeting: "hello" } });
    expect(fieldResolver).toHaveBeenCalledTimes(1);
  });

  test("function properties can shadow Function.prototype.call", async () => {
    const greeting = Object.assign(
      function (this: { value: string }) {
        return this.value;
      },
      { call: () => "wrong function" },
    );
    const result = await executeDefaultFields(
      `type Query { greeting: String }`,
      `{ greeting }`,
      { value: "hello", greeting },
    );
    expect(result).toEqual({ data: { greeting: "hello" } });
  });

  test("property getter errors retain the aliased field path", async () => {
    const result = await executeDefaultFields(
      `type Query { value: String }`,
      `{ alias: value }`,
      {
        get value() {
          throw new Error("failed");
        },
      },
    );
    expect(result).toMatchObject({
      data: { alias: null },
      errors: [{ message: "failed", path: ["alias"] }],
    });
  });

  test("explicitly registered built-in resolvers support property promises", async () => {
    expect(
      await executeDefaultFields(
        `type Query { value: String }`,
        `{ value }`,
        { value: Promise.resolve("hello") },
        {},
        { Query: { value: defaultFieldResolver } },
      ),
    ).toEqual({ data: { value: "hello" } });
  });

  test("property fields still validate declared arguments", async () => {
    const result = await executeDefaultFields(
      `type Query { value(required: String!): String }`,
      `{ value }`,
      { value: "hello" },
    );
    expect(result).toMatchObject({
      data: { value: null },
      errors: [
        {
          message:
            'Unexpected error value: "Argument \\"required\\" of required type \\"String!\\" was not provided."',
          path: ["value"],
        },
      ],
    });
  });

  test("registered built-in resolvers preserve hooks when the fallback is customized", async () => {
    const beforeFieldResolve = jest.fn();
    const afterFieldResolverReturnsPromise = jest.fn();
    const result = await executeDefaultFields(
      `type Query { value: String }`,
      `{ value }`,
      { value: Promise.resolve("hello") },
      {
        fieldResolver: () => "fallback",
        fieldExecutionHooks: {
          beforeFieldResolve,
          afterFieldResolverReturnsPromise,
        },
      },
      { Query: { value: defaultFieldResolver } },
    );
    expect(result).toEqual({ data: { value: "hello" } });
    expect(beforeFieldResolve).toHaveBeenCalledTimes(1);
    expect(afterFieldResolverReturnsPromise).toHaveBeenCalledWith(
      expect.objectContaining({
        resolveInfo: expect.objectContaining({ fieldName: "value" }),
      }),
    );
  });

  test("rejected property promises retain the field error path", async () => {
    const result = await executeDefaultFields(
      `type Query { value: String }`,
      `{ alias: value }`,
      { value: Promise.reject(new Error("failed")) },
    );
    expect(result).toMatchObject({
      data: { alias: null },
      errors: [{ message: "failed", path: ["alias"] }],
    });
  });

  test.each([false, true])(
    "abstract property fields preserve info for custom type resolvers (global: %s)",
    async (global) => {
      const typeResolver = jest.fn((_source, _context, info) => {
        expect(info).toMatchObject({
          fieldName: "items",
          parentTypeName: "Query",
          returnTypeName: "Node",
          path: { key: "alias", typename: "Query" },
        });
        return Promise.resolve("Item");
      });
      const result = await executeDefaultFields(
        `
          type Query { items: [[Node!]!]! }
          interface Node { value: String! }
          type Item implements Node { value: String! }
        `,
        `{ alias: items { __typename value } }`,
        { items: [[{ value: "hello" }]] },
        global ? { typeResolver } : {},
        global ? {} : { Node: { __resolveType: typeResolver } },
      );
      expect(result).toEqual({
        data: { alias: [[{ __typename: "Item", value: "hello" }]] },
      });
      expect(typeResolver).toHaveBeenCalledTimes(1);
    },
  );

  test.each([
    {
      type: "[[String!]]",
      value: [[null]],
      data: { alias: [null] },
      message: "Cannot return null for non-nullable field Query.values.",
      path: ["alias", 0, 0],
    },
    {
      type: "[[String]]",
      value: ["not a list"],
      data: { alias: [null] },
      message:
        'Unexpected error value: "Expected Iterable, but did not find one for field \\"Query.values\\"."',
      path: ["alias", 0],
    },
  ])("preserves error names and paths: $message", async (testCase) => {
    const result = await executeDefaultFields(
      `type Query { values: ${testCase.type} }`,
      `{ alias: values }`,
      { values: testCase.value },
    );
    expect(result).toMatchObject({
      data: testCase.data,
      errors: [{ message: testCase.message, path: testCase.path }],
    });
  });

  test.each([false, true])(
    "property lists support streamed values without info (async: %s)",
    async (async) => {
      const list = ["one", Promise.resolve("two")];
      const result = await drainExecution(
        await executeDefaultFields(
          `type Query { values: [String] }`,
          `{ values @stream(initialCount: 1) }`,
          {
            values: async
              ? (async function* () {
                  yield* list;
                })()
              : list,
          },
        ),
      );
      expect(result).toMatchObject({
        initialResult: { data: { values: ["one"] }, hasNext: true },
        subsequentResults: expect.arrayContaining([
          {
            incremental: [{ items: ["two"], path: ["values", 1] }],
            hasNext: async,
          },
        ]),
      });
    },
  );

  test("deferred function properties retain incremental resolve info", async () => {
    const value = jest.fn((_args, _context, info) => {
      expect(info.isInIncrementalExecution).toBe(true);
      return "hello";
    });
    const result = await drainExecution(
      await executeDefaultFields(
        `type Query { item: Item } type Item { value: String }`,
        `{ item { ... @defer { value } } }`,
        { item: { value } },
      ),
    );
    expect(result).toEqual({
      initialResult: { data: { item: {} }, hasNext: true },
      subsequentResults: [
        {
          incremental: [{ data: { value: "hello" }, path: ["item"] }],
          hasNext: false,
        },
      ],
    });
    expect(value).toHaveBeenCalledTimes(1);
  });

  test.each([false, true])(
    "subscription stream properties preserve event resolution (promised: %s)",
    async (promised) => {
      const stream = (async function* () {
        yield { value: "hello" };
      })();
      const result = await drainExecution(
        await executeDefaultFields(
          `type Subscription { value: String }`,
          `subscription { alias: value }`,
          { value: promised ? Promise.resolve(stream) : stream },
        ),
      );
      expect(result).toEqual([{ data: { alias: "hello" } }]);
    },
  );

  test("subscription function properties receive full info", async () => {
    const subscribeProperty = jest.fn((_args, _context, info) => {
      expect(info).toMatchObject({
        fieldName: "value",
        parentTypeName: "Subscription",
        returnTypeName: "String",
      });
      return (async function* () {
        yield { value: "hello" };
      })();
    });
    const result = await drainExecution(
      await executeDefaultFields(
        `type Subscription { value: String }`,
        `subscription { value }`,
        { value: subscribeProperty },
      ),
    );
    expect(result).toEqual([{ data: { value: "hello" } }]);
    expect(subscribeProperty).toHaveBeenCalledTimes(1);
  });

  test("rejected subscription stream promises retain the field error path", async () => {
    const result = await executeDefaultFields(
      `type Subscription { value: String }`,
      `subscription { alias: value }`,
      { value: Promise.reject(new Error("failed")) },
    );
    expect(result).toMatchObject({
      errors: [{ message: "failed", path: ["alias"] }],
    });
  });
});
