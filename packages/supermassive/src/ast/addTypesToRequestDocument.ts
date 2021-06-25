import {
  GraphQLInputType,
  GraphQLOutputType,
  GraphQLSchema,
  isListType,
  isNamedType,
  isNonNullType,
  TypeInfo,
  visit,
  visitWithTypeInfo,
} from "graphql";

import * as TypelessAST from "graphql/language/ast";
import * as TypedAST from "./TypedAST";
export * from "./TypedAST";

export function addTypesToRequestDocument(
  schema: GraphQLSchema,
  document: TypelessAST.DocumentNode
): TypedAST.DocumentNode {
  const typeInfo = new TypeInfo(schema);
  return visit(
    document,
    visitWithTypeInfo(typeInfo, {
      Argument(node) {
        const argument = typeInfo.getArgument()!;
        const typeNode = generateTypeNode(argument.type);
        const newNode: TypedAST.ArgumentNode = {
          ...node,
          __type: typeNode,
        };
        return newNode;
      },
      Field(
        node: Omit<
          TypelessAST.FieldNode,
          "selectionSet" | "arguments" | "directives"
        >
      ) {
        const type = typeInfo.getType();
        if (type) {
          const typeNode = generateTypeNode(type);
          const newNode: TypedAST.FieldNode = {
            ...node,
            __type: typeNode,
          };
          return newNode;
        }
        throw new Error(`Unhandled: ${type}`);
      },
    })
  );
}

function generateTypeNode(
  type: GraphQLOutputType | GraphQLInputType
): TypedAST.TypeNode {
  if (isNonNullType(type)) {
    const typeNode = generateTypeNode(type.ofType) as
      | TypedAST.NamedTypeNode
      | TypedAST.ListTypeNode;
    return {
      kind: "NonNullType",
      type: typeNode,
    };
  } else if (isListType(type)) {
    const typeNode = generateTypeNode(type.ofType) as
      | TypedAST.NamedTypeNode
      | TypedAST.NonNullTypeNode;
    return {
      kind: "ListType",
      type: typeNode,
    };
  } else if (isNamedType(type)) {
    return {
      kind: "NamedType",
      name: {
        kind: "Name",
        value: type.name,
      },
    };
  }
  throw new Error(`Can't generate TypeNode for type: ${type}`);
}
