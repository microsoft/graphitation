import {
  GraphQLType,
  GraphQLSchema,
  isListType,
  isNamedType,
  isNonNullType,
  TypeInfo,
  visit,
  visitWithTypeInfo,
  Kind,
  astFromValue,
  GraphQLArgument,
} from "graphql";

import * as TypelessAST from "graphql/language/ast";
import * as TypedAST from "./LegacyTypedAST";

export function addLegacySupermassiveTypesToRequestDocument(
  schema: GraphQLSchema,
  document: TypelessAST.DocumentNode,
): TypedAST.DocumentNode {
  const typeInfo = new TypeInfo(schema);
  return visit(
    document,
    visitWithTypeInfo(typeInfo, {
      Argument: {
        leave(node, _key, _parent, _path, ancestors) {
          const argument = typeInfo.getArgument();
          if (argument) {
            const typeNode = generateTypeNode(argument.type);
            const newNode: TypedAST.ArgumentNode = {
              ...node,
              __type: typeNode,
            };
            // We only need default value for arguments with variable values
            if (argument.defaultValue && node.value.kind === Kind.VARIABLE) {
              (newNode.__defaultValue as
                | TypedAST.ValueNode
                | null
                | undefined) = astFromValue(
                argument.defaultValue,
                argument.type,
              );
            }
            return newNode;
          }
          const errorPath = makeReadableErrorPath(ancestors);
          throw new Error(
            `Cannot find type for argument: ${errorPath.join(".")}.${
              node.name.value
            }`,
          );
        },
      },
      Field: {
        leave(
          node: Omit<TypelessAST.FieldNode, "selectionSet" | "directives">,
          _key,
          _parent,
          _path,
          ancestors,
        ) {
          const fieldDef = typeInfo.getFieldDef();
          if (fieldDef) {
            const type = fieldDef.type;
            if (type) {
              const typeNode = generateTypeNode(type);
              const missingArgs: Array<GraphQLArgument> = fieldDef.args.filter(
                (argDef) =>
                  argDef.defaultValue != null &&
                  node.arguments?.findIndex(
                    (arg) => arg.name.value === argDef.name,
                  ) === -1,
              );
              const newNode: TypedAST.FieldNode = {
                ...(node as Omit<
                  TypelessAST.FieldNode,
                  "selectionSet" | "arguments" | "directives"
                >),
                __type: typeNode,
              };
              if (missingArgs) {
                (newNode.arguments as TypedAST.ArgumentNode[]) = (
                  newNode.arguments || []
                ).concat(
                  missingArgs.map((arg) => ({
                    __type: generateTypeNode(arg.type),
                    kind: Kind.ARGUMENT,
                    name: {
                      kind: Kind.NAME,
                      value: arg.name,
                    },
                    value: astFromValue(
                      arg.defaultValue,
                      arg.type,
                    ) as TypedAST.ValueNode,
                  })),
                );
              }
              return newNode;
            }
          }

          const errorPath = makeReadableErrorPath(ancestors);

          // This happens whenever a new field is requested that hasn't been defined in schema
          throw new Error(
            `Cannot find type for field: ${errorPath.join(".")}.${
              node.name.value
            }`,
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

function makeReadableErrorPath(
  ancestors: ReadonlyArray<
    readonly TypelessAST.ASTNode[] | TypelessAST.ASTNode
  >,
): string[] {
  const path: string[] = [];
  ancestors.forEach((ancestorOrArray) => {
    let ancestor: TypelessAST.ASTNode;
    if (!Array.isArray(ancestorOrArray)) {
      ancestor = ancestorOrArray as TypelessAST.ASTNode;
      if (ancestor && ancestor.kind === Kind.FIELD) {
        path.push(ancestor.name.value);
      } else if (ancestor && ancestor.kind === Kind.OPERATION_DEFINITION) {
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
  return path;
}
