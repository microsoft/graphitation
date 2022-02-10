import {
  ASTNode as GraphQLASTNode,
  GraphQLEnumType,
  GraphQLError,
  GraphQLFormattedError,
  GraphQLInputObjectType,
  GraphQLLeafType,
  GraphQLObjectType,
  GraphQLScalarType,
  isLeafType,
  Kind,
  locatedError,
} from "graphql";

import {
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
  OperationTypeDefinitionNode,
  TypeNode,
} from "./ast/TypedAST";
import { collectFields } from "./collectFields";
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
import { isUnionResolverType, isInterfaceResolverType } from "./definition";
import { mergeResolvers } from "./utilities/mergeResolvers";
import {
  ExecutionWithoutSchemaArgs,
  FieldResolver,
  FunctionFieldResolver,
  InterfaceTypeResolver,
  ObjectTypeResolver,
  ResolveInfo,
  Resolver,
  Resolvers,
  TypeResolver,
  UnionTypeResolver,
  ExecutionResult,
} from "./types";
import { typeNameFromAST } from "./utilities/typeNameFromAST";
import {
  getArgumentValues,
  getVariableValues,
  specifiedScalars,
} from "./values";

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
  resolvers: Resolvers;
  fragments: ObjMap<FragmentDefinitionNode>;
  rootValue: unknown;
  contextValue: unknown;
  operation: OperationDefinitionNode;
  variableValues: { [variable: string]: unknown };
  fieldResolver: FunctionFieldResolver<any, any>;
  typeResolver: TypeResolver<any, any>;
  errors: Array<GraphQLError>;
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
  const {
    resolvers,
    schemaResolvers,
    document,
    rootValue,
    contextValue,
    variableValues,
    operationName,
    fieldResolver,
    typeResolver,
  } = args;

  const combinedResolvers = mergeResolvers(resolvers, schemaResolvers);
  // If arguments are missing or incorrect, throw an error.
  assertValidExecutionArguments(document, variableValues);

  // If a valid execution context cannot be created due to incorrect arguments,
  // a "Response" with only errors is returned.
  const exeContext = buildExecutionContext(
    combinedResolvers,
    document,
    rootValue,
    contextValue,
    variableValues,
    operationName,
    fieldResolver,
    typeResolver,
  );

  // Return early errors if execution context failed.
  if (!("resolvers" in exeContext)) {
    return { errors: exeContext };
  } else {
    // Return a Promise that will eventually resolve to the data described by
    // The "Response" section of the GraphQL specification.
    //
    // If errors are encountered while executing a GraphQL field, only that
    // field and its descendants will be omitted, and sibling fields will still
    // be executed. An execution which encounters errors will still result in a
    // resolved Promise.
    const data = executeOperation(exeContext, exeContext.operation, rootValue);
    return buildResponse(exeContext, data);
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
    return data.then((resolved: PromiseOrValue<ObjMap<unknown> | null>) =>
      buildResponse(exeContext, resolved),
    );
  }
  return exeContext.errors.length === 0
    ? { data }
    : { errors: exeContext.errors, data };
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
export function buildExecutionContext(
  resolvers: Resolvers,
  document: DocumentNode,
  rootValue: unknown,
  contextValue: unknown,
  rawVariableValues: Maybe<{ [variable: string]: unknown }>,
  operationName: Maybe<string>,
  fieldResolver: Maybe<FunctionFieldResolver<unknown, unknown>>,
  typeResolver?: Maybe<TypeResolver<unknown, unknown>>,
): Array<GraphQLError> | ExecutionContext {
  let operation: OperationDefinitionNode | undefined;
  const fragments: ObjMap<FragmentDefinitionNode> = Object.create(null);
  for (const definition of document.definitions) {
    switch (definition.kind) {
      case Kind.OPERATION_DEFINITION:
        if (operationName == null) {
          if (operation !== undefined) {
            return [
              new GraphQLError(
                "Must provide operation name if query contains multiple operations.",
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
      return [new GraphQLError(`Unknown operation named "${operationName}".`)];
    }
    return [new GraphQLError("Must provide an operation.")];
  }

  // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')
  const variableDefinitions = operation.variableDefinitions ?? [];

  const coercedVariableValues = getVariableValues(
    resolvers,
    variableDefinitions,
    rawVariableValues ?? {},
    { maxErrors: 50 },
  );

  if (coercedVariableValues.errors) {
    return coercedVariableValues.errors;
  }

  return {
    resolvers,
    fragments,
    rootValue,
    contextValue,
    operation,
    variableValues: coercedVariableValues.coerced,
    fieldResolver: fieldResolver ?? defaultFieldResolver,
    typeResolver: typeResolver ?? defaultTypeResolver,
    errors: [],
  };
}

/**
 * Implements the "Executing operations" section of the spec.
 */
function executeOperation(
  exeContext: ExecutionContext,
  operation: OperationDefinitionNode,
  rootValue: unknown,
): PromiseOrValue<ObjMap<unknown> | null> {
  const typeName = getOperationRootTypeName(operation);
  const fields = collectFields(
    exeContext.resolvers,
    exeContext.fragments,
    exeContext.variableValues,
    typeName,
    operation.selectionSet,
    new Map(),
    new Set(),
  );

  const path = undefined;

  // Errors from sub-fields of a NonNull type may propagate to the top level,
  // at which point we still log the error and null the parent field, which
  // in this case is the entire response.
  try {
    const result =
      operation.operation === "mutation"
        ? executeFieldsSerially(exeContext, typeName, rootValue, path, fields)
        : executeFields(exeContext, typeName, rootValue, path, fields);
    if (isPromise(result)) {
      return result.then(undefined, (error: GraphQLError) => {
        exeContext.errors.push(error);
        return Promise.resolve(null);
      });
    }
    return result;
  } catch (error) {
    exeContext.errors.push(error as any);
    return null;
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
  fields: Map<string, Array<FieldNode>>,
): PromiseOrValue<ObjMap<unknown>> {
  return promiseReduce(
    fields.entries(),
    (results, [responseName, fieldNodes]) => {
      const fieldPath = addPath(path, responseName, parentTypeName);
      const result = executeField(
        exeContext,
        parentTypeName,
        sourceValue,
        fieldNodes,
        fieldPath,
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
  fields: Map<string, Array<FieldNode>>,
): PromiseOrValue<ObjMap<unknown>> {
  const results = Object.create(null);
  let containsPromise = false;

  for (const [responseName, fieldNodes] of fields.entries()) {
    const fieldPath = addPath(path, responseName, parentTypeName);
    const result = executeField(
      exeContext,
      parentTypeName,
      sourceValue,
      fieldNodes,
      fieldPath,
    );

    if (result !== undefined) {
      results[responseName] = result;
      if (isPromise(result)) {
        containsPromise = true;
      }
    }
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
 * In particular, this function figures out the value that the field returns by
 * calling its resolve function, then calls completeValue to complete promises,
 * serialize scalars, or execute the sub-selection-set for objects.
 */
function executeField(
  exeContext: ExecutionContext,
  parentTypeName: string,
  source: unknown,
  fieldNodes: Array<FieldNode>,
  path: Path,
): PromiseOrValue<unknown> {
  const fieldName = fieldNodes[0].name.value;

  let resolveFn;
  let returnTypeName: string;
  let returnTypeNode: TypeNode;
  if (fieldName === "__typename" && !resolveFn) {
    resolveFn = () => parentTypeName;
    returnTypeName = "String";
    returnTypeNode = {
      kind: Kind.NAMED_TYPE,
      name: {
        kind: Kind.NAME,
        value: "String",
      },
    };
  } else {
    returnTypeNode = fieldNodes[0].__type;
    returnTypeName = typeNameFromAST(returnTypeNode);
    const typeResolvers = exeContext.resolvers[parentTypeName];
    resolveFn = (typeResolvers as
      | ObjectTypeResolver<any, any, any>
      | undefined)?.[fieldName];

    if (typeof resolveFn !== "function" && resolveFn != null) {
      resolveFn = resolveFn.resolve;
    }
  }

  if (!resolveFn) {
    resolveFn = exeContext.fieldResolver;
  }

  const info = buildResolveInfo(
    exeContext,
    fieldName,
    fieldNodes,
    parentTypeName,
    returnTypeName,
    returnTypeNode,
    path,
  );

  // Get the resolve function, regardless of if its result is normal or abrupt (error).
  try {
    // Build a JS object of arguments from the field.arguments AST, using the
    // variables scope to fulfill any variable references.
    // TODO: find a way to memoize, in case this field is within a List type.
    const args = getArgumentValues(
      exeContext.resolvers,
      fieldNodes[0],
      exeContext.variableValues,
    );

    // The resolve function's optional third argument is a context value that
    // is provided to every resolve function within an execution. It is commonly
    // used to represent an authenticated user, or request-specific caches.
    const contextValue = exeContext.contextValue;

    const result = resolveFn(source, args, contextValue, info);

    let completed;
    if (isPromise(result)) {
      completed = result.then((resolved) =>
        completeValue(
          exeContext,
          returnTypeNode,
          fieldNodes,
          info,
          path,
          resolved,
        ),
      );
    } else {
      completed = completeValue(
        exeContext,
        returnTypeNode,
        fieldNodes,
        info,
        path,
        result,
      );
    }

    if (isPromise(completed)) {
      // Note: we don't rely on a `catch` method, but we do expect "thenable"
      // to take a second callback for the error case.
      return completed.then(undefined, (rawError) => {
        const error = locatedError(
          rawError,
          fieldNodes as ReadonlyArray<GraphQLASTNode>,
          pathToArray(path),
        );
        return handleFieldError(error, returnTypeNode, exeContext);
      });
    }
    return completed;
  } catch (rawError) {
    const error = locatedError(
      rawError,
      fieldNodes as ReadonlyArray<GraphQLASTNode>,
      pathToArray(path),
    );
    return handleFieldError(error, returnTypeNode, exeContext);
  }
}

/**
 * @internal
 */
export function buildResolveInfo(
  exeContext: ExecutionContext,
  fieldName: string,
  fieldNodes: Array<FieldNode>,
  parentTypeName: string,
  returnTypeName: string,
  returnTypeNode: TypeNode,
  path: Path,
): ResolveInfo {
  // The resolve function's optional fourth argument is a collection of
  // information about the current execution state.
  return {
    fieldName: fieldName,
    fieldNodes,
    returnTypeName,
    parentTypeName,
    returnTypeNode,
    path,
    fragments: exeContext.fragments,
    rootValue: exeContext.rootValue,
    operation: exeContext.operation,
    variableValues: exeContext.variableValues,
  };
}

function handleFieldError(
  error: GraphQLError,
  returnTypeNode: TypeNode,
  exeContext: ExecutionContext,
): null {
  // If the field type is non-nullable, then it is resolved without any
  // protection from errors, however it still properly locates the error.
  if (returnTypeNode.kind === Kind.NON_NULL_TYPE) {
    throw error;
  }

  // Otherwise, error protection is applied, logging the error and resolving
  // a null value for this field if one is encountered.
  exeContext.errors.push(error);
  return null;
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
  returnTypeNode: TypeNode,
  fieldNodes: Array<FieldNode>,
  info: ResolveInfo,
  path: Path,
  result: unknown,
): PromiseOrValue<unknown> {
  // If result is an Error, throw a located error.
  if (result instanceof Error) {
    throw result;
  }

  // If field type is NonNull, complete for inner type, and throw field error
  // if result is null.
  if (returnTypeNode.kind === Kind.NON_NULL_TYPE) {
    const completed = completeValue(
      exeContext,
      returnTypeNode.type,
      fieldNodes,
      info,
      path,
      result,
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
  if (returnTypeNode.kind === Kind.LIST_TYPE) {
    return completeListValue(
      exeContext,
      returnTypeNode.type,
      fieldNodes,
      info,
      path,
      result,
    );
  }

  const returnTypeName = returnTypeNode.name.value;
  let returnType: Resolver<any, any> = exeContext.resolvers[returnTypeName];
  if (!returnType) {
    returnType = specifiedScalars[returnTypeName];
  }

  // If field type is a leaf type, Scalar or Enum, serialize to a valid value,
  // returning null if serialization is not possible.
  if (isLeafType(returnType)) {
    return completeLeafValue(returnType, result);
  }

  if (returnType instanceof GraphQLInputObjectType) {
    // todo
  }

  // If field type is an abstract type, Interface or Union, determine the
  // runtime Object type and complete for that type.
  if (isUnionResolverType(returnType) || isInterfaceResolverType(returnType)) {
    return completeAbstractValue(
      exeContext,
      returnType,
      fieldNodes,
      info,
      path,
      result,
    );
  }

  // If field type is Object, execute and complete all sub-selections.
  // istanbul ignore else (See: 'https://github.com/graphql/graphql-js/issues/2618')
  if (typeof returnType === "object") {
    return completeObjectValue(
      exeContext,
      returnTypeName,
      fieldNodes,
      info,
      path,
      result,
    );
  }

  // istanbul ignore next (Not reachable. All possible output types have been considered)
  invariant(
    false,
    "Cannot complete value of unexpected output type: " + inspect(returnType),
  );
}

/**
 * Complete a list value by completing each item in the list with the
 * inner type
 */
function completeListValue(
  exeContext: ExecutionContext,
  returnTypeNode: TypeNode,
  fieldNodes: Array<FieldNode>,
  info: ResolveInfo,
  path: Path,
  result: unknown,
): PromiseOrValue<Array<unknown>> {
  if (!isIterableObject(result)) {
    throw new GraphQLError(
      `Expected Iterable, but did not find one for field "${info.parentTypeName}.${info.fieldName}".`,
    );
  }

  // This is specified as a simple map, however we're optimizing the path
  // where the list contains no Promises by avoiding creating another Promise.
  let containsPromise = false;
  const completedResults = Array.from(result, (item, index) => {
    // No need to modify the info object containing the path,
    // since from here on it is not ever accessed by resolver functions.
    const itemPath = addPath(path, index, undefined);
    try {
      let completedItem;
      if (isPromise(item)) {
        completedItem = item.then((resolved) =>
          completeValue(
            exeContext,
            returnTypeNode,
            fieldNodes,
            info,
            itemPath,
            resolved,
          ),
        );
      } else {
        completedItem = completeValue(
          exeContext,
          returnTypeNode,
          fieldNodes,
          info,
          itemPath,
          item,
        );
      }

      if (isPromise(completedItem)) {
        containsPromise = true;
        // Note: we don't rely on a `catch` method, but we do expect "thenable"
        // to take a second callback for the error case.
        return completedItem.then(undefined, (rawError) => {
          const error = locatedError(
            rawError,
            fieldNodes as ReadonlyArray<GraphQLASTNode>,
            pathToArray(itemPath),
          );
          return handleFieldError(error, returnTypeNode, exeContext);
        });
      }
      return completedItem;
    } catch (rawError) {
      const error = locatedError(
        rawError,
        fieldNodes as ReadonlyArray<GraphQLASTNode>,
        pathToArray(itemPath),
      );
      return handleFieldError(error, returnTypeNode, exeContext);
    }
  });

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
  returnType: UnionTypeResolver | InterfaceTypeResolver,
  fieldNodes: Array<FieldNode>,
  info: ResolveInfo,
  path: Path,
  result: unknown,
): PromiseOrValue<ObjMap<unknown>> {
  const resolveTypeFn = returnType.__resolveType ?? exeContext.typeResolver;
  const contextValue = exeContext.contextValue;
  const runtimeTypeName = resolveTypeFn(result, contextValue, info);

  if (isPromise(runtimeTypeName)) {
    return runtimeTypeName.then((resolvedRuntimeTypeName) =>
      completeObjectValue(
        exeContext,
        ensureValidRuntimeType(resolvedRuntimeTypeName, exeContext),
        fieldNodes,
        info,
        path,
        result,
      ),
    );
  }

  return completeObjectValue(
    exeContext,
    ensureValidRuntimeType(runtimeTypeName, exeContext),
    fieldNodes,
    info,
    path,
    result,
  );
}

function ensureValidRuntimeType(
  runtimeTypeName: unknown,
  exeContext: ExecutionContext,
): string {
  if (typeof runtimeTypeName !== "string") {
    throw new GraphQLError(
      `Could not determine runtime type for abstract type ${runtimeTypeName}`,
    );
  }

  const runtimeType: Resolver<any, any> = exeContext.resolvers[runtimeTypeName];

  if (!runtimeType) {
    throw new GraphQLError(
      `Type "${runtimeTypeName}" does not exist inside the schema.`,
    );
  } else if (
    runtimeType instanceof GraphQLScalarType ||
    runtimeType instanceof GraphQLEnumType ||
    runtimeType instanceof GraphQLInputObjectType ||
    runtimeType.__resolveType
  ) {
    throw new GraphQLError(
      `Given runtime object "${getRuntimeTypeInstanceName(
        runtimeType,
      )}" type is not a possible type for "${runtimeTypeName}".`,
    );
  } else {
    return runtimeTypeName;
  }
}

function getRuntimeTypeInstanceName(runtimeType: Resolver<any, any>): string {
  if (runtimeType instanceof GraphQLScalarType) {
    return "GraphQLScalarType";
  } else if (runtimeType instanceof GraphQLEnumType) {
    return "GraphQLEnumType";
  } else if (runtimeType instanceof GraphQLInputObjectType) {
    return "GraphQLInputObjectType";
  } else if ("__types" in runtimeType) {
    return "GraphQLUnionType";
  } else if ("__implementedBy" in runtimeType) {
    return "GraphQLInterfaceType";
  } else {
    return "Unknown";
  }
}

/**
 * Complete an Object value by executing all sub-selections.
 */
function completeObjectValue(
  exeContext: ExecutionContext,
  returnTypeName: string,
  fieldNodes: Array<FieldNode>,
  info: ResolveInfo,
  path: Path,
  result: unknown,
): PromiseOrValue<ObjMap<unknown>> {
  // Collect sub-fields to execute to complete this value.
  const subFieldNodes = collectSubfields(
    exeContext,
    returnTypeName,
    fieldNodes,
  );
  return executeFields(exeContext, returnTypeName, result, path, subFieldNodes);
}

function invalidReturnTypeError(
  returnType: GraphQLObjectType,
  result: unknown,
  fieldNodes: Array<FieldNode>,
): GraphQLError {
  return new GraphQLError(
    `Expected value of type "${returnType.name}" but got: ${inspect(result)}.`,
    fieldNodes as ReadonlyArray<GraphQLASTNode>,
  );
}

/**
 * A memoized collection of relevant subfields with regard to the return
 * type. Memoizing ensures the subfields are not repeatedly calculated, which
 * saves overhead when resolving lists of values.
 */
// TODO: memoize const collectSubfields = memoize3(_collectSubfields);
function collectSubfields(
  exeContext: ExecutionContext,
  returnTypeName: string,
  fieldNodes: Array<FieldNode>,
): Map<string, Array<FieldNode>> {
  let subFieldNodes = new Map();
  const visitedFragmentNames = new Set<string>();
  for (const node of fieldNodes) {
    if (node.selectionSet) {
      subFieldNodes = collectFields(
        exeContext.resolvers,
        exeContext.fragments,
        exeContext.variableValues,
        returnTypeName,
        node.selectionSet,
        subFieldNodes,
        visitedFragmentNames,
      );
    }
  }
  return subFieldNodes;
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
export const defaultFieldResolver: FunctionFieldResolver<
  unknown,
  unknown
> = function (source: any, args, contextValue, info) {
  // ensure source is a value for which property access is acceptable.
  if (isObjectLike(source) || typeof source === "function") {
    const property = source[info.fieldName];
    if (typeof property === "function") {
      return source[info.fieldName](args, contextValue, info);
    }
    return property;
  }
};

// TODO(freiksenet): Custom root type names maybe?
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
  }
}
