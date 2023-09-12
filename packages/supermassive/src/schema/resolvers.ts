import {
  Resolver,
  UserUnionTypeResolver,
  UserInterfaceTypeResolver,
  ScalarTypeResolver,
  FunctionFieldResolver,
  SchemaId,
  SchemaFragment,
  ObjectTypeResolver,
  TypeResolver,
} from "../types";
import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLLeafType,
  GraphQLScalarType,
  GraphQLString,
  isScalarType,
} from "graphql";
import { TypeName, typeNameFromReference, TypeReference } from "./reference";
import {
  getEnumValues,
  getLeafType,
  isEnumTypeDefinition,
  isScalarTypeDefinition,
} from "./definition";
import { isObjectLike } from "../jsutils/isObjectLike";

const resolveTypeName: FunctionFieldResolver<unknown, unknown> = (
  _source,
  _args,
  _context,
  info,
) => info.parentTypeName;

const emptyObject = Object.freeze(Object.create(null));

export const specifiedScalarResolvers: { [key: string]: ScalarTypeResolver } = {
  ID: GraphQLID,
  String: GraphQLString,
  Int: GraphQLInt,
  Float: GraphQLFloat,
  Boolean: GraphQLBoolean,
};

export function isSpecifiedScalarType(typeName: string): boolean {
  return !!specifiedScalarResolvers[typeName];
}

export function isInterfaceTypeResolver(
  resolver: Resolver<unknown, unknown>,
): resolver is UserInterfaceTypeResolver {
  return resolver && "__resolveType" in resolver;
}

export function isUnionTypeResolver(
  resolver: Resolver<unknown, unknown>,
): resolver is UserUnionTypeResolver {
  return resolver && "__resolveType" in resolver;
}

export function isScalarTypeResolver(
  resolver: unknown,
): resolver is ScalarTypeResolver {
  return isScalarType(resolver);
}

export function getFieldResolver(
  schemaFragment: SchemaFragment,
  typeName: TypeName,
  fieldName: string,
): FunctionFieldResolver<unknown, unknown> | undefined {
  if (fieldName === "__typename") {
    return resolveTypeName;
  }
  // TODO: sanity check that this is an object type resolver
  const typeResolvers = schemaFragment.resolvers[typeName] as
    | ObjectTypeResolver<unknown, unknown, unknown>
    | undefined;
  const fieldResolver = typeResolvers?.[fieldName];
  return typeof fieldResolver === "function"
    ? fieldResolver
    : fieldResolver?.resolve;
}

export function getSubscriptionFieldResolver(
  schemaFragment: SchemaFragment,
  subscriptionTypeName: TypeName,
  fieldName: string,
): FunctionFieldResolver<unknown, unknown> | undefined {
  // TODO: sanity check that this is an object type resolver
  const typeResolvers = schemaFragment.resolvers[subscriptionTypeName] as
    | ObjectTypeResolver<unknown, unknown, unknown>
    | undefined;
  const fieldResolver = typeResolvers?.[fieldName];
  return typeof fieldResolver === "function"
    ? fieldResolver
    : fieldResolver?.subscribe;
}

export function getAbstractTypeResolver(
  schemaFragment: SchemaFragment,
  typeName: TypeName,
): TypeResolver<unknown, unknown> | undefined {
  const resolver = schemaFragment.resolvers[typeName];
  return resolver &&
    (isUnionTypeResolver(resolver) || isInterfaceTypeResolver(resolver))
    ? resolver.__resolveType
    : undefined;
}

export function getLeafTypeResolver(
  schemaFragment: SchemaFragment,
  typeRef: TypeReference,
): GraphQLLeafType | undefined {
  // TODO: consider removing GraphQLEnumType and GraphQLScalarType
  const typeName = typeNameFromReference(typeRef);

  if (specifiedScalarResolvers[typeName]) {
    return specifiedScalarResolvers[typeName];
  }

  const typeDef = getLeafType(schemaFragment.definitions, typeRef);
  if (!typeDef) {
    // TODO: Could be still in resolvers (i.e., add "found in resolvers, not found in schema" error?)
    return undefined;
  }
  if (isScalarTypeDefinition(typeDef)) {
    const scalarTypesMap = getSchemaScalarTypes(schemaFragment);
    let scalarType = scalarTypesMap.get(typeName);
    if (!scalarType) {
      const tmp = schemaFragment.resolvers[typeName];
      scalarType = isScalarTypeResolver(tmp)
        ? tmp
        : new GraphQLScalarType({ name: typeName, description: "" });
      scalarTypesMap.set(typeName, scalarType);
    }
    return scalarType;
  }
  if (isEnumTypeDefinition(typeDef)) {
    const enumTypesMap = getSchemaEnumTypes(schemaFragment);
    let enumType = enumTypesMap.get(typeName);
    if (!enumType) {
      const tmp = schemaFragment.resolvers[typeName]; // Can only be graphql-tools map
      const customValues = isObjectLike(tmp) ? tmp : emptyObject;

      const values: Record<string, object> = {};
      for (const value of getEnumValues(typeDef)) {
        values[value] =
          typeof customValues[value] !== "undefined"
            ? { value: customValues[value] }
            : {};
      }
      enumType = new GraphQLEnumType({
        name: typeName,
        values,
      });
      enumTypesMap.set(typeName, enumType);
    }
    return enumType;
  }
  return undefined;
}

type ScalarTypeMap = Map<TypeName, GraphQLScalarType>;
type EnumTypeMap = Map<TypeName, GraphQLEnumType>;

const scalarTypesBySchema = new Map<SchemaId, ScalarTypeMap>();
const enumTypesBySchema = new Map<SchemaId, EnumTypeMap>();

function getSchemaScalarTypes(schemaFragment: SchemaFragment) {
  let scalarTypes = scalarTypesBySchema.get(schemaFragment.schemaId);
  if (!scalarTypes) {
    scalarTypes = new Map<TypeName, GraphQLScalarType>();
    scalarTypesBySchema.set(schemaFragment.schemaId, scalarTypes);
  }
  return scalarTypes;
}

function getSchemaEnumTypes(schemaFragment: SchemaFragment) {
  let enumTypes = enumTypesBySchema.get(schemaFragment.schemaId);
  if (!enumTypes) {
    enumTypes = new Map<TypeName, GraphQLEnumType>();
    enumTypesBySchema.set(schemaFragment.schemaId, enumTypes);
  }
  return enumTypes;
}
