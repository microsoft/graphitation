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
  DirectiveLocationEnum,
  DirectiveNode,
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
  SchemaDefinitions,
  TypeDefinitionTuple,
  createScalarTypeDefinition,
  createEnumTypeDefinition,
  createObjectTypeDefinition,
  createInputObjectTypeDefinition,
  createInterfaceTypeDefinition,
  createUnionTypeDefinition,
  encodeDirectiveLocation,
  DirectiveTuple,
} from "../schema/definition";
import { typeReferenceFromNode, TypeReference } from "../schema/reference";
import { valueFromASTUntyped } from "./valueFromASTUntyped";

type EncodeASTSchemaOptions = {
  includeDirectives?: boolean;
};

export function encodeASTSchema(
  schemaFragment: DocumentNode,
  options?: EncodeASTSchemaOptions,
): SchemaDefinitions[] {
  const includeDirectives = Boolean(options?.includeDirectives);
  const fragments: SchemaDefinitions[] = [{ types: {} }];
  const add = (name: string, def: TypeDefinitionTuple, extension = false) =>
    addTypeDefinition(fragments, name, def, extension);

  for (const definition of schemaFragment.definitions) {
    if (definition.kind === "ObjectTypeDefinition") {
      add(
        definition.name.value,
        encodeObjectType(definition, includeDirectives),
      );
    } else if (definition.kind === "InputObjectTypeDefinition") {
      add(
        definition.name.value,
        encodeInputObjectType(definition, includeDirectives),
      );
    } else if (definition.kind === "EnumTypeDefinition") {
      add(definition.name.value, encodeEnumType(definition, includeDirectives));
    } else if (definition.kind === "UnionTypeDefinition") {
      add(
        definition.name.value,
        encodeUnionType(definition, includeDirectives),
      );
    } else if (definition.kind === "InterfaceTypeDefinition") {
      add(
        definition.name.value,
        encodeInterfaceType(definition, includeDirectives),
      );
    } else if (definition.kind === "ScalarTypeDefinition") {
      add(
        definition.name.value,
        encodeScalarType(definition, includeDirectives),
      );
    } else if (definition.kind === "ObjectTypeExtension") {
      add(
        definition.name.value,
        encodeObjectType(definition, includeDirectives),
        true,
      );
    } else if (definition.kind === "InputObjectTypeExtension") {
      add(
        definition.name.value,
        encodeInputObjectType(definition, includeDirectives),
        true,
      );
    } else if (definition.kind === "EnumTypeExtension") {
      add(
        definition.name.value,
        encodeEnumType(definition, includeDirectives),
        true,
      );
    } else if (definition.kind === "UnionTypeExtension") {
      add(
        definition.name.value,
        encodeUnionType(definition, includeDirectives),
        true,
      );
    } else if (definition.kind === "InterfaceTypeExtension") {
      add(
        definition.name.value,
        encodeInterfaceType(definition, includeDirectives),
        true,
      );
    } else if (definition.kind === "ScalarTypeExtension") {
      add(
        definition.name.value,
        encodeScalarType(definition, includeDirectives),
        true,
      );
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
  fragments: SchemaDefinitions[],
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
  type: ScalarTypeDefinitionNode | ScalarTypeExtensionNode,
  includeDirectives: boolean,
): ScalarTypeDefinitionTuple {
  return createScalarTypeDefinition(
    includeDirectives
      ? type.directives
          ?.map(encodeDirectiveTuple)
          .filter<DirectiveTuple>((directive) => !!directive)
      : undefined,
  );
}

function encodeEnumType(
  node: EnumTypeDefinitionNode | EnumTypeExtensionNode,
  includeDirectives: boolean,
): EnumTypeDefinitionTuple {
  return createEnumTypeDefinition(
    (node.values ?? []).map((value) => value.name.value),
    includeDirectives
      ? node.directives
          ?.map(encodeDirectiveTuple)
          .filter<DirectiveTuple>((directive) => !!directive)
      : undefined,
  );
}

function encodeObjectType(
  node: ObjectTypeDefinitionNode | ObjectTypeExtensionNode,
  includeDirectives: boolean,
): ObjectTypeDefinitionTuple {
  const fields = Object.create(null);
  for (const field of node.fields ?? []) {
    fields[field.name.value] = encodeField(field);
  }
  return createObjectTypeDefinition(
    fields,
    node.interfaces?.map((iface) => iface.name.value),
    includeDirectives
      ? node.directives
          ?.map(encodeDirectiveTuple)
          .filter<DirectiveTuple>((directive) => !!directive)
      : undefined,
  );
}

function encodeDirectiveTuple(
  directive?: DirectiveNode,
): DirectiveTuple | undefined {
  if (!directive) {
    return;
  }

  const name = directive.name.value;

  const args = Object.create(null);
  for (const argument of directive.arguments ?? []) {
    args[argument.name.value] = valueFromASTUntyped(argument.value);
  }

  if (Object.keys(args).length) {
    return [name, args];
  }
  return [name];
}

function encodeInterfaceType(
  node: InterfaceTypeDefinitionNode | InterfaceTypeExtensionNode,
  includeDirectives: boolean,
): InterfaceTypeDefinitionTuple {
  const fields = Object.create(null);
  for (const field of node.fields ?? []) {
    fields[field.name.value] = encodeField(field);
  }
  return createInterfaceTypeDefinition(
    fields,
    node.interfaces?.map((iface) => iface.name.value),
    includeDirectives
      ? node.directives
          ?.map(encodeDirectiveTuple)
          .filter<DirectiveTuple>((directive) => !!directive)
      : undefined,
  );
}

function encodeUnionType(
  node: UnionTypeDefinitionNode | UnionTypeExtensionNode,
  includeDirectives: boolean,
): UnionTypeDefinitionTuple {
  return createUnionTypeDefinition(
    (node.types ?? []).map((type) => type.name.value),
    includeDirectives
      ? node.directives
          ?.map(encodeDirectiveTuple)
          .filter<DirectiveTuple>((directive) => !!directive)
      : undefined,
  );
}

function encodeInputObjectType(
  node: InputObjectTypeDefinitionNode | InputObjectTypeExtensionNode,
  includeDirectives: boolean,
): InputObjectTypeDefinitionTuple {
  const fields = Object.create(null);
  for (const field of node.fields ?? []) {
    fields[field.name.value] = encodeInputValue(field);
  }
  return createInputObjectTypeDefinition(
    fields,
    includeDirectives
      ? node.directives
          ?.map(encodeDirectiveTuple)
          .filter<DirectiveTuple>((directive) => !!directive)
      : undefined,
  );
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
  if (node.arguments?.length) {
    return [
      node.name.value,
      node.locations.map((node) =>
        encodeDirectiveLocation(node.value as DirectiveLocationEnum),
      ),
      encodeArguments(node),
    ];
  } else {
    return [
      node.name.value,
      node.locations.map((node) =>
        encodeDirectiveLocation(node.value as DirectiveLocationEnum),
      ),
    ];
  }
}
