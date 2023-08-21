import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLScalarType,
  GraphQLString,
} from "graphql";

export type TypeName = string; // name without wrappers, i.e. "MyType", but not "[MyType]"
export type SpecTypeIndex = number;
export type TypeReference = string | SpecTypeIndex; // e.g. "ComplexType" | "ComplexType!" | "[ComplexType!]" | 4 (i.e. "ID")

// Perf: const enums are inlined in the build (+small integers are stored on the stack in v8)
export const enum TypeKind {
  SCALAR = 1,
  OBJECT = 2,
  INTERFACE = 3,
  UNION = 4,
  ENUM = 5,
  INPUT = 6,
}

export type ScalarTypeDefinitionTuple = [
  kind: TypeKind.SCALAR,
  // directives?: DirectiveTuple[], // TODO ?
];

export type ObjectTypeDefinitionTuple = [
  kind: TypeKind.OBJECT,
  fields: FieldDefinitionRecord,
  interfaces?: TypeName[],
  // directives?: DirectiveTuple[],
];
export const enum ObjectKeys {
  fields = 1,
  interfaces = 2,
}

export type InterfaceTypeDefinitionTuple = [
  kind: TypeKind.INTERFACE,
  fields: FieldDefinitionRecord,
  interfaces?: TypeName[],
  // directives?: DirectiveTuple[],
];
export const enum InterfaceKeys {
  fields = 1,
  interfaces = 2,
}

export type UnionTypeDefinitionTuple = [
  kind: TypeKind.UNION,
  types: TypeName[],
  // directives?: DirectiveTuple[],
];
export const enum UnionKeys {
  types = 1,
}

export type EnumTypeDefinitionTuple = [
  kind: TypeKind.ENUM,
  values?: string[],
  // directives?: DirectiveTuple[],
];
export const enum EnumKeys {
  values = 1,
}

export type InputObjectTypeDefinitionTuple = [
  kind: TypeKind.INPUT,
  fields: InputValueDefinitionRecord,
  // directives?: DirectiveTuple[],
];
export const enum InputObjectKeys {
  fields = 1,
}

export type TypeDefinitionTuple =
  | ScalarTypeDefinitionTuple
  | ObjectTypeDefinitionTuple
  | InterfaceTypeDefinitionTuple
  | UnionTypeDefinitionTuple
  | EnumTypeDefinitionTuple
  | InputObjectTypeDefinitionTuple;

export type FieldDefinitionTuple = [
  type: TypeReference,
  arguments?: InputValueDefinitionRecord,
  // directives?: DirectiveTuple[],
];
export const enum FieldKeys {
  type = 0,
  arguments = 1,
}
export type FieldDefinitionRecord = Record<string, FieldDefinitionTuple>;

export type InputValueDefinitionTuple = [
  type: TypeReference,
  defaultValue?: unknown,
  // directives?: DirectiveTuple[],
];
export const enum InputValueKeys {
  type = 0,
  defaultValue = 1,
}
export type InputValueDefinitionRecord = Record<
  string,
  InputValueDefinitionTuple
>;

export type DirectiveTuple = [
  name: string,
  arguments?: Record<string, unknown>, // JS values (cannot be a variable inside schema definition, so it is fine)
];
export type DirectiveDefinitionTuple = [
  name: string,
  arguments?: InputValueDefinitionRecord,
];
export const enum DirectiveKeys {
  name = 0,
  arguments = 1,
}

export type EncodedTypeRecord = Record<TypeName, TypeDefinitionTuple>;
export type EncodedDirectives = DirectiveDefinitionTuple[];

export type EncodedSchemaFragment = {
  types: EncodedTypeRecord;
  directives?: EncodedDirectives;
};

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
