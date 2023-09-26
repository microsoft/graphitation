import {
  FragmentDefinitionNode,
  GraphQLSchema,
  OperationDefinitionNode,
} from "graphql";
import {
  addMinimalViableSchemaToExecutableDefinitionNode,
  AddMinimalViableSchemaToRequestDocumentOptions,
} from "./addMinimalViableSchemaToRequestDocument";

export const annotateDocumentWithMininimalViableSchemaGraphQLTransform = (
  schema: GraphQLSchema,
  options?: AddMinimalViableSchemaToRequestDocumentOptions,
) => {
  return (node: FragmentDefinitionNode | OperationDefinitionNode) =>
    addMinimalViableSchemaToExecutableDefinitionNode(schema, node, options);
};
