import { Kind } from "graphql";
import { OperationDefinitionNode } from "@graphitation/supermassive";
import { Operation } from "@apollo/client";

export function getOperationDefinitionNode(
  operation: Operation
): OperationDefinitionNode | null {
  if (operation?.query?.definitions) {
    const operationDefinitionNode = operation.query.definitions.find(
      ({ kind }) => kind === Kind.OPERATION_DEFINITION
    ) as OperationDefinitionNode | undefined;

    if (operationDefinitionNode?.operation) {
      return operationDefinitionNode;
    }
  }
  return null;
}
