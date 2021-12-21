import {
  ArgumentNode,
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  OperationDefinitionNode,
  visit,
} from "graphql";
import invariant from "invariant";

interface ConnectionMetadata {
  forwardCountVariable?: string;
  forwardCursorVariable?: string;
  backwardCountVariable?: string;
  backwardCursorVariable?: string;
  selectionPath: string[];
}
export interface Metadata {
  rootSelection?: string;
  mainFragment?: {
    name: string;
    typeCondition: string;
  };
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
  const mainFragment = getMainFragmentMetadata(
    document,
    nodeFieldSelection?.name.value
  );
  if (mainFragment) {
    metadata.mainFragment = mainFragment;
  }
  const connectionMetadata = extractConnectionMetadataTransform(document);
  if (connectionMetadata) {
    metadata.connection = connectionMetadata;
  }
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function getMainFragmentMetadata(
  document: DocumentNode,
  rootSelection: string | undefined
):
  | {
      name: string;
      typeCondition: string;
    }
  | undefined {
  const [
    operationDefinition,
    ...fragmentDefinitions
  ] = document.definitions as [
    OperationDefinitionNode,
    ...FragmentDefinitionNode[]
  ];
  invariant(
    operationDefinition.kind === "OperationDefinition" &&
      fragmentDefinitions.every((node) => node.kind === "FragmentDefinition"),
    "Expected definition nodes in specific order"
  );
  if (fragmentDefinitions.length === 0) {
    return undefined;
  }
  let selectionSet = operationDefinition.selectionSet;
  if (rootSelection) {
    const field = selectionSet.selections.find(
      (selection) =>
        selection.kind === "Field" && selection.name.value === rootSelection
    ) as FieldNode | undefined;
    invariant(
      field?.selectionSet,
      "Expected root selection to exist in document"
    );
    selectionSet = field.selectionSet;
  }
  const mainFragmentSpread = selectionSet.selections.find(
    (selection) => selection.kind === "FragmentSpread"
  ) as FragmentSpreadNode | undefined;
  invariant(mainFragmentSpread, "Expected a main fragment spread");
  const mainFragment = fragmentDefinitions.find(
    (fragment) => fragment.name.value === mainFragmentSpread.name.value
  );
  invariant(mainFragment, "Expected a main fragment");
  return {
    name: mainFragment.name.value,
    typeCondition: mainFragment.typeCondition.name.value,
  };
}

function extractNodeFieldSelection(document: DocumentNode) {
  const operationDefinition = document.definitions.find(
    (def) => def.kind === "OperationDefinition"
  ) as OperationDefinitionNode | undefined;
  invariant(operationDefinition, "Expected an operation");
  const nodeFieldSelection = operationDefinition.selectionSet.selections.find(
    (selection) => selection.kind === "Field" && selection.name.value === "node"
  ) as FieldNode | undefined;
  return nodeFieldSelection;
}

function extractConnectionMetadataTransform(
  document: DocumentNode
): ConnectionMetadata | undefined {
  let foundConnection = false;
  const metadata: ConnectionMetadata = { selectionPath: [] };
  visit(document, {
    Field: {
      enter(fieldNode) {
        if (!foundConnection) {
          metadata.selectionPath.push(fieldNode.name.value);
        }
        if (
          fieldNode.directives?.find(
            (directive) => directive.name.value === "connection"
          )
        ) {
          invariant(
            !foundConnection,
            "Expected to find a single connection in one document"
          );
          foundConnection = true;

          fieldNode.arguments?.forEach((arg) => {
            switch (arg.name.value) {
              case "first": {
                metadata.forwardCountVariable = getVariableValue(arg);
                break;
              }
              case "after": {
                metadata.forwardCursorVariable = getVariableValue(arg);
                break;
              }
              case "last": {
                metadata.backwardCountVariable = getVariableValue(arg);
                break;
              }
              case "before": {
                metadata.backwardCursorVariable = getVariableValue(arg);
                break;
              }
            }
          });
        }
      },
      leave() {
        if (!foundConnection) {
          metadata.selectionPath.pop();
        }
      },
    },
  });
  if (foundConnection) {
    invariant(
      (metadata.forwardCountVariable && metadata.forwardCursorVariable) ||
        (metadata.backwardCountVariable && metadata.backwardCursorVariable),
      "Expected correct count and cursor variables combinations"
    );
    return metadata;
  } else {
    return undefined;
  }
}

function getVariableValue(arg: ArgumentNode) {
  return arg.value.kind === "Variable" ? arg.value.name.value : undefined;
}
