import { isSpecifiedScalarType } from "./scalars";
import { TypeName, TypeReference, typeNameFromReference } from "./reference";
import {
  DirectiveLocation as GraphQLDirectiveLocation,
  DirectiveLocationEnum,
} from "graphql";

// Perf: const enums are inlined in the build (+small integers are stored on the stack in v8)
// IMPORTANT: const enums MUST NOT be exported, otherwise esbuild struggles to inline them: use exported functions
const enum TypeKind {
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
const enum ObjectKeys {
  fields = 1,
  interfaces = 2,
}

export type InterfaceTypeDefinitionTuple = [
  kind: TypeKind.INTERFACE,
  fields: FieldDefinitionRecord,
  interfaces?: TypeName[],
  // directives?: DirectiveTuple[],
];
const enum InterfaceKeys {
  fields = 1,
  interfaces = 2,
}

export type UnionTypeDefinitionTuple = [
  kind: TypeKind.UNION,
  types: TypeName[],
  // directives?: DirectiveTuple[],
];
const enum UnionKeys {
  types = 1,
}

export type EnumTypeDefinitionTuple = [
  kind: TypeKind.ENUM,
  values: string[],
  // directives?: DirectiveTuple[],
];
const enum EnumKeys {
  values = 1,
}

export type InputObjectTypeDefinitionTuple = [
  kind: TypeKind.INPUT,
  fields: InputValueDefinitionRecord,
  // directives?: DirectiveTuple[],
];
const enum InputObjectKeys {
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
const enum FieldKeys {
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
const enum InputValueKeys {
  type = 0,
  defaultValue = 1,
}
export type InputValueDefinition = TypeReference | InputValueDefinitionTuple;
export type InputValueDefinitionRecord = Record<string, InputValueDefinition>;

const DirectiveLocation = {
  QUERY: 0,
  MUTATION: 1,
  SUBSCRIPTION: 2,
  FIELD: 3,
  FRAGMENT_DEFINITION: 4,
  FRAGMENT_SPREAD: 5,
  INLINE_FRAGMENT: 6,
  VARIABLE_DEFINITION: 7,
  /** Type System Definitions */
  SCHEMA: 8,
  SCALAR: 9,
  OBJECT: 10,
  FIELD_DEFINITION: 11,
  ARGUMENT_DEFINITION: 12,
  INTERFACE: 13,
  UNION: 14,
  ENUM: 15,
  ENUM_VALUE: 16,
  INPUT_OBJECT: 17,
  INPUT_FIELD_DEFINITION: 18,
} as const;
type DirectiveLocation =
  (typeof DirectiveLocation)[keyof typeof DirectiveLocation];
const DirectiveLocationToGraphQL = {
  0: GraphQLDirectiveLocation.QUERY,
  1: GraphQLDirectiveLocation.MUTATION,
  2: GraphQLDirectiveLocation.SUBSCRIPTION,
  3: GraphQLDirectiveLocation.FIELD,
  4: GraphQLDirectiveLocation.FRAGMENT_DEFINITION,
  5: GraphQLDirectiveLocation.FRAGMENT_SPREAD,
  6: GraphQLDirectiveLocation.INLINE_FRAGMENT,
  7: GraphQLDirectiveLocation.VARIABLE_DEFINITION,
  /** Type System Definitions */
  8: GraphQLDirectiveLocation.SCHEMA,
  9: GraphQLDirectiveLocation.SCALAR,
  10: GraphQLDirectiveLocation.OBJECT,
  11: GraphQLDirectiveLocation.FIELD_DEFINITION,
  12: GraphQLDirectiveLocation.ARGUMENT_DEFINITION,
  13: GraphQLDirectiveLocation.INTERFACE,
  14: GraphQLDirectiveLocation.UNION,
  15: GraphQLDirectiveLocation.ENUM,
  16: GraphQLDirectiveLocation.ENUM_VALUE,
  17: GraphQLDirectiveLocation.INPUT_OBJECT,
  18: GraphQLDirectiveLocation.INPUT_FIELD_DEFINITION,
} as const;

export type DirectiveName = string;
export type DirectiveTuple = [
  name: DirectiveName,
  arguments?: Record<string, unknown>, // JS values (cannot be a variable inside schema definition, so it is fine)
];
export type DirectiveDefinitionTuple = [
  name: DirectiveName,
  arguments: InputValueDefinitionRecord,
  locations: DirectiveLocation[],
];

const enum DirectiveKeys {
  name = 0,
  arguments = 1,
  locations = 2,
}

export type TypeDefinitionsRecord = Record<TypeName, TypeDefinitionTuple>;
export type InterfaceImplementationsRecord = Record<TypeName, TypeName[]>;

export type OperationTypes = {
  query?: TypeName;
  mutation?: TypeName;
  subscription?: TypeName;
};

export type SchemaDefinitions = {
  types: TypeDefinitionsRecord;
  directives?: DirectiveDefinitionTuple[];
  // implementations?: InterfaceImplementationsRecord; // TODO?
};

const typeNameMetaFieldDef: FieldDefinition = "String";
const specifiedScalarDefinition: ScalarTypeDefinitionTuple = [TypeKind.SCALAR];

export function findObjectType(
  defs: SchemaDefinitions,
  typeName: TypeName,
): ObjectTypeDefinitionTuple | undefined {
  const type = defs.types[typeName];
  return type?.[0] === TypeKind.OBJECT ? type : undefined;
}

export function getObjectFields(
  def: ObjectTypeDefinitionTuple,
): FieldDefinitionRecord {
  return def[ObjectKeys.fields];
}

export function addInterfaceImplementation(
  defs: SchemaDefinitions,
  interfaceType: TypeName,
  objectType: TypeName,
) {
  const iface = getInterfaceType(defs, interfaceType);
  const type = defs.types[objectType];

  if (!iface) {
    throw new Error(
      `Type ${interfaceType} either doesn't exist or is not an interface`,
    );
  }
  if (type && !isObjectTypeDefinition(type)) {
    throw new Error(`Type ${objectType} is not an object type`);
  }
  if (!type) {
    defs.types[objectType] = [
      TypeKind.OBJECT,
      Object.create(null),
      [interfaceType],
    ];
    return;
  }
  let knownInterfaces = type[ObjectKeys.interfaces];
  if (!knownInterfaces) {
    knownInterfaces = [];
    type[ObjectKeys.interfaces] = knownInterfaces;
  }
  if (!knownInterfaces.includes(interfaceType)) {
    knownInterfaces.push(interfaceType);
  }
}

export function getField(
  defs: SchemaDefinitions,
  typeName: TypeName,
  fieldName: string,
) {
  if (fieldName === "__typename") {
    return typeNameMetaFieldDef;
  }
  return (
    getOwnField(defs, typeName, fieldName) ??
    findInterfaceField(defs, typeName, fieldName)
  );
}

function getOwnField(
  defs: SchemaDefinitions,
  typeName: TypeName,
  fieldName: string,
): FieldDefinition | undefined {
  const type = defs.types[typeName];
  if (!type) {
    return undefined;
  }
  if (type[0] === TypeKind.OBJECT) {
    return type[ObjectKeys.fields]?.[fieldName];
  }
  if (type[0] === TypeKind.INTERFACE) {
    return type[InterfaceKeys.fields]?.[fieldName];
  }
  return undefined;
}

function findInterfaceField(
  defs: SchemaDefinitions,
  typeName: TypeName,
  fieldName: string,
) {
  const type = defs.types[typeName];
  if (!type) {
    return undefined;
  }
  if (type[0] === TypeKind.OBJECT && type[ObjectKeys.interfaces]) {
    return findField(defs, type[ObjectKeys.interfaces], fieldName);
  }
  if (type[0] === TypeKind.INTERFACE && type[InterfaceKeys.interfaces]) {
    return findField(defs, type[InterfaceKeys.interfaces], fieldName);
  }
  return undefined;
}

function findField(
  defs: SchemaDefinitions,
  interfaceTypes: TypeName[],
  fieldName: string,
) {
  // TODO: merge field definition from all interface types to ensure all necessary arguments are present
  //   (or maybe instead always encode all arguments in the schema fragment for simplicity?)
  for (const interfaceName of interfaceTypes) {
    const ownField = getOwnField(defs, interfaceName, fieldName);
    if (ownField !== undefined) {
      return ownField;
    }
  }
  return undefined;
}

export function getInputObjectType(
  defs: SchemaDefinitions,
  typeRef: TypeReference,
): InputObjectTypeDefinitionTuple | undefined {
  const type = defs.types[typeNameFromReference(typeRef)];
  return type?.[0] === TypeKind.INPUT ? type : undefined;
}

export function getLeafType(
  defs: SchemaDefinitions,
  typeRef: TypeReference,
): EnumTypeDefinitionTuple | ScalarTypeDefinitionTuple | undefined {
  const typeName = typeNameFromReference(typeRef);

  if (isSpecifiedScalarType(typeName)) {
    return specifiedScalarDefinition;
  }
  const type = defs.types[typeName];
  if (type?.[0] !== TypeKind.ENUM && type?.[0] !== TypeKind.SCALAR) {
    return undefined;
  }
  return type;
}

export function isDefined(
  defs: SchemaDefinitions,
  typeRef: TypeReference,
): boolean {
  if (typeof typeRef === "number") {
    // Fast-path: spec type
    return true;
  }
  const types = defs.types;
  const typeName = typeNameFromReference(typeRef);
  return !!types[typeName] || isSpecifiedScalarType(typeName);
}

export function isInputType(
  defs: SchemaDefinitions,
  typeRef: TypeReference,
): boolean {
  if (typeof typeRef === "number") {
    // Fast-path: all spec types are input types
    return true;
  }
  const typeName = typeNameFromReference(typeRef);
  const kind = defs.types[typeName]?.[0];
  return (
    isSpecifiedScalarType(typeName) ||
    kind === TypeKind.ENUM ||
    kind === TypeKind.INPUT ||
    kind === TypeKind.SCALAR
  );
}

export function isObjectType(
  defs: SchemaDefinitions,
  typeRef: TypeReference,
): boolean {
  if (typeof typeRef === "number") {
    // Fast-path: all spec types are scalars
    return false;
  }
  const types = defs.types;
  const type = types[typeRef] ?? types[typeNameFromReference(typeRef)];
  return type?.[0] === TypeKind.OBJECT;
}

export function isAbstractType(
  defs: SchemaDefinitions,
  typeRef: TypeReference,
): boolean {
  if (typeof typeRef === "number") {
    // Fast-path: all spec types are scalars
    return false;
  }
  const type =
    defs.types[typeRef] ?? defs.types[typeNameFromReference(typeRef)];
  return type?.[0] === TypeKind.UNION || type?.[0] === TypeKind.INTERFACE;
}

export function getUnionType(
  defs: SchemaDefinitions,
  typeRef: TypeReference,
): UnionTypeDefinitionTuple | undefined {
  const types = defs.types;
  const type = types[typeRef] ?? types[typeNameFromReference(typeRef)];
  return type?.[0] === TypeKind.UNION ? type : undefined;
}

export function getInterfaceType(
  defs: SchemaDefinitions,
  typeRef: TypeReference,
): InterfaceTypeDefinitionTuple | undefined {
  const types = defs.types;
  const type = types[typeRef] ?? types[typeNameFromReference(typeRef)];
  return type?.[0] === TypeKind.INTERFACE ? type : undefined;
}

export function isSubType(
  defs: SchemaDefinitions,
  abstractTypeName: TypeName,
  maybeSubTypeName: TypeName,
): boolean {
  const union = getUnionType(defs, abstractTypeName);
  if (union) {
    return union[UnionKeys.types].includes(maybeSubTypeName);
  }
  const object = findObjectType(defs, maybeSubTypeName);
  if (object) {
    return !!object[ObjectKeys.interfaces]?.includes(abstractTypeName);
  }
  const iface = getInterfaceType(defs, maybeSubTypeName);
  if (iface) {
    return !!iface[InterfaceKeys.interfaces]?.includes(abstractTypeName);
  }
  return false;
}

export function getDirectiveName(tuple: DirectiveDefinitionTuple): string {
  return tuple[DirectiveKeys.name];
}

export function getDirectiveLocations(
  tuple: DirectiveDefinitionTuple,
): DirectiveLocation[] {
  return tuple[DirectiveKeys.locations];
}

export function encodeDirectiveLocation(
  location: DirectiveLocationEnum,
): DirectiveLocation {
  return DirectiveLocation[location];
}
export function decodeDirectiveLocation(
  location: DirectiveLocation,
): DirectiveLocationEnum {
  return DirectiveLocationToGraphQL[location];
}

export function isObjectTypeDefinition(
  type: TypeDefinitionTuple,
): type is ObjectTypeDefinitionTuple {
  return type[0] === TypeKind.OBJECT;
}

export function isUnionTypeDefinition(
  type: TypeDefinitionTuple,
): type is UnionTypeDefinitionTuple {
  return type[0] === TypeKind.UNION;
}

export function isInterfaceTypeDefinition(
  type: TypeDefinitionTuple,
): type is InterfaceTypeDefinitionTuple {
  return type[0] === TypeKind.INTERFACE;
}

export function isEnumTypeDefinition(
  type: TypeDefinitionTuple,
): type is EnumTypeDefinitionTuple {
  return type[0] === TypeKind.ENUM;
}

export function isScalarTypeDefinition(
  type: TypeDefinitionTuple,
): type is ScalarTypeDefinitionTuple {
  return type[0] === TypeKind.SCALAR;
}

export function isInputObjectTypeDefinition(
  type: TypeDefinitionTuple,
): type is InputObjectTypeDefinitionTuple {
  return type[0] === TypeKind.INPUT;
}

export function getInputValueTypeReference(
  inputValue: InputValueDefinition,
): TypeReference {
  return Array.isArray(inputValue)
    ? inputValue[InputValueKeys.type]
    : inputValue;
}

export function getInputObjectFields(
  obj: InputObjectTypeDefinitionTuple,
): InputValueDefinitionRecord {
  return obj[InputObjectKeys.fields];
}

export function getInputDefaultValue(
  inputValue: InputValueDefinition,
): unknown | undefined {
  return Array.isArray(inputValue)
    ? inputValue[InputValueKeys.defaultValue]
    : undefined;
}

export function getFields(
  def: ObjectTypeDefinitionTuple | InterfaceTypeDefinitionTuple,
): FieldDefinitionRecord {
  return def[0] === TypeKind.OBJECT
    ? def[ObjectKeys.fields]
    : def[InterfaceKeys.fields];
}

export function getFieldTypeReference(field: FieldDefinition): TypeReference {
  return Array.isArray(field) ? field[FieldKeys.type] : field;
}

export function getFieldArgs(
  field: FieldDefinition,
): InputValueDefinitionRecord | undefined {
  return Array.isArray(field) ? field[FieldKeys.arguments] : undefined;
}

export function setFieldArgs(
  field: FieldDefinitionTuple,
  args: InputValueDefinitionRecord,
): InputValueDefinitionRecord {
  field[FieldKeys.arguments] = args;
  return args;
}

export function getEnumValues(tuple: EnumTypeDefinitionTuple): string[] {
  return tuple[EnumKeys.values];
}

export function getDirectiveDefinitionArgs(
  directive: DirectiveDefinitionTuple,
): InputValueDefinitionRecord | undefined {
  return directive[DirectiveKeys.arguments];
}

export function setDirectiveDefinitionArgs(
  directive: DirectiveDefinitionTuple,
  args: InputValueDefinitionRecord,
): InputValueDefinitionRecord {
  directive[DirectiveKeys.arguments] = args;
  return args;
}

export function createUnionTypeDefinition(
  types: TypeName[],
): UnionTypeDefinitionTuple {
  return [TypeKind.UNION, types];
}

export function createInterfaceTypeDefinition(
  fields: FieldDefinitionRecord,
  interfaces?: TypeName[],
): InterfaceTypeDefinitionTuple {
  return interfaces?.length
    ? [TypeKind.INTERFACE, fields, interfaces]
    : [TypeKind.INTERFACE, fields];
}

export function createObjectTypeDefinition(
  fields: FieldDefinitionRecord,
  interfaces?: TypeName[],
): ObjectTypeDefinitionTuple {
  return interfaces?.length
    ? [TypeKind.OBJECT, fields, interfaces]
    : [TypeKind.OBJECT, fields];
}

export function createInputObjectTypeDefinition(
  fields: InputValueDefinitionRecord,
): InputObjectTypeDefinitionTuple {
  return [TypeKind.INPUT, fields];
}

export function createEnumTypeDefinition(
  values: string[],
): EnumTypeDefinitionTuple {
  return [TypeKind.ENUM, values];
}

export function createScalarTypeDefinition(): ScalarTypeDefinitionTuple {
  return [TypeKind.SCALAR];
}

export function getObjectTypeInterfaces(
  def: ObjectTypeDefinitionTuple,
): TypeName[] {
  return def[ObjectKeys.interfaces] ?? [];
}

export function getInterfaceTypeInterfaces(
  def: InterfaceTypeDefinitionTuple,
): TypeName[] {
  return def[InterfaceKeys.interfaces] ?? [];
}

export function getUnionTypeMembers(
  tuple: UnionTypeDefinitionTuple,
): TypeName[] {
  return tuple[UnionKeys.types];
}

export function getDefinitionArguments(
  def: FieldDefinition | DirectiveDefinitionTuple,
): InputValueDefinitionRecord | undefined {
  // Note: both FieldDefinition and DirectiveDefinition store arguments at the same position
  return Array.isArray(def) ? def[FieldKeys.arguments] : undefined;
}
