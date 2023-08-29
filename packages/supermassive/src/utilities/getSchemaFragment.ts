import { FragmentDefinitionNode, Kind, OperationDefinitionNode } from "graphql";
import {
  SUPERMASSIVE_SCHEMA_DIRECTIVE_NAME,
  SUPERMASSIVE_SCHEMA_DIRECTIVE_FRAGMENT_ARGUMENT_NAME,
} from "../schema/directives";
import { SchemaFragmentDefinitions } from "../schema/definition";

export function getSchemaFragment(
  definition: OperationDefinitionNode | FragmentDefinitionNode,
): SchemaFragmentDefinitions | undefined {
  const directive = definition.directives?.find(
    (directive) => directive.name.value === SUPERMASSIVE_SCHEMA_DIRECTIVE_NAME,
  );
  const arg = directive?.arguments?.find(
    (arg) =>
      arg.name.value === SUPERMASSIVE_SCHEMA_DIRECTIVE_FRAGMENT_ARGUMENT_NAME,
  );
  if (arg?.value.kind === Kind.STRING) {
    return JSON.parse(arg.value.value);
  }
  return undefined;
}
