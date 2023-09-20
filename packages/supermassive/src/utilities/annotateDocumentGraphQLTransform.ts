import {
  FragmentDefinitionNode,
  GraphQLSchema,
  OperationDefinitionNode,
} from "graphql";
import {
  addMinimalViableSchemaToExecutableDefinitionNode,
  AddMinimalViableSchemaToRequestDocumentOptions,
} from "./addMinimalViableSchemaToRequestDocument";

export const annotateDocumentGraphQLTransform = (
  schema: GraphQLSchema,
  options?: AddMinimalViableSchemaToRequestDocumentOptions,
) => {
  return (node: FragmentDefinitionNode | OperationDefinitionNode) =>
    addMinimalViableSchemaToExecutableDefinitionNode(schema, node, options);
};
