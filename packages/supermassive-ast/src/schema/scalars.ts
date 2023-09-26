import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLString,
  type GraphQLScalarType,
} from "graphql";

export const specifiedScalarResolvers: { [key: string]: GraphQLScalarType } = {
  ID: GraphQLID,
  String: GraphQLString,
  Int: GraphQLInt,
  Float: GraphQLFloat,
  Boolean: GraphQLBoolean,
};

export function isSpecifiedScalarType(typeName: string): boolean {
  return !!specifiedScalarResolvers[typeName];
}
