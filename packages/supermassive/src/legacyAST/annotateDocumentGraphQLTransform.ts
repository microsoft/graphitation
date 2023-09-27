import {
  FragmentDefinitionNode,
  GraphQLSchema,
  Kind,
  OperationDefinitionNode,
} from "graphql";
import { addMinimalViableSchemaToRequestDocument } from "@graphitation/supermassive";

export const annotateDocumentGraphQLTransform = (schema: GraphQLSchema) => {
  return (node: FragmentDefinitionNode | OperationDefinitionNode) => {
    const document = addMinimalViableSchemaToRequestDocument(
      schema,
      {
        kind: Kind.DOCUMENT,
        definitions: [node],
      },
      {
        addTo: "PROPERTY",
      },
    );
    return document.definitions[0];
  };
};
