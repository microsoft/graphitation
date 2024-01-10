import {
  GraphQLError,
  GraphQLFormattedError,
  GraphQLScalarType,
  DocumentNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
} from "graphql";
import { Maybe } from "./jsutils/Maybe";
import { PromiseOrValue } from "./jsutils/PromiseOrValue";
import { ObjMap } from "./jsutils/ObjMap";
import { Path } from "./jsutils/Path";
import { ExecutionHooks } from "./hooks/types";
import { FieldGroup } from "./collectFields";
import { OperationTypes, SchemaDefinitions } from "./schema/definition";
import { TypeName } from "./schema/reference";

export type ScalarTypeResolver = GraphQLScalarType;
export type EnumTypeResolver = Record<string, unknown>;
export type FunctionFieldResolver<
  TSource,
  TContext,
  TArgs = Record<string, unknown>,
  TReturn = unknown,
> = (
  source: TSource,
  args: TArgs,
  context: TContext,
  info: ResolveInfo,
) => TReturn;

export type FieldResolver<
  TSource,
  TContext,
  TArgs = Record<string, unknown>,
  TReturn = unknown,
> =
  | FunctionFieldResolver<TSource, TContext, TArgs, TReturn>
  | FieldResolverObject<TSource, TContext, TArgs, TReturn>;

export type FieldResolverObject<
  TSource,
  TContext,
  TArgs = Record<string, unknown>,
  TReturn = unknown,
> = {
  subscribe?: FunctionFieldResolver<TSource, TContext, TArgs, TReturn>;
  resolve?: FunctionFieldResolver<TSource, TContext, TArgs, TReturn>;
};

export type TypeResolver<TSource, TContext> = (
  value: TSource,
  context: TContext,
  info: ResolveInfo,
) => PromiseOrValue<Maybe<string>>;

export type ObjectTypeResolver<
  TSource = unknown,
  TContext = unknown,
  TArgs = unknown,
> = {
  [key: string]: FieldResolver<TSource, TContext, TArgs>;
};

export type UserInterfaceTypeResolver = {
  __resolveType?: TypeResolver<unknown, unknown>;
};

export type UserUnionTypeResolver = {
  __resolveType?: TypeResolver<unknown, unknown>;
};

export type UserResolver<TSource, TContext> =
  | ObjectTypeResolver<TSource, TContext>
  | UserInterfaceTypeResolver
  | UserUnionTypeResolver
  | ScalarTypeResolver
  | EnumTypeResolver;

// TODO: Keep only UserResolver
export type Resolver<TSource, TContext> = UserResolver<TSource, TContext>;

export type Resolvers<TSource = unknown, TContext = unknown> = UserResolvers<
  TSource,
  TContext
>;

export type UserResolvers<TSource = unknown, TContext = unknown> = Record<
  string,
  UserResolver<TSource, TContext>
>;

export interface ResolveInfo {
  fieldName: string;
  fieldNodes: FieldGroup;
  returnTypeName: string;
  parentTypeName: string;
  // readonly returnType: GraphQLOutputType;
  // readonly parentType: GraphQLObjectType;
  path: Path;
  // readonly schema: GraphQLSchema;
  fragments: ObjMap<FragmentDefinitionNode>;
  rootValue: unknown;
  operation: OperationDefinitionNode;
  variableValues: { [variable: string]: unknown };
}

export type ExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> =
  | TotalExecutionResult<TData, TExtensions>
  | SubscriptionExecutionResult<TData, TExtensions>
  | IncrementalExecutionResult<TData, TExtensions>;

/**
 * The result of GraphQL execution.
 *
 *   - `errors` is included when any errors occurred as a non-empty array.
 *   - `data` is the result of a successful execution of the query.
 *   - `hasNext` is true if a future payload is expected.
 *   - `extensions` is reserved for adding non-standard properties.
 *   - `incremental` is a list of the results from defer/stream directives.
 */
export interface TotalExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLError>;
  data?: TData | null;
  extensions?: TExtensions;
}

export type SubscriptionExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> = AsyncGenerator<TotalExecutionResult<TData, TExtensions>>;

export interface FormattedTotalExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLFormattedError>;
  data?: TData | null;
  extensions?: TExtensions;
}

export interface IncrementalExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  initialResult: InitialIncrementalExecutionResult<TData, TExtensions>;
  subsequentResults: AsyncGenerator<
    SubsequentIncrementalExecutionResult<TData, TExtensions>,
    void,
    void
  >;
}

export interface InitialIncrementalExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends TotalExecutionResult<TData, TExtensions> {
  hasNext: boolean;
  incremental?: ReadonlyArray<IncrementalResult<TData, TExtensions>>;
  extensions?: TExtensions;
}

export interface FormattedInitialIncrementalExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends FormattedTotalExecutionResult<TData, TExtensions> {
  hasNext: boolean;
  incremental?: ReadonlyArray<FormattedIncrementalResult<TData, TExtensions>>;
  extensions?: TExtensions;
}

export interface SubsequentIncrementalExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  hasNext: boolean;
  incremental?: ReadonlyArray<IncrementalResult<TData, TExtensions>>;
  extensions?: TExtensions;
}

export interface FormattedSubsequentIncrementalExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  hasNext: boolean;
  incremental?: ReadonlyArray<FormattedIncrementalResult<TData, TExtensions>>;
  extensions?: TExtensions;
}

export interface IncrementalDeferResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends TotalExecutionResult<TData, TExtensions> {
  path?: ReadonlyArray<string | number>;
  label?: string;
}

export interface FormattedIncrementalDeferResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends FormattedTotalExecutionResult<TData, TExtensions> {
  path?: ReadonlyArray<string | number>;
  label?: string;
}

export interface IncrementalStreamResult<
  TData = Array<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLError>;
  items?: TData | null;
  path?: ReadonlyArray<string | number>;
  label?: string;
  extensions?: TExtensions;
}

export interface FormattedIncrementalStreamResult<
  TData = Array<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLFormattedError>;
  items?: TData | null;
  path?: ReadonlyArray<string | number>;
  label?: string;
  extensions?: TExtensions;
}

export type IncrementalResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> =
  | IncrementalDeferResult<TData, TExtensions>
  | IncrementalStreamResult<TData, TExtensions>;

export type FormattedIncrementalResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> =
  | FormattedIncrementalDeferResult<TData, TExtensions>
  | FormattedIncrementalStreamResult<TData, TExtensions>;

export interface CommonExecutionArgs {
  document: DocumentNode;
  rootValue?: unknown;
  contextValue?: unknown;
  buildContextValue?: (contextValue?: unknown) => unknown;
  variableValues?: Maybe<{ [variable: string]: unknown }>;
  operationName?: Maybe<string>;
  fieldResolver?: Maybe<FunctionFieldResolver<unknown, unknown>>;
  typeResolver?: Maybe<TypeResolver<unknown, unknown>>;
  subscribeFieldResolver?: Maybe<FunctionFieldResolver<unknown, unknown>>;
  fieldExecutionHooks?: ExecutionHooks;
}
export type ExecutionWithoutSchemaArgs = CommonExecutionArgs & {
  schemaFragment: SchemaFragment;
  schemaFragmentLoader?: SchemaFragmentLoader;
};

export type ExecutionWithSchemaArgs = CommonExecutionArgs & {
  definitions: DocumentNode;
  resolvers: UserResolvers;
};

export type SchemaId = string;

export type SchemaFragment = {
  schemaId: SchemaId;
  definitions: SchemaDefinitions;
  resolvers: UserResolvers;
  operationTypes?: OperationTypes;
};

export type SchemaFragmentForReturnTypeRequest = {
  kind: "ReturnType";
  parentTypeName: TypeName;
  fieldName: string;
};
export type SchemaFragmentForRuntimeTypeRequest = {
  kind: "RuntimeType";
  abstractTypeName: TypeName;
  runtimeTypeName: TypeName;
};

export type SchemaFragmentRequest =
  | SchemaFragmentForReturnTypeRequest
  | SchemaFragmentForRuntimeTypeRequest;

export type SchemaFragmentLoaderResult = {
  mergedFragment: SchemaFragment;
  mergedContextValue?: unknown;
};

export type SchemaFragmentLoader = (
  currentFragment: SchemaFragment,
  currentContextValue: unknown,
  req: SchemaFragmentRequest,
) => Promise<SchemaFragmentLoaderResult>;

export type DocumentWithMinimalViableSchema = {
  readonly kind: "Document";
  readonly loc?: Location;
  readonly definitions: DefinitionNodeWithMinimalViableSchema[];
};

export type DefinitionNodeWithMinimalViableSchema = (
  | OperationDefinitionNode
  | FragmentDefinitionNode
) & {
  readonly __defs: SchemaDefinitions;
};
