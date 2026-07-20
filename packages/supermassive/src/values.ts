import {
  GraphQLError,
  Kind,
  print,
  locatedError,
  DirectiveNode,
  FieldNode,
  VariableDefinitionNode,
  ValueNode,
} from "graphql";
import { inspect } from "./jsutils/inspect";
import { printPathArray } from "./jsutils/printPathArray";
import type {
  ExecutionContext,
  VariableCoercionResult,
} from "./executeWithoutSchema";
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
} from "./schema/definition";
import { valueFromAST } from "./utilities/valueFromAST";
import { coerceInputValue } from "./utilities/coerceInputValue";
import {
  inspectTypeReference,
  isNonNullType,
  typeReferenceFromNode,
} from "./schema/reference";
import type { SchemaFragment } from "./types";

type CoercedVariableValues =
  | { errors: Array<GraphQLError>; coerced?: never }
  | { coerced: { [variable: string]: unknown }; errors?: never };

type VariableCoercionContext = {
  schemaFragment: SchemaFragment;
  variableValues: { [variable: string]: unknown };
  rawVariableValues: { [variable: string]: unknown };
  variableDefinitions: { [variable: string]: VariableDefinitionNode };
  variableCoercionResults: Map<string, VariableCoercionResult>;
};

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
  schemaFragment: SchemaFragment,
  varDefNodes: ReadonlyArray<VariableDefinitionNode>,
  inputs: { [variable: string]: unknown },
  options?: { maxErrors?: number },
): CoercedVariableValues {
  const errors: GraphQLError[] = [];
  const maxErrors = options?.maxErrors;
  const variableContext = {
    schemaFragment,
    variableValues: {},
    rawVariableValues: inputs,
    variableDefinitions: getVariableDefinitionMap(varDefNodes),
    variableCoercionResults: new Map(),
  };
  const onError = (error: GraphQLError) => {
    if (maxErrors != null && errors.length >= maxErrors) {
      throw locatedError(
        "Too many errors processing variables, error limit reached. Execution aborted.",
        [],
      );
    }
    errors.push(error);
  };

  try {
    for (const varDefNode of varDefNodes) {
      const result = getVariableValue(
        variableContext,
        varDefNode.variable.name.value,
      );
      if (result.status === "error") {
        for (const error of result.errors) {
          onError(error);
        }
      }
    }
    if (errors.length === 0) {
      return { coerced: variableContext.variableValues };
    }
  } catch (error) {
    errors.push(error as GraphQLError);
  }

  return { errors: errors };
}

export function getVariableDefinitionMap(
  varDefNodes: ReadonlyArray<VariableDefinitionNode>,
): { [variable: string]: VariableDefinitionNode } {
  const variableDefinitionMap: { [variable: string]: VariableDefinitionNode } =
    Object.create(null);
  for (const varDefNode of varDefNodes) {
    variableDefinitionMap[varDefNode.variable.name.value] = varDefNode;
  }
  return variableDefinitionMap;
}

function getVariableValue(
  exeContext: VariableCoercionContext,
  variableName: string,
): VariableCoercionResult {
  const existingResult = exeContext.variableCoercionResults.get(variableName);
  if (existingResult) {
    return existingResult;
  }

  const varDefNode = exeContext.variableDefinitions[variableName];
  if (!varDefNode) {
    const result: VariableCoercionResult = { status: "missing" };
    exeContext.variableCoercionResults.set(variableName, result);
    return result;
  }

  const result = coerceVariableValue(
    exeContext.schemaFragment,
    varDefNode,
    exeContext.rawVariableValues,
  );
  exeContext.variableCoercionResults.set(variableName, result);

  if (result.status === "coerced") {
    exeContext.variableValues[variableName] = result.value;
  }

  return result;
}

function coerceVariableValue(
  schemaFragment: SchemaFragment,
  varDefNode: VariableDefinitionNode,
  inputs: { [variable: string]: unknown },
): VariableCoercionResult {
  const errors: GraphQLError[] = [];
  const onError = (error: GraphQLError) => errors.push(error);
  const varName = varDefNode.variable.name.value;
  const varTypeReference = typeReferenceFromNode(varDefNode.type);

  if (!isInputType(schemaFragment.definitions, varTypeReference)) {
    const varTypeStr = inspectTypeReference(varTypeReference);
    onError(
      locatedError(
        `Variable "$${varName}" expected value of type "${varTypeStr}" which cannot be used as an input type.`,
        [varDefNode.type],
      ),
    );
    return { status: "error", errors };
  }

  if (!hasOwnProperty(inputs, varName)) {
    if (varDefNode.defaultValue) {
      const value = valueFromAST(
        varDefNode.defaultValue,
        varTypeReference,
        schemaFragment,
      );
      return { status: "coerced", value };
    }
    if (isNonNullType(varTypeReference)) {
      const varTypeStr = inspectTypeReference(varTypeReference);
      onError(
        locatedError(
          `Variable "$${varName}" of required type "${varTypeStr}" was not provided.`,
          [varDefNode],
        ),
      );
      return { status: "error", errors };
    }
    return { status: "missing" };
  }

  const value = inputs[varName];
  if (value === null && isNonNullType(varTypeReference)) {
    const varTypeStr = inspectTypeReference(varTypeReference);
    onError(
      locatedError(
        `Variable "$${varName}" of non-null type "${varTypeStr}" must not be null.`,
        [varDefNode],
      ),
    );
    return { status: "error", errors };
  }

  const coerced = coerceInputValue(
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
  );

  return errors.length > 0
    ? { status: "error", errors }
    : { status: "coerced", value: coerced };
}

function ensureVariableValue(
  exeContext: ExecutionContext,
  variableName: string,
): void {
  const result = getVariableValue(exeContext, variableName);
  if (result.status === "error") {
    throw result.errors[0];
  }
}

function ensureVariablesInValue(
  exeContext: ExecutionContext,
  valueNode: ValueNode,
): void {
  if (valueNode.kind === Kind.VARIABLE) {
    ensureVariableValue(exeContext, valueNode.name.value);
    return;
  }

  if (valueNode.kind === Kind.LIST) {
    for (const itemNode of valueNode.values) {
      ensureVariablesInValue(exeContext, itemNode);
    }
    return;
  }

  if (valueNode.kind === Kind.OBJECT) {
    for (const fieldNode of valueNode.fields) {
      ensureVariablesInValue(exeContext, fieldNode.value);
    }
  }
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
): { [argument: string]: unknown } {
  const definitions = exeContext.schemaFragment.definitions;
  const coercedValues: { [argument: string]: unknown } = {};
  const argumentDefs = isFieldDefinition(def, node)
    ? getFieldDefinitionArgs(def)
    : getDirectiveDefinitionArgs(def);
  if (!argumentDefs) {
    return coercedValues;
  }
  // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')
  const argumentNodes = node.arguments ?? [];
  const argNodeMap = new Map(argumentNodes.map((arg) => [arg.name.value, arg]));

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

    if (!isDefined(definitions, argumentTypeRef)) {
      throw locatedError(
        `Could not find type for argument ${name} in ${node.kind} ${node.name.value}`,
        [argumentNode],
      );
    }

    // if (!schemaTypes.isInputType(argumentTypeRef)) {
    //   const type = schemaTypes.printTypeRef(argumentTypeRef);
    //   throw locatedError(
    //     `Argument "$${name}" expected value of type "${type}" which cannot be used as an input type.`,
    //     [argumentNode],
    //   );
    // }

    const valueNode = argumentNode.value;
    let isNull = valueNode.kind === Kind.NULL;

    if (valueNode.kind === Kind.VARIABLE) {
      const variableName = valueNode.name.value;
      ensureVariableValue(exeContext, variableName);
      if (
        exeContext.variableValues == null ||
        !hasOwnProperty(exeContext.variableValues, variableName)
      ) {
        if (defaultValue !== undefined) {
          coercedValues[name] = defaultValue;
        } else if (isNonNullType(argumentTypeRef)) {
          const type = inspectTypeReference(argumentTypeRef);
          throw locatedError(
            `Argument "${name}" of required type "${type}" ` +
              `was provided the variable "$${variableName}" which was not provided a runtime value.`,
            [valueNode],
          );
        }
        continue;
      }
      isNull = exeContext.variableValues[variableName] == null;
    } else {
      ensureVariablesInValue(exeContext, valueNode);
    }

    if (isNull && isNonNullType(argumentTypeRef)) {
      const type = inspectTypeReference(argumentTypeRef);
      throw locatedError(
        `Argument "${name}" of non-null type "${type}" must not be null."`,
        [valueNode],
      );
    }

    const coercedValue = valueFromAST(
      valueNode,
      argumentTypeRef,
      exeContext.schemaFragment,
      exeContext.variableValues,
    );
    if (coercedValue === undefined) {
      // Note: ValuesOfCorrectTypeRule validation should catch this before
      // execution. This is a runtime check to ensure execution does not
      // continue with an invalid argument value.
      throw locatedError(
        `Argument "${name}" has invalid value ${print(valueNode)}.`,
        [valueNode],
      );
    }
    coercedValues[name] = coercedValue;
  }

  return coercedValues;
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
    return getArgumentValues(exeContext, directiveDef, directiveNode);
  }
}

function hasOwnProperty(obj: unknown, prop: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}
