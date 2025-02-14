import {
  GraphQLError,
  GraphQLLeafType,
  Kind,
  locatedError,
  DocumentNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
  OperationTypeDefinitionNode,
} from "graphql";
import {
  collectFields,
  collectSubfields as _collectSubfields,
  FieldGroup,
  GroupedFieldSet,
} from "./collectFields";
import { devAssert } from "./jsutils/devAssert";
import { inspect } from "./jsutils/inspect";
import { invariant } from "./jsutils/invariant";
import { isIterableObject } from "./jsutils/isIterableObject";
import { isObjectLike } from "./jsutils/isObjectLike";
import { isPromise } from "./jsutils/isPromise";
import type { Maybe } from "./jsutils/Maybe";
import type { ObjMap } from "./jsutils/ObjMap";
import type { Path } from "./jsutils/Path";
import { addPath, pathToArray } from "./jsutils/Path";
import { promiseForObject } from "./jsutils/promiseForObject";
import type { PromiseOrValue } from "./jsutils/PromiseOrValue";
import { promiseReduce } from "./jsutils/promiseReduce";
import type {
  ExecutionWithoutSchemaArgs,
  FunctionFieldResolver,
  ResolveInfo,
  TypeResolver,
  ExecutionResult,
  TotalExecutionResult,
  SubsequentIncrementalExecutionResult,
  IncrementalExecutionResult,
  SchemaFragment,
  SchemaFragmentLoader,
  SchemaFragmentRequest,
} from "./types";
import {
  getArgumentValues,
  getVariableValues,
  getDirectiveValues,
} from "./values";
import type { ExecutionHooks } from "./hooks/types";
import { arraysAreEqual } from "./utilities/array";
import { isAsyncIterable } from "./jsutils/isAsyncIterable";
import { mapAsyncIterator } from "./utilities/mapAsyncIterator";
import { GraphQLStreamDirective } from "./schema/directives";
import { memoize3 } from "./jsutils/memoize3";
import {
  inspectTypeReference,
  isListType,
  isNonNullType,
  typeNameFromReference,
  unwrap,
} from "./schema/reference";
import type { TypeReference } from "./schema/reference";
import type { FieldDefinition } from "./schema/definition";
import * as Definitions from "./schema/definition";
import * as Resolvers from "./schema/resolvers";
import { DeferredExecutionManager } from "./IncrementalDataManager";

/**
 * A memoized collection of relevant subfields with regard to the return
 * type. Memoizing ensures the subfields are not repeatedly calculated, which
 * saves overhead when resolving lists of values.
 */
const collectSubfields = memoize3(
  (
    exeContext: ExecutionContext,
    // HAX??
    returnTypeName: { name: string },
    fieldGroup: FieldGroup,
  ) => _collectSubfields(exeContext, returnTypeName.name, fieldGroup),
);

/**
 * Terminology
 *
 * "Definitions" are the generic name for top-level statements in the document.
 * Examples of this include:
 * 1) Operations (such as a query)
 * 2) Fragments
 *
 * "Operations" are a generic name for requests in the document.
 * Examples of this include:
 * 1) query,
 * 2) mutation
 *
 * "Selections" are the definitions that can appear legally and at
 * single level of the query. These include:
 * 1) field references e.g "a"
 * 2) fragment "spreads" e.g. "...c"
 * 3) inline fragment "spreads" e.g. "...on Type { a }"
 */

/**
 * Data that must be available at all points during query execution.
 *
 * Namely, schema of the type system that is currently executing,
 * and the fragments defined in the query document
 */
export interface ExecutionContext {
  schemaFragment: SchemaFragment;
  schemaFragmentLoader?: SchemaFragmentLoader;
  fragments: ObjMap<FragmentDefinitionNode>;
  rootValue: unknown;
  contextValue: unknown;
  buildContextValue?: (contextValue?: unknown) => unknown;
  operation: OperationDefinitionNode;
  variableValues: { [variable: string]: unknown };
  fieldResolver: FunctionFieldResolver<unknown, unknown>;
  typeResolver: TypeResolver<unknown, unknown>;
  subscribeFieldResolver: FunctionFieldResolver<unknown, unknown>;
  errors: Array<GraphQLError>;
  fieldExecutionHooks?: ExecutionHooks;
  deferredExecutionManager: DeferredExecutionManager;
}

/**
 * Implements the "Executing requests" section of the GraphQL specification.
 *
 * Returns either a synchronous ExecutionResult (if all encountered resolvers
 * are synchronous), or a Promise of an ExecutionResult that will eventually be
 * resolved and never rejected.
 *
 * If the arguments to this function do not result in a legal execution context,
 * a GraphQLError will be thrown immediately explaining the invalid input.
 */
export function executeWithoutSchema(
  args: ExecutionWithoutSchemaArgs,
): PromiseOrValue<ExecutionResult> {
  // If a valid execution context cannot be created due to incorrect arguments,
  // a "Response" with only errors is returned.
  const exeContext = buildExecutionContext(args);

  // Return early errors if execution context failed.
  if (!("schemaFragment" in exeContext)) {
    return { errors: exeContext };
  } else {
    return executeOperationWithBeforeHook(exeContext);
  }
}

/**
 * Essential assertions before executing to provide developer feedback for
 * improper use of the GraphQL library.
 *
 * @internal
 */
export function assertValidExecutionArguments(
  document: DocumentNode,
  rawVariableValues: Maybe<{ [variable: string]: unknown }>,
): void {
  devAssert(document, "Must provide document.");

  // Variables, if provided, must be an object.
  devAssert(
    rawVariableValues == null || isObjectLike(rawVariableValues),
    "Variables must be provided as an Object where each property is a variable value. Perhaps look to see if an unparsed JSON string was provided.",
  );
}

/**
 * Constructs a ExecutionContext object from the arguments passed to
 * execute, which we will pass throughout the other execution methods.
 *
 * Throws a GraphQLError if a valid execution context cannot be created.
 *
 * @internal
 */
function buildExecutionContext(
  args: ExecutionWithoutSchemaArgs,
): Array<GraphQLError> | ExecutionContext {
  const {
    schemaFragment,
    schemaFragmentLoader,
    document,
    rootValue,
    contextValue,
    buildContextValue,
    variableValues,
    operationName,
    fieldResolver,
    typeResolver,
    subscribeFieldResolver,
    fieldExecutionHooks,
  } = args;

  assertValidExecutionArguments(document, variableValues);

  let operation: OperationDefinitionNode | undefined;
  const fragments: ObjMap<FragmentDefinitionNode> = Object.create(null);

  for (const definition of document.definitions) {
    switch (definition.kind) {
      case Kind.OPERATION_DEFINITION:
        if (operationName == null) {
          if (operation !== undefined) {
            return [
              locatedError(
                "Must provide operation name if query contains multiple operations.",
                [],
              ),
            ];
          }
          operation = definition;
        } else if (definition.name?.value === operationName) {
          operation = definition;
        }
        break;
      case Kind.FRAGMENT_DEFINITION:
        fragments[definition.name.value] = definition;
        break;
    }
  }

  if (!operation) {
    if (operationName != null) {
      return [locatedError(`Unknown operation named "${operationName}".`, [])];
    }
    return [locatedError("Must provide an operation.", [])];
  }

  // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')
  const variableDefinitions = operation.variableDefinitions ?? [];

  const coercedVariableValues = getVariableValues(
    schemaFragment,
    variableDefinitions,
    variableValues ?? {},
    { maxErrors: 50 },
  );

  if (coercedVariableValues.errors) {
    return coercedVariableValues.errors;
  }

  return {
    schemaFragment,
    schemaFragmentLoader,
    fragments,
    rootValue,
    contextValue: buildContextValue
      ? buildContextValue(contextValue)
      : contextValue,
    buildContextValue,
    operation,
    variableValues: coercedVariableValues.coerced,
    fieldResolver: fieldResolver ?? defaultFieldResolver,
    typeResolver: typeResolver ?? defaultTypeResolver,
    subscribeFieldResolver: subscribeFieldResolver ?? defaultFieldResolver,
    errors: [],
    fieldExecutionHooks,
    deferredExecutionManager: new DeferredExecutionManager(),
  };
}

function buildPerEventExecutionContext(
  exeContext: ExecutionContext,
  payload: unknown,
): ExecutionContext {
  return {
    ...exeContext,
    contextValue: exeContext.buildContextValue
      ? exeContext.buildContextValue(exeContext.contextValue)
      : exeContext.contextValue,
    rootValue: payload,
    errors: [],
  };
}

function executeOperationWithBeforeHook(
  exeContext: ExecutionContext,
): PromiseOrValue<ExecutionResult> {
  const hooks = exeContext.fieldExecutionHooks;
  let hookResultPromise;
  if (hooks?.beforeOperationExecute) {
    hookResultPromise = invokeBeforeOperationExecuteHook(exeContext);
  }

  if (hookResultPromise instanceof GraphQLError) {
    return buildResponse(exeContext, null);
  }

  if (isPromise(hookResultPromise)) {
    return hookResultPromise.then((hookResult) => {
      if (hookResult instanceof GraphQLError) {
        return buildResponse(exeContext, null);
      }
      return executeOperation(exeContext);
    });
  }

  return executeOperation(exeContext);
}

function executeOperation(
  exeContext: ExecutionContext,
): PromiseOrValue<ExecutionResult> {
  try {
    const { operation, rootValue } = exeContext;
    const { operation: operationType, selectionSet } = operation;
    const rootTypeName = getOperationRootTypeName(operation);
    const { groupedFieldSet, deferredFieldSets } = collectFields(
      exeContext,
      rootTypeName,
      selectionSet,
    );
    const path = undefined;
    let result;

    // Note: cannot use OperationTypeNode from graphql-js as it doesn't exist in 15.x
    switch (operationType) {
      case "query":
        result = executeFields(
          exeContext,
          rootTypeName,
          rootValue,
          path,
          groupedFieldSet,
          null,
        );
        result = buildResponse(exeContext, result);
        break;
      case "mutation":
        result = executeFieldsSerially(
          exeContext,
          rootTypeName,
          rootValue,
          path,
          groupedFieldSet,
        );
        result = buildResponse(exeContext, result);
        break;
      case "subscription": {
        const resultOrStreamOrPromise = createSourceEventStream(exeContext);
        result = mapResultOrEventStreamOrPromise(
          resultOrStreamOrPromise,
          exeContext,
          rootTypeName,
          path,
          groupedFieldSet,
        );
        break;
      }
      default:
        invariant(
          false,
          `Operation "${operation.operation}" is not a part of GraphQL spec`,
        );
    }

    for (const {
      label,
      groupedFieldSet: deferredGroupFieldSet,
      nestedDefers,
    } of deferredFieldSets) {
      console.log(label, groupedFieldSet);
      exeContext.deferredExecutionManager.addDeferRecord({
        label: label || null,
        path,
        parentChunkId: null,
        returnTypeName: rootTypeName,
        parentResult: result,
        groupedFieldSet: deferredGroupFieldSet,
        nestedDefers,
      });
    }

    return result;
  } catch (error) {
    exeContext.errors.push(error as GraphQLError);
    return buildResponse(exeContext, null);
  }
}

/**
 * Given a completed execution context and data, build the { errors, data }
 * response defined by the "Response" section of the GraphQL specification.
 */
function buildResponse(
  exeContext: ExecutionContext,
  data: PromiseOrValue<ObjMap<unknown> | null>,
): PromiseOrValue<ExecutionResult> {
  if (isPromise(data)) {
    return data.then(
      (resolved) => buildResponse(exeContext, resolved),
      (error) => {
        exeContext.errors.push(error);
        return buildResponse(exeContext, null);
      },
    );
  }

  const hooks = exeContext.fieldExecutionHooks;
  try {
    const initialResult =
      exeContext.errors.length === 0
        ? { data }
        : { errors: exeContext.errors, data };
    if (hooks?.afterBuildResponse) {
      const hookResult = invokeAfterBuildResponseHook(
        exeContext,
        initialResult,
      );
      if (exeContext.errors.length > (initialResult.errors?.length ?? 0)) {
        initialResult.errors = exeContext.errors;
      }
      if (hookResult instanceof GraphQLError) {
        return { errors: initialResult.errors };
      }
    }
    if (
      initialResult.data != null &&
      exeContext.deferredExecutionManager.hasRecords()
    ) {
      return {
        initialResult: {
          ...initialResult,
          hasNext: true,
          pending: exeContext.deferredExecutionManager.getPending(),
        },
        subsequentResults: yieldSubsequentPayloads(exeContext),
      };
    } else {
      return initialResult;
    }
  } catch (error) {
    exeContext.errors.push(error as GraphQLError);
    return buildResponse(exeContext, null);
  }
}

/**
 * Implements the "Executing selection sets" section of the spec
 * for fields that must be executed serially.
 */
function executeFieldsSerially(
  exeContext: ExecutionContext,
  parentTypeName: string,
  sourceValue: unknown,
  path: Path | undefined,
  groupedFieldSet: GroupedFieldSet,
): PromiseOrValue<ObjMap<unknown>> {
  return promiseReduce(
    groupedFieldSet,
    (results, [responseName, fieldGroup]) => {
      const fieldPath = addPath(path, responseName, parentTypeName);
      const result = executeField(
        exeContext,
        parentTypeName,
        sourceValue,
        fieldGroup,
        fieldPath,
        null,
      );
      if (result === undefined) {
        return results;
      }
      if (isPromise(result)) {
        return result.then((resolvedResult: unknown) => {
          results[responseName] = resolvedResult;
          return results;
        });
      }
      results[responseName] = result;
      return results;
    },
    Object.create(null),
  );
}

/**
 * Implements the "Executing selection sets" section of the spec
 * for fields that may be executed in parallel.
 */
function executeFields(
  exeContext: ExecutionContext,
  parentTypeName: string,
  sourceValue: unknown,
  path: Path | undefined,
  groupedFieldSet: GroupedFieldSet,
  deferredChunkId: string | null,
): PromiseOrValue<ObjMap<unknown>> {
  const results = Object.create(null);
  let containsPromise = false;

  try {
    for (const [responseName, fieldGroup] of groupedFieldSet) {
      const fieldPath = addPath(path, responseName, parentTypeName);
      const result = executeField(
        exeContext,
        parentTypeName,
        sourceValue,
        fieldGroup,
        fieldPath,
        deferredChunkId,
      );

      if (result !== undefined) {
        results[responseName] = result;
        if (isPromise(result)) {
          containsPromise = true;
        }
      }
    }
  } catch (error) {
    if (containsPromise) {
      // Ensure that any promises returned by other fields are handled, as they may also reject.
      return promiseForObject(results).finally(() => {
        throw error;
      });
    }
    throw error;
  }

  // If there are no promises, we can just return the object
  if (!containsPromise) {
    return results;
  }

  // Otherwise, results is a map from field name to the result of resolving that
  // field, which is possibly a promise. Return a promise that will return this
  // same map, but with any promises replaced with the values they resolved to.
  return promiseForObject(results);
}

/**
 * Implements the "Executing field" section of the spec
 * `In` particular, this function figures out the value that the field returns by
 * calling its resolve function, then calls completeValue to complete promises,
 * serialize scalars, or execute the sub-selection-set for objects.
 */
function executeField(
  exeContext: ExecutionContext,
  parentTypeName: string,
  source: unknown,
  fieldGroup: FieldGroup,
  path: Path,
  deferredChunkId: string | null,
): PromiseOrValue<unknown> {
  const schemaFragment = exeContext.schemaFragment;
  const fieldName = fieldGroup[0].name.value;
  const fieldDef = Definitions.getField(
    schemaFragment.definitions,
    parentTypeName,
    fieldName,
  );

  if (fieldDef !== undefined) {
    return resolveAndCompleteField(
      exeContext,
      parentTypeName,
      fieldDef,
      fieldGroup,
      path,
      source,
      deferredChunkId,
    );
  }

  const loading = requestSchemaFragment(exeContext, {
    kind: "ReturnType",
    parentTypeName,
    fieldName,
  });
  if (!loading) {
    return undefined;
  }
  return loading.then(() => {
    const fieldDef = Definitions.getField(
      exeContext.schemaFragment.definitions,
      parentTypeName,
      fieldName,
    );
    if (fieldDef !== undefined) {
      return resolveAndCompleteField(
        exeContext,
        parentTypeName,
        fieldDef,
        fieldGroup,
        path,
        source,
        deferredChunkId,
      );
    }
    return undefined;
  });
}

function requestSchemaFragment(
  exeContext: ExecutionContext,
  request: SchemaFragmentRequest,
): PromiseOrValue<void> {
  if (!exeContext.schemaFragmentLoader) {
    return;
  }
  const currentSchemaId = exeContext.schemaFragment.schemaId;
  return exeContext
    .schemaFragmentLoader(
      exeContext.schemaFragment,
      exeContext.contextValue,
      request,
    )
    .then(({ mergedFragment, mergedContextValue }) => {
      if (currentSchemaId !== mergedFragment.schemaId) {
        throw new Error(
          `Cannot use new schema fragment: old and new fragments describe different schemas:` +
            ` ${currentSchemaId} vs. ${mergedFragment.schemaId}`,
        );
      }
      exeContext.contextValue = mergedContextValue ?? exeContext.contextValue;
      exeContext.schemaFragment = mergedFragment;
    });
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
function createSourceEventStream(
  exeContext: ExecutionContext,
): PromiseOrValue<ExecutionResult | AsyncIterable<unknown>> {
  try {
    const eventStream = executeSubscriptionImpl(exeContext);
    if (isPromise(eventStream)) {
      return eventStream.then(undefined, (error) => ({ errors: [error] }));
    }

    return eventStream;
  } catch (error) {
    return { errors: [error as GraphQLError] };
  }
}

function afterFieldSubscribeHandle(
  resolved: unknown,
  isDefaultResolverUsed: boolean,
  exeContext: ExecutionContext,
  info: ResolveInfo,
  hookContext: unknown | undefined,
  afterFieldSubscribe: boolean,
  error?: Error,
) {
  if (!isDefaultResolverUsed && afterFieldSubscribe) {
    hookContext = invokeAfterFieldSubscribeHook(
      info,
      exeContext,
      hookContext,
      resolved,
      error,
    );
  }
}

function executeSubscriptionImpl(
  exeContext: ExecutionContext,
): PromiseOrValue<AsyncIterable<unknown>> {
  const { operation, rootValue, schemaFragment } = exeContext;
  const rootTypeName = getOperationRootTypeName(operation);
  const { groupedFieldSet } = collectFields(
    exeContext,
    rootTypeName,
    operation.selectionSet,
  );

  const firstRootField = groupedFieldSet.entries().next().value;
  if (firstRootField === undefined) {
    throw locatedError("Must have at least one root field.", []);
  }

  const [responseName, fieldGroup] = firstRootField;
  const fieldName = fieldGroup[0].name.value;
  const fieldDef = Definitions.getField(
    schemaFragment.definitions,
    rootTypeName,
    fieldName,
  );

  if (!fieldDef) {
    throw locatedError(
      `The subscription field "${fieldName}" is not defined.`,
      fieldGroup,
    );
  }

  const returnTypeRef = Definitions.getFieldTypeReference(fieldDef);
  const resolveFn =
    Resolvers.getSubscriptionFieldResolver(
      schemaFragment,
      rootTypeName,
      fieldName,
    ) ?? exeContext.subscribeFieldResolver;

  const path = addPath(undefined, responseName, rootTypeName);
  const info = buildResolveInfo(
    exeContext,
    fieldName,
    fieldGroup,
    rootTypeName,
    typeNameFromReference(returnTypeRef),
    path,
  );

  const isDefaultResolverUsed = resolveFn === exeContext.subscribeFieldResolver;
  const hooks = exeContext.fieldExecutionHooks;
  let hookContext: unknown = undefined;

  try {
    // Implements the "ResolveFieldEventStream" algorithm from GraphQL specification.
    // It differs from "ResolveFieldValue" due to providing a different `resolveFn`.

    let result: unknown;

    if (!isDefaultResolverUsed && hooks?.beforeFieldSubscribe) {
      hookContext = invokeBeforeFieldSubscribeHook(info, exeContext);
    }

    // Build a JS object of arguments from the field.arguments AST, using the
    // variables scope to fulfill any variable references.
    const args = getArgumentValues(exeContext, fieldDef, fieldGroup[0]);

    // The resolve function's optional third argument is a context value that
    // is provided to every resolve function within an execution. It is commonly
    // used to represent an authenticated user, or request-specific caches.
    const contextValue = exeContext.contextValue;

    if (hookContext) {
      if (isPromise(hookContext)) {
        result = hookContext.then((context) => {
          hookContext = context;

          return resolveFn(rootValue, args, contextValue, info);
        });
      }
    }

    // Call the `subscribe()` resolver or the default resolver to produce an
    // AsyncIterable yielding raw payloads.
    if (result === undefined) {
      result = resolveFn(rootValue, args, contextValue, info);
    }

    if (isPromise(result)) {
      return result
        .then(assertEventStream, (error) => {
          afterFieldSubscribeHandle(
            undefined,
            isDefaultResolverUsed,
            exeContext,
            info,
            hookContext,
            !!hooks?.afterFieldSubscribe,
            error,
          );
          throw locatedError(error, fieldGroup, pathToArray(path));
        })
        .then((resolved) => {
          afterFieldSubscribeHandle(
            resolved,
            isDefaultResolverUsed,
            exeContext,
            info,
            hookContext,
            !!hooks?.afterFieldSubscribe,
          );

          return resolved;
        });
    }

    const stream = assertEventStream(result);
    afterFieldSubscribeHandle(
      stream,
      isDefaultResolverUsed,
      exeContext,
      info,
      hookContext,
      !!hooks?.afterFieldSubscribe,
    );
    return stream;
  } catch (error) {
    if (!isDefaultResolverUsed && hooks?.afterFieldSubscribe) {
      invokeAfterFieldSubscribeHook(
        info,
        exeContext,
        hookContext,
        undefined,
        error,
      );
    }

    throw locatedError(error, fieldGroup, pathToArray(path));
  }
}

function assertEventStream(result: unknown): AsyncIterable<unknown> {
  if (result instanceof Error) {
    throw result;
  }

  // Assert field returned an event stream, otherwise yield an error.
  if (!isAsyncIterable(result)) {
    throw locatedError(
      "Subscription field must return Async Iterable. " +
        `Received: ${inspect(result)}.`,
      [],
    );
  }

  return result;
}

// Either map or return potential event stream
function mapResultOrEventStreamOrPromise(
  resultOrStreamOrPromise: PromiseOrValue<
    ExecutionResult | AsyncIterable<unknown>
  >,
  exeContext: ExecutionContext,
  parentTypeName: string,
  path: Path | undefined,
  groupedFieldSet: GroupedFieldSet,
): PromiseOrValue<
  TotalExecutionResult | AsyncGenerator<TotalExecutionResult, void, void>
> {
  if (isPromise(resultOrStreamOrPromise)) {
    return resultOrStreamOrPromise.then((resultOrStream) =>
      mapResultOrEventStreamOrPromise(
        resultOrStream,
        exeContext,
        parentTypeName,
        path,
        groupedFieldSet,
      ),
    );
  } else {
    if (!isAsyncIterable(resultOrStreamOrPromise)) {
      // This is typechecked in collect values
      return resultOrStreamOrPromise as TotalExecutionResult;
    } else {
      // For each payload yielded from a subscription, map it over the normal
      // GraphQL `execute` function, with `payload` as the rootValue.
      // This implements the "MapSourceToResponseEvent" algorithm described in
      // the GraphQL specification. The `executeFields` function provides the
      // "ExecuteSubscriptionEvent" algorithm, as it is nearly identical to the
      // "ExecuteQuery" algorithm, for which `execute` is also used.
      const mapSourceToResponse = (payload: unknown) => {
        const perEventContext = buildPerEventExecutionContext(
          exeContext,
          payload,
        );
        const hooks = exeContext?.fieldExecutionHooks;
        let beforeExecuteSubscriptionEvenEmitHook;

        if (hooks?.beforeSubscriptionEventEmit) {
          beforeExecuteSubscriptionEvenEmitHook =
            invokeBeforeSubscriptionEventEmitHook(perEventContext, payload);

          if (beforeExecuteSubscriptionEvenEmitHook instanceof GraphQLError) {
            return buildResponse(perEventContext, null) as TotalExecutionResult;
          }
        }
        try {
          const data = isPromise(beforeExecuteSubscriptionEvenEmitHook)
            ? beforeExecuteSubscriptionEvenEmitHook.then((context) => {
                if (context instanceof GraphQLError) {
                  return null;
                }

                return executeFields(
                  exeContext,
                  parentTypeName,
                  payload,
                  path,
                  groupedFieldSet,
                  null,
                );
              })
            : executeFields(
                exeContext,
                parentTypeName,
                payload,
                path,
                groupedFieldSet,
                null,
              );
          // This is typechecked in collect values
          return buildResponse(perEventContext, data) as TotalExecutionResult;
        } catch (error) {
          perEventContext.errors.push(error as GraphQLError);
          return buildResponse(perEventContext, null) as TotalExecutionResult;
        }
      };

      return mapAsyncIterator(resultOrStreamOrPromise, mapSourceToResponse);
    }
  }
}

/**
 * @internal
 */
export function buildResolveInfo(
  exeContext: ExecutionContext,
  fieldName: string,
  fieldGroup: FieldGroup,
  parentTypeName: string,
  returnTypeName: string,
  path: Path,
): ResolveInfo {
  // The resolve function's optional fourth argument is a collection of
  // information about the current execution state.
  return {
    fieldName: fieldName,
    fieldNodes: fieldGroup,
    fieldGroup: fieldGroup,
    returnTypeName,
    parentTypeName,
    path,
    fragments: exeContext.fragments,
    rootValue: exeContext.rootValue,
    operation: exeContext.operation,
    variableValues: exeContext.variableValues,
  };
}

function handleFieldError(
  rawError: unknown,
  exeContext: ExecutionContext,
  returnTypeRef: TypeReference,
  fieldGroup: FieldGroup,
  path: Path,
  deferredChunkId: string | null,
): void {
  const error = locatedError(rawError, fieldGroup, pathToArray(path));

  // If the field type is non-nullable, then it is resolved without any
  // protection from errors, however it still properly locates the error.
  if (isNonNullType(returnTypeRef)) {
    throw error;
  }

  // Otherwise, error protection is applied, logging the error and resolving
  // a null value for this field if one is encountered.
  if (deferredChunkId) {
    exeContext.deferredExecutionManager.addError(deferredChunkId, error);
  } else {
    exeContext.errors.push(error);
  }
}

function resolveAndCompleteField(
  exeContext: ExecutionContext,
  parentTypeName: string,
  fieldDefinition: FieldDefinition,
  fieldGroup: FieldGroup,
  path: Path,
  source: unknown,
  deferredChunkId: string | null,
): PromiseOrValue<unknown> {
  const fieldName = fieldGroup[0].name.value;
  const returnTypeRef = Definitions.getFieldTypeReference(fieldDefinition);

  const resolveFn: FunctionFieldResolver<unknown, unknown> =
    Resolvers.getFieldResolver(
      exeContext.schemaFragment,
      parentTypeName,
      fieldName,
    ) ?? exeContext.fieldResolver;

  const info = buildResolveInfo(
    exeContext,
    fieldName,
    fieldGroup,
    parentTypeName,
    typeNameFromReference(returnTypeRef),
    path,
  );

  const isDefaultResolverUsed =
    resolveFn === exeContext.fieldResolver || fieldName === "__typename";
  const hooks = exeContext.fieldExecutionHooks;
  let hookContext: unknown = undefined;

  //  the resolve function, regardless of if its result is normal or abrupt (error).
  try {
    // Build a JS object of arguments from the field.arguments AST, using the
    // variables scope to fulfill any variable references.
    // TODO: find a way to memoize, in case this field is within a List type.
    const args = getArgumentValues(exeContext, fieldDefinition, fieldGroup[0]);

    // The resolve function's optional third argument is a context value that
    // is provided to every resolve function within an execution. It is commonly
    // used to represent an authenticated user, or request-specific caches.
    const contextValue = exeContext.contextValue;

    if (!isDefaultResolverUsed && hooks?.beforeFieldResolve) {
      hookContext = invokeBeforeFieldResolveHook(info, exeContext);
    }

    let result: unknown;

    if (hookContext instanceof GraphQLError) {
      result = null;
    } else if (isPromise(hookContext)) {
      result = hookContext.then((context) => {
        hookContext = context;

        if (hookContext instanceof GraphQLError) {
          return null;
        }

        return resolveFn(source, args, contextValue, info);
      });
    } else {
      result = resolveFn(source, args, contextValue, info);
    }

    let completed;

    if (isPromise(result)) {
      completed = result
        .then((resolved) => {
          if (!isDefaultResolverUsed && hooks?.afterFieldResolve) {
            hookContext = invokeAfterFieldResolveHook(
              info,
              exeContext,
              hookContext,
              resolved,
            );
            return hookContext instanceof GraphQLError ? null : resolved;
          }

          return resolved;
        })
        .then(
          (resolved) => {
            return completeValue(
              exeContext,
              returnTypeRef,
              fieldGroup,
              info,
              path,
              hookContext instanceof GraphQLError ? null : resolved,
              deferredChunkId,
            );
          },
          (rawError) => {
            // That's where afterResolve hook can only be called
            // in the case of async resolver promise rejection.
            if (!isDefaultResolverUsed && hooks?.afterFieldResolve) {
              hookContext = invokeAfterFieldResolveHook(
                info,
                exeContext,
                hookContext,
                undefined,
                rawError,
              );
            }
            // Error will be handled on field completion
            throw rawError;
          },
        );
    } else {
      if (!isDefaultResolverUsed && hooks?.afterFieldResolve) {
        hookContext = invokeAfterFieldResolveHook(
          info,
          exeContext,
          hookContext,
          result,
        );
        result = hookContext instanceof GraphQLError ? null : result;
      }

      completed = completeValue(
        exeContext,
        returnTypeRef,
        fieldGroup,
        info,
        path,
        result,
        deferredChunkId,
      );
    }

    if (isPromise(completed)) {
      // Note: we don't rely on a `catch` method, but we do expect "thenable"
      // to take a second callback for the error case.
      return completed.then(
        (resolved) => {
          if (!isDefaultResolverUsed && hooks?.afterFieldComplete) {
            hookContext = invokeAfterFieldCompleteHook(
              info,
              exeContext,
              hookContext,
              resolved,
            );
            return hookContext instanceof GraphQLError ? null : resolved;
          }

          return resolved;
        },
        (rawError) => {
          const error = locatedError(rawError, fieldGroup, pathToArray(path));

          if (!isDefaultResolverUsed && hooks?.afterFieldComplete) {
            hookContext = invokeAfterFieldCompleteHook(
              info,
              exeContext,
              hookContext,
              undefined,
              error,
            );
          }

          handleFieldError(
            rawError,
            exeContext,
            returnTypeRef,
            fieldGroup,
            path,
            deferredChunkId,
          );
          return null;
        },
      );
    }

    if (!isDefaultResolverUsed && hooks?.afterFieldComplete) {
      hookContext = invokeAfterFieldCompleteHook(
        info,
        exeContext,
        hookContext,
        completed,
      );

      return hookContext instanceof GraphQLError ? null : completed;
    }
    return completed;
  } catch (rawError) {
    const pathArray = pathToArray(path);
    const error = locatedError(rawError, fieldGroup, pathArray);
    // Do not invoke afterFieldResolve hook when error path and current field path are not equal:
    // it means that field itself resolved fine (so afterFieldResolve has been invoked already),
    // but non-nullable child field resolving throws an error,
    // so that error is propagated to the parent field according to spec
    if (
      !isDefaultResolverUsed &&
      hooks?.afterFieldResolve &&
      error.path &&
      arraysAreEqual(pathArray, error.path)
    ) {
      hookContext = invokeAfterFieldResolveHook(
        info,
        exeContext,
        hookContext,
        undefined,
        error,
      );
    }
    if (!isDefaultResolverUsed && hooks?.afterFieldComplete) {
      invokeAfterFieldCompleteHook(
        info,
        exeContext,
        hookContext,
        undefined,
        error,
      );
    }

    handleFieldError(
      rawError,
      exeContext,
      returnTypeRef,
      fieldGroup,
      path,
      deferredChunkId,
    );
    return null;
  }
}

/**
 * Implements the instructions for completeValue as defined in the
 * "Field entries" section of the spec.
 *
 * If the field type is Non-Null, then this recursively completes the value
 * for the inner type. It throws a field error if that completion returns null,
 * as per the "Nullability" section of the spec.
 *
 * If the field type is a List, then this recursively completes the value
 * for the inner type on each item in the list.
 *
 * If the field type is a Scalar or Enum, ensures the completed value is a legal
 * value of the type by calling the `serialize` method of GraphQL type
 * definition.
 *
 * If the field is an abstract type, determine the runtime type of the value
 * and then complete based on that type
 *
 * Otherwise, the field type expects a sub-selection set, and will complete the
 * value by executing all sub-selections.
 */
function completeValue(
  exeContext: ExecutionContext,
  returnTypeRef: TypeReference,
  fieldGroup: FieldGroup,
  info: ResolveInfo,
  path: Path,
  result: unknown,
  deferredChunkId: string | null,
): PromiseOrValue<unknown> {
  // If result is an Error, throw a located error.
  if (result instanceof Error) {
    throw result;
  }

  // If field type is NonNull, complete for inner type, and throw field error
  // if result is null.
  if (isNonNullType(returnTypeRef)) {
    const completed = completeValue(
      exeContext,
      unwrap(returnTypeRef),
      fieldGroup,
      info,
      path,
      result,
      deferredChunkId,
    );
    if (completed === null) {
      throw new Error(
        `Cannot return null for non-nullable field ${info.parentTypeName}.${info.fieldName}.`,
      );
    }
    return completed;
  }

  // If result value is null or undefined then return null.
  if (result == null) {
    return null;
  }

  // If field type is List, complete each item in the list with the inner type
  if (isListType(returnTypeRef)) {
    return completeListValue(
      exeContext,
      returnTypeRef,
      fieldGroup,
      info,
      path,
      result,
      deferredChunkId,
    );
  }

  const { schemaFragment } = exeContext;
  const returnTypeName = typeNameFromReference(returnTypeRef);

  // If field type is a leaf type, Scalar or Enum, serialize to a valid value,
  // returning null if serialization is not possible.
  const leafType = Resolvers.getLeafTypeResolver(schemaFragment, returnTypeRef);
  if (leafType) {
    return completeLeafValue(leafType, result);
  }

  // If field type is an abstract type, Interface or Union, determine the
  // runtime Object type and complete for that type.
  if (Definitions.isAbstractType(schemaFragment.definitions, returnTypeRef)) {
    return completeAbstractValue(
      exeContext,
      returnTypeName,
      fieldGroup,
      info,
      path,
      result,
      deferredChunkId,
    );
  }

  // If field type is Object, execute and complete all sub-selections.
  // istanbul ignore else (See: 'https://github.com/graphql/graphql-js/issues/2618')
  if (Definitions.isObjectType(schemaFragment.definitions, returnTypeRef)) {
    return completeObjectValue(
      exeContext,
      returnTypeName,
      fieldGroup,
      path,
      result,
      deferredChunkId,
    );
  }

  // istanbul ignore next (Not reachable. All possible output types have been considered)
  invariant(
    false,
    "Cannot complete value of unexpected output type: " +
      inspectTypeReference(returnTypeRef),
  );
}

async function completePromisedValue(
  exeContext: ExecutionContext,
  returnTypeRef: TypeReference,
  fieldGroup: FieldGroup,
  info: ResolveInfo,
  path: Path,
  result: Promise<unknown>,
  deferredChunkId: string | null,
): Promise<unknown> {
  try {
    const resolved = await result;
    let completed = completeValue(
      exeContext,
      returnTypeRef,
      fieldGroup,
      info,
      path,
      resolved,
      deferredChunkId,
    );
    if (isPromise(completed)) {
      completed = await completed;
    }
    return completed;
  } catch (rawError) {
    handleFieldError(
      rawError,
      exeContext,
      returnTypeRef,
      fieldGroup,
      path,
      deferredChunkId,
    );
    exeContext.deferredExecutionManager.removeSubsequentPayloads(
      path,
      deferredChunkId,
    );
    return null;
  }
}

/**
 * Complete a list value by completing each item in the list with the
 * inner type
 */
function completeListValue(
  exeContext: ExecutionContext,
  returnTypeRef: TypeReference, // assuming list type
  fieldGroup: FieldGroup,
  info: ResolveInfo,
  path: Path,
  result: unknown,
  deferredChunkId: string | null,
): PromiseOrValue<ReadonlyArray<unknown>> {
  const itemTypeRef = unwrap(returnTypeRef);
  if (isAsyncIterable(result)) {
    const asyncIterator = result[Symbol.asyncIterator]();

    return completeAsyncIteratorValue(
      exeContext,
      itemTypeRef,
      fieldGroup,
      info,
      path,
      asyncIterator,
      deferredChunkId,
    );
  }

  if (!isIterableObject(result)) {
    throw locatedError(
      `Expected Iterable, but did not find one for field "${info.parentTypeName}.${info.fieldName}".`,
      [],
    );
  }

  // const streamUsage = getStreamValues(exeContext, fieldGroup, path);

  // This is specified as a simple map, however we're optimizing the path
  // where the list contains no Promises by avoiding creating another Promise.
  let containsPromise = false;
  const completedResults: Array<unknown> = [];
  let index = 0;
  for (const item of result) {
    // No need to modify the info object containing the path,
    // since from here on it is not ever accessed by resolver functions.
    const itemPath = addPath(path, index, undefined);

    // if (
    //   streamUsage &&
    //   typeof streamUsage.initialCount === "number" &&
    //   index >= streamUsage.initialCount
    // ) {
    //   break;
    // }

    if (
      completeListItemValue(
        item,
        completedResults,
        exeContext,
        itemTypeRef,
        fieldGroup,
        info,
        itemPath,
        deferredChunkId,
      )
    ) {
      containsPromise = true;
    }

    index++;
  }

  // if (streamUsage && index <= completedResults.length - 1) {
  //   const sliced = Promise.all(completedResults.slice(index));
  //   exeContext.deferredExecutionManager.addItemsStreamRecord({
  //     label: streamUsage.label || null,
  //     path,
  //     parentChunkId: deferredChunkId,
  //     promise: sliced,
  //   });
  //   return containsPromise
  //     ? Promise.all(completedResults.slice(0, index))
  //     : completedResults.slice(0, index);
  // } else {
  return containsPromise ? Promise.all(completedResults) : completedResults;
  // }
}

/**
 * Complete a list item value by adding it to the completed results.
 *
 * Returns true if the value is a Promise.
 */
function completeListItemValue(
  item: unknown,
  completedResults: Array<unknown>,
  exeContext: ExecutionContext,
  itemTypeRef: TypeReference,
  fieldGroup: FieldGroup,
  info: ResolveInfo,
  itemPath: Path,
  deferredChunkId: string | null,
): boolean {
  if (isPromise(item)) {
    completedResults.push(
      completePromisedValue(
        exeContext,
        itemTypeRef,
        fieldGroup,
        info,
        itemPath,
        item,
        deferredChunkId,
      ),
    );

    return true;
  }

  try {
    const completedItem = completeValue(
      exeContext,
      itemTypeRef,
      fieldGroup,
      info,
      itemPath,
      item,
      deferredChunkId,
    );

    if (isPromise(completedItem)) {
      // Note: we don't rely on a `catch` method, but we do expect "thenable"
      // to take a second callback for the error case.
      completedResults.push(
        completedItem.then(undefined, (rawError) => {
          handleFieldError(
            rawError,
            exeContext,
            itemTypeRef,
            fieldGroup,
            itemPath,
            deferredChunkId,
          );
          exeContext.deferredExecutionManager.removeSubsequentPayloads(
            itemPath,
            deferredChunkId,
          );
          return null;
        }),
      );

      return true;
    }

    completedResults.push(completedItem);
  } catch (rawError) {
    handleFieldError(
      rawError,
      exeContext,
      itemTypeRef,
      fieldGroup,
      itemPath,
      deferredChunkId,
    );
    exeContext.deferredExecutionManager.removeSubsequentPayloads(
      itemPath,
      deferredChunkId,
    );
    completedResults.push(null);
  }

  return false;
}

// /**
//  * Returns an object containing the `@stream` arguments if a field should be
//  * streamed based on the experimental flag, stream directive present and
//  * not disabled by the "if" argument.
//  */
// function getStreamValues(
//   exeContext: ExecutionContext,
//   fieldGroup: FieldGroup,
//   path: Path,
// ):
//   | undefined
//   | {
//       initialCount: number | undefined;
//       label: string | undefined;
//     } {
//   // do not stream inner lists of multi-dimensional lists
//   if (typeof path.key === "number") {
//     return;
//   }

//   // validation only allows equivalent streams on multiple fields, so it is
//   // safe to only check the first fieldNode for the stream directive
//   const stream = getDirectiveValues(
//     exeContext,
//     GraphQLStreamDirective,
//     fieldGroup[0],
//   );

//   if (!stream) {
//     return;
//   }

//   if (stream.if === false) {
//     return;
//   }

//   invariant(
//     typeof stream.initialCount === "number",
//     "initialCount must be a number",
//   );

//   invariant(
//     stream.initialCount >= 0,
//     "initialCount must be a positive integer",
//   );

//   invariant(
//     exeContext.operation.operation !== "subscription",
//     "`@stream` directive not supported on subscription operations. Disable `@stream` by setting the `if` argument to `false`.",
//   );

//   return {
//     initialCount: stream.initialCount,
//     label: typeof stream.label === "string" ? stream.label : undefined,
//   };
// }

/**
 * Complete a async iterator value by completing the result and calling
 * recursively until all the results are completed.
 */
async function completeAsyncIteratorValue(
  exeContext: ExecutionContext,
  itemTypeRef: TypeReference,
  fieldGroup: FieldGroup,
  info: ResolveInfo,
  path: Path,
  asyncIterator: AsyncIterator<unknown>,
  deferredChunkId: string | null,
): Promise<ReadonlyArray<unknown>> {
  // const streamUsage = getStreamValues(exeContext, fieldGroup, path);
  let containsPromise = false;
  const completedResults: Array<unknown> = [];
  let index = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // if (
    //   streamUsage &&
    //   typeof streamUsage.initialCount === "number" &&
    //   index >= streamUsage.initialCount
    // ) {
    // exeContext.deferredExecutionManager.addAsyncIteratorStreamRecord({
    //   label: streamUsage.label || null,
    //   path,
    //   parentChunkId: deferredChunkId,
    //   asyncIterator: asyncIterator as AsyncIterator<ObjMap<unknown>>,
    // });
    // break;
    // }

    const itemPath = addPath(path, index, undefined);
    let iteration;
    try {
      // eslint-disable-next-line no-await-in-loop
      iteration = await asyncIterator.next();
      if (iteration.done) {
        break;
      }
    } catch (rawError) {
      throw locatedError(rawError, fieldGroup, pathToArray(path));
    }

    if (
      completeListItemValue(
        iteration.value,
        completedResults,
        exeContext,
        itemTypeRef,
        fieldGroup,
        info,
        itemPath,
        deferredChunkId,
      )
    ) {
      containsPromise = true;
    }
    index += 1;
  }
  return containsPromise ? Promise.all(completedResults) : completedResults;
}

/**
 * Complete a Scalar or Enum by serializing to a valid value, returning
 * null if serialization is not possible.
 */
function completeLeafValue(
  returnType: GraphQLLeafType,
  result: unknown,
): unknown {
  const serializedResult = returnType.serialize(result);
  if (serializedResult === undefined) {
    throw new Error(
      `Expected a value of type "${inspect(returnType)}" but ` +
        `received: ${inspect(result)}`,
    );
  }
  return serializedResult;
}

/**
 * Complete a value of an abstract type by determining the runtime object type
 * of that value, then complete the value for that type.
 */
function completeAbstractValue(
  exeContext: ExecutionContext,
  returnTypeName: string,
  fieldGroup: FieldGroup,
  info: ResolveInfo,
  path: Path,
  result: unknown,
  deferredChunkId: string | null,
): PromiseOrValue<ObjMap<unknown>> {
  const { schemaFragment } = exeContext;
  const resolveTypeFn =
    Resolvers.getAbstractTypeResolver(schemaFragment, returnTypeName) ??
    exeContext.typeResolver;
  const contextValue = exeContext.contextValue;
  const runtimeTypeName = resolveTypeFn(result, contextValue, info);

  const validatedRuntimeTypeName = isPromise(runtimeTypeName)
    ? runtimeTypeName.then((resolvedRuntimeTypeName) =>
        ensureValidRuntimeType(
          resolvedRuntimeTypeName,
          exeContext,
          returnTypeName,
          fieldGroup,
          info,
          result,
        ),
      )
    : ensureValidRuntimeType(
        runtimeTypeName,
        exeContext,
        returnTypeName,
        fieldGroup,
        info,
        result,
      );

  if (isPromise(validatedRuntimeTypeName)) {
    return validatedRuntimeTypeName.then((resolvedRuntimeTypeName) =>
      completeObjectValue(
        exeContext,
        resolvedRuntimeTypeName,
        fieldGroup,
        path,
        result,
        deferredChunkId,
      ),
    );
  }

  return completeObjectValue(
    exeContext,
    validatedRuntimeTypeName,
    fieldGroup,
    path,
    result,
    deferredChunkId,
  );
}

function ensureValidRuntimeType(
  runtimeTypeName: unknown,
  exeContext: ExecutionContext,
  returnTypeName: string,
  fieldGroup: FieldGroup,
  info: ResolveInfo,
  result: unknown,
): PromiseOrValue<string> {
  if (runtimeTypeName == null) {
    throw locatedError(
      `Abstract type "${returnTypeName}" must resolve to an Object type at runtime for field "${info.parentTypeName}.${info.fieldName}".` +
        ` Either the "${returnTypeName}" should provide a "__resolveType" resolver function` +
        ` or "${info.parentTypeName}.${info.fieldName}" should be an object with "__typename" property.`,
      fieldGroup,
    );
  }

  if (typeof runtimeTypeName !== "string") {
    throw locatedError(
      `Abstract type "${returnTypeName}" must resolve to an Object type at runtime for field "${info.returnTypeName}.${info.fieldName}" with ` +
        `value ${inspect(result)}, received "${inspect(runtimeTypeName)}".`,
      [],
    );
  }

  // Presence of schema fragment loader triggers strict checks for interface types
  // (assuming we can get full information about interface implementations on demand)
  const strictInterfaceValidation = !!exeContext.schemaFragmentLoader;

  const isDefinedType = Definitions.isDefined(
    exeContext.schemaFragment.definitions,
    runtimeTypeName,
  );
  const loading = !isDefinedType
    ? requestSchemaFragment(exeContext, {
        kind: "RuntimeType",
        abstractTypeName: returnTypeName,
        runtimeTypeName,
      })
    : undefined;
  return loading
    ? loading.then(() =>
        ensureValidRuntimeTypeImpl(
          runtimeTypeName,
          exeContext,
          returnTypeName,
          fieldGroup,
          strictInterfaceValidation,
        ),
      )
    : ensureValidRuntimeTypeImpl(
        runtimeTypeName,
        exeContext,
        returnTypeName,
        fieldGroup,
        strictInterfaceValidation,
      );
}

function ensureValidRuntimeTypeImpl(
  runtimeTypeName: string,
  exeContext: ExecutionContext,
  returnTypeName: string,
  fieldGroup: FieldGroup,
  strictInterfaceValidation: boolean,
): string {
  const definitions = exeContext.schemaFragment.definitions;

  const union = Definitions.getUnionType(definitions, returnTypeName);
  if (union || strictInterfaceValidation) {
    // Standard graphql-js checks
    if (!Definitions.isDefined(definitions, runtimeTypeName)) {
      throw locatedError(
        `Abstract type "${returnTypeName}" was resolved to a type "${runtimeTypeName}" that does not exist inside the schema.`,
        fieldGroup,
      );
    }
    if (!Definitions.isObjectType(definitions, runtimeTypeName)) {
      throw locatedError(
        `Abstract type "${returnTypeName}" was resolved to a non-object type "${runtimeTypeName}".`,
        fieldGroup,
      );
    }
    if (!Definitions.isSubType(definitions, returnTypeName, runtimeTypeName)) {
      throw locatedError(
        `Runtime Object type "${runtimeTypeName}" is not a possible type for "${returnTypeName}".`,
        fieldGroup,
      );
    }
    return runtimeTypeName;
  }

  const iface = Definitions.getInterfaceType(definitions, returnTypeName);
  if (iface) {
    // Loose interface validation mode, significant deviation from graphql-js:
    //   Assuming runtimeTypeName is a valid implementation of returnTypeName.
    if (
      Definitions.isDefined(definitions, runtimeTypeName) &&
      !Definitions.isObjectType(definitions, runtimeTypeName)
    ) {
      throw locatedError(
        `Abstract type "${returnTypeName}" was resolved to a non-object type "${runtimeTypeName}".`,
        fieldGroup,
      );
    }
    Definitions.addInterfaceImplementation(
      definitions,
      returnTypeName,
      runtimeTypeName,
    );
    return runtimeTypeName;
  }

  invariant(false, `${returnTypeName} is not an abstract type`);
}

/**
 * Complete an Object value by executing all sub-selections.
 */
function completeObjectValue(
  exeContext: ExecutionContext,
  returnTypeName: string,
  fieldGroup: FieldGroup,
  path: Path,
  result: unknown,
  deferredChunkId: string | null,
): PromiseOrValue<ObjMap<unknown>> {
  // Collect sub-fields to execute to complete this value.
  return collectAndExecuteSubfields(
    exeContext,
    returnTypeName,
    fieldGroup,
    path,
    result,
    deferredChunkId,
  );
}

function collectAndExecuteSubfields(
  exeContext: ExecutionContext,
  returnTypeName: string,
  fieldGroup: FieldGroup,
  path: Path,
  result: unknown,
  parentDeferredChunkId: string | null,
): PromiseOrValue<ObjMap<unknown>> {
  // Collect sub-fields to execute to complete this value.
  const {
    groupedFieldSet: subGroupedFieldSet,
    deferredFieldSets: deferredSelections,
  } = collectSubfields(exeContext, { name: returnTypeName }, fieldGroup);
  // console.log(subGroupedFieldSet, deferredFieldSets);

  const subFields = executeFields(
    exeContext,
    returnTypeName,
    result,
    path,
    subGroupedFieldSet,
    parentDeferredChunkId,
  );

  for (const {
    label,
    groupedFieldSet: deferredGroupedFieldSet,
    nestedDefers,
  } of deferredSelections) {
    exeContext.deferredExecutionManager.addDeferRecord({
      label: label || null,
      path,
      parentChunkId: parentDeferredChunkId,
      returnTypeName,
      parentResult: result,
      groupedFieldSet: deferredGroupedFieldSet,
      nestedDefers,
    });
  }

  return subFields;
}

function invokeBeforeFieldSubscribeHook(
  resolveInfo: ResolveInfo,
  exeContext: ExecutionContext,
) {
  const hook = exeContext.fieldExecutionHooks?.beforeFieldSubscribe;
  if (!hook) {
    return;
  }

  return executeSafe(
    () =>
      hook({
        resolveInfo,
        context: exeContext.contextValue,
      }),
    (result, rawError) => {
      if (rawError) {
        const error = toGraphQLError(
          rawError,
          resolveInfo.path,
          "Unexpected error thrown by beforeFieldSubscribe hook",
        );
        exeContext.errors.push(error);

        throw error;
      } else if (result instanceof Error) {
        const error = toGraphQLError(
          result,
          resolveInfo.path,
          "Unexpected error returned from beforeFieldSubscribe hook",
        );
        exeContext.errors.push(error);

        throw error;
      }

      return result;
    },
  );
}

function invokeBeforeFieldResolveHook(
  resolveInfo: ResolveInfo,
  exeContext: ExecutionContext,
) {
  const hook = exeContext.fieldExecutionHooks?.beforeFieldResolve;
  if (!hook) {
    return;
  }

  return executeSafe(
    () =>
      hook({
        resolveInfo,
        context: exeContext.contextValue,
      }),
    (result, rawError) => {
      if (rawError) {
        const error = toGraphQLError(
          rawError,
          resolveInfo.path,
          "Unexpected error thrown by beforeFieldResolve hook",
        );
        exeContext.errors.push(error);

        return error;
      } else if (result instanceof Error) {
        const error = toGraphQLError(
          result,
          resolveInfo.path,
          "Unexpected error returned from beforeFieldResolve hook",
        );
        exeContext.errors.push(error);
      }

      return result;
    },
  );
}

function invokeAfterFieldResolveHook(
  resolveInfo: ResolveInfo,
  exeContext: ExecutionContext,
  hookContext: unknown,
  result?: unknown,
  error?: unknown,
) {
  const hook = exeContext.fieldExecutionHooks?.afterFieldResolve;
  if (!hook) {
    return;
  }
  return executeSafe(
    () =>
      hook({
        resolveInfo,
        context: exeContext.contextValue,
        hookContext,
        result,
        error,
      }),
    (result, rawError) => {
      if (rawError) {
        const error = toGraphQLError(
          rawError,
          resolveInfo.path,
          "Unexpected error thrown by afterFieldResolve hook",
        );
        exeContext.errors.push(error);

        return error;
      } else if (result instanceof Error) {
        const error = toGraphQLError(
          result,
          resolveInfo.path,
          "Unexpected error returned from afterFieldResolve hook",
        );
        exeContext.errors.push(error);
      }

      return result;
    },
  );
}

function invokeAfterFieldSubscribeHook(
  resolveInfo: ResolveInfo,
  exeContext: ExecutionContext,
  hookContext: unknown,
  result?: unknown,
  error?: unknown,
) {
  const hook = exeContext.fieldExecutionHooks?.afterFieldSubscribe;
  if (!hook) {
    return;
  }
  return executeSafe(
    () =>
      hook({
        resolveInfo,
        context: exeContext.contextValue,
        hookContext,
        result,
        error,
      }),
    (result, rawError) => {
      if (rawError) {
        const error = toGraphQLError(
          rawError,
          resolveInfo.path,
          "Unexpected error thrown by afterFieldSubscribe hook",
        );
        exeContext.errors.push(error);

        throw error;
      } else if (result instanceof Error) {
        const error = toGraphQLError(
          result,
          resolveInfo.path,
          "Unexpected error returned from afterFieldSubscribe hook",
        );
        exeContext.errors.push(error);

        throw error;
      }

      return result;
    },
  );
}

function invokeAfterFieldCompleteHook(
  resolveInfo: ResolveInfo,
  exeContext: ExecutionContext,
  hookContext: unknown,
  result?: unknown,
  error?: unknown,
) {
  const hook = exeContext.fieldExecutionHooks?.afterFieldComplete;
  if (!hook) {
    return;
  }
  return executeSafe(
    () =>
      hook({
        resolveInfo,
        context: exeContext.contextValue,
        hookContext,
        result,
        error,
      }),
    (result, rawError) => {
      if (rawError) {
        const error = toGraphQLError(
          rawError,
          resolveInfo.path,
          "Unexpected error thrown by afterFieldComplete hook",
        );
        exeContext.errors.push(error);

        return error;
      } else if (result instanceof Error) {
        const error = toGraphQLError(
          result,
          resolveInfo.path,
          "Unexpected error returned from afterFieldComplete hook",
        );
        exeContext.errors.push(error);
      }

      return result;
    },
  );
}

function invokeBeforeOperationExecuteHook(exeContext: ExecutionContext) {
  const hook = exeContext.fieldExecutionHooks?.beforeOperationExecute;
  if (!hook) {
    return;
  }
  return executeSafe(
    () =>
      hook({
        context: exeContext.contextValue,
        operation: exeContext.operation,
      }),
    (result, rawError) => {
      const operationName = exeContext.operation.name?.value ?? "unknown";
      if (rawError) {
        const error = toGraphQLError(
          rawError,
          undefined,
          `Unexpected error thrown by beforeOperationExecute hook (operation: ${operationName})`,
        );
        exeContext.errors.push(error);

        return error;
      }

      if (result instanceof Error) {
        const error = toGraphQLError(
          result,
          undefined,
          `Unexpected error returned from beforeOperationExecute hook (operation: ${operationName})`,
        );
        exeContext.errors.push(error);
      }

      return result;
    },
  );
}

function invokeBeforeSubscriptionEventEmitHook(
  exeContext: ExecutionContext,
  eventPayload: unknown,
) {
  const hook = exeContext.fieldExecutionHooks?.beforeSubscriptionEventEmit;
  if (!hook) {
    return;
  }
  return executeSafe(
    () =>
      hook({
        context: exeContext.contextValue,
        operation: exeContext.operation,
        eventPayload,
      }),
    (result, rawError) => {
      const operationName = exeContext.operation.name?.value ?? "unknown";
      if (rawError) {
        const error = toGraphQLError(
          rawError,
          undefined,
          `Unexpected error thrown by beforeSubscriptionEventEmit hook (operation: ${operationName})`,
        );
        exeContext.errors.push(error);

        return error;
      } else if (result instanceof Error) {
        const error = toGraphQLError(
          result,
          undefined,
          `Unexpected error returned from beforeSubscriptionEventEmit hook (operation: ${operationName})`,
        );
        exeContext.errors.push(error);
      }

      return result;
    },
  );
}

function invokeAfterBuildResponseHook(
  exeContext: ExecutionContext,
  result: TotalExecutionResult,
) {
  const hook = exeContext.fieldExecutionHooks?.afterBuildResponse;
  if (!hook) {
    return;
  }
  return executeSafe(
    () =>
      hook({
        context: exeContext.contextValue,
        operation: exeContext.operation,
        result,
      }),
    (result, rawError) => {
      const operationName = exeContext.operation.name?.value ?? "unknown";
      if (rawError) {
        const error = toGraphQLError(
          rawError,
          undefined,
          `Unexpected error thrown by afterBuildResponse hook (operation: ${operationName})`,
        );
        exeContext.errors.push(error);

        return error;
      } else if (result instanceof Error) {
        const error = toGraphQLError(
          result,
          undefined,
          `Unexpected error returned from afterBuildResponse hook (operation: ${operationName})`,
        );

        exeContext.errors.push(error);
      }
    },
  );
}

function executeSafe<T>(
  execute: () => T | Promise<T>,
  onComplete: (result: T | undefined, error: unknown) => T | Promise<T>,
): T | Promise<T> {
  let error: unknown;
  let result: T | Promise<T> | undefined;
  try {
    result = execute();
  } catch (e) {
    error = e;
  }

  if (!isPromise(result)) {
    return onComplete(result, error);
  }

  return result
    .then((hookResult) => {
      return onComplete(hookResult, error);
    })
    .catch((e) => {
      return onComplete(undefined, e);
    }) as Promise<T>;
}

function toGraphQLError(
  originalError: unknown,
  path: Path | undefined,
  prependMessage: string,
): GraphQLError {
  const originalMessage =
    originalError instanceof Error
      ? originalError.message
      : inspect(originalError);
  const error = new Error(`${prependMessage}: ${originalMessage}`);
  return locatedError(error, undefined, path ? pathToArray(path) : undefined);
}

/**
 * If a resolveType function is not given, then a default resolve behavior is
 * used which attempts two strategies:
 *
 * First, See if the provided value has a `__typename` field defined, if so, use
 * that value as name of the resolved type.
 *
 * Otherwise, test each possible type for the abstract type by calling
 * isTypeOf for the object being coerced, returning the first type that matches.
 */
export const defaultTypeResolver: TypeResolver<unknown, unknown> = function (
  value,
) {
  if (isObjectLike(value) && typeof value.__typename === "string") {
    return value.__typename;
  }
};

/**
 * If a resolve function is not given, then a default resolve behavior is used
 * which takes the property of the source object of the same name as the field
 * and returns it as the result, or if it's a function, returns the result
 * of calling that function while passing along args and context value.
 */
export const defaultFieldResolver: FunctionFieldResolver<unknown, unknown> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function (source: any, args, contextValue, info) {
    // ensure source is a value for which property access is acceptable.
    if (isObjectLike(source) || typeof source === "function") {
      const property = source[info.fieldName];
      if (typeof property === "function") {
        return source[info.fieldName](args, contextValue, info);
      }
      return property;
    }
  };

export function getOperationRootTypeName(
  operation: OperationDefinitionNode | OperationTypeDefinitionNode,
): string {
  switch (operation.operation) {
    case "query":
      return "Query";
    case "mutation":
      return "Mutation";
    case "subscription":
      return "Subscription";
    default:
      invariant(
        false,
        `Operation "${operation.operation}" is not a part of GraphQL spec`,
      );
  }
}

function yieldSubsequentPayloads(
  exeContext: ExecutionContext,
): AsyncGenerator<
  SubsequentIncrementalExecutionResult<ObjMap<unknown>, ObjMap<unknown>>,
  void,
  void
> {
  let isDone = false;

  async function next(): Promise<
    IteratorResult<
      SubsequentIncrementalExecutionResult<ObjMap<unknown>, ObjMap<unknown>>,
      void
    >
  > {
    if (isDone) {
      return { value: undefined, done: true };
    }

    exeContext.deferredExecutionManager.executePending(
      exeContext,
      executeFields,
    );

    await exeContext.deferredExecutionManager.waitForNext();

    if (isDone) {
      // a different call to next has exhausted all payloads
      return { value: undefined, done: true };
    }

    const [incremental, completed] =
      exeContext.deferredExecutionManager.drainCompleted();

    if (isDone) {
      // a different call to next has exhausted all payloads
      return { value: undefined, done: true };
    }

    const pending = exeContext.deferredExecutionManager.getPending();
    const hasNext = exeContext.deferredExecutionManager.hasNext();

    if (incremental.length === 0 && completed.length === 0 && hasNext) {
      return next();
    }

    if (!hasNext) {
      isDone = true;
    }

    const incrementalResult: SubsequentIncrementalExecutionResult<
      ObjMap<unknown>,
      ObjMap<unknown>
    > = {
      hasNext,
    };

    if (pending.length > 0) {
      incrementalResult.pending = pending;
    }

    if (completed.length > 0) {
      incrementalResult.completed = completed;
    }

    if (incremental.length > 0) {
      incrementalResult.incremental = incremental;
    }

    return {
      value: incrementalResult,
      done: false,
    };
  }

  // function returnStreamIterators() {
  //   const promises: Array<Promise<IteratorResult<unknown>>> = [];
  //   exeContext.subsequentPayloads.forEach((incrementalDataRecord) => {
  //     if (
  //       isStreamItemsRecord(incrementalDataRecord) &&
  //       incrementalDataRecord.asyncIterator?.return
  //     ) {
  //       promises.push(incrementalDataRecord.asyncIterator.return());
  //     }
  //   });
  //   return Promise.all(promises);
  // }

  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    next,
    async return(): Promise<
      IteratorResult<
        SubsequentIncrementalExecutionResult<ObjMap<unknown>, ObjMap<unknown>>,
        void
      >
    > {
      // await returnStreamIterators();
      isDone = true;
      return { value: undefined, done: true };
    },
    async throw(
      error?: unknown,
    ): Promise<
      IteratorResult<
        SubsequentIncrementalExecutionResult<ObjMap<unknown>, ObjMap<unknown>>,
        void
      >
    > {
      // await returnStreamIterators();
      isDone = true;
      return Promise.reject(error);
    },
  };
}
export function isIncrementalExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
>(
  result: ExecutionResult<TData, TExtensions>,
): result is IncrementalExecutionResult<TData, TExtensions> {
  return "initialResult" in result;
}

export function isTotalExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
>(
  result: ExecutionResult<TData, TExtensions>,
): result is TotalExecutionResult<TData, TExtensions> {
  return !("initialResult" in result);
}
