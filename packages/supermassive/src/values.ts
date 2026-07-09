import {
  GraphQLError,
  Kind,
  print,
  locatedError,
  DirectiveNode,
  FieldNode,
  VariableDefinitionNode,
  ArgumentNode,
} from "graphql";
import { inspect } from "./jsutils/inspect";
import { printPathArray } from "./jsutils/printPathArray";
import { ExecutionContext } from "./executeWithoutSchema";
import {
  DirectiveDefinitionTuple,
  FieldDefinition,
  getFieldDefinitionArgs,
  getDirectiveDefinitionName,
  getInputDefaultValue,
  getInputValueTypeReference,
  isDefined,
  isInputType,
  getDirectiveDefinitionArgs,
  InputValueDefinition,
} from "./schema/definition";
import { typeNameFromReference } from "./schema/reference";
import { valueFromAST } from "./utilities/valueFromAST";
import { coerceInputValue } from "./utilities/coerceInputValue";
import {
  type SchemaFragmentLoaderContext,
  requestSchemaFragment,
} from "./utilities/requestSchemaFragment";
import {
  inspectTypeReference,
  isNonNullType,
  typeReferenceFromNode,
} from "./schema/reference";
import { PromiseOrValue } from "graphql/jsutils/PromiseOrValue";
import { isPromise } from "./jsutils/isPromise";
import { SchemaFragment } from "./types";

type CoercedVariableValues =
  | { errors: Array<GraphQLError>; coerced?: never }
  | { coerced: { [variable: string]: unknown }; errors?: never };

/**
 * Prepares an object map of variableValues of the correct type based on the
 * provided variable definitions and arbitrary input. If the input cannot be
 * parsed to match the variable definitions, a GraphQLError will be thrown.
 *
 * Note: The returned value is a plain Object with a prototype, since it is
 * exposed to user code. Care should be taken to not pull values from the
 * Object prototype.
 *
 * @internal
 */
export function getVariableValues(
  context: SchemaFragmentLoaderContext,
  varDefNodes: ReadonlyArray<VariableDefinitionNode>,
  inputs: { [variable: string]: unknown },
  options?: { maxErrors?: number },
): PromiseOrValue<CoercedVariableValues> {
  const errors: GraphQLError[] = [];
  const maxErrors = options?.maxErrors;
  try {
    const coerced = coerceVariableValues(
      context,
      varDefNodes,
      inputs,
      (error) => {
        if (maxErrors != null && errors.length >= maxErrors) {
          throw locatedError(
            "Too many errors processing variables, error limit reached. Execution aborted.",
            [],
          );
        }
        errors.push(error);
      },
    );

    if (errors.length === 0) {
      return isPromise(coerced)
        ? coerced.then((result) => ({ coerced: result }))
        : { coerced };
    }
  } catch (error) {
    errors.push(error as GraphQLError);
  }

  return { errors: errors };
}

function coerceVariableValues(
  context: SchemaFragmentLoaderContext,
  varDefNodes: ReadonlyArray<VariableDefinitionNode>,
  inputs: { [variable: string]: unknown },
  onError: (error: GraphQLError) => void,
): PromiseOrValue<{ [variable: string]: unknown }> {
  const coercedValues: { [variable: string]: unknown } = {};
  const coercionResults = [];
  let hasPromises = false;
  for (const varDefNode of varDefNodes) {
    const r = coerceVariableValueWithFragmentLoader(
      context,
      varDefNode,
      inputs,
      onError,
    );
    coercionResults.push(r);

    if (isPromise(r)) {
      hasPromises = true;
    }
  }

  return hasPromises
    ? Promise.all(coercionResults).then((results) =>
        results.reduce(reduceVariableCoercionResults, coercedValues),
      )
    : (coercionResults as CoercionResult[]).reduce(
        reduceVariableCoercionResults,
        coercedValues,
      );
}

function reduceVariableCoercionResults(
  coercedValues: Record<string, unknown>,
  result: CoercionResult,
): Record<string, unknown> {
  if (isCoercedValue(result)) {
    coercedValues[result.varName] = result.value;
  }
  return coercedValues;
}

type CoercedValue = { varName: string; value: unknown };
type CoercionError = { varName: string; error: GraphQLError };
type CoercionResult = CoercedValue | CoercionError;

function isCoercedValue(r: CoercionResult): r is CoercedValue {
  return "value" in r;
}

function coerceVariableValueWithFragmentLoader(
  context: SchemaFragmentLoaderContext,
  varDefNode: Readonly<VariableDefinitionNode>,
  inputs: { [variable: string]: unknown },
  onError: (error: GraphQLError) => void,
): PromiseOrValue<CoercionResult> {
  const { schemaFragment } = context;
  const varTypeReference = typeReferenceFromNode(varDefNode.type);
  if (!isDefined(schemaFragment.definitions, varTypeReference)) {
    const typeName = typeNameFromReference(varTypeReference);
    // FIXME: this call needs to resolve all the nested types as well or it could still break down the chain
    const loading = requestSchemaFragment(context, {
      kind: "InputType",
      typeName,
    });

    if (!loading) {
      const varName = varDefNode.variable.name.value;
      const error = locatedError(
        `Type "${typeName}" for variable "${varName}" is missing.`,
        [varDefNode.type],
      );
      onError(error);
      return { varName, error };
    }

    return loading.then(() =>
      coerceVariableValue(context.schemaFragment, varDefNode, inputs, onError),
    );
  }

  return coerceVariableValue(
    context.schemaFragment,
    varDefNode,
    inputs,
    onError,
  );
}

function coerceVariableValue(
  schemaFragment: SchemaFragment,
  varDefNode: Readonly<VariableDefinitionNode>,
  inputs: { [variable: string]: unknown },
  onError: (error: GraphQLError) => void,
): CoercionResult {
  const varName = varDefNode.variable.name.value;
  const varTypeReference = typeReferenceFromNode(varDefNode.type);

  if (!isInputType(schemaFragment.definitions, varTypeReference)) {
    // Must use input types for variables. This should be caught during
    // validation, however is checked again here for safety.
    const varTypeStr = inspectTypeReference(varTypeReference);
    const error = locatedError(
      `Variable "$${varName}" expected value of type "${varTypeStr}" which cannot be used as an input type.`,
      [varDefNode.type],
    );
    onError(error);
    return { varName, error };
  }

  if (!hasOwnProperty(inputs, varName)) {
    if (varDefNode.defaultValue) {
      return {
        varName,
        value: valueFromAST(
          varDefNode.defaultValue,
          varTypeReference,
          schemaFragment,
        ),
      };
    } else if (isNonNullType(varTypeReference)) {
      const varTypeStr = inspectTypeReference(varTypeReference);
      const error = locatedError(
        `Variable "$${varName}" of required type "${varTypeStr}" was not provided.`,
        [varDefNode],
      );
      onError(error);
      return { varName, error };
    }
    // FIXME: probablt should return with undefined value here
  }

  const value = inputs[varName];
  if (value === null && isNonNullType(varTypeReference)) {
    const varTypeStr = inspectTypeReference(varTypeReference);
    const error = locatedError(
      `Variable "$${varName}" of non-null type "${varTypeStr}" must not be null.`,
      [varDefNode],
    );
    onError(error);
    return { varName, error };
  }

  return {
    varName,
    value: coerceInputValue(
      value,
      varTypeReference,
      schemaFragment,
      (path, invalidValue, error) => {
        let prefix =
          `Variable "$${varName}" got invalid value ` + inspect(invalidValue);
        if (path.length > 0) {
          prefix += ` at "${varName}${printPathArray(path)}"`;
        }
        onError(locatedError(prefix + "; " + error.message, [varDefNode]));
      },
    ),
  };
}

function isFieldDefinition(
  def: FieldDefinition | DirectiveDefinitionTuple,
  node: FieldNode | DirectiveNode,
): def is FieldDefinition {
  return node.kind === Kind.FIELD;
}

/**
 * Prepares an object map of argument values given a list of argument
 * definitions and list of argument AST nodes.
 *
 * Note: The returned value is a plain Object with a prototype, since it is
 * exposed to user code. Care should be taken to not pull values from the
 * Object prototype.
 *
 * @internal
 */
export function getArgumentValues(
  exeContext: ExecutionContext,
  def: FieldDefinition | DirectiveDefinitionTuple,
  node: FieldNode | DirectiveNode,
): PromiseOrValue<{ [argument: string]: unknown }> {
  const coercedValues: Record<string, unknown> = {};
  const argumentDefs = isFieldDefinition(def, node)
    ? getFieldDefinitionArgs(def)
    : getDirectiveDefinitionArgs(def);

  if (!argumentDefs) {
    return coercedValues;
  }

  // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')
  const argumentNodes = node.arguments ?? [];
  const argNodeMap = new Map(argumentNodes.map((arg) => [arg.name.value, arg]));
  let hasPromises = false;
  const coercionResults = [];
  for (const [name, argumentDef] of Object.entries(argumentDefs)) {
    const argumentNode = argNodeMap.get(name);
    const argumentTypeRef = getInputValueTypeReference(argumentDef);
    const defaultValue = getInputDefaultValue(argumentDef);

    if (argumentNode == null) {
      if (defaultValue !== undefined) {
        coercedValues[name] = defaultValue;
      } else if (isNonNullType(argumentTypeRef)) {
        const type = inspectTypeReference(argumentTypeRef);
        throw locatedError(
          `Argument "${name}" of required type "${type}" was not provided.`,
          [node],
        );
      }
      continue;
    }

    const {
      schemaFragment,
      schemaFragmentLoader,
      contextValue,
      variableValues,
    } = exeContext;

    const r = getArgumentValueWithFragmentLoader(
      { contextValue, schemaFragment, schemaFragmentLoader },
      argumentNode,
      argumentDef,
      variableValues,
    );

    coercionResults.push(r);

    if (isPromise(r)) {
      hasPromises = true;
    }
  }

  return hasPromises
    ? Promise.all(coercionResults).then((results) =>
        results.reduce(reduceArgCoercionResults, coercedValues),
      )
    : (coercionResults as ArgCoercionResult[]).reduce(
        reduceArgCoercionResults,
        coercedValues,
      );
}

type ArgValue = { argName: string; value: unknown };
type ArgError = { argName: string; error: GraphQLError };
type ArgCoercionResult = ArgValue | ArgError;

function isArgValue(r: ArgCoercionResult): r is ArgValue {
  return "value" in r;
}

function reduceArgCoercionResults(
  coercedValues: Record<string, unknown>,
  result: ArgCoercionResult,
): Record<string, unknown> {
  if (isArgValue(result)) {
    coercedValues[result.argName] = result.value;
  }
  return coercedValues;
}

function getArgumentValueWithFragmentLoader(
  context: SchemaFragmentLoaderContext,
  argNode: ArgumentNode,
  argDef: InputValueDefinition,
  variableValues: { [variable: string]: unknown },
): PromiseOrValue<ArgCoercionResult> {
  const argName = argNode.name.value;
  const argumentTypeRef = getInputValueTypeReference(argDef);

  const { schemaFragment } = context;
  if (!isDefined(schemaFragment.definitions, argumentTypeRef)) {
    const typeName = typeNameFromReference(argumentTypeRef);
    // FIXME: this call needs to resolve all the nested types as well or it could still break down the chain
    const loading = requestSchemaFragment(context, {
      kind: "InputType",
      typeName,
    });

    if (!loading) {
      const error = locatedError(
        `Type "${typeName}" for argument "${argName}" is missing.`,
        [argNode],
      );
      return { argName, error };
    }

    return loading.then(() =>
      coerceArgumentValue(context, argNode, argDef, variableValues),
    );
  }

  return coerceArgumentValue(context, argNode, argDef, variableValues);
}

function coerceArgumentValue(
  context: SchemaFragmentLoaderContext,
  argNode: ArgumentNode,
  argDef: InputValueDefinition,
  variableValues: { [variable: string]: unknown },
) {
  const argumentTypeRef = getInputValueTypeReference(argDef);

  const argName = argNode.name.value;
  const valueNode = argNode.value;
  let isNull = valueNode.kind === Kind.NULL;

  if (valueNode.kind === Kind.VARIABLE) {
    const variableName = valueNode.name.value;
    const defaultValue = getInputDefaultValue(argDef);
    if (
      variableValues == null ||
      !hasOwnProperty(variableValues, variableName)
    ) {
      if (defaultValue !== undefined) {
        return { argName, value: defaultValue };
      }
      if (isNonNullType(argumentTypeRef)) {
        const type = inspectTypeReference(argumentTypeRef);
        const error = locatedError(
          `Argument "${name}" of required type "${type}" ` +
            `was provided the variable "$${variableName}" which was not provided a runtime value.`,
          [valueNode],
        );

        return { argName, error };
      }
      // FIXME: what to do here? check original implementation
    }
    isNull = variableValues[variableName] == null;
  }

  if (isNull && isNonNullType(argumentTypeRef)) {
    const type = inspectTypeReference(argumentTypeRef);
    const error = locatedError(
      `Argument "${name}" of non-null type "${type}" must not be null."`,
      [valueNode],
    );
    return { argName, error };
  }

  const coercedValue = valueFromAST(
    valueNode,
    argumentTypeRef,
    context.schemaFragment,
    variableValues,
  );
  if (coercedValue === undefined) {
    // Note: ValuesOfCorrectTypeRule validation should catch this before
    // execution. This is a runtime check to ensure execution does not
    // continue with an invalid argument value.
    const error = locatedError(
      `Argument "${argName}" has invalid value ${print(valueNode)}.`,
      [valueNode],
    );
    return { argName, error };
  }

  return { argName, value: coercedValue };
}

/**
 * Prepares an object map of argument values given a directive definition
 * and a AST node which may contain directives. Optionally also accepts a map
 * of variable values.
 *
 * If the directive does not exist on the node, returns undefined.
 *
 * Note: The returned value is a plain Object with a prototype, since it is
 * exposed to user code. Care should be taken to not pull values from the
 * Object prototype.
 */
export function getDirectiveValues(
  exeContext: ExecutionContext,
  directiveDef: DirectiveDefinitionTuple,
  node: { directives?: ReadonlyArray<DirectiveNode> },
): undefined | { [argument: string]: unknown } {
  const name = getDirectiveDefinitionName(directiveDef);

  // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')
  const directiveNode = node.directives?.find(
    (directive) => directive.name.value === name,
  );

  if (directiveNode) {
    const argValues = getArgumentValues(
      exeContext,
      directiveDef,
      directiveNode,
    );

    // FIXME: check if schemaLoader should load types for directives
    if (isPromise(argValues)) {
      throw locatedError("FIXME:getDirectiveValues", node.directives);
    }

    return argValues;
  }
}

function hasOwnProperty(obj: unknown, prop: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}
