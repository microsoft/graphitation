import { DocumentNode, visit } from "graphql";

/**
 * Given an execution query document, this transform will remove `__fragments`
 * selections (and container inline fragments on the `Node` interface) from the
 * operation, as these are only needed in watch queries.
 *
 * @param document The watch query document
 */
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
