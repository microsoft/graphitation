import { DocumentNode, visit } from "graphql";
import invariant from "invariant";

export function extractConnectionMetadataTransform(
  document: DocumentNode
): {
  countVariable: string;
  cursorVariable: string;
  selectionPath: string[];
} | null {
  let foundConnection = false;
  let countVariable: string | undefined;
  let cursorVariable: string | undefined;
  const selectionPath: string[] = [];
  visit(document, {
    Field: {
      enter(fieldNode) {
        if (!foundConnection) {
          selectionPath.push(fieldNode.name.value);
        }
        if (
          fieldNode.directives?.find(
            (directive) => directive.name.value === "connection"
          )
        ) {
          invariant(!foundConnection, "Expected to find a single connection");
          foundConnection = true;

          const countArgument = fieldNode.arguments?.find(
            (arg) => arg.name.value === "first"
          );
          countVariable =
            countArgument?.value.kind === "Variable"
              ? countArgument.value.name.value
              : undefined;
          const cursorArgument = fieldNode.arguments?.find(
            (arg) => arg.name.value === "after"
          );
          cursorVariable =
            cursorArgument?.value.kind === "Variable"
              ? cursorArgument.value.name.value
              : undefined;
        }
      },
      leave() {
        if (!foundConnection) {
          selectionPath.pop();
        }
      },
    },
  });
  if (foundConnection) {
    invariant(
      countVariable,
      "Expected connection to have a variable count argument"
    );
    invariant(
      cursorVariable,
      "Expected connection to have a variable cursor argument"
    );
    return { countVariable, cursorVariable, selectionPath };
  } else {
    return null;
  }
}
