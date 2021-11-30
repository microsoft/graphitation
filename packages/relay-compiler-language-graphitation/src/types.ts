import { DocumentNode } from "graphql";

import { Metadata } from "./formatModuleTransforms/extractMetadataTransform";

export interface CompiledArtefactModule {
  executionQueryDocument?: DocumentNode;
  watchQueryDocument?: DocumentNode;
  metadata?: Metadata;
}
