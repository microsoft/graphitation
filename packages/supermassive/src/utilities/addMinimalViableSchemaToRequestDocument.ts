import {
  ArgumentNode,
  DirectiveNode,
  DocumentNode,
  ExecutableDefinitionNode,
  GraphQLSchema,
  Kind,
  NameNode,
} from "graphql";
import {
  SUPERMASSIVE_SCHEMA_DIRECTIVE_DEFINITIONS_ARGUMENT_NAME,
  SUPERMASSIVE_SCHEMA_DIRECTIVE_NAME,
} from "../schema/directives";
import { extractMinimalViableSchemaForRequestDocument } from "./extractMinimalViableSchemaForRequestDocument";
import { SchemaDefinitions } from "../schema/definition";

export type AddMinimalViableSchemaToRequestDocumentOptions = {
  addTo?: "DIRECTIVE" | "PROPERTY";
};

export function addMinimalViableSchemaToRequestDocument(
  schema: GraphQLSchema,
  document: DocumentNode,
  options?: AddMinimalViableSchemaToRequestDocumentOptions,
): DocumentNode {
  return {
    ...document,
    definitions: document.definitions.map((node) =>
      node.kind === Kind.OPERATION_DEFINITION ||
      node.kind === Kind.FRAGMENT_DEFINITION
        ? addMinimalViableSchemaToExecutableDefinitionNode(
            schema,
            node,
            options,
          )
        : node,
    ),
  };
}

export function addMinimalViableSchemaToExecutableDefinitionNode(
  schema: GraphQLSchema,
  node: ExecutableDefinitionNode,
  options?: AddMinimalViableSchemaToRequestDocumentOptions,
) {
  const { definitions } = extractMinimalViableSchemaForRequestDocument(schema, {
    kind: Kind.DOCUMENT,
    definitions: [node],
  });

  return options?.addTo === "PROPERTY"
    ? addToExecutableDefinitionNodeProperty(definitions, node)
    : addToExecutableDefinitionNodeDirective(definitions, node);
}

export type ExecutableDefinitionNodeWithInlinedSchema =
  ExecutableDefinitionNode & {
    __defs?: SchemaDefinitions;
  };

/**
 * Adds directive with minimal viable schema to every individual executable node (operation, fragment)
 */
function addToExecutableDefinitionNodeProperty<
  T extends ExecutableDefinitionNodeWithInlinedSchema,
>(schemaFragment: SchemaDefinitions, node: T): T {
  if (node.__defs) {
    return node;
  }
  return {
    ...node,
    __defs: schemaFragment,
  };
}

/**
 * Adds directive with minimal viable schema to every individual executable node (operation, fragment)
 */
function addToExecutableDefinitionNodeDirective<
  T extends ExecutableDefinitionNode,
>(schemaFragment: SchemaDefinitions, node: T): T {
  if (node.directives?.some((directive) => directive.name.value === "schema")) {
    return node;
  }
  const directive: DirectiveNode = {
    kind: Kind.DIRECTIVE,
    name: nameNode(SUPERMASSIVE_SCHEMA_DIRECTIVE_NAME),
    arguments: [
      argNode(
        SUPERMASSIVE_SCHEMA_DIRECTIVE_DEFINITIONS_ARGUMENT_NAME,
        schemaFragment,
      ),
    ],
  };
  return {
    ...node,
    directives: [...(node.directives ?? []), directive],
  };
}

export function getSchemaDefinitions(
  node: ExecutableDefinitionNodeWithInlinedSchema,
): SchemaDefinitions | undefined {
  if (node.__defs) {
    return node.__defs;
  }
  const directive = node.directives?.find(
    (directive) => directive.name.value === SUPERMASSIVE_SCHEMA_DIRECTIVE_NAME,
  );
  const arg = directive?.arguments?.find(
    (arg) =>
      arg.name.value ===
      SUPERMASSIVE_SCHEMA_DIRECTIVE_DEFINITIONS_ARGUMENT_NAME,
  );
  if (arg?.value.kind === Kind.STRING) {
    return JSON.parse(arg.value.value);
  }
  return undefined;
}

function nameNode(name: string): NameNode {
  return { kind: Kind.NAME, value: name };
}

function argNode(name: string, value: unknown): ArgumentNode {
  return {
    kind: Kind.ARGUMENT,
    name: nameNode(name),
    value: { kind: Kind.STRING, value: JSON.stringify(value) },
  };
}
