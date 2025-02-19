import { ArgumentNode, GraphQLError, DirectiveNode } from "graphql";
import { ValueNode } from "graphql/language/ast";
import { DefinitionImport } from "../types";
import { getRelativePath } from "./utilities";
import { createVariableNameFromImport } from "../utilities";

export const IMPORT_DIRECTIVE_NAME = "import";

export function processImportDirective(
  node: DirectiveNode,
  outputPath: string,
  documentPath: string,
): DefinitionImport {
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
    from: getRelativePath(from.value, outputPath, documentPath) as string,
    defs: definitionNames.map((typeName) => ({
      typeName,
    })),
    importName: `${createVariableNameFromImport(from.value)}Models`,
    directive: node,
  };
}

const getArgumentValue = (
  args: readonly ArgumentNode[] = [],
  name: string,
): ValueNode | undefined => args.find((arg) => arg.name.value === name)?.value;
