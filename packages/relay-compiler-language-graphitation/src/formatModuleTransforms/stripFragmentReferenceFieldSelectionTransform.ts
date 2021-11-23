import { DocumentNode, visit } from "graphql";

export function stripFragmentReferenceFieldSelectionTransform(
  document: DocumentNode
): DocumentNode {
  return visit(document, {
    Field(fieldNode) {
      if (fieldNode.name.value === "__fragments") {
        return null;
      }
    },
    InlineFragment: {
      leave(fragmentNode) {
        if (
          fragmentNode.typeCondition?.name.value === "Node" &&
          fragmentNode.selectionSet.selections.length === 0
        ) {
          return null;
        }
      },
    },
  });
}
