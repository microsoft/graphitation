import {
  GraphQLEnumType,
  GraphQLError,
  GraphQLFormattedError,
  GraphQLInputObjectType,
  GraphQLScalarType,
  GraphQLSchema,
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

export type ScalarTypeResolver = GraphQLScalarType;
export type EnumTypeResolver = GraphQLEnumType; // TODO Record<string, any>;
export type FunctionFieldResolver<
  TSource,
  TContext,
  TArgs = Record<string, any>,
  TReturn = any
> = (
  source: TSource,
  args: TArgs,
  context: TContext,
  info: ResolveInfo
) => TReturn;

export type FieldResolver<
  TSource,
  TContext,
  TArgs = Record<string, any>,
  TReturn = any
> =
  | FunctionFieldResolver<TSource, TContext, TArgs, TReturn>
  | {
      subscribe?: FunctionFieldResolver<TSource, TContext, TArgs, TReturn>;
      resolve?: FunctionFieldResolver<TSource, TContext, TArgs, TReturn>;
    };

export type TypeResolver<TSource, TContext> = (
  value: TSource,
  context: TContext,
  info: ResolveInfo
) => PromiseOrValue<Maybe<string>>;

export type ObjectTypeResolver<TSource = any, TContext = any, TArgs = any> = {
  [key: string]: FieldResolver<TSource, TContext, TArgs>;
};
export type InterfaceTypeResolver<
  TSource = any,
  TContext = any,
  TArgs = any
> = {
  [key: string]: FieldResolver<TSource, TContext, TArgs>;
} & {
  __resolveType?: TypeResolver<any, any>;
};
export type UnionTypeResolver = {
  __resolveType?: TypeResolver<any, any>;
};
export type InputObjectTypeResolver = GraphQLInputObjectType;

export type Resolver<TSource, TContext> =
  | ObjectTypeResolver<TSource, TContext>
  | InterfaceTypeResolver<TSource, TContext>
  | UnionTypeResolver
  | ScalarTypeResolver
  | EnumTypeResolver
  | InputObjectTypeResolver;

export type Resolvers<TSource = any, TContext = any> = Record<
  string,
  Resolver<TSource, TContext>
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
  TExtensions = ObjMap<unknown>
> {
  errors?: Array<GraphQLError>;
  data?: TData | null;
  extensions?: TExtensions;
}

export interface FormattedExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>
> {
  errors?: Array<GraphQLFormattedError>;
  data?: TData | null;
  extensions?: TExtensions;
}

export interface CommonExecutionArgs {
  resolvers: Resolvers;
  rootValue?: unknown;
  contextValue?: unknown;
  variableValues?: Maybe<{ [variable: string]: unknown }>;
  operationName?: Maybe<string>;
  fieldResolver?: Maybe<FunctionFieldResolver<any, any>>;
  typeResolver?: Maybe<TypeResolver<any, any>>;
  subscribeFieldResolver?: Maybe<FunctionFieldResolver<any, any>>;
}
export type ExecutionWithoutSchemaArgs = CommonExecutionArgs & {
  document: DocumentNode;
};

export type ExecutionWithSchemaArgs = CommonExecutionArgs & {
  document: UntypedDocumentNode;
  typeDefs: UntypedDocumentNode;
};
