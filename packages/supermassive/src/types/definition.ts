export type TypeReference = string | number; // Name or index of the encoded spec type
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
  arguments?: InputValueDefinitionRecord,
];

export type FieldDefinitionTuple = [
  type: TypeReference,
  arguments?: InputValueDefinitionRecord,
  directives?: DirectiveTuple[],
];

export type FieldDefinitionRecord = Record<string, FieldDefinitionTuple>;

export type ScalarTypeDefinitionTuple = [
  kind: 1,
  directives?: DirectiveTuple[],
];

export type ObjectTypeDefinitionTuple = [
  kind: 2,
  fields: FieldDefinitionRecord,
  interfaces?: ComplexTypeReference[],
  directives?: DirectiveTuple[],
];

export type InterfaceTypeDefinitionTuple = [
  kind: 3,
  fields: FieldDefinitionRecord,
  interfaces?: ComplexTypeReference[],
  directives?: DirectiveTuple[],
];

export type UnionTypeDefinitionTuple = [
  kind: 4,
  types: ComplexTypeReference[],
  directives?: DirectiveTuple[],
];

export type EnumTypeDefinitionTuple = [
  kind: 5,
  values?: string[],
  directives?: DirectiveTuple[],
];

export type InputObjectTypeDefinitionTuple = [
  kind: 6,
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

export type EncodedType = TypeDefinitionTuple;
export type EncodedTypesRecord = Record<string, EncodedType>;

export type ComplexType =
  | ObjectTypeDefinitionTuple
  | InterfaceTypeDefinitionTuple
  | UnionTypeDefinitionTuple;

export type EncodedSchemaFragment = {
  types: EncodedTypesRecord;
  // implementations: Record<ComplexTypeReference, ComplexTypeReference[]>;
};

export const EncodedSpecTypes = [
  "String",
  "Boolean",
  "Int",
  "Float",
  "ID",

  "String!",
  "Boolean!",
  "Int!",
  "Float!",
  "ID!",

  "[String]",
  "[Boolean]",
  "[Int]",
  "[Float]",
  "[ID]",

  "[String!]",
  "[Boolean!]",
  "[Int!]",
  "[Float!]",
  "[ID!]",

  "[String]!",
  "[Boolean]!",
  "[Int]!",
  "[Float]!",
  "[ID]!",

  "[String!]!",
  "[Boolean!]!",
  "[Int!]!",
  "[Float!]!",
  "[ID!]!",
];

export const TypeKind = {
  SCALAR: 1,
  OBJECT: 2,
  INTERFACE: 3,
  UNION: 4,
  ENUM: 5,
  INPUT: 6,
} as const;

export const ObjectKeys = { fields: 1, interfaces: 2 } as const;
export const InputObjectKeys = { fields: 1 } as const;
export const FieldKeys = { type: 0, arguments: 1 } as const;
export const InputValueKeys = { type: 0, defaultValue: 1 } as const;
export const EnumKeys = { values: 1 } as const;

// TODO:
function concatSchemaFragments(
  fragments: EncodedSchemaFragment[],
): EncodedSchemaFragment {
  // TODO: copy on merge (i.e. do not clone objects and arrays prematurely)
  const result: EncodedSchemaFragment = {
    types: {},
  };
  return result;
}
