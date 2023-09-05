import {
  DirectiveDefinitionNode,
  EnumTypeDefinitionNode,
  FieldDefinitionNode,
  InputObjectTypeDefinitionNode,
  InputValueDefinitionNode,
  InterfaceTypeDefinitionNode,
  ObjectTypeDefinitionNode,
  ScalarTypeDefinitionNode,
  UnionTypeDefinitionNode,
  DocumentNode,
  ObjectTypeExtensionNode,
  InputObjectTypeExtensionNode,
  InterfaceTypeExtensionNode,
  UnionTypeExtensionNode,
  EnumTypeExtensionNode,
  ScalarTypeExtensionNode,
} from "graphql";
import {
  DirectiveDefinitionTuple,
  EnumTypeDefinitionTuple,
  FieldDefinitionTuple,
  InputObjectTypeDefinitionTuple,
  InputValueDefinitionRecord,
  InputValueDefinitionTuple,
  InterfaceTypeDefinitionTuple,
  ObjectTypeDefinitionTuple,
  ScalarTypeDefinitionTuple,
  UnionTypeDefinitionTuple,
  SchemaFragmentDefinitions,
  TypeKind,
  TypeReference,
  TypeDefinitionsRecord,
} from "../schema/definition";
import { typeReferenceFromNode } from "../schema/reference";
import { valueFromASTUntyped } from "./valueFromASTUntyped";

export function encodeASTSchema(
  schemaFragment: DocumentNode,
): SchemaFragmentDefinitions & { extensions?: TypeDefinitionsRecord } {
  const types = Object.create(null);
  const extensions = Object.create(null);
  const directives = [];
  for (const definition of schemaFragment.definitions) {
    if (definition.kind === "ObjectTypeDefinition") {
      types[definition.name.value] = encodeObjectType(definition);
    } else if (definition.kind === "InputObjectTypeDefinition") {
      types[definition.name.value] = encodeInputObjectType(definition);
    } else if (definition.kind === "EnumTypeDefinition") {
      types[definition.name.value] = encodeEnumType(definition);
    } else if (definition.kind === "UnionTypeDefinition") {
      types[definition.name.value] = encodeUnionType(definition);
    } else if (definition.kind === "InterfaceTypeDefinition") {
      types[definition.name.value] = encodeInterfaceType(definition);
    } else if (definition.kind === "ScalarTypeDefinition") {
      types[definition.name.value] = encodeScalarType(definition);
    } else if (definition.kind === "ObjectTypeExtension") {
      extensions[definition.name.value] = encodeObjectType(definition);
    } else if (definition.kind === "InputObjectTypeExtension") {
      extensions[definition.name.value] = encodeInputObjectType(definition);
    } else if (definition.kind === "EnumTypeExtension") {
      extensions[definition.name.value] = encodeEnumType(definition);
    } else if (definition.kind === "UnionTypeExtension") {
      extensions[definition.name.value] = encodeUnionType(definition);
    } else if (definition.kind === "InterfaceTypeExtension") {
      extensions[definition.name.value] = encodeInterfaceType(definition);
    } else if (definition.kind === "ScalarTypeExtension") {
      extensions[definition.name.value] = encodeScalarType(definition);
    } else if (definition.kind === "DirectiveDefinition") {
      directives.push(encodeDirective(definition));
    }
  }
  return { types, extensions, directives };
}

function encodeScalarType(
  _type: ScalarTypeDefinitionNode | ScalarTypeExtensionNode,
): ScalarTypeDefinitionTuple {
  return [TypeKind.SCALAR];
}

function encodeEnumType(
  node: EnumTypeDefinitionNode | EnumTypeExtensionNode,
): EnumTypeDefinitionTuple {
  return [TypeKind.ENUM, (node.values ?? []).map((value) => value.name.value)];
}

function encodeObjectType(
  node: ObjectTypeDefinitionNode | ObjectTypeExtensionNode,
): ObjectTypeDefinitionTuple {
  const fields = Object.create(null);
  for (const field of node.fields ?? []) {
    fields[field.name.value] = encodeField(field);
  }
  if (!node.interfaces) {
    return [TypeKind.OBJECT, fields];
  }
  return [
    TypeKind.OBJECT,
    fields,
    node.interfaces.map((iface) => iface.name.value),
  ];
}

function encodeInterfaceType(
  node: InterfaceTypeDefinitionNode | InterfaceTypeExtensionNode,
): InterfaceTypeDefinitionTuple {
  const fields = Object.create(null);
  for (const field of node.fields ?? []) {
    fields[field.name.value] = encodeField(field);
  }
  if (!node.interfaces) {
    return [TypeKind.INTERFACE, fields];
  }
  return [
    TypeKind.INTERFACE,
    fields,
    node.interfaces.map((iface) => iface.name.value),
  ];
}

function encodeUnionType(
  node: UnionTypeDefinitionNode | UnionTypeExtensionNode,
): UnionTypeDefinitionTuple {
  return [TypeKind.UNION, (node.types ?? []).map((type) => type.name.value)];
}

function encodeInputObjectType(
  node: InputObjectTypeDefinitionNode | InputObjectTypeExtensionNode,
): InputObjectTypeDefinitionTuple {
  const fields = Object.create(null);
  for (const field of node.fields ?? []) {
    fields[field.name.value] = encodeInputValue(field);
  }
  return [TypeKind.INPUT, fields];
}

function encodeField(
  node: FieldDefinitionNode,
): TypeReference | FieldDefinitionTuple {
  return !node.arguments?.length
    ? typeReferenceFromNode(node.type)
    : [typeReferenceFromNode(node.type), encodeArguments(node)];
}

function encodeArguments(
  node: FieldDefinitionNode | DirectiveDefinitionNode,
): InputValueDefinitionRecord {
  const args = Object.create(null);
  for (const argument of node.arguments ?? []) {
    args[argument.name.value] = encodeInputValue(argument);
  }
  return args;
}

function encodeInputValue(
  node: InputValueDefinitionNode,
): InputValueDefinitionTuple | TypeReference {
  if (!node.defaultValue) {
    return typeReferenceFromNode(node.type);
  }
  return [
    typeReferenceFromNode(node.type),
    valueFromASTUntyped(node.defaultValue),
  ];
}

function encodeDirective(
  node: DirectiveDefinitionNode,
): DirectiveDefinitionTuple {
  return !node.arguments?.length
    ? [node.name.value]
    : [node.name.value, encodeArguments(node)];
}
