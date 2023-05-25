import {
  GraphQLType,
  GraphQLSchema,
  isListType,
  isNamedType,
  isNonNullType,
  parseValue,
  TypeInfo,
  visit,
  print,
  visitWithTypeInfo,
  Kind,
  astFromValue,
} from "graphql";

import * as TypelessAST from "graphql/language/ast";
import * as TypedAST from "./TypedAST";
export * from "./TypedAST";

export function addTypesToRequestDocument(
  schema: GraphQLSchema,
  document: TypelessAST.DocumentNode,
): TypedAST.DocumentNode {
  const typeInfo = new TypeInfo(schema);
  return visit(
    document as any,
    visitWithTypeInfo(typeInfo, {
      Argument: {
        leave(node) {
          const argument = typeInfo.getArgument()!;
          if (argument) {
            const typeNode = generateTypeNode(argument.type);
            const newNode: TypedAST.ArgumentNode = {
              ...node,
              __type: typeNode,
              __defaultValue: argument.defaultValue
                ? astFromValue(argument.defaultValue, argument.type)
                : undefined,
            };
            if (newNode.__defaultValue) {
              console.log(newNode);
            }
            return newNode;
          }
        },
      },
      Field: {
        leave(
          node: Omit<
            TypelessAST.FieldNode,
            "selectionSet" | "arguments" | "directives"
          >,
          _key,
          _parent,
          _path,
          ancestors,
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
          const path: string[] = [];
          ancestors.forEach((ancestorOrArray) => {
            let ancestor: TypelessAST.ASTNode;
            if (!Array.isArray(ancestorOrArray)) {
              ancestor = ancestorOrArray as TypelessAST.ASTNode;
              if (ancestor && ancestor.kind === Kind.FIELD) {
                path.push(ancestor.name.value);
              } else if (
                ancestor &&
                ancestor.kind === Kind.OPERATION_DEFINITION
              ) {
                let name;
                if (ancestor.name) {
                  name = `${ancestor.operation} ${ancestor.name.value}`;
                } else {
                  name = ancestor.operation;
                }
                path.push(name);
              }
            }
          });
          // This happens whenever a new field is requested that hasn't been defined in schema
          throw new Error(
            `Cannot find type for field: ${path.join(".")}.${node.name.value}`,
          );
        },
      },
    }),
  );
}

function generateTypeNode(type: GraphQLType): TypedAST.TypeNode {
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
