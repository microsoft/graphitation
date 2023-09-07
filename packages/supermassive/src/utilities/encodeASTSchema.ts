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
  TypeDefinitionTuple,
} from "../schema/definition";
import { typeReferenceFromNode } from "../schema/reference";
import { valueFromASTUntyped } from "./valueFromASTUntyped";

export function encodeASTSchema(
  schemaFragment: DocumentNode,
): SchemaFragmentDefinitions[] {
  const fragments: SchemaFragmentDefinitions[] = [{ types: {} }];
  const add = addTypeDefinition.bind(null, fragments);

  for (const definition of schemaFragment.definitions) {
    if (definition.kind === "ObjectTypeDefinition") {
      add(definition.name.value, encodeObjectType(definition));
    } else if (definition.kind === "InputObjectTypeDefinition") {
      add(definition.name.value, encodeInputObjectType(definition));
    } else if (definition.kind === "EnumTypeDefinition") {
      add(definition.name.value, encodeEnumType(definition));
    } else if (definition.kind === "UnionTypeDefinition") {
      add(definition.name.value, encodeUnionType(definition));
    } else if (definition.kind === "InterfaceTypeDefinition") {
      add(definition.name.value, encodeInterfaceType(definition));
    } else if (definition.kind === "ScalarTypeDefinition") {
      add(definition.name.value, encodeScalarType(definition));
    } else if (definition.kind === "ObjectTypeExtension") {
      add(definition.name.value, encodeObjectType(definition), true);
    } else if (definition.kind === "InputObjectTypeExtension") {
      add(definition.name.value, encodeInputObjectType(definition), true);
    } else if (definition.kind === "EnumTypeExtension") {
      add(definition.name.value, encodeEnumType(definition), true);
    } else if (definition.kind === "UnionTypeExtension") {
      add(definition.name.value, encodeUnionType(definition), true);
    } else if (definition.kind === "InterfaceTypeExtension") {
      add(definition.name.value, encodeInterfaceType(definition), true);
    } else if (definition.kind === "ScalarTypeExtension") {
      add(definition.name.value, encodeScalarType(definition), true);
    } else if (definition.kind === "DirectiveDefinition") {
      if (!fragments[0].directives) {
        fragments[0].directives = [];
      }
      fragments[0].directives.push(encodeDirective(definition));
    }
  }
  return fragments;
}

function addTypeDefinition(
  fragments: SchemaFragmentDefinitions[],
  typeName: string,
  typeDef: TypeDefinitionTuple,
  isExtension = false,
) {
  for (let i = 0; i < fragments.length; i++) {
    if (i === 0 && isExtension) {
      // Don't write extensions to the very first fragment (it is reserved for type definitions)
      //   Note: 2nd+ type definition with the same name is treated as extension
      continue;
    }
    const fragment = fragments[i];
    if (!fragment.types[typeName]) {
      fragment.types[typeName] = typeDef;
      return;
    }
  }
  const newFragment = { types: { [typeName]: typeDef } };
  fragments.push(newFragment);
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
