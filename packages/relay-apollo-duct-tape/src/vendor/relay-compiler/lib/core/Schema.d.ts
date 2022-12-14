import { DocumentNode, Source } from "graphql";
export * from "relay-compiler/lib/core/Schema";
import { Schema } from "relay-compiler/lib/core/Schema";

export function create(
  baseSchema: Source,
  schemaExtensionDocuments?: ReadonlyArray<DocumentNode>,
  schemaExtensions?: ReadonlyArray<string>,
): Schema;
