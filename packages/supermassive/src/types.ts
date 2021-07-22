import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLScalarType,
} from "graphql";
import { Maybe } from "graphql/jsutils/Maybe";
import { PromiseOrValue } from "graphql/jsutils/PromiseOrValue";
import {
  FieldNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
  TypeNode,
} from "./ast/TypedAST";
import { ObjMap } from "./jsutils/ObjMap";
import { Path } from "./jsutils/Path";

export type ScalarTypeResolver = GraphQLScalarType;
export type EnumTypeResolver = GraphQLEnumType; // TODO Record<string, any>;
export type FieldResolver<
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
