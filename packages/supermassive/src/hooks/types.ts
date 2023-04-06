import { ResolveInfo } from "../types";

interface BaseExecuteHookArgs {
  context: unknown;
}

interface BaseExecuteFieldHookArgs extends BaseExecuteHookArgs {
  resolveInfo: ResolveInfo;
}

export interface BeforeFieldResolveHookArgs extends BaseExecuteFieldHookArgs {}

export interface AfterFieldResolveHookArgs extends BaseExecuteFieldHookArgs {
  result?: unknown;
  error?: any;
}

export interface AfterFieldCompleteHookArgs extends BaseExecuteFieldHookArgs {
  result?: unknown;
  error?: any;
}

export interface BeforeFieldResolveHook {
  (args: BeforeFieldResolveHookArgs): void;
}

export interface AfterFieldResolveHook {
  (args: AfterFieldResolveHookArgs): void;
}

export interface AfterFieldCompleteHook {
  (args: AfterFieldCompleteHookArgs): void;
}

export interface ExecutionHooks {
  beforeFieldResolve?: BeforeFieldResolveHook;
  afterFieldResolve?: AfterFieldResolveHook;
  afterFieldComplete?: AfterFieldCompleteHook;
}
