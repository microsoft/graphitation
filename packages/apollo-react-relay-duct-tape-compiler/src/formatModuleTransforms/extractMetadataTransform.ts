import {
  ArgumentNode,
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  OperationDefinitionNode,
  ValueNode,
  parseValue,
  visit,
  valueFromAST,
  valueFromASTUntyped,
  DirectiveNode,
} from "graphql";
import invariant from "invariant";

interface ConnectionMetadata {
  forwardCountVariable?: string;
  forwardCursorVariable?: string;
  backwardCountVariable?: string;
  backwardCursorVariable?: string;
  filterVariableDefaults?: Record<string, any>;
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
 * This transform extracts metadata needed at runtime for the `use*Fragment`
 * hooks to do their work efficiently. This includes:
 *
 * - Whether or not the observed data starts at the root of the operation or at
 *   the `node` root-field.
 * - The name and type-condition of the fragment.
 * - Connection metadata such as location of the connection inside the fragment
 *   and the names of the various connection variables.
 *
 * @param document The watch query document
 * @returns The metadata needed at runtime
 */
export function extractMetadataTransform(
  document: DocumentNode,
): Metadata | undefined {
  const metadata: Metadata = {};
  const nodeFieldSelection = extractNodeFieldSelection(document);
  if (nodeFieldSelection) {
    metadata.rootSelection = "node";
  }
  const mainFragment = getMainFragmentMetadata(
    document,
    nodeFieldSelection?.name.value,
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
  rootSelection: string | undefined,
):
  | {
      name: string;
      typeCondition: string;
    }
  | undefined {
  const [operationDefinition, ...fragmentDefinitions] =
    document.definitions as [
      OperationDefinitionNode,
      ...FragmentDefinitionNode[],
    ];
  invariant(
    operationDefinition.kind === "OperationDefinition" &&
      fragmentDefinitions.every((node) => node.kind === "FragmentDefinition"),
    "Expected definition nodes in specific order",
  );
  if (fragmentDefinitions.length === 0) {
    return undefined;
  }
  let selectionSet = operationDefinition.selectionSet;
  if (rootSelection) {
    const field = selectionSet.selections.find(
      (selection) =>
        selection.kind === "Field" && selection.name.value === rootSelection,
    ) as FieldNode | undefined;
    invariant(
      field?.selectionSet,
      "Expected root selection to exist in document",
    );
    selectionSet = field.selectionSet;
  }
  const mainFragmentSpread = selectionSet.selections.find(
    (selection) => selection.kind === "FragmentSpread",
  ) as FragmentSpreadNode | undefined;
  if (!mainFragmentSpread) {
    return undefined;
  }
  const mainFragment = fragmentDefinitions.find(
    (fragment) => fragment.name.value === mainFragmentSpread.name.value,
  );
  invariant(mainFragment, "Expected a main fragment");
  return {
    name: mainFragment.name.value,
    typeCondition: mainFragment.typeCondition.name.value,
  };
}

function extractNodeFieldSelection(document: DocumentNode) {
  const operationDefinition = document.definitions.find(
    (def) => def.kind === "OperationDefinition",
  ) as OperationDefinitionNode | undefined;
  invariant(operationDefinition, "Expected an operation");
  const nodeFieldSelection = operationDefinition.selectionSet.selections.find(
    (selection) =>
      selection.kind === "Field" && selection.name.value === "node",
  ) as FieldNode | undefined;
  return nodeFieldSelection;
}

function extractConnectionMetadataTransform(
  document: DocumentNode,
): ConnectionMetadata | undefined {
  let foundConnection = false;
  const metadata: ConnectionMetadata = { selectionPath: [] };
  const variableDefaults = new Map<string, ValueNode | undefined>();
  visit(document, {
    VariableDefinition: {
      enter(variableNode) {
        variableDefaults.set(
          variableNode.variable.name.value,
          variableNode.defaultValue,
        );
      },
    },
    Field: {
      enter(fieldNode) {
        if (!foundConnection) {
          metadata.selectionPath.push(fieldNode.name.value);
        }
        const connectionDirective = fieldNode.directives?.find(
          (directive) => directive.name.value === "connection",
        );
        if (connectionDirective) {
          invariant(
            !foundConnection,
            "Expected to find a single connection in one document",
          );
          foundConnection = true;

          const fieldArguments = new Map(
            fieldNode.arguments?.map((arg) => [arg.name.value, arg]),
          );

          metadata.forwardCountVariable = getVariableValue(
            fieldArguments.get("first"),
          );
          metadata.forwardCursorVariable = getVariableValue(
            fieldArguments.get("after"),
          );
          metadata.backwardCountVariable = getVariableValue(
            fieldArguments.get("last"),
          );
          metadata.backwardCursorVariable = getVariableValue(
            fieldArguments.get("before"),
          );

          metadata.filterVariableDefaults = extractFilterVariableDefaults(
            connectionDirective,
            fieldArguments,
            variableDefaults,
          );
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
      "Expected correct count and cursor variables combinations",
    );
    return metadata;
  } else {
    return undefined;
  }
}

function getVariableValue(arg: ArgumentNode | undefined) {
  return arg && arg.value.kind === "Variable"
    ? arg.value.name.value
    : undefined;
}

function extractFilterVariableDefaults(
  connectionDirective: DirectiveNode,
  fieldArguments: Map<string, ArgumentNode>,
  variableDefaults: Map<string, ValueNode | undefined>,
) {
  invariant(
    connectionDirective.arguments !== undefined,
    "Expected connection directive to have arguments",
  );
  const filterVariableDefaults = new Map<string, any>();
  const [, filters] = connectionDirective.arguments;
  if (filters) {
    invariant(
      filters.name.value === "filter" && filters.value.kind === "ListValue",
      "Expected filters argument to be a list of field arguments",
    );
    const fieldArgumentNames = filters.value.values.map((value) => {
      invariant(
        value.kind === "StringValue",
        "Expected field argument to be a string",
      );
      return value.value;
    });
    fieldArgumentNames.forEach((name) => {
      const arg = fieldArguments.get(name);
      invariant(
        arg !== undefined,
        "Expected filter name to refer to a field argument",
      );
      const variable = getVariableValue(arg);
      if (variable) {
        const defaultValue = variableDefaults.get(variable);
        if (defaultValue) {
          filterVariableDefaults.set(
            variable,
            valueFromASTUntyped(defaultValue),
          );
        }
      }
    });
  }
  return filterVariableDefaults.size > 0
    ? Object.fromEntries(filterVariableDefaults)
    : undefined;
}
