import { DocumentNode, OperationDefinitionNode } from "graphql";

export const getOperationName = (query: DocumentNode) => {
  const definition =
    query && query.definitions && query.definitions.length > 0
      ? (query.definitions[0] as OperationDefinitionNode)
      : null;
  const operationName = definition ? definition.name?.value : "name_not_found";

  return operationName;
};

export const isNumber = (input: string | number | undefined = "NA") => {
  const value = parseInt(input as string, 10);
  if (isNaN(value)) {
    return false;
  }

  return true;
};

export const copyToClipboard = async (obj: unknown) => {
  try {
    await window.navigator.clipboard.writeText(JSON.stringify(obj));
  } catch (error) {
    console.log(`failed to copy`, error);
  }
};
