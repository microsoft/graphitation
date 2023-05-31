// Given a GraphQL document with type definitions, extract all types that can be defined implicitly.
import {
  DocumentNode,
  EnumValueDefinitionNode,
  FieldDefinitionNode,
  getDirectiveValues,
  ObjectTypeDefinitionNode,
  GraphQLDeprecatedDirective,
  NamedTypeNode,
  GraphQLEnumType,
  GraphQLEnumValueConfigMap,
  GraphQLScalarType,
  InputValueDefinitionNode,
  Kind,
  EnumTypeDefinitionNode,
  InputObjectTypeDefinitionNode,
  GraphQLInputObjectType,
  GraphQLInputFieldConfigMap,
  GraphQLInputType,
  valueFromAST,
  TypeNode,
  GraphQLNonNull,
  GraphQLList,
} from "graphql";
import { Maybe } from "./jsutils/Maybe";
import { Resolvers, UnionTypeResolver, InterfaceTypeResolver } from "./types";

export function extractImplicitTypes<TSource = unknown, TContext = unknown>(
  document: DocumentNode,
  getTypeByName: (name: string) => GraphQLInputType,
): Resolvers<TSource, TContext> {
  const result: Resolvers<TSource, TContext> = Object.create(null);
  const implementedBy: Record<string, Array<string>> = {};
  for (const astNode of document.definitions) {
    if (astNode.kind === Kind.SCALAR_TYPE_DEFINITION) {
      const name = astNode.name.value;
      result[name] = new GraphQLScalarType({
        name,
        description: astNode.description?.value,
      });
    } else if (astNode.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION) {
      result[astNode.name.value] = makeInputObject(astNode, getTypeByName);
    } else if (astNode.kind === Kind.ENUM_TYPE_DEFINITION) {
      result[astNode.name.value] = makeEnum(astNode);
    } else if (astNode.kind === Kind.INTERFACE_TYPE_DEFINITION) {
      if (!implementedBy[astNode.name.value]) {
        implementedBy[astNode.name.value] = [];
      }
      result[astNode.name.value] = {
        __resolveType: undefined,
        __implementedBy: implementedBy[astNode.name.value],
      } as InterfaceTypeResolver;
    } else if (astNode.kind === Kind.UNION_TYPE_DEFINITION) {
      const types = astNode.types?.map((typeNode) => {
        return typeNode.name.value;
      });

      result[astNode.name.value] = {
        __resolveType: undefined,
        __types: types || [],
      } as UnionTypeResolver;
    } else if (astNode.kind === Kind.OBJECT_TYPE_DEFINITION) {
      astNode.interfaces?.forEach((node: NamedTypeNode) => {
        if (!implementedBy[node.name.value]) {
          implementedBy[node.name.value] = [];
        }
        implementedBy[node.name.value].push(
          (astNode as ObjectTypeDefinitionNode).name.value,
        );
      });

      result[astNode.name.value] = {};
    }
  }
  return result;
}

function makeEnum(astNode: EnumTypeDefinitionNode) {
  const enumValueMap: GraphQLEnumValueConfigMap = Object.create(null);
  for (const value of astNode.values || []) {
    enumValueMap[value.name.value] = {
      description: value.description?.value,
      deprecationReason: getDeprecationReason(value),
      astNode: value,
    };
  }

  return new GraphQLEnumType({
    name: astNode.name.value,
    description: astNode.description?.value,
    values: enumValueMap,
  });
}

function makeInputObject(
  astNode: InputObjectTypeDefinitionNode,
  getTypeByName: (name: string) => GraphQLInputType,
) {
  const name = astNode.name.value;

  return new GraphQLInputObjectType({
    name,
    description: astNode.description?.value,
    fields: () => buildInputFieldMap(astNode.fields || [], getTypeByName),
    astNode,
  });
}

function buildInputFieldMap(
  fieldNodes: ReadonlyArray<InputValueDefinitionNode>,
  getTypeByName: (name: string) => GraphQLInputType,
): GraphQLInputFieldConfigMap {
  const inputFieldMap = Object.create(null);
  for (const field of fieldNodes) {
    // Note: While this could make assertions to get the correctly typed
    // value, that would throw immediately while type system validation
    // with validateSchema() will produce more actionable results.
    const type: GraphQLInputType = getWrappedType(field.type, getTypeByName);

    inputFieldMap[field.name.value] = {
      type,
      description: field.description?.value,
      defaultValue: valueFromAST(field.defaultValue, type),
      deprecationReason: getDeprecationReason(field),
      astNode: field,
    };
  }
  return inputFieldMap;
}

function getWrappedType(
  type: TypeNode,
  getTypeByName: (name: string) => GraphQLInputType,
): GraphQLInputType {
  if (type.kind === Kind.LIST_TYPE) {
    return new GraphQLList(getWrappedType(type.type, getTypeByName));
  } else if (type.kind === Kind.NON_NULL_TYPE) {
    return new GraphQLNonNull(getWrappedType(type.type, getTypeByName));
  } else {
    return getTypeByName(type.name.value);
  }
}

function getDeprecationReason(
  node:
    | EnumValueDefinitionNode
    | FieldDefinitionNode
    | InputValueDefinitionNode,
): Maybe<string> {
  const deprecated = getDirectiveValues(
    GraphQLDeprecatedDirective,
    node,
  ) as any;
  return deprecated?.reason;
}
