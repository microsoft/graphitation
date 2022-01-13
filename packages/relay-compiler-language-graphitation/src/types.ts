import { DocumentNode } from "graphql";

// Relay's ReaderPaginationMetadata type
export interface ConnectionPaginationMetadata {
  backward: {
    count: string;
    cursor: string;
  } | null;
  forward: {
    count: string;
    cursor: string;
  } | null;
  path: string[];
}

export interface Metadata {
  rootSelection?: string;
  mainFragment?: {
    name: string;
    typeCondition: string;
  };
  connection?: ConnectionPaginationMetadata;
  defaultVariableValues?: Record<string, any>;
}

export interface CompiledArtefactModule {
  executionQueryDocument?: DocumentNode;
  watchQueryDocument?: DocumentNode;
  metadata?: Metadata;
}
