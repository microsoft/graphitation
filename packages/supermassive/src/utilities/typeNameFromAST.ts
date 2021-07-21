import { Kind, TypeNode } from "graphql";

export function typeNameFromAST(typeAst: TypeNode): string {
  if (typeAst.kind === Kind.LIST_TYPE || typeAst.kind === Kind.NON_NULL_TYPE) {
    return typeNameFromAST(typeAst.type);
  } else {
    return typeAst.name.value;
  }
}
