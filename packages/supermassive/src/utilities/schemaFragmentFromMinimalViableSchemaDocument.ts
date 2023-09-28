import {
  DocumentWithMinimalViableSchema,
  SchemaFragment,
  UserResolvers,
} from "../types";
import { createSchemaDefinitions } from "./mergeSchemaDefinitions";

export function schemaFragmentFromMinimalViableSchemaDocument(
  document: DocumentWithMinimalViableSchema,
  resolvers: UserResolvers,
  operationName?: string,
): SchemaFragment {
  const schemaDefinitions = createSchemaDefinitions(
    document.definitions.map((def) => def.__defs),
  );
  const name =
    operationName ||
    document.definitions.find((def) => def.name?.value)?.name?.value ||
    "(anonymous)";
  return {
    schemaId: name,
    definitions: schemaDefinitions,
    resolvers,
  };
}
