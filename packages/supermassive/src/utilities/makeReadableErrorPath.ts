import { Kind, ASTNode } from "graphql";

export function makeReadableErrorPath(
  ancestors: ReadonlyArray<readonly ASTNode[] | ASTNode>,
): string[] {
  const path: string[] = [];
  ancestors.forEach((ancestorOrArray) => {
    let ancestor: ASTNode;
    if (!Array.isArray(ancestorOrArray)) {
      ancestor = ancestorOrArray as ASTNode;
      if (ancestor && ancestor.kind === Kind.FIELD) {
        path.push(ancestor.name.value);
      } else if (ancestor && ancestor.kind === Kind.DIRECTIVE) {
        path.push(`@${ancestor.name.value}`);
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
