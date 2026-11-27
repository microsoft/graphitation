import type {
  DeferLabel,
  FormattedError,
  ResponsePath,
} from "../descriptor/types";

/**
 * Results of incremental delivery (`@defer`) in the 2022-09-17 draft of the `@defer` / `@stream` RFC
 * (deferred fragments addressed by `path` and `label`), as in Apollo Client 4 `Defer20220917Handler`.
 *
 * TODO: support the current incremental delivery format (graphql-js 17: `pending`, `id`, `subPath`, `completed`)
 */

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

// Identifies an incremental execution (e.g. a request id), compared by identity.
//   Only needed to ignore late results of a superseded execution of the same operation (with the same variables)
export type ExecutionKey = string | number | object;

/**
 * Anything that can be written to the cache: a complete result, or results of incremental delivery.
 *
 * `key` identifies an incremental execution (defaults to the operation, i.e. a single execution at a time).
 */
export type ExecutionResult = (
  | CompleteExecutionResult
  | InitialIncrementalExecutionResult
  | SubsequentIncrementalExecutionResult
) & { key?: ExecutionKey };

export type InitialExecutionResult = (
  | CompleteExecutionResult
  | InitialIncrementalExecutionResult
) & { key?: ExecutionKey };

export type SubsequentExecutionResult = SubsequentIncrementalExecutionResult & {
  key?: ExecutionKey;
};
