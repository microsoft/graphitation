import type { DocumentNode } from "graphql";

import type { Metadata } from "./formatModuleTransforms/extractMetadataTransform";

export type { Metadata };

export interface CompiledArtefactModule {
  executionQueryDocument?: DocumentNode;
  watchQueryDocument?: DocumentNode;
  metadata?: Metadata;
}
