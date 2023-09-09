import {
  GraphQLError,
  Kind,
  print,
  locatedError,
  DirectiveNode,
  FieldNode,
  VariableDefinitionNode,
} from "graphql";
import { inspect } from "./jsutils/inspect";
import { printPathArray } from "./jsutils/printPathArray";
import { ExecutionContext } from "./executeWithoutSchema";
import { DirectiveDefinitionTuple, FieldDefinition } from "./schema/definition";
import { valueFromAST } from "./utilities/valueFromAST";
import { PartialSchema } from "./schema/fragment";
import { coerceInputValue } from "./utilities/coerceInputValue";
import {
  inspectTypeReference,
  isNonNullType,
  typeReferenceFromNode,
} from "./schema/reference";

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
  schemaTypes: PartialSchema,
  varDefNodes: ReadonlyArray<VariableDefinitionNode>,
  inputs: { [variable: string]: unknown },
  options?: { maxErrors?: number },
): CoercedVariableValues {
  const errors: GraphQLError[] = [];
  const maxErrors = options?.maxErrors;
  try {
    const coerced = coerceVariableValues(
      schemaTypes,
      varDefNodes,
      inputs,
      (error) => {
        if (maxErrors != null && errors.length >= maxErrors) {
          throw new GraphQLError(
            "Too many errors processing variables, error limit reached. Execution aborted.",
          );
        }
        errors.push(error);
      },
    );

    if (errors.length === 0) {
      return { coerced };
    }
  } catch (error) {
    errors.push(error as GraphQLError);
  }

  return { errors: errors };
}

function coerceVariableValues(
  schemaTypes: PartialSchema,
  varDefNodes: ReadonlyArray<VariableDefinitionNode>,
  inputs: { [variable: string]: unknown },
  onError: (error: GraphQLError) => void,
): { [variable: string]: unknown } {
  const coercedValues: { [variable: string]: unknown } = {};
  for (const varDefNode of varDefNodes) {
    const varName = varDefNode.variable.name.value;
    const varTypeReference = typeReferenceFromNode(varDefNode.type);

    if (!schemaTypes.isInputType(varTypeReference)) {
      // Must use input types for variables. This should be caught during
      // validation, however is checked again here for safety.
      const varTypeStr = inspectTypeReference(varTypeReference);
      onError(
        new GraphQLError(
          `Variable "$${varName}" expected value of type "${varTypeStr}" which cannot be used as an input type.`,
          { nodes: varDefNode.type },
        ),
      );
      continue;
    }

    if (!hasOwnProperty(inputs, varName)) {
      if (varDefNode.defaultValue) {
        coercedValues[varName] = valueFromAST(
          varDefNode.defaultValue,
          varTypeReference,
          schemaTypes,
        );
      } else if (isNonNullType(varTypeReference)) {
        const varTypeStr = inspectTypeReference(varTypeReference);
        onError(
          new GraphQLError(
            `Variable "$${varName}" of required type "${varTypeStr}" was not provided.`,
            { nodes: varDefNode },
          ),
        );
      }
      continue;
    }

    const value = inputs[varName];
    if (value === null && isNonNullType(varTypeReference)) {
      const varTypeStr = inspectTypeReference(varTypeReference);
      onError(
        new GraphQLError(
          `Variable "$${varName}" of non-null type "${varTypeStr}" must not be null.`,
          { nodes: varDefNode },
        ),
      );
      continue;
    }

    coercedValues[varName] = coerceInputValue(
      value,
      varTypeReference,
      schemaTypes,
      (path, invalidValue, error) => {
        let prefix =
          `Variable "$${varName}" got invalid value ` + inspect(invalidValue);
        if (path.length > 0) {
          prefix += ` at "${varName}${printPathArray(path)}"`;
        }
        onError(
          new GraphQLError(prefix + "; " + error.message, {
            nodes: varDefNode,
            originalError: error.originalError,
          }),
        );
      },
    );
  }

  return coercedValues;
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
  const schemaTypes = exeContext.schemaTypes;
  const coercedValues: { [argument: string]: unknown } = {};
  const argumentDefs = schemaTypes.resolveDefinitionArguments(def);
  if (!argumentDefs) {
    return coercedValues;
  }
  // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')
  const argumentNodes = node.arguments ?? [];
  const argNodeMap = new Map(argumentNodes.map((arg) => [arg.name.value, arg]));

  for (const [name, argumentDef] of Object.entries(argumentDefs)) {
    const argumentNode = argNodeMap.get(name);
    const argumentTypeRef = schemaTypes.getTypeReference(argumentDef);
    const defaultValue = schemaTypes.getInputDefaultValue(argumentDef);

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

    if (!schemaTypes.isDefined(argumentTypeRef)) {
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
      schemaTypes,
      exeContext.variableValues,
    );
    if (coercedValue === undefined) {
      // Note: ValuesOfCorrectTypeRule validation should catch this before
      // execution. This is a runtime check to ensure execution does not
      // continue with an invalid argument value.
      throw new GraphQLError(
        `Argument "${name}" has invalid value ${print(valueNode)}.`,
        { nodes: valueNode },
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
  const schemaTypes = exeContext.schemaTypes;
  const name = schemaTypes.getDirectiveName(directiveDef);

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
