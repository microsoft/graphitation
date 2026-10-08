import type { OperationDefinitionNode } from "graphql";
import type {
  InitialIncrementalExecutionResult,
  ResolveInfo,
  SubsequentIncrementalExecutionResult,
  TotalExecutionResult,
} from "../types";
import { PromiseOrValue } from "../jsutils/PromiseOrValue";

interface BaseExecuteHookArgs<ResolveContext> {
  context: ResolveContext;
}

export interface BaseExecuteFieldHookArgs<ResolveContext>
  extends BaseExecuteHookArgs<ResolveContext> {
  resolveInfo: ResolveInfo;
}

export interface PostExecuteFieldHookArgs<ResolveContext, HookContext>
  extends BaseExecuteFieldHookArgs<ResolveContext> {
  hookContext: HookContext;
}

export interface AfterFieldResolveHookArgs<ResolveContext, HookContext>
  extends PostExecuteFieldHookArgs<ResolveContext, HookContext> {
  result?: unknown;
  error?: unknown;
}

export interface AfterFieldSubscribeHookArgs<ResolveContext, HookContext>
  extends PostExecuteFieldHookArgs<ResolveContext, HookContext> {
  result?: unknown;
  error?: unknown;
}

export interface AfterFieldCompleteHookArgs<ResolveContext, HookContext>
  extends PostExecuteFieldHookArgs<ResolveContext, HookContext> {
  result?: unknown;
  error?: unknown;
}

export interface BaseExecuteOperationHookArgs<ResolveContext>
  extends BaseExecuteHookArgs<ResolveContext> {
  operation: OperationDefinitionNode;
}

export interface AfterBuildResponseHookArgs<ResolveContext>
  extends BaseExecuteOperationHookArgs<ResolveContext> {
  /** The current response payload, without merging initial and subsequent data. */
  result:
    | TotalExecutionResult
    | InitialIncrementalExecutionResult
    | SubsequentIncrementalExecutionResult;
  /** True for a non-incremental response or a terminal incremental payload. */
  isComplete?: boolean;
}

export interface BeforeSubscriptionEventEmitHookArgs<ResolveContext>
  extends BaseExecuteOperationHookArgs<ResolveContext> {
  eventPayload: unknown;
}

export interface BeforeFieldResolveHook<
  ResolveContext = unknown,
  BeforeHookContext = unknown,
> {
  (args: BaseExecuteFieldHookArgs<ResolveContext>):
    | PromiseOrValue<BeforeHookContext>
    | PromiseOrValue<Error>;
}

/**
 * Represents a user in the system.
 */
export interface BeforeFieldSubscribe<
  ResolveContext = unknown,
  BeforeHookContext = unknown,
> {
  (args: BaseExecuteFieldHookArgs<ResolveContext>):
    | PromiseOrValue<BeforeHookContext>
    | PromiseOrValue<Error>;
}

export interface AfterFieldResolveHook<
  ResolveContext = unknown,
  BeforeHookContext = unknown,
  AfterHookContext = BeforeHookContext,
> {
  (args: AfterFieldResolveHookArgs<ResolveContext, BeforeHookContext>):
    | AfterHookContext
    | Error;
}

export type AfterFieldResolverReturnsPromiseHookArgs<
  ResolveContext,
  HookContext,
> = PostExecuteFieldHookArgs<ResolveContext, HookContext>;

export interface AfterFieldResolverReturnsPromiseHook<
  ResolveContext = unknown,
  HookContext = unknown,
> {
  (
    args: AfterFieldResolverReturnsPromiseHookArgs<ResolveContext, HookContext>,
  ): void;
}

export interface AfterFieldSubscribe<
  ResolveContext = unknown,
  BeforeHookContext = unknown,
  AfterHookContext = BeforeHookContext,
> {
  (args: AfterFieldSubscribeHookArgs<ResolveContext, BeforeHookContext>):
    | AfterHookContext
    | Error;
}

export interface AfterFieldCompleteHook<
  ResolveContext = unknown,
  AfterHookContext = unknown,
> {
  (
    args: AfterFieldCompleteHookArgs<ResolveContext, AfterHookContext>,
  ): void | Error;
}

export interface AfterBuildResponseHook<ResolveContext = unknown> {
  (args: AfterBuildResponseHookArgs<ResolveContext>): void | Error;
}

export interface BeforeOperationExecuteHook<ResolveContext = unknown> {
  (args: BaseExecuteOperationHookArgs<ResolveContext>):
    | PromiseOrValue<void>
    | PromiseOrValue<Error>;
}

export interface BeforeSubscriptionEventEmitHook<ResolveContext = unknown> {
  (args: BeforeSubscriptionEventEmitHookArgs<ResolveContext>):
    | PromiseOrValue<void>
    | PromiseOrValue<Error>;
}

export interface ExecutionHooks<
  ResolveContext = unknown,
  BeforeHookContext = unknown,
  AfterHookContext = BeforeHookContext,
> {
  /**
   * Called before every operation.
   *
   * @hook
   * @throws {Error} Stops execution and sets `data` to `null` and registers the error.
   * @returns {Error} The error is registered and execution continues.
   */
  beforeOperationExecute?: BeforeOperationExecuteHook<ResolveContext>;
  /**
   * Called before every subscription event emit.
   *
   * @hook
   * @throws {Error} Sets `data` to `null` and registers the error.
   * @returns {Error} The error is registered and execution continues.
   */
  beforeSubscriptionEventEmit?: BeforeSubscriptionEventEmitHook<ResolveContext>;
  /**
   * Called before every field resolution.
   *
   * @hook
   * @throws {Error} The field is not executed and is handled as if it has returned `null`.
   * @returns {Error} The error is registered and execution continues.
   */
  beforeFieldResolve?: BeforeFieldResolveHook<
    ResolveContext,
    BeforeHookContext
  >;
  /**
   * Called before subscription event stream creation.
   *
   * @hook
   * @throws {Error} Stops execution and sets `data` to `undefined` and error is returned in `errors` field.
   * @returns {Error} Stops execution and sets `data` to `undefined` and error is returned in `errors` field.
   */
  beforeFieldSubscribe?: BeforeFieldSubscribe<
    ResolveContext,
    BeforeHookContext
  >;
  /**
   * Called after every field resolution.
   *
   * @hook
   * @throws {Error} The field is set to `null` and the error is registered.
   * @returns {Error} The error is registered and execution continues.
   */
  afterFieldResolve?: AfterFieldResolveHook<
    ResolveContext,
    BeforeHookContext,
    AfterHookContext
  >;

  /**
   * Called after a field resolver returns a Promise and before settlement handlers are attached.
   *
   * @hook
   */
  afterFieldResolverReturnsPromise?: AfterFieldResolverReturnsPromiseHook<
    ResolveContext,
    BeforeHookContext
  >;

  /**
   * Called after subscription event stream creation.
   *
   * @hook
   * @throws {Error} Stops execution and sets `data` to `undefined` and error is returned in `errors` field.
   * @returns {Error} Stops execution and sets `data` to `undefined` and error is returned in `errors` field.
   */
  afterFieldSubscribe?: AfterFieldSubscribe<
    ResolveContext,
    BeforeHookContext,
    AfterHookContext
  >;
  /**
   * Called when field value is completed.
   *
   * @hook
   * @throws {Error} The field is set to `null` and the error is registered.
   * @returns {Error} The error is registered and execution continues.
   */
  afterFieldComplete?: AfterFieldCompleteHook<ResolveContext, AfterHookContext>;
  /**
   * Called after each response payload is built, including the initial and
   * subsequent incremental payloads. Not called for iterator cancellation.
   *
   * @hook
   * @throws {Error} Non-incremental responses contain only errors; incremental payloads are preserved.
   * @returns {Error} The error is registered and execution continues.
   */
  afterBuildResponse?: AfterBuildResponseHook<ResolveContext>;
}
