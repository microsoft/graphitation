import {
  FragmentDefinitionNode,
  GraphQLSchema,
  Kind,
  OperationDefinitionNode,
} from "graphql";
import { addTypesToRequestDocument } from "../ast/addTypesToRequestDocument";

export const annotateDocumentGraphQLTransform = (schema: GraphQLSchema) => {
  return (node: FragmentDefinitionNode | OperationDefinitionNode) => {
    const document = addTypesToRequestDocument(schema, {
      kind: Kind.DOCUMENT,
      definitions: [node],
    });
    return document.definitions[0];
  };
};
