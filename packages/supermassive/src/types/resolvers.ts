import {
  Resolver,
  UserUnionTypeResolver,
  UserInterfaceTypeResolver,
  ScalarTypeResolver,
} from "../types";
import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLString,
  isScalarType,
} from "graphql";

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
