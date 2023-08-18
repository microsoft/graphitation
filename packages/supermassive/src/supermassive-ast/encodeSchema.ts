import { TypeNode } from "./TypedAST";
import { Kind, parseType } from "graphql";

export type TypeIndex = number;

type InputValueDefinitionTuple = [
  type: TypeIndex,
  defaultValue?: unknown,
  directives?: DirectiveTuple[],
];

type InputValueDefinitionRecord = Record<string, InputValueDefinitionTuple>;

export type DirectiveTuple = [
  name: string,
  arguments?: InputValueDefinitionRecord,
];

type FieldDefinitionTuple = [
  type: TypeIndex,
  arguments?: InputValueDefinitionRecord,
  directives?: DirectiveTuple[],
];

export type FieldDefinitionRecord = Record<string, FieldDefinitionTuple>;

export type WrappingTypeTuple = [
  // lists | non-nulls
  kind: 0,
  name: string,
];

export type ScalarTypeDefinitionTuple = [
  kind: 1,
  name: string,
  directives?: DirectiveTuple[],
];

export type ObjectTypeDefinitionTuple = [
  kind: 2,
  name: string,
  fields: FieldDefinitionRecord,
  interfaces?: TypeIndex[],
  directives?: DirectiveTuple[],
];

export type InterfaceTypeDefinitionTuple = [
  kind: 3,
  name: string,
  fields: FieldDefinitionRecord,
  interfaces?: TypeIndex[],
  directives?: DirectiveTuple[],
];

export type UnionTypeDefinitionTuple = [
  kind: 4,
  name: string,
  types: TypeIndex[],
  directives?: DirectiveTuple[],
];

export type EnumTypeDefinitionTuple = [
  kind: 5,
  name: string,
  values?: string[],
  directives?: DirectiveTuple[],
];

export type InputObjectTypeDefinitionTuple = [
  kind: 6,
  name: string,
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

export type EncodedType = TypeDefinitionTuple | WrappingTypeTuple;

export type ComplexType =
  | ObjectTypeDefinitionTuple
  | InterfaceTypeDefinitionTuple
  | UnionTypeDefinitionTuple;

export type EncodedSchema = {
  types: EncodedType[];
};

const TypeKind = {
  WRAPPER: 0,
  SCALAR: 1,
  OBJECT: 2,
  INTERFACE: 3,
  UNION: 4,
  ENUM: 5,
  INPUT: 6,
} as const;

const TypeKeys = { kind: 0, name: 1 } as const;
const ObjectKeys = { fields: 2 } as const;
const InputObjectKeys = { fields: 2 } as const;
const FieldKeys = { type: 0 } as const;
const InputValueKeys = { type: 0 } as const;

// TODO: move to a separate type file (as this may have multiple implementations)
export type SchemaFacade = {
  returnTypeNode: (
    parentTypeName: string,
    fieldName: string,
  ) => TypeNode | undefined;
};

export function createSchemaFacade(schema: EncodedSchema): SchemaFacade {
  const parseOptions = { noLocation: true };

  return {
    returnTypeNode(parentTypeName, fieldName) {
      const parentType = schema.types.find(
        (type: EncodedType) => type[1] === parentTypeName,
      );
      if (!parentType) {
        return undefined;
      }
      let field;
      let returnTypeIndex = -1;
      if (
        parentType[0] === TypeKind.OBJECT ||
        parentType[0] === TypeKind.INTERFACE
      ) {
        field = parentType[ObjectKeys.fields]?.[fieldName];
        returnTypeIndex = field?.[FieldKeys.type] ?? -1;
      } else if (parentType[0] === TypeKind.INPUT) {
        field = parentType[InputObjectKeys.fields]?.[fieldName];
        returnTypeIndex = field?.[InputValueKeys.type] ?? -1;
      }
      const returnType = schema.types[returnTypeIndex];

      if (returnType?.[0] === TypeKind.WRAPPER) {
        return parseType(returnType[1], parseOptions);
      }
      return returnType
        ? {
            kind: Kind.NAMED_TYPE,
            name: { kind: Kind.NAME, value: returnType[TypeKeys.name] },
          }
        : undefined;
    },
  };
}
