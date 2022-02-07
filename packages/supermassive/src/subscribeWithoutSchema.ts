import { inspect } from "./jsutils/inspect";
import { isAsyncIterable } from "./jsutils/isAsyncIterable";
import { addPath, pathToArray } from "./jsutils/Path";
import type { Maybe } from "./jsutils/Maybe";
import {
  GraphQLError,
  locatedError,
  Kind,
  ASTNode as GraphQLASTNode,
  TypeNode,
} from "graphql";
import { DocumentNode } from "./ast/TypedAST";

import type { ExecutionContext } from "./executeWithoutSchema";
import {
  assertValidExecutionArguments,
  buildExecutionContext,
  buildResolveInfo,
  executeWithoutSchema,
  getOperationRootTypeName,
} from "./executeWithoutSchema";
import { collectFields } from "./collectFields";
import { getArgumentValues } from "./values";
import { typeNameFromAST } from "./utilities/typeNameFromAST";
import { mergeResolvers } from "./utilities/mergeResolvers";

import { mapAsyncIterator } from "./utilities/mapAsyncIterator";

import {
  ObjectTypeResolver,
  FunctionFieldResolver,
  ExecutionWithoutSchemaArgs,
  FieldResolver,
  Resolvers,
  ExecutionResult,
} from "./types";

/**
 * Implements the "Subscribe" algorithm described in the GraphQL specification.
 *
 * Returns a Promise which resolves to either an AsyncIterator (if successful)
 * or an ExecutionResult (error). The promise will be rejected if the schema or
 * other arguments to this function are invalid, or if the resolved event stream
 * is not an async iterable.
 *
 * If the client-provided arguments to this function do not result in a
 * compliant subscription, a GraphQL Response (ExecutionResult) with
 * descriptive errors and no data will be returned.
 *
 * If the source stream could not be created due to faulty subscription
 * resolver logic or underlying systems, the promise will resolve to a single
 * ExecutionResult containing `errors` and no `data`.
 *
 * If the operation succeeded, the promise resolves to an AsyncIterator, which
 * yields a stream of ExecutionResults representing the response stream.
 *
 * Accepts either an object with named arguments, or individual arguments.
 */
export async function subscribeWithoutSchema(
  args: ExecutionWithoutSchemaArgs,
): Promise<AsyncGenerator<ExecutionResult, void, void> | ExecutionResult> {
  const {
    resolvers,
    schemaResolvers,
    document,
    rootValue,
    contextValue,
    variableValues,
    operationName,
    fieldResolver,
    subscribeFieldResolver,
  } = args;

  const combinedResolvers = mergeResolvers(resolvers, schemaResolvers);

  const resultOrStream = await createSourceEventStream(
    combinedResolvers,
    document,
    rootValue,
    contextValue,
    variableValues,
    operationName,
    subscribeFieldResolver,
  );

  if (!isAsyncIterable(resultOrStream)) {
    return resultOrStream;
  }

  // For each payload yielded from a subscription, map it over the normal
  // GraphQL `execute` function, with `payload` as the rootValue.
  // This implements the "MapSourceToResponseEvent" algorithm described in
  // the GraphQL specification. The `execute` function provides the
  // "ExecuteSubscriptionEvent" algorithm, as it is nearly identical to the
  // "ExecuteQuery" algorithm, for which `execute` is also used.
  const mapSourceToResponse = (payload: unknown) =>
    executeWithoutSchema({
      resolvers,
      schemaResolvers,
      document,
      rootValue: payload,
      contextValue,
      variableValues,
      operationName,
      fieldResolver,
    });

  // Map every source value to a ExecutionResult value as described above.
  return mapAsyncIterator(resultOrStream, mapSourceToResponse);
}

/**
 * Implements the "CreateSourceEventStream" algorithm described in the
 * GraphQL specification, resolving the subscription source event stream.
 *
 * Returns a Promise which resolves to either an AsyncIterable (if successful)
 * or an ExecutionResult (error). The promise will be rejected if the schema or
 * other arguments to this function are invalid, or if the resolved event stream
 * is not an async iterable.
 *
 * If the client-provided arguments to this function do not result in a
 * compliant subscription, a GraphQL Response (ExecutionResult) with
 * descriptive errors and no data will be returned.
 *
 * If the the source stream could not be created due to faulty subscription
 * resolver logic or underlying systems, the promise will resolve to a single
 * ExecutionResult containing `errors` and no `data`.
 *
 * If the operation succeeded, the promise resolves to the AsyncIterable for the
 * event stream returned by the resolver.
 *
 * A Source Event Stream represents a sequence of events, each of which triggers
 * a GraphQL execution for that event.
 *
 * This may be useful when hosting the stateful subscription service in a
 * different process or machine than the stateless GraphQL execution engine,
 * or otherwise separating these two steps. For more on this, see the
 * "Supporting Subscriptions at Scale" information in the GraphQL specification.
 */
export async function createSourceEventStream(
  resolvers: Resolvers,
  document: DocumentNode,
  rootValue?: unknown,
  contextValue?: unknown,
  variableValues?: Maybe<{ readonly [variable: string]: unknown }>,
  operationName?: Maybe<string>,
  fieldResolver?: Maybe<FunctionFieldResolver<any, any>>,
): Promise<AsyncIterable<unknown> | ExecutionResult> {
  // If arguments are missing or incorrectly typed, this is an internal
  // developer mistake which should throw an early error.
  assertValidExecutionArguments(document, variableValues);

  try {
    // If a valid context cannot be created due to incorrect arguments, this will throw an error.
    const exeContext = buildExecutionContext(
      resolvers,
      document,
      rootValue,
      contextValue,
      variableValues,
      operationName,
      fieldResolver,
    );

    // Return early errors if execution context failed.
    if (!("resolvers" in exeContext)) {
      return { errors: exeContext };
    }

    const eventStream = await executeSubscription(exeContext);

    // Assert field returned an event stream, otherwise yield an error.
    if (!isAsyncIterable(eventStream)) {
      throw new Error(
        "Subscription field must return Async Iterable. " +
          `Received: ${inspect(eventStream)}.`,
      );
    }

    return eventStream;
  } catch (error) {
    // If it GraphQLError, report it as an ExecutionResult, containing only errors and no data.
    // Otherwise treat the error as a system-class error and re-throw it.
    if (error instanceof GraphQLError) {
      return { errors: [error] };
    }
    throw error;
  }
}

async function executeSubscription(
  exeContext: ExecutionContext,
): Promise<unknown> {
  const {
    resolvers,
    fragments,
    operation,
    variableValues,
    rootValue,
  } = exeContext;
  const typeName = getOperationRootTypeName(operation);
  const fields = collectFields(
    resolvers,
    fragments,
    variableValues,
    typeName,
    operation.selectionSet,
    new Map(),
    new Set(),
  );

  const [responseName, fieldNodes] = [...fields.entries()][0];
  const fieldName = fieldNodes[0].name.value;

  let resolveFn;
  let returnTypeName: string;
  let returnTypeNode: TypeNode;
  if (fieldName === "__typename" && !resolveFn) {
    resolveFn = () => typeName;
    returnTypeName = "String";
    returnTypeNode = {
      kind: Kind.NAMED_TYPE,
      name: {
        kind: Kind.NAME,
        value: "String",
      },
    };
  } else {
    returnTypeNode = fieldNodes[0].__type as TypeNode;
    returnTypeName = typeNameFromAST(returnTypeNode);
    const typeResolvers = exeContext.resolvers[typeName];
    resolveFn = ((typeResolvers as
      | ObjectTypeResolver<any, any, any>
      | undefined)?.[fieldName] as any).subscribe;
  }

  if (!resolveFn) {
    resolveFn = exeContext.fieldResolver;
  }

  const path = addPath(undefined, responseName, typeName);
  const info = buildResolveInfo(
    exeContext,
    fieldName,
    fieldNodes,
    typeName,
    returnTypeName,
    returnTypeNode,
    path,
  );

  try {
    // Implements the "ResolveFieldEventStream" algorithm from GraphQL specification.
    // It differs from "ResolveFieldValue" due to providing a different `resolveFn`.

    // Build a JS object of arguments from the field.arguments AST, using the
    // variables scope to fulfill any variable references.
    const args = getArgumentValues(resolvers, fieldNodes[0], variableValues);

    // The resolve function's optional third argument is a context value that
    // is provided to every resolve function within an execution. It is commonly
    // used to represent an authenticated user, or request-specific caches.
    const contextValue = exeContext.contextValue;

    // Call the `subscribe()` resolver or the default resolver to produce an
    // AsyncIterable yielding raw payloads.
    const eventStream = await resolveFn(rootValue, args, contextValue, info);

    if (eventStream instanceof Error) {
      throw eventStream;
    }
    return eventStream;
  } catch (error) {
    throw locatedError(
      error,
      fieldNodes as ReadonlyArray<GraphQLASTNode>,
      pathToArray(path),
    );
  }
}
