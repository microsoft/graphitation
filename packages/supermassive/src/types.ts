import {
  DefinitionNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLScalarType,
  GraphQLTypeResolver,
  NamedTypeNode,
  NameNode,
  OperationDefinitionNode,
  OperationTypeNode,
  SelectionSetNode,
  TypeNode,
  TypeSystemDefinitionNode,
  TypeSystemExtensionNode,
  ValueNode,
  VariableDefinitionNode,
  Location,
} from "graphql";
import { Maybe } from "graphql/jsutils/Maybe";
import { PromiseOrValue } from "graphql/jsutils/PromiseOrValue";
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

export interface TypeAnnotatedDocumentNode {
  kind: "Document";
  loc?: Location;
  definitions: Array<TypeAnnotatedDefinitionNode>;
}

export type TypeAnnotatedDefinitionNode =
  | TypeAnnotatedExecutableDefinitionNode
  | TypeSystemDefinitionNode
  | TypeSystemExtensionNode;

export type TypeAnnotatedExecutableDefinitionNode =
  | TypeAnnotatedOperationDefinitionNode
  | TypeAnnotatedFragmentDefinitionNode;

export interface TypeAnnotatedOperationDefinitionNode {
  kind: "OperationDefinition";
  loc?: Location;
  operation: OperationTypeNode;
  name?: NameNode;
  variableDefinitions?: Array<VariableDefinitionNode>;
  directives?: Array<TypeAnnotatedDirectiveNode>;
  selectionSet: TypeAnnotatedSelectionSetNode;
}

export interface TypeAnnotatedFieldNode {
  kind: "Field";
  loc?: Location;
  alias?: NameNode;
  name: NameNode;
  arguments?: Array<TypeAnnotatedArgumentNode>;
  directives?: Array<TypeAnnotatedDirectiveNode>;
  selectionSet?: TypeAnnotatedSelectionSetNode;

  __type: TypeNode;
}

export interface TypeAnnotatedSelectionSetNode {
  kind: "SelectionSet";
  loc?: Location;
  selections: Array<TypeAnnotatedSelectionNode>;
}

export type TypeAnnotatedSelectionNode =
  | TypeAnnotatedFieldNode
  | FragmentSpreadNode
  | TypeAnnotatedInlineFragmentNode;

export interface TypeAnnotatedInlineFragmentNode {
  kind: "InlineFragment";
  loc?: Location;
  typeCondition?: NamedTypeNode;
  directives?: Array<TypeAnnotatedDirectiveNode>;
  selectionSet: TypeAnnotatedSelectionSetNode;
}

export interface TypeAnnotatedArgumentNode {
  kind: "Argument";
  loc?: Location;
  name: NameNode;
  value: ValueNode;

  __type: TypeNode;
  __defaultValue?: ValueNode;
}

export interface TypeAnnotatedDirectiveNode {
  kind: "Directive";
  loc?: Location;
  name: NameNode;
  arguments?: Array<TypeAnnotatedArgumentNode>;
}

export interface TypeAnnotatedFragmentDefinitionNode {
  kind: "FragmentDefinition";
  loc?: Location;
  name: NameNode;
  typeCondition: NamedTypeNode;
  directives?: Array<TypeAnnotatedDirectiveNode>;
  selectionSet: TypeAnnotatedSelectionSetNode;
}

export interface ResolveInfo {
  fieldName: string;
  fieldNodes: Array<TypeAnnotatedFieldNode>;
  returnTypeName: string;
  parentTypeName: string;
  returnTypeNode: TypeNode;
  // readonly returnType: GraphQLOutputType;
  // readonly parentType: GraphQLObjectType;
  path: Path;
  // readonly schema: GraphQLSchema;
  fragments: ObjMap<TypeAnnotatedFragmentDefinitionNode>;
  rootValue: unknown;
  operation: TypeAnnotatedOperationDefinitionNode;
  variableValues: { [variable: string]: unknown };
}
