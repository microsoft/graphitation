import type { IndexedTree } from "../forest/types";
import type {
  DeferLabel,
  FormattedError,
  ResponsePath,
} from "../descriptor/types";
import type { SourceObject } from "../values/types";

// The 2022-09-17 draft of the @defer / @stream RFC (path and label).
export type ResultData = Record<string, unknown>;
export type ResultExtensions = Record<string, unknown>;

export type CompleteExecutionResult = {
  data: ResultData;
  errors?: ReadonlyArray<FormattedError>;
  extensions?: ResultExtensions;
};

export type InitialIncrementalExecutionResult = CompleteExecutionResult & {
  hasNext: boolean;
};

export type SubsequentIncrementalExecutionResult = {
  incremental?: ReadonlyArray<IncrementalDeferResult | IncrementalStreamResult>;
  hasNext: boolean;
  extensions?: ResultExtensions;
};

export type IncrementalDeferResult = {
  data?: ResultData | null;
  errors?: ReadonlyArray<FormattedError>;
  extensions?: ResultExtensions;
  path?: ResponsePath;
  label?: DeferLabel;
};

export type IncrementalStreamResult = {
  items?: ReadonlyArray<unknown> | null;
  errors?: ReadonlyArray<FormattedError>;
  extensions?: ResultExtensions;
  path?: ResponsePath;
  label?: DeferLabel;
};

// Identifies an incremental execution (e.g. a request id), compared by equality.
// Only needed to ignore late results of a superseded execution of the same operation.
export type ExecutionKey = string | number | object;

export type ExecutionResult = (
  | CompleteExecutionResult
  | InitialIncrementalExecutionResult
  | SubsequentIncrementalExecutionResult
) & { key?: ExecutionKey };

export type IncrementalExecution = {
  key: ExecutionKey | undefined;
  serverData: SourceObject;
  overwrite: boolean | undefined;
  preview: IndexedTree;
};
