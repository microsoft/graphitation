import { DocumentNode, NameNode, OperationDefinitionNode } from "graphql";
import { DocumentDescriptor } from "./types";

export function describeDocument(document: DocumentNode): DocumentDescriptor {
  const operationDefinitions: OperationDefinitionNode[] = [];
  const fragmentMap = new Map();

  for (const definition of document.definitions) {
    if (definition.kind === "OperationDefinition") {
      operationDefinitions.push(definition);
    } else if (definition.kind === "FragmentDefinition") {
      fragmentMap.set(definition.name.value, definition);
    }
  }
  if (operationDefinitions.length === 0) {
    throw new Error(`Must contain a query definition.`);
  }
  if (operationDefinitions.length > 1) {
    const text = operationDefinitions.map((def) => def.name?.value).join(",");
    throw new Error(
      `Expecting exactly one operation definition, got ${operationDefinitions.length} operations: ${text}`,
    );
  }
  const operationDefinition = operationDefinitions[0];
  return {
    document,
    debugName: debugName(operationDefinition),
    definition: operationDefinition,
    fragmentMap,
  };
}

function debugName({
  name,
  operation,
  selectionSet,
}: OperationDefinitionNode): string {
  if (name?.value) {
    return `${operation} ${name.value}`;
  }
  const rootSelections = selectionSet.selections.map((node) => {
    if (node.kind === "FragmentSpread") {
      return `...${getName(node)}`;
    }
    if (node.kind === "Field") {
      return node.selectionSet?.selections.length
        ? getName(node) + ` {...}`
        : getName(node);
    }
    if (node.kind === "InlineFragment") {
      return node.typeCondition
        ? `... on ` + getName(node.typeCondition) + ` {...}`
        : `... {...}`;
    }
  });
  return `${operation} {\n  ` + rootSelections.join("\n  ") + `\n}`;
}

const getName = (node: { name: NameNode; alias?: NameNode }): string =>
  node.alias ? node.alias.value + ": " + node.name.value : node.name.value;
