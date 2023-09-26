import {
  FragmentDefinitionNode,
  GraphQLSchema,
  Kind,
  OperationDefinitionNode,
} from "graphql";
import { addLegacySupermassiveTypesToRequestDocument } from "./addLegacySupermassiveTypesToRequestDocument";

export const annotateDocumentWithLegacySupermassiveASTTransform = (
  schema: GraphQLSchema,
) => {
  return (node: FragmentDefinitionNode | OperationDefinitionNode) => {
    const document = addLegacySupermassiveTypesToRequestDocument(schema, {
      kind: Kind.DOCUMENT,
      definitions: [node],
    });
    return document.definitions[0];
  };
};
