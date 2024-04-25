import { ResolveInfo } from "../types";

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
  /**
   * The result of the field execution _before_ completing the value. This
   * means the result may be a promise that is still pending, and the delta
   * between the time this hook and the `afterFieldComplete` hook is called
   * is the time it takes for the promise to resolve.
   */
  result?: unknown | Promise<unknown>;
}

export interface AfterFieldCompleteHookArgs<ResolveContext, HookContext>
  extends PostExecuteFieldHookArgs<ResolveContext, HookContext> {
  result?: unknown;
  error?: unknown;
}

export interface BeforeFieldResolveHook<
  ResolveContext = unknown,
  BeforeHookContext = unknown,
> {
  (args: BaseExecuteFieldHookArgs<ResolveContext>): BeforeHookContext;
}

export interface AfterFieldResolveHook<
  ResolveContext = unknown,
  BeforeHookContext = unknown,
  AfterHookContext = BeforeHookContext,
> {
  (
    args: AfterFieldResolveHookArgs<ResolveContext, BeforeHookContext>,
  ): AfterHookContext;
}

export interface AfterFieldCompleteHook<
  ResolveContext = unknown,
  AfterHookContext = unknown,
> {
  (args: AfterFieldCompleteHookArgs<ResolveContext, AfterHookContext>): void;
}

export interface ExecutionHooks<
  ResolveContext = unknown,
  BeforeHookContext = unknown,
  AfterHookContext = BeforeHookContext,
> {
  beforeFieldResolve?: BeforeFieldResolveHook<
    ResolveContext,
    BeforeHookContext
  >;
  afterFieldResolve?: AfterFieldResolveHook<
    ResolveContext,
    BeforeHookContext,
    AfterHookContext
  >;
  afterFieldComplete?: AfterFieldCompleteHook<ResolveContext, AfterHookContext>;
}
