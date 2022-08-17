import {
  ArgumentNode,
  BREAK,
  DocumentNode,
  visit,
  GraphQLError,
  DirectiveNode,
} from "graphql";
import { ValueNode } from "graphql/language/ast";
import { DefinitionImport } from "../types";
import { createVariableNameFromImport } from "../utilities";

export const IMPORT_DIRECTIVE_NAME = "import";

export function processImportDirective(node: DirectiveNode): DefinitionImport {
  const from = getArgumentValue(node.arguments, "from");
  const defs = getArgumentValue(node.arguments, "defs");

  if (from?.kind !== "StringValue") {
    throw new GraphQLError(
      `Directive @import requires "from" argument to exist and be a path to a GraphQL file.`,
      [from ?? node],
    );
  }
  if (defs?.kind !== "ListValue") {
    throw new GraphQLError(
      `Directive @import requires "defs" argument to exist and be a list of strings.`,
      [defs ?? node],
    );
  }

  const definitionNames: string[] = [];
  defs.values.forEach((valueNode: ValueNode) => {
    if (valueNode.kind !== "StringValue") {
      throw new GraphQLError(
        `Directive @import requires "defs" argument to exist and be a list of strings (got ${valueNode.kind}).`,
        [valueNode],
      );
    }
    definitionNames.push(valueNode.value);
  });

  return {
    from: from.value,
    defs: definitionNames.map((typeName) => ({
      typeName,
      modelName: `${typeName}Model`,
    })),
    importName: createVariableNameFromImport(from.value),
    directive: node,
  };
}

const getArgumentValue = (
  args: readonly ArgumentNode[] = [],
  name: string,
): ValueNode | undefined => args.find((arg) => arg.name.value === name)?.value;
