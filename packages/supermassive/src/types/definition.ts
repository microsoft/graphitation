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
  values: string[],
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

export type CompositeTypeTuple =
  | ObjectTypeDefinitionTuple
  | InterfaceTypeDefinitionTuple
  | UnionTypeDefinitionTuple;

export type FieldDefinitionTuple = [
  type: TypeReference,
  arguments: InputValueDefinitionRecord,
  // directives?: DirectiveTuple[],
];
export const enum FieldKeys {
  type = 0,
  arguments = 1,
}
export type FieldDefinition = TypeReference | FieldDefinitionTuple;
export type FieldDefinitionRecord = Record<string, FieldDefinition>;

export type InputValueDefinitionTuple = [
  type: TypeReference,
  defaultValue: unknown,
  // directives?: DirectiveTuple[],
];
export const enum InputValueKeys {
  type = 0,
  defaultValue = 1,
}
export type InputValueDefinition = TypeReference | InputValueDefinitionTuple;
export type InputValueDefinitionRecord = Record<string, InputValueDefinition>;

export type DirectiveName = string;
export type DirectiveTuple = [
  name: DirectiveName,
  arguments?: Record<string, unknown>, // JS values (cannot be a variable inside schema definition, so it is fine)
];
export type DirectiveDefinitionTuple = [
  name: DirectiveName,
  arguments?: InputValueDefinitionRecord,
];
export const enum DirectiveKeys {
  name = 0,
  arguments = 1,
}

export type TypeDefinitionsRecord = Record<TypeName, TypeDefinitionTuple>;
export type InterfaceImplementationsRecord = Record<TypeName, TypeName[]>;

export type EncodedSchemaFragment = {
  types: TypeDefinitionsRecord;
  implementations?: InterfaceImplementationsRecord; // TODO?
  directives?: DirectiveDefinitionTuple[];
};
