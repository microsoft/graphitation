import {
  DocumentWithMinimalViableSchema,
  SchemaFragment,
  UserResolvers,
} from "../types";
import { createSchemaDefinitions } from "./mergeSchemaDefinitions";

export function schemaFragmentFromMinimalViableSchemaDocument(
  document: DocumentWithMinimalViableSchema,
  resolvers: UserResolvers,
  schemaId: string,
): SchemaFragment {
  const schemaDefinitions = createSchemaDefinitions(
    document.definitions.map((def) => def.__defs),
  );

  return {
    schemaId,
    definitions: schemaDefinitions,
    resolvers,
  };
}
