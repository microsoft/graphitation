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
  DirectiveKeys,
  SchemaFragmentDefinitions,
  EnumKeys,
  EnumTypeDefinitionTuple,
  FieldDefinition,
  FieldKeys,
  InputObjectKeys,
  InputObjectTypeDefinitionTuple,
  InputValueDefinition,
  InputValueKeys,
  InterfaceKeys,
  InterfaceTypeDefinitionTuple,
  ObjectKeys,
  ObjectTypeDefinitionTuple,
  TypeDefinitionsRecord,
  TypeKind,
  TypeReference,
  UnionKeys,
  UnionTypeDefinitionTuple,
} from "../schema/definition";
import {
  inspectTypeReference,
  isListType,
  isNonNullType,
  typeNameFromReference,
  unwrap,
} from "../schema/reference";
import { invariant } from "../jsutils/invariant";
import { ConstValueNode } from "graphql/language/ast";
import { inspect } from "../jsutils/inspect";

/**
 * Converts encoded schema to standard AST representation of the same schema
 */
export function decodeSchema(
  encodedSchemaFragments: SchemaFragmentDefinitions[],
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
    switch (tuple[0]) {
      case TypeKind.SCALAR:
        definitions.push(decodeScalarType(typeName));
        break;
      case TypeKind.ENUM:
        definitions.push(decodeEnumType(typeName, tuple));
        break;
      case TypeKind.OBJECT:
        definitions.push(decodeObjectType(typeName, tuple, types));
        break;
      case TypeKind.INTERFACE:
        definitions.push(decodeInterfaceType(typeName, tuple, types));
        break;
      case TypeKind.UNION:
        definitions.push(decodeUnionType(typeName, tuple));
        break;
      case TypeKind.INPUT:
        definitions.push(decodeInputObjectType(typeName, tuple, types));
        break;
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
    values: tuple[EnumKeys.values].map((value) => ({
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
    fields: decodeFields(tuple[ObjectKeys.fields], types),
    interfaces: (tuple[ObjectKeys.interfaces] || []).map((name) => ({
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
    fields: decodeFields(tuple[InterfaceKeys.fields], types),
    interfaces: (tuple[InterfaceKeys.interfaces] || []).map((name) => ({
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
    types: tuple[UnionKeys.types].map((name) => ({
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
    fields: Object.entries(tuple[InputObjectKeys.fields]).map(([name, value]) =>
      decodeInputValue(name, value, types),
    ),
  };
}

function decodeFields(
  fields: Record<string, FieldDefinition>,
  types: TypeDefinitionsRecord,
): FieldDefinitionNode[] {
  return Object.entries(fields).map(([name, value]) => {
    const type = Array.isArray(value)
      ? decodeTypeReference(value[FieldKeys.type])
      : decodeTypeReference(value);
    return {
      kind: Kind.FIELD_DEFINITION,
      name: nameNode(name),
      type,
      arguments: decodeArguments(
        Array.isArray(value) ? value[FieldKeys.arguments] ?? {} : {},
        types,
      ),
    };
  });
}

function decodeInputValue(
  name: string,
  value: InputValueDefinition,
  types: TypeDefinitionsRecord,
): InputValueDefinitionNode {
  const type = Array.isArray(value)
    ? decodeTypeReference(value[InputValueKeys.type])
    : decodeTypeReference(value);

  return {
    kind: Kind.INPUT_VALUE_DEFINITION,
    name: nameNode(name),
    type,
    defaultValue: Array.isArray(value)
      ? valueToConstValueNode(
          value[InputValueKeys.defaultValue],
          value[InputValueKeys.type],
          types,
        )
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
      Array.isArray(typeDef) && typeDef[0] === TypeKind.INPUT,
      `Expecting input object type for ${typeName}, got ${typeDef?.[0]}`,
    );
    const fields = typeDef[InputObjectKeys.fields];
    return {
      kind: Kind.OBJECT,
      fields: Object.entries(jsValue).map(([name, value]) => {
        const fieldDef = fields[name];
        const fieldTypeRef = Array.isArray(fieldDef)
          ? fieldDef[FieldKeys.type]
          : fieldDef;
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
  const name = tuple[DirectiveKeys.name];
  const args = tuple[DirectiveKeys.arguments]
    ? decodeArguments(tuple[DirectiveKeys.arguments], types)
    : [];
  return {
    kind: Kind.DIRECTIVE_DEFINITION,
    name: nameNode(name),
    arguments: args,
    // TODO? locations and repeatable are irrelevant for execution
    repeatable: false,
    locations: [],
  };
}
