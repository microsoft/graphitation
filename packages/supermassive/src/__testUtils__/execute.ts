import {
  DocumentNode,
  GraphQLSchema,
  Kind,
  OperationDefinitionNode,
  parse,
  ExecutionArgs,
  ExecutionArgs as GraphQLExecutionArgs,
  ExecutionResult as GraphQLExecutionResult,
} from "graphql";
import { executeWithSchema } from "../executeWithSchema";
import { typeDefs } from "../benchmarks/swapi-schema";
import resolvers from "../benchmarks/swapi-schema/resolvers";
import { ExecutionResult, UserResolvers } from "../types";
import models from "../benchmarks/swapi-schema/models";
import { executeWithoutSchema } from "../executeWithoutSchema";
import { extractMinimalViableSchemaForRequestDocument } from "../utilities/extractMinimalViableSchemaForRequestDocument";
import { PromiseOrValue } from "graphql/jsutils/PromiseOrValue";
import { ObjMap } from "../jsutils/ObjMap";
import { forAwaitEach, isAsyncIterable } from "iterall";

type GraphQLResult<TData = ObjMap<unknown>, TExtensions = ObjMap<unknown>> =
  | GraphQLExecutionResult<TData, TExtensions>
  | AsyncGenerator<GraphQLExecutionResult<TData, TExtensions>, void, void>;

export function createExecutionUtils(
  graphqlExecute: (args: ExecutionArgs) => PromiseOrValue<ExecutionResult>,
  graphqlSubscribe: (
    args: ExecutionArgs,
  ) => PromiseOrValue<AsyncIterableIterator<ExecutionResult> | ExecutionResult>,
) {
  async function compareResultsForExecuteWithSchema(
    schema: GraphQLSchema,
    query: string,
    variables?: Record<string, unknown>,
  ) {
    expect.assertions(1);
    const document = parse(query);
    const result = await drainExecution(
      await executeWithSchema({
        document,
        definitions: typeDefs,
        resolvers: resolvers as UserResolvers<unknown, unknown>,
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

  async function compareResultForExecuteWithoutSchemaWithMVSAnnotation(
    schema: GraphQLSchema,
    query: string,
    variables: Record<string, unknown> = {},
  ) {
    expect.assertions(1);
    const document = parse(query);
    const { definitions } = extractMinimalViableSchemaForRequestDocument(
      schema,
      document,
    );
    const result = await drainExecution(
      await executeWithoutSchema({
        document,
        contextValue: {
          models,
        },
        schemaFragment: {
          schemaId: "test",
          definitions,
          resolvers: resolvers as UserResolvers,
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

    if (operation.operation === "subscription") {
      return graphqlSubscribe(args) as GraphQLResult;
    } else {
      return graphqlExecute(args) as GraphQLResult;
    }
  }

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

  return {
    compareResultForExecuteWithoutSchemaWithMVSAnnotation,
    compareResultsForExecuteWithSchema,
    drainExecution,
    graphqlExecuteOrSubscribe,
  };
}
