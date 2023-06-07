import {
  GraphQLEnumType,
  GraphQLError,
  GraphQLFormattedError,
  GraphQLInputObjectType,
  GraphQLScalarType,
  DocumentNode as UntypedDocumentNode,
} from "graphql";
import { Maybe } from "./jsutils/Maybe";
import { PromiseOrValue } from "./jsutils/PromiseOrValue";
import {
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
  TypeNode,
} from "./ast/TypedAST";
import { ObjMap } from "./jsutils/ObjMap";
import { Path } from "./jsutils/Path";
import { ExecutionHooks } from "./hooks/types";

export type ScalarTypeResolver = GraphQLScalarType;
export type EnumTypeResolver = GraphQLEnumType; // TODO Record<string, unknown>;
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

export type InterfaceTypeResolver<
  TSource = unknown,
  TContext = unknown,
  TArgs = unknown,
> = {
  __implementedBy: string[];
  [key: string]: FieldResolver<TSource, TContext, TArgs> | string[] | undefined;
} & {
  __resolveType?: TypeResolver<unknown, unknown>;
};
export type UnionTypeResolver = {
  __resolveType?: TypeResolver<unknown, unknown>;
  __types: string[];
};

export type UserInterfaceTypeResolver<
  TSource = unknown,
  TContext = unknown,
  TArgs = unknown,
> = {
  [key: string]: FieldResolver<TSource, TContext, TArgs>;
} & {
  __resolveType?: TypeResolver<unknown, unknown>;
};

export type UserUnionTypeResolver = {
  __resolveType?: TypeResolver<unknown, unknown>;
};

export type InputObjectTypeResolver = GraphQLInputObjectType;

export type UserResolver<TSource, TContext> =
  | ObjectTypeResolver<TSource, TContext>
  | UserInterfaceTypeResolver<TSource, TContext>
  | UserUnionTypeResolver
  | ScalarTypeResolver
  | EnumTypeResolver
  | InputObjectTypeResolver;

export type Resolver<TSource, TContext> =
  | ObjectTypeResolver<TSource, TContext>
  | InterfaceTypeResolver<TSource, TContext>
  | UnionTypeResolver
  | ScalarTypeResolver
  | EnumTypeResolver
  | InputObjectTypeResolver;

export type Resolvers<TSource = unknown, TContext = unknown> = Record<
  string,
  Resolver<TSource, TContext>
>;

export type UserResolvers<TSource = unknown, TContext = unknown> = Record<
  string,
  UserResolver<TSource, TContext>
>;

export interface ResolveInfo {
  fieldName: string;
  fieldNodes: Array<FieldNode>;
  returnTypeName: string;
  parentTypeName: string;
  returnTypeNode: TypeNode;
  // readonly returnType: GraphQLOutputType;
  // readonly parentType: GraphQLObjectType;
  path: Path;
  // readonly schema: GraphQLSchema;
  fragments: ObjMap<FragmentDefinitionNode>;
  rootValue: unknown;
  operation: OperationDefinitionNode;
  variableValues: { [variable: string]: unknown };
}

/**
 * The result of GraphQL execution.
 *
 *   - `errors` is included when any errors occurred as a non-empty array.
 *   - `data` is the result of a successful execution of the query.
 *   - `extensions` is reserved for adding non-standard properties.
 */
export interface ExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: Array<GraphQLError>;
  data?: TData | null;
  extensions?: TExtensions;
}

export interface FormattedExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: Array<GraphQLFormattedError>;
  data?: TData | null;
  extensions?: TExtensions;
}

export interface CommonExecutionArgs {
  resolvers: UserResolvers;
  rootValue?: unknown;
  contextValue?: unknown;
  variableValues?: Maybe<{ [variable: string]: unknown }>;
  operationName?: Maybe<string>;
  fieldResolver?: Maybe<FunctionFieldResolver<unknown, unknown>>;
  typeResolver?: Maybe<TypeResolver<unknown, unknown>>;
  subscribeFieldResolver?: Maybe<FunctionFieldResolver<unknown, unknown>>;
  fieldExecutionHooks?: ExecutionHooks;
}
export type ExecutionWithoutSchemaArgs = CommonExecutionArgs & {
  document: DocumentNode;
  schemaResolvers?: Resolvers;
};

export type ExecutionWithSchemaArgs = CommonExecutionArgs & {
  document: UntypedDocumentNode;
  typeDefs: UntypedDocumentNode;
};
