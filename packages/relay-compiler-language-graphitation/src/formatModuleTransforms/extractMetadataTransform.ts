import { DocumentNode, OperationDefinitionNode } from "graphql";
import invariant from "invariant";

interface Metadata {
  rootSelection?: string;
}

/**
 * @param document The watch query document
 * @returns Metadata needed at runtime
 */
export function extractMetadataTransform(
  document: DocumentNode
): Metadata | undefined {
  const metadata: Metadata = {};
  const operationDefinition = document.definitions.find(
    (def) => def.kind === "OperationDefinition"
  ) as OperationDefinitionNode | undefined;
  invariant(operationDefinition, "Expected an operation");
  const nodeFieldSelection = operationDefinition.selectionSet.selections.find(
    (selection) => selection.kind === "Field" && selection.name.value === "node"
  );
  if (nodeFieldSelection) {
    metadata.rootSelection = "node";
  }
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}
