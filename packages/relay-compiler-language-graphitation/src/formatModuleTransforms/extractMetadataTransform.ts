import { DocumentNode, OperationDefinitionNode, visit } from "graphql";
import invariant from "invariant";

interface ConnectionMetadata {
  countVariable: string;
  cursorVariable: string;
  selectionPath: string[];
}
export interface Metadata {
  rootSelection?: string;
  connection?: ConnectionMetadata;
}

/**
 * @param document The watch query document
 * @returns Metadata needed at runtime
 */
export function extractMetadataTransform(
  document: DocumentNode
): Metadata | undefined {
  const metadata: Metadata = {};

  const nodeFieldSelection = extractNodeFieldSelection(document);
  if (nodeFieldSelection) {
    metadata.rootSelection = "node";
  }

  const connectionMetadata = extractConnectionMetadataTransform(document);
  if (connectionMetadata) {
    metadata.connection = connectionMetadata;
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function extractNodeFieldSelection(document: DocumentNode) {
  const operationDefinition = document.definitions.find(
    (def) => def.kind === "OperationDefinition"
  ) as OperationDefinitionNode | undefined;
  invariant(operationDefinition, "Expected an operation");
  const nodeFieldSelection = operationDefinition.selectionSet.selections.find(
    (selection) => selection.kind === "Field" && selection.name.value === "node"
  );
  return nodeFieldSelection;
}

function extractConnectionMetadataTransform(
  document: DocumentNode
): ConnectionMetadata | undefined {
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
    return undefined;
  }
}
