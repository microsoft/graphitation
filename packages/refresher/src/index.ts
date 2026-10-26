/// <reference lib="es2022.error" preserve="true" />
/// <reference lib="es2022.object" preserve="true" />

/**
 * `@graphitation/refresher`: the reactive view layer. Views, refs, store views, and the change
 * vocabulary they are written in, and the runtime they run in.
 *
 * Reading external records is a store's job, and stores ship separately — see
 * `@graphitation/refresher/stores` for the object store binding. Nothing here names one.
 */
import type * as Core from "./api.core";
import type * as Env from "./api.env";
import type * as Queries from "./api.queries";
import type * as RuntimeApi from "./api.runtime";
import type * as Stores from "./api.stores";
import {
  createMainThreadEnvironment as createBuiltInMainThreadEnvironment,
  defaultEnvironment as builtInEnvironment,
} from "./env/environment";
import { createSimpleDriver as createBuiltInSimpleDriver } from "./queries/simpleDriver";
import { createRuntime as createBuiltInRuntime } from "./runtime/runtime";
import {
  pin as definePin,
  storeView as defineStoreView,
  view as defineView,
} from "./views/definitions";
import { isOpenInput as isBuiltInOpenInput } from "./views/input";

export const view: Core.ViewFn = defineView;
export const pin: Core.PinFn = definePin;
export const storeView: Stores.StoreViewFn = defineStoreView;
export const createRuntime: RuntimeApi.CreateRuntimeFn = createBuiltInRuntime;
export const createSimpleDriver: Queries.CreateSimpleDriverFn =
  createBuiltInSimpleDriver;
export const defaultEnvironment: Env.Environment = builtInEnvironment;
export const createMainThreadEnvironment: Env.CreateEnvironmentFn =
  createBuiltInMainThreadEnvironment;
export const isOpenInput: Core.IsOpenInputFn = isBuiltInOpenInput;

export type {
  Revision,
  PromiseOrValue,
  ViewSignature,
  Settled,
  ViewSchema,
  AccessConfig,
  DefaultAccess,
  View,
  AnyView,
  ReadableView,
  QueryableView,
  ReferenceableView,
  ArgsOf,
  ResultOf,
  AnswerOf,
  CodecSuppliedKey,
  ViewId,
  ViewInstanceId,
  Ref,
  RefTemplate,
  RefLeaving,
  AnyRef,
  RefFor,
  InputsOf,
  OpenInput,
  InputFn,
  IsOpenInputFn,
  BindFn,
  ExternalRef,
  ExternalRefFor,
  FollowedRef,
  External,
  Action,
  ActionArgsOf,
  ActionResultOf,
  ActionId,
  ActionRef,
  ActionRefTemplate,
  ActionRefLeaving,
  AnyActionRef,
  ExternalActionRef,
  ReadonlyResult,
  ReadAnswer,
  ReadFn,
  RefFn,
  ActionRefFn,
  IsRefFn,
  ResolveContext,
  ResolveFn,
  ViewFn,
  Pin,
  PinResult,
  PinAccess,
  PinOptions,
  PinFn,
  ExternalView,
  ExternalViewFn,
  RefresherError,
  StoreError,
  ViewError,
  RefError,
  ValueError,
  SessionError,
  OperationError,
  InternalError,
  IsRefresherErrorFn,
  StoreName,
  ViewOptions,
  ExternalOptions,
  RefMeta,
  RefMetaExtensions,
} from "./api.core";
export type {
  Store,
  StoreChange,
  StoreChangeListener,
  ChangeFeed,
  GetStoreFn,
  StoreHandle,
  StoreViewContext,
  AnnotationArgs,
  AnnotatedResult,
  StoreData,
  StoreFootprint,
  StoreReadAnswer,
  StoreViewFn,
  DefaultStoreViewAccess,
  StoreView,
  StoreViewOptions,
  AnnotateFn,
  StoreRead,
} from "./api.stores";
export type {
  Codec,
  FoundRefs,
  ResultPath,
  JsonCodecOptions,
  CreateJsonCodecFn,
} from "./api.codec";
export type { Environment, CreateEnvironmentFn, AssertReport } from "./api.env";
export type {
  ExecutionState,
  ExecutionStateKey,
  ExecutionWave,
  LatestRevisionFn,
  ViewCache,
  ViewInstance,
} from "./api.execution";
export type {
  ViewInstanceDescriptor,
  InvalidateResult,
  Invalidated,
  StaleReason,
  Hit,
  Unverifiable,
} from "./api.invalidation";
export type {
  QueryId,
  QueryDescriptor,
  QueryDriver,
  QueryStartArgs,
  QueryRestartArgs,
  DriverContext,
  DriverExecuteFn,
  DriverExecutionArgs,
  QueryResult,
  QueryPayload,
  IncrementalQueryResults,
  CreateSimpleDriverFn,
  SimpleDriverOutput,
} from "./api.queries";
export type {
  CreateRuntimeFn,
  RuntimeArgs,
  Runtime,
  RootFn,
  QueryArgs,
  RunResult,
  QueryObserver,
  QuerySubscription,
} from "./api.runtime";
// Aliased to publish only the first parameter; `Defaults` is internal.
export type AccessOf<Declared> = Core.AccessOf<Declared>;
