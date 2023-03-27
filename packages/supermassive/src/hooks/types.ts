import { Path } from "../jsutils/Path";

interface BaseExecuteHookArgs {
  context: unknown;
}

interface BaseExecuteFieldHookArgs extends BaseExecuteHookArgs {
  path: Path;
}

export interface BeforeFieldResolveHookArgs extends BaseExecuteFieldHookArgs {}

export interface AfterFieldResolveHookArgs extends BaseExecuteFieldHookArgs {
  result?: unknown;
  error?: Error;
}

export interface AfterFieldCompleteHookArgs extends BaseExecuteFieldHookArgs {
  result?: unknown;
  error?: Error;
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
