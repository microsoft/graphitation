import {
  ArgumentNode,
  ASTNode,
  DirectiveNode,
  ValueNode,
  ObjectTypeDefinitionNode,
  locatedError,
} from "graphql";
import { DefinitionModel } from "../types";
import { createVariableNameFromImport } from "../utilities";
import { getRelativePath } from "./utilities";

export const MODEL_DIRECTIVE_NAME = "model";

export function processModelDirective(
  node: DirectiveNode,
  ancestors: ReadonlyArray<ASTNode | ReadonlyArray<ASTNode>>,
  outputPath: string,
  documentPath: string,
): DefinitionModel {
  const from = getArgumentValue(node.arguments, "from");
  const tsType = getArgumentValue(node.arguments, "tsType");
  const scope = getArgumentValue(node.arguments, "scope");

  if (from && from.kind !== "StringValue") {
    throw locatedError(
      `Directive @module requires "from" argument to exist and be a path to a typescript file.`,
      [from ?? node],
    );
  }
  if (tsType?.kind !== "StringValue") {
    throw locatedError(
      `Directive @model requires "tsType" argument to exist and be a name of the exported typescript type`,
      [tsType ?? node],
    );
  }
  if (scope && scope.kind !== "StringValue" && scope.kind !== "EnumValue") {
    throw locatedError(
      `Directive @model scope argument must be string or enum`,
      [scope ?? node],
    );
  }
  const typeDef: ASTNode | readonly ASTNode[] | undefined =
    ancestors[ancestors.length - 1];

  if (
    !typeDef ||
    Array.isArray(typeDef) ||
    ((typeDef as ASTNode).kind !== "ObjectTypeDefinition" &&
      (typeDef as ASTNode).kind !== "ScalarTypeDefinition")
  ) {
    throw new GraphQLError(
      "Directive @model must be defined on Object or Scalar type",
      [node],
    );
  }
  const typeName = (typeDef as ObjectTypeDefinitionNode).name.value;

  return {
    typeName,
    modelName: `_${typeName}`,
    tsType: tsType.value,
    importName: from ? createVariableNameFromImport(from.value) : null,
    from: getRelativePath(from?.value, outputPath, documentPath),
    modelScope: scope ? scope.value : null,
    on: (typeDef as ASTNode).kind as
      | "ObjectTypeDefinition"
      | "ScalarTypeDefinition",
    directive: node,
  };
}

const getArgumentValue = (
  args: readonly ArgumentNode[] = [],
  name: string,
): ValueNode | undefined => args.find((arg) => arg.name.value === name)?.value;
