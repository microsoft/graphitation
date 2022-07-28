import {
  ArgumentNode,
  ASTNode,
  DirectiveNode,
  DocumentNode,
  GraphQLError,
  ObjectTypeDefinitionNode,
  visit,
} from "graphql";
import { ValueNode } from "graphql/language/ast";
import { DefinitionModels } from "../types";

export const MODEL_DIRECTIVE_NAME = "model";

export function collectModelImports(document: DocumentNode) {
  const map: DefinitionModels = new Map();

  visit(document, {
    Directive(node, _, __, ___, ancestors) {
      if (node.name.value !== MODEL_DIRECTIVE_NAME) {
        return;
      }
      const from = getArgumentValue(node.arguments, "from");
      const tsType = getArgumentValue(node.arguments, "tsType");

      if (from?.kind !== "StringValue") {
        throw new GraphQLError(
          `Directive @module requires "from" argument to exist and be a path to a typescript file.`,
          [from ?? node],
        );
      }
      if (tsType?.kind !== "StringValue") {
        throw new GraphQLError(
          `Directive @model requires "tsType" argument to exist and be a name of the exported typescript type`,
          [tsType ?? node],
        );
      }
      const typeDef: ASTNode | readonly ASTNode[] | undefined =
        ancestors[ancestors.length - 1];

      if (
        !typeDef ||
        Array.isArray(typeDef) ||
        (typeDef as ASTNode).kind !== "ObjectTypeDefinition"
      ) {
        throw new GraphQLError(
          "Directive @model must be defined on Object type",
          [node],
        );
      }
      const typeName = (typeDef as ObjectTypeDefinitionNode).name.value;
      const existingModel = map.get(typeName);

      if (existingModel) {
        throw new GraphQLError(
          `Model for type ${typeName} is defined multiple times`,

          [existingModel.directive, node],
        );
      }
      map.set(typeName, {
        tsType: tsType.value,
        from: from.value,
        directive: node,
      });
    },
  });
  return map;
}

const getArgumentValue = (
  args: readonly ArgumentNode[] = [],
  name: string,
): ValueNode | undefined => args.find((arg) => arg.name.value === name)?.value;
