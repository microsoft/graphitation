/**
 * Utilities for conversion of Typed AST to printable (standard) GraphQL AST, and vice-versa.
 * Useful for printing and parsing AST with standard graphql-js `print` and `parse` without loosing type annotations.
 */
import {
  DirectiveNode,
  DocumentNode,
  FieldNode,
  ArgumentNode,
  TypeNode,
  Kind,
  print as graphqlPrint,
  visit,
  parseType,
  ASTNode,
  ValueNode,
  ListValueNode,
  StringValueNode,
  parseValue,
  ExecutableDefinitionNode,
} from "graphql";
import * as TypedAST from "./TypedAST";

type FieldAnnotation = { __type: TypeNode };
type ArgumentAnnotation = { __type: TypeNode; __defaultValue?: ValueNode };
type MutableTypedFieldNode = FieldNode & FieldAnnotation;
type MutableTypedArgumentNode = ArgumentNode & ArgumentAnnotation;

const TYPES_DIRECTIVE_NAME = "types";
const parseOptions = { noLocation: true };

export function convertToPrintableDocument(
  document: TypedAST.DocumentNode,
): DocumentNode {
  const fieldTypes: string[] = [];
  const argumentTypes: string[] = [];

  const operationOrFragmentVisitor = {
    enter(node: ExecutableDefinitionNode) {
      fieldTypes.length = 0;
      argumentTypes.length = 0;
      if (node.directives?.length) {
        // Clear existing @types directive (if any), otherwise we will visit its arguments and break sequence
        const directives = node.directives.filter(
          (node) => !isTypesDirective(node),
        );
        if (directives.length !== node.directives.length) {
          return { ...node, directives };
        }
      }
    },
    leave(node: ExecutableDefinitionNode) {
      const typesDirective: DirectiveNode = {
        kind: Kind.DIRECTIVE,
        name: { kind: Kind.NAME, value: TYPES_DIRECTIVE_NAME },
        arguments: [
          typesArgument("fields", fieldTypes),
          typesArgument("args", argumentTypes),
        ],
      };
      return {
        ...node,
        directives: node.directives
          ? [...node.directives, typesDirective]
          : [typesDirective],
      };
    },
  };

  return visit(document as DocumentNode, {
    OperationDefinition: operationOrFragmentVisitor,
    FragmentDefinition: operationOrFragmentVisitor,
    Field(node) {
      const typedNode = node as TypedAST.FieldNode;
      fieldTypes.push(print(typedNode.__type));
    },
    Argument(node) {
      const typedNode = node as TypedAST.ArgumentNode;
      argumentTypes.push(printArgumentType(typedNode));
      return false; // perf: no need to visit values
    },
  });
}

/**
 * Converts DocumentNode produced by convertToPrintableAST to TypedAST.DocumentNode
 * (suitable for execution with supermassive)
 *
 * @param document
 * @param mutateOriginalDocument
 */
export function convertToTypedDocument(
  document: DocumentNode,
  mutateOriginalDocument = false,
): TypedAST.DocumentNode {
  const fields: string[] = [];
  const args: string[] = [];

  let argumentIndex = 0;
  let fieldIndex = 0;

  const operationOrFragmentEnter = (node: ExecutableDefinitionNode) => {
    fields.length = 0;
    args.length = 0;
    argumentIndex = 0;
    fieldIndex = 0;

    const typesDirectiveIndex =
      node.directives?.findIndex(isTypesDirective) ?? -1;

    const typesDirective = node.directives
      ? node.directives[typesDirectiveIndex]
      : null;

    if (!typesDirective || !node.directives) {
      const types = TYPES_DIRECTIVE_NAME;
      const dump = graphqlPrint(node).substring(0, 30);
      throw new Error(
        `Supermassive parser expects @${types} directive to be present on ${node.kind}, got ${dump}`,
      );
    }
    fields.push(...readTypes(typesDirective?.arguments, "fields"));
    args.push(...readTypes(typesDirective?.arguments, "args"));

    if (mutateOriginalDocument) {
      (node.directives as unknown[]).splice(typesDirectiveIndex, 1);
      return;
    }
    return {
      ...node,
      directives: node.directives.filter(
        (directive) => directive !== typesDirective,
      ),
    };
  };

  return visit(document, {
    OperationDefinition: operationOrFragmentEnter,
    FragmentDefinition: operationOrFragmentEnter,
    Field(node) {
      const fieldType = fields[fieldIndex++];
      const typeNode = parseType(fieldType, parseOptions);
      if (mutateOriginalDocument) {
        (node as MutableTypedFieldNode).__type = typeNode;
        return;
      }
      return {
        ...node,
        __type: typeNode,
      };
    },
    Argument(node, _key, _parent) {
      if (!args.length) {
        return false;
      }
      const argType = args[argumentIndex++];
      const annotations = parseArgumentType(argType, node);
      if (mutateOriginalDocument) {
        Object.assign(node as MutableTypedArgumentNode, annotations);
        return false;
      }
      return {
        ...node,
        ...annotations,
      };
    },
  }) as TypedAST.DocumentNode;
}

function typesArgument(name: string, types: string[]): ArgumentNode {
  return {
    kind: Kind.ARGUMENT,
    name: { kind: Kind.NAME, value: name },
    value: {
      kind: Kind.LIST,
      values: types.map((value) => ({ kind: Kind.STRING, value })),
    },
  };
}

function readTypes(args: Readonly<ArgumentNode[]> | undefined, name: string) {
  const arg = args?.find((arg) => arg.name.value === name);
  if (!arg) {
    return [];
  }
  const list = arg.value as ListValueNode;
  return list.values.map((node) => (node as StringValueNode).value);
}

function print(node: TypedAST.ASTNode) {
  return graphqlPrint(node as ASTNode);
}

function printArgumentType(node: TypedAST.ArgumentNode): string {
  return node.__defaultValue == null
    ? print(node.__type)
    : `'${print(node.__type)}=${print(node.__defaultValue)}'`;
}

function parseArgumentType(
  annotation: string,
  node: ArgumentNode,
): { __type: TypeNode; __defaultValue?: ValueNode } {
  if (annotation.startsWith("'")) {
    // Edge case with default value
    const matches = annotation.match(/^'([^=]+)=(.*)'$/);
    if (matches?.length !== 3) {
      throw new Error(
        `Cannot parse type annotation for argument ${node.name.value}`,
      );
    }
    return {
      __type: parseType(matches[1], parseOptions),
      __defaultValue: parseValue(matches[2], parseOptions),
    };
  }
  return { __type: parseType(annotation, parseOptions) };
}

function isTypesDirective(node: Readonly<ASTNode>) {
  return (
    node.kind === Kind.DIRECTIVE && node.name.value === TYPES_DIRECTIVE_NAME
  );
}
