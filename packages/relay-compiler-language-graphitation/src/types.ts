import { DocumentNode } from "graphql";

export interface ConnectionMetadata {
  forwardCountVariable?: string;
  forwardCursorVariable?: string;
  backwardCountVariable?: string;
  backwardCursorVariable?: string;
  selectionPath: string[];
}

export interface Metadata {
  rootSelection?: string;
  mainFragment?: {
    name: string;
    typeCondition: string;
  };
  connection?: ConnectionMetadata;
  defaultVariableValues?: Record<string, any>;
}

export interface CompiledArtefactModule {
  executionQueryDocument?: DocumentNode;
  watchQueryDocument?: DocumentNode;
  metadata?: Metadata;
}
