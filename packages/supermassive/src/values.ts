import {
  ArgumentNode as GraphQLArgumentNode,
  GraphQLBoolean,
  GraphQLError,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLScalarType,
  GraphQLString,
  GraphQLType,
  isInputType,
  isNonNullType,
  Kind,
  print,
  TypeNode as GraphQLTypeNode,
  ValueNode as GraphQLValueNode,
  VariableDefinitionNode as GraphQLVariableDefinitionNode,
  valueFromAST,
  coerceInputValue,
} from "graphql";
import {
  DirectiveNode,
  FieldNode,
  TypeNode,
  VariableDefinitionNode,
} from "@graphitation/supermassive-ast";
import { inspect } from "./jsutils/inspect";
import type { Maybe } from "./jsutils/Maybe";
import type { ObjMap } from "./jsutils/ObjMap";
import { printPathArray } from "./jsutils/printPathArray";
import { Resolvers } from "./types";
import { GraphQLDirective } from "./directives";

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
  resolvers: Resolvers,
  varDefNodes: ReadonlyArray<VariableDefinitionNode>,
  inputs: { [variable: string]: unknown },
  options?: { maxErrors?: number },
): CoercedVariableValues {
  const errors: GraphQLError[] = [];
  const maxErrors = options?.maxErrors;
  try {
    const coerced = coerceVariableValues(
      resolvers,
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
  resolvers: Resolvers,
  varDefNodes: ReadonlyArray<VariableDefinitionNode>,
  inputs: { [variable: string]: unknown },
  onError: (error: GraphQLError) => void,
): { [variable: string]: unknown } {
  const coercedValues: { [variable: string]: unknown } = {};
  for (const varDefNode of varDefNodes) {
    const varName = varDefNode.variable.name.value;
    const varTypeAst = varDefNode.type;
    const varType: GraphQLType = graphqlTypeFromTypeAst(resolvers, varTypeAst);

    if (!isInputType(varType)) {
      // Must use input types for variables. This should be caught during
      // validation, however is checked again here for safety.
      const varTypeStr = inspect(varType);
      onError(
        new GraphQLError(
          `Variable "$${varName}" expected value of type "${varTypeStr}" which cannot be used as an input type.`,
          { nodes: varDefNode.type as GraphQLTypeNode },
        ),
      );
      continue;
    }

    if (!hasOwnProperty(inputs, varName)) {
      if (varDefNode.defaultValue) {
        coercedValues[varName] = valueFromAST(
          varDefNode.defaultValue as Maybe<GraphQLValueNode>,
          varType,
        );
      } else if (isNonNullType(varType)) {
        const varTypeStr = print(varDefNode.type as GraphQLTypeNode);
        onError(
          new GraphQLError(
            `Variable "$${varName}" of required type "${varTypeStr}" was not provided.`,
            { nodes: varDefNode as GraphQLVariableDefinitionNode },
          ),
        );
      }
      continue;
    }

    const value = inputs[varName];
    if (value === null && isNonNullType(varType)) {
      const varTypeStr = inspect(varType);
      onError(
        new GraphQLError(
          `Variable "$${varName}" of non-null type "${varTypeStr}" must not be null.`,
          { nodes: varDefNode as GraphQLVariableDefinitionNode },
        ),
      );
      continue;
    }

    coercedValues[varName] = coerceInputValue(
      value,
      varType,
      (path, invalidValue, error) => {
        let prefix =
          `Variable "$${varName}" got invalid value ` + inspect(invalidValue);
        if (path.length > 0) {
          prefix += ` at "${varName}${printPathArray(path)}"`;
        }
        onError(
          new GraphQLError(prefix + "; " + error.message, {
            nodes: varDefNode as GraphQLVariableDefinitionNode,
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
  resolvers: Resolvers,
  node: FieldNode | DirectiveNode,
  variableValues?: Maybe<ObjMap<unknown>>,
): { [argument: string]: unknown } {
  const coercedValues: { [argument: string]: unknown } = {};

  // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')
  const argumentNodes = node.arguments ?? [];

  for (const argumentNode of argumentNodes) {
    const name = argumentNode.name.value;
    const argTypeNode = argumentNode.__type;
    const argType = graphqlTypeFromTypeAst(resolvers, argTypeNode);

    if (!isInputType(argType)) {
      throw new GraphQLError(
        `Argument "$${name}" expected value of type "${inspect(
          argType,
        )}" which cannot be used as an input type.`,
        { nodes: argumentNode as GraphQLArgumentNode },
      );
    }

    let valueNode = argumentNode.value;

    if (valueNode.kind === Kind.VARIABLE) {
      const variableName = valueNode.name.value;
      if (
        variableValues == null ||
        !hasOwnProperty(variableValues, variableName)
      ) {
        if (argumentNode.__defaultValue) {
          valueNode = argumentNode.__defaultValue;
        } else if (isNonNullType(argType)) {
          throw new GraphQLError(
            `Argument "${name}" of required type "${inspect(argType)}" ` +
              `was provided the variable "$${variableName}" which was not provided a runtime value.`,
            { nodes: valueNode as GraphQLValueNode },
          );
        }

        continue;
      }
    }

    const coercedValue = valueFromAST(
      valueNode as GraphQLValueNode,
      argType,
      variableValues,
    );
    if (coercedValue === undefined) {
      // Note: ValuesOfCorrectTypeRule validation should catch this before
      // execution. This is a runtime check to ensure execution does not
      // continue with an invalid argument value.
      throw new GraphQLError(
        `Argument "${name}" has invalid value ${print(
          valueNode as GraphQLValueNode,
        )}.`,
        { nodes: valueNode as GraphQLValueNode },
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
  directiveDef: GraphQLDirective,
  node: { directives?: ReadonlyArray<DirectiveNode> },
  resolvers: Resolvers,
  variableValues?: Maybe<ObjMap<unknown>>,
): undefined | { [argument: string]: unknown } {
  // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')
  const directiveNode = node.directives?.find(
    (directive) => directive.name.value === directiveDef.name,
  );

  if (directiveNode) {
    return getArgumentValues(resolvers, directiveNode, variableValues);
  }
}

function hasOwnProperty(obj: unknown, prop: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

export const specifiedScalars: { [key: string]: GraphQLScalarType } = {
  ID: GraphQLID,
  String: GraphQLString,
  Int: GraphQLInt,
  Float: GraphQLFloat,
  Boolean: GraphQLBoolean,
};

function graphqlTypeFromTypeAst(
  resolvers: Resolvers,
  node: TypeNode,
): GraphQLType {
  if (node.kind === Kind.NON_NULL_TYPE) {
    return new GraphQLNonNull(graphqlTypeFromTypeAst(resolvers, node.type));
  } else if (node.kind === Kind.LIST_TYPE) {
    return new GraphQLList(graphqlTypeFromTypeAst(resolvers, node.type));
  } else {
    const typeName = node.name.value;
    const type = specifiedScalars[typeName] || resolvers[typeName];
    return type as GraphQLType;
  }
}
