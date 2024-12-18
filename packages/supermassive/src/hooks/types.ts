import type { OperationDefinitionNode } from "graphql";
import type { ResolveInfo, TotalExecutionResult } from "../types";

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
  result: TotalExecutionResult;
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
    | Promise<BeforeHookContext>
    | BeforeHookContext
    | Error;
}

export interface BeforeFieldSubscribe<
  ResolveContext = unknown,
  BeforeHookContext = unknown,
> {
  (args: BaseExecuteFieldHookArgs<ResolveContext>):
    | Promise<BeforeHookContext>
    | Promise<Error>
    | BeforeHookContext
    | Error;
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
    | void
    | Promise<void>
    | Error
    | Promise<Error>;
}

export interface BeforeSubscriptionEventEmitHook<ResolveContext = unknown> {
  (args: BeforeSubscriptionEventEmitHookArgs<ResolveContext>):
    | void
    | Promise<void>
    | Error
    | Promise<Error>;
}

export interface ExecutionHooks<
  ResolveContext = unknown,
  BeforeHookContext = unknown,
  AfterHookContext = BeforeHookContext,
> {
  beforeOperationExecute?: BeforeOperationExecuteHook<ResolveContext>;
  beforeSubscriptionEventEmit?: BeforeSubscriptionEventEmitHook<ResolveContext>;
  beforeFieldResolve?: BeforeFieldResolveHook<
    ResolveContext,
    BeforeHookContext
  >;
  beforeFieldSubscribe?: BeforeFieldSubscribe<
    ResolveContext,
    BeforeHookContext
  >;
  afterFieldResolve?: AfterFieldResolveHook<
    ResolveContext,
    BeforeHookContext,
    AfterHookContext
  >;
  afterFieldSubscribe?: AfterFieldSubscribe<
    ResolveContext,
    BeforeHookContext,
    AfterHookContext
  >;
  afterFieldComplete?: AfterFieldCompleteHook<ResolveContext, AfterHookContext>;
  afterBuildResponse?: AfterBuildResponseHook<ResolveContext>;
}
