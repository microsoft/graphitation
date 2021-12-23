import { DocumentNode } from "graphql";

import { Metadata } from "./formatModuleTransforms/extractMetadataTransform";

export { Metadata };

export interface CompiledArtefactModule {
  executionQueryDocument?: DocumentNode;
  watchQueryDocument?: DocumentNode;
  metadata?: Metadata;
}
