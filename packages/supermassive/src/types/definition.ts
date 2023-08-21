import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLScalarType,
  GraphQLString,
} from "graphql";

export type TypeReference = string | number;
export type ComplexTypeReference = string;

export type InputValueDefinitionTuple = [
  type: TypeReference,
  defaultValue?: unknown,
  directives?: DirectiveTuple[],
];

export type InputValueDefinitionRecord = Record<
  string,
  InputValueDefinitionTuple
>;

export type DirectiveTuple = [
  name: string,
  arguments?: Record<string, unknown>, // JS values (cannot be a variable inside schema definition, so it is fine)
];

export type FieldDefinitionTuple = [
  type: TypeReference,
  arguments?: InputValueDefinitionRecord,
  directives?: DirectiveTuple[],
];

export type FieldDefinitionRecord = Record<string, FieldDefinitionTuple>;

export type ScalarTypeDefinitionTuple = [
  kind: TypeKind.SCALAR,
  directives?: DirectiveTuple[],
];

export type ObjectTypeDefinitionTuple = [
  kind: TypeKind.OBJECT,
  fields: FieldDefinitionRecord,
  interfaces?: ComplexTypeReference[],
  directives?: DirectiveTuple[],
];

export type InterfaceTypeDefinitionTuple = [
  kind: TypeKind.INTERFACE,
  fields: FieldDefinitionRecord,
  interfaces?: ComplexTypeReference[],
  directives?: DirectiveTuple[],
];

export type UnionTypeDefinitionTuple = [
  kind: TypeKind.UNION,
  types: ComplexTypeReference[],
  directives?: DirectiveTuple[],
];

export type EnumTypeDefinitionTuple = [
  kind: TypeKind.ENUM,
  values?: string[],
  directives?: DirectiveTuple[],
];

export type InputObjectTypeDefinitionTuple = [
  kind: TypeKind.INPUT,
  fields: InputValueDefinitionRecord,
  directives?: DirectiveTuple[],
];

export type TypeDefinitionTuple =
  | ScalarTypeDefinitionTuple
  | ObjectTypeDefinitionTuple
  | InterfaceTypeDefinitionTuple
  | UnionTypeDefinitionTuple
  | EnumTypeDefinitionTuple
  | InputObjectTypeDefinitionTuple;

export type DirectiveDefinitionTuple = [
  name: string,
  arguments?: InputValueDefinitionRecord,
];

export type EncodedTypeRecord = Record<string, TypeDefinitionTuple>;
export type EncodedDirectives = DirectiveDefinitionTuple[];

export type ComplexType =
  | ObjectTypeDefinitionTuple
  | InterfaceTypeDefinitionTuple
  | UnionTypeDefinitionTuple;

export type EncodedSchemaFragment = {
  types: EncodedTypeRecord;
  directives: EncodedDirectives;
  // implementations: Record<ComplexTypeReference, ComplexTypeReference[]>;
};

// Perf: const enums are inlined in the build (+small integers are stored on the stack in v8)
export const enum TypeKind {
  SCALAR = 1,
  OBJECT = 2,
  INTERFACE = 3,
  UNION = 4,
  ENUM = 5,
  INPUT = 6,
}
export const enum ObjectKeys {
  fields = 1,
  interfaces = 2,
}
export const enum InterfaceKeys {
  fields = 1,
  interfaces = 2,
}
export const enum InputObjectKeys {
  fields = 1,
}
export const enum FieldKeys {
  type = 0,
  arguments = 1,
}
export const enum InputValueKeys {
  type = 0,
  defaultValue = 1,
}
export const enum EnumKeys {
  values = 1,
}
export const enum DirectiveKeys {
  name = 0,
  arguments = 1,
}

export const specifiedScalars: { [key: string]: GraphQLScalarType } = {
  ID: GraphQLID,
  String: GraphQLString,
  Int: GraphQLInt,
  Float: GraphQLFloat,
  Boolean: GraphQLBoolean,
};

export function isSpecifiedScalarType(typeName: string): boolean {
  return !!specifiedScalars[typeName];
}

// TODO: function concatEncodedSchemaFragments
