import {
  DirectiveDefinitionNode,
  DocumentNode,
  EnumTypeDefinitionNode,
  FieldDefinitionNode,
  InputObjectTypeDefinitionNode,
  InputValueDefinitionNode,
  InterfaceTypeDefinitionNode,
  Kind,
  ListTypeNode,
  NamedTypeNode,
  NameNode,
  NonNullTypeNode,
  ObjectTypeDefinitionNode,
  ScalarTypeDefinitionNode,
  UnionTypeDefinitionNode,
} from "graphql";
import {
  DirectiveDefinitionTuple,
  SchemaDefinitions,
  EnumTypeDefinitionTuple,
  FieldDefinition,
  InputObjectTypeDefinitionTuple,
  InputValueDefinition,
  InterfaceTypeDefinitionTuple,
  ObjectTypeDefinitionTuple,
  TypeDefinitionsRecord,
  UnionTypeDefinitionTuple,
  isScalarTypeDefinition,
  isEnumTypeDefinition,
  isObjectTypeDefinition,
  isInterfaceTypeDefinition,
  isUnionTypeDefinition,
  isInputObjectTypeDefinition,
  getEnumValues,
  getObjectFields,
  getObjectTypeInterfaces,
  getFields,
  getInterfaceTypeInterfaces,
  getUnionTypeMembers,
  getInputObjectFields,
  getFieldTypeReference,
  getFieldArgs,
  getInputValueTypeReference,
  getInputDefaultValue,
  getDirectiveName,
  getDirectiveDefinitionArgs,
  getDirectiveLocations,
  decodeDirectiveLocation,
} from "../schema/definition";
import {
  inspectTypeReference,
  isListType,
  isNonNullType,
  typeNameFromReference,
  TypeReference,
  unwrap,
} from "../schema/reference";
import { invariant } from "../jsutils/invariant";
import { ValueNode as ConstValueNode } from "graphql/language/ast"; // TODO: use ConstValueNode in graphql@17
import { inspect } from "../jsutils/inspect";

/**
 * Converts encoded schema to standard AST representation of the same schema
 */
export function decodeASTSchema(
  encodedSchemaFragments: SchemaDefinitions[],
): DocumentNode {
  if (encodedSchemaFragments.length !== 1) {
    // TODO:
    throw new Error("decodeSchema does not support decoding extensions yet");
  }
  const definitions = [];
  const types = encodedSchemaFragments[0].types;
  const directives = encodedSchemaFragments[0].directives;

  for (const typeName in types) {
    const tuple = types[typeName];
    if (isScalarTypeDefinition(tuple)) {
      definitions.push(decodeScalarType(typeName));
    } else if (isEnumTypeDefinition(tuple)) {
      definitions.push(decodeEnumType(typeName, tuple));
    } else if (isObjectTypeDefinition(tuple)) {
      definitions.push(decodeObjectType(typeName, tuple, types));
    } else if (isInterfaceTypeDefinition(tuple)) {
      definitions.push(decodeInterfaceType(typeName, tuple, types));
    } else if (isUnionTypeDefinition(tuple)) {
      definitions.push(decodeUnionType(typeName, tuple));
    } else if (isInputObjectTypeDefinition(tuple)) {
      definitions.push(decodeInputObjectType(typeName, tuple, types));
    }
  }

  for (const directive of directives ?? []) {
    definitions.push(decodeDirective(directive, types));
  }

  return { kind: Kind.DOCUMENT, definitions };
}

function nameNode(value: string): NameNode {
  return { kind: Kind.NAME, value };
}

function decodeScalarType(typeName: string): ScalarTypeDefinitionNode {
  return {
    kind: Kind.SCALAR_TYPE_DEFINITION,
    name: nameNode(typeName),
  };
}

function decodeEnumType(
  typeName: string,
  tuple: EnumTypeDefinitionTuple,
): EnumTypeDefinitionNode {
  return {
    kind: Kind.ENUM_TYPE_DEFINITION,
    name: nameNode(typeName),
    values: getEnumValues(tuple).map((value) => ({
      kind: Kind.ENUM_VALUE_DEFINITION,
      name: nameNode(value),
    })),
  };
}

function decodeObjectType(
  typeName: string,
  tuple: ObjectTypeDefinitionTuple,
  types: TypeDefinitionsRecord,
): ObjectTypeDefinitionNode {
  return {
    kind: Kind.OBJECT_TYPE_DEFINITION,
    name: nameNode(typeName),
    fields: decodeFields(getObjectFields(tuple) ?? {}, types),
    interfaces: getObjectTypeInterfaces(tuple).map((name) => ({
      kind: Kind.NAMED_TYPE,
      name: nameNode(name),
    })),
  };
}

function decodeInterfaceType(
  typeName: string,
  tuple: InterfaceTypeDefinitionTuple,
  types: TypeDefinitionsRecord,
): InterfaceTypeDefinitionNode {
  return {
    kind: Kind.INTERFACE_TYPE_DEFINITION,
    name: nameNode(typeName),
    fields: decodeFields(getFields(tuple), types),
    interfaces: getInterfaceTypeInterfaces(tuple).map((name) => ({
      kind: Kind.NAMED_TYPE,
      name: nameNode(name),
    })),
  };
}

function decodeUnionType(
  typeName: string,
  tuple: UnionTypeDefinitionTuple,
): UnionTypeDefinitionNode {
  return {
    kind: Kind.UNION_TYPE_DEFINITION,
    name: nameNode(typeName),
    types: getUnionTypeMembers(tuple).map((name) => ({
      kind: Kind.NAMED_TYPE,
      name: nameNode(name),
    })),
  };
}

function decodeInputObjectType(
  typeName: string,
  tuple: InputObjectTypeDefinitionTuple,
  types: TypeDefinitionsRecord,
): InputObjectTypeDefinitionNode {
  return {
    kind: Kind.INPUT_OBJECT_TYPE_DEFINITION,
    name: nameNode(typeName),
    fields: Object.entries(getInputObjectFields(tuple)).map(([name, value]) =>
      decodeInputValue(name, value, types),
    ),
  };
}

function decodeFields(
  fields: Record<string, FieldDefinition>,
  types: TypeDefinitionsRecord,
): FieldDefinitionNode[] {
  return Object.entries(fields).map(([name, value]) => {
    const type = decodeTypeReference(getFieldTypeReference(value));
    return {
      kind: Kind.FIELD_DEFINITION,
      name: nameNode(name),
      type,
      arguments: decodeArguments(getFieldArgs(value) ?? {}, types),
    };
  });
}

function decodeInputValue(
  name: string,
  value: InputValueDefinition,
  types: TypeDefinitionsRecord,
): InputValueDefinitionNode {
  const inputValueTypeRef = getInputValueTypeReference(value);
  const type = decodeTypeReference(inputValueTypeRef);
  return {
    kind: Kind.INPUT_VALUE_DEFINITION,
    name: nameNode(name),
    type,
    defaultValue: Array.isArray(value)
      ? (valueToConstValueNode(
          getInputDefaultValue(value),
          inputValueTypeRef,
          types,
        ) as any) // Note: "any" is necessary here for graphql15/graphql17 cross-compatibility
      : undefined,
  };
}

function valueToConstValueNode(
  jsValue: unknown,
  typeRef: TypeReference,
  types: TypeDefinitionsRecord,
): ConstValueNode {
  const typeName = typeNameFromReference(typeRef);
  if (typeof jsValue === "string") {
    return typeName === "String"
      ? { kind: Kind.STRING, value: jsValue }
      : { kind: Kind.ENUM, value: jsValue };
  }
  if (jsValue === null) {
    invariant(!isNonNullType(typeRef), "Expecting nullable type");
    return { kind: Kind.NULL };
  }
  if (Number.isInteger(jsValue)) {
    return { kind: Kind.INT, value: String(jsValue) };
  }
  if (typeof jsValue === "number") {
    return { kind: Kind.FLOAT, value: String(jsValue) };
  }
  if (Array.isArray(jsValue)) {
    invariant(isListType(typeRef), "Expecting list type");
    return {
      kind: Kind.LIST,
      values: jsValue.map((item) =>
        valueToConstValueNode(item, unwrap(typeRef), types),
      ),
    };
  }
  if (typeof jsValue === "object") {
    const typeDef = types[typeName];
    invariant(
      Array.isArray(typeDef) && isInputObjectTypeDefinition(typeDef),
      `Expecting input object type for ${typeName}, got ${typeDef?.[0]}`,
    );
    const fields = getInputObjectFields(typeDef);
    return {
      kind: Kind.OBJECT,
      fields: Object.entries(jsValue).map(([name, value]) => {
        const fieldDef = fields[name];
        const fieldTypeRef = getInputValueTypeReference(fieldDef);
        invariant(
          fieldTypeRef !== undefined,
          `Could not find field definition for ${typeName}.${name}`,
        );
        return {
          kind: Kind.OBJECT_FIELD,
          name: nameNode(name),
          value: valueToConstValueNode(value, fieldTypeRef, types),
        };
      }),
    };
  }
  invariant(
    false,
    `Unexpected value for type ${inspectTypeReference(typeRef)}: ${inspect(
      jsValue,
    )}`,
  );
}

function decodeArguments(
  args: Record<string, InputValueDefinition>,
  types: TypeDefinitionsRecord,
): InputValueDefinitionNode[] {
  return Object.entries(args).map(([name, value]) =>
    decodeInputValue(name, value, types),
  );
}

function decodeTypeReference(
  ref: TypeReference,
): NamedTypeNode | ListTypeNode | NonNullTypeNode {
  if (isListType(ref)) {
    return {
      kind: Kind.LIST_TYPE,
      type: decodeTypeReference(unwrap(ref)),
    };
  }
  if (isNonNullType(ref)) {
    const unwrappedType = decodeTypeReference(unwrap(ref));
    invariant(
      unwrappedType.kind !== Kind.NON_NULL_TYPE,
      "Non-null modifier cannot be nested",
    );
    return {
      kind: Kind.NON_NULL_TYPE,
      type: unwrappedType,
    };
  }
  return {
    kind: Kind.NAMED_TYPE,
    name: nameNode(typeNameFromReference(ref)),
  };
}

function decodeDirective(
  tuple: DirectiveDefinitionTuple,
  types: TypeDefinitionsRecord,
): DirectiveDefinitionNode {
  const name = getDirectiveName(tuple);
  const args = getDirectiveDefinitionArgs(tuple);
  const locations = getDirectiveLocations(tuple);
  return {
    kind: Kind.DIRECTIVE_DEFINITION,
    name: nameNode(name),
    arguments: args ? decodeArguments(args, types) : [],
    locations: locations.map((loc) => ({
      kind: Kind.NAME,
      value: decodeDirectiveLocation(loc),
    })),
    // TODO? repeatable are irrelevant for execution
    repeatable: false,
  };
}
