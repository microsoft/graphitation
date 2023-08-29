import {
  FragmentDefinitionNode,
  GraphQLSchema,
  Kind,
  OperationDefinitionNode,
} from "graphql";
import { addMinimalViableSchemaToRequestDocument } from "./addMinimalViableSchemaToRequestDocument";

export const annotateDocumentGraphQLTransform = (schema: GraphQLSchema) => {
  return (node: FragmentDefinitionNode | OperationDefinitionNode) => {
    const document = addMinimalViableSchemaToRequestDocument(schema, {
      kind: Kind.DOCUMENT,
      definitions: [node],
    });
    return document?.definitions[0]; // FIXME
  };
};
