import type {
  DocumentNode,
  FragmentDefinitionNode,
  InlineFragmentNode,
} from "graphql";

// Structural contract for clients that own incremental routing. Kept local so
// ForestRun does not require an Apollo version that exposes this optional API.
export interface IncrementalIdentity {
  id: string;
  typename: string;
}

export interface IncrementalTarget extends IncrementalIdentity {
  token: unknown;
}

export interface IncrementalWriteHooks {
  onNormalized(
    result: Record<string, unknown>,
    dataId: string | undefined,
    typename: string | undefined,
  ): void;
  beforeWrite(): void;
}

export interface IncrementalWriteOptions {
  query: DocumentNode;
  data: Record<string, unknown>;
  variables?: Record<string, unknown>;
  target?: IncrementalTarget;
  overwrite: boolean;
}

export interface IncrementalCacheAdapter {
  isCurrent(): boolean;
  captureTarget(identity: IncrementalIdentity): IncrementalTarget;
  isTargetValid(target: IncrementalTarget): boolean;
  fragmentMatches(
    fragment: FragmentDefinitionNode | InlineFragmentNode,
    typename: string | undefined,
    result: Record<string, unknown>,
    variables: Record<string, unknown>,
  ): boolean;
  write(options: IncrementalWriteOptions, hooks: IncrementalWriteHooks): void;
}
