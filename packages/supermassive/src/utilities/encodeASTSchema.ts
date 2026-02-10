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
  TypeDefinitionMetadata,
  DirectiveDefinitionMetadata,
  EnumTypeDefinitionMetadata,
} from "../schema/definition";
import { typeReferenceFromNode, TypeReference } from "../schema/reference";
import { valueFromASTUntyped } from "./valueFromASTUntyped";

export type EncodeASTSchemaOptions = {
  includeDirectives?: boolean;
  includeDescriptions?: boolean;
};

export function encodeASTSchema(
  schemaFragment: DocumentNode,
  options?: EncodeASTSchemaOptions,
): SchemaDefinitions[] {
  const fragments: SchemaDefinitions[] = [{ types: {} }];
  const add = (name: string, def: TypeDefinitionTuple, extension = false) =>
    addTypeDefinition(fragments, name, def, extension);

  for (const definition of schemaFragment.definitions) {
    if (definition.kind === "ObjectTypeDefinition") {
      add(definition.name.value, encodeObjectType(definition, options));
    } else if (definition.kind === "InputObjectTypeDefinition") {
      add(definition.name.value, encodeInputObjectType(definition, options));
    } else if (definition.kind === "EnumTypeDefinition") {
      add(definition.name.value, encodeEnumType(definition, options));
    } else if (definition.kind === "UnionTypeDefinition") {
      add(definition.name.value, encodeUnionType(definition, options));
    } else if (definition.kind === "InterfaceTypeDefinition") {
      add(definition.name.value, encodeInterfaceType(definition, options));
    } else if (definition.kind === "ScalarTypeDefinition") {
      add(definition.name.value, encodeScalarType(definition, options));
    } else if (definition.kind === "ObjectTypeExtension") {
      add(definition.name.value, encodeObjectType(definition, options), true);
    } else if (definition.kind === "InputObjectTypeExtension") {
      add(
        definition.name.value,
        encodeInputObjectType(definition, options),
        true,
      );
    } else if (definition.kind === "EnumTypeExtension") {
      add(definition.name.value, encodeEnumType(definition, options), true);
    } else if (definition.kind === "UnionTypeExtension") {
      add(definition.name.value, encodeUnionType(definition, options), true);
    } else if (definition.kind === "InterfaceTypeExtension") {
      add(
        definition.name.value,
        encodeInterfaceType(definition, options),
        true,
      );
    } else if (definition.kind === "ScalarTypeExtension") {
      add(definition.name.value, encodeScalarType(definition, options), true);
    } else if (definition.kind === "DirectiveDefinition") {
      if (!fragments[0].directives) {
        fragments[0].directives = [];
      }
      fragments[0].directives.push(encodeDirective(definition, options));
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
  options?: EncodeASTSchemaOptions,
): ScalarTypeDefinitionTuple {
  return createScalarTypeDefinition(getTypeDefinitionMetadata(type, options));
}

function encodeEnumType(
  node: EnumTypeDefinitionNode | EnumTypeExtensionNode,
  options?: EncodeASTSchemaOptions,
): EnumTypeDefinitionTuple {
  return createEnumTypeDefinition(
    (node.values ?? []).map((value) => value.name.value),
    getEnumTypeDefinitionMetadata(node, options),
  );
}

function encodeObjectType(
  node: ObjectTypeDefinitionNode | ObjectTypeExtensionNode,
  options?: EncodeASTSchemaOptions,
): ObjectTypeDefinitionTuple {
  const fields = Object.create(null);
  for (const field of node.fields ?? []) {
    fields[field.name.value] = encodeField(field, options);
  }
  return createObjectTypeDefinition(
    fields,
    node.interfaces?.map((iface) => iface.name.value),
    getTypeDefinitionMetadata(node, options),
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
  options?: EncodeASTSchemaOptions,
): InterfaceTypeDefinitionTuple {
  const fields = Object.create(null);
  for (const field of node.fields ?? []) {
    fields[field.name.value] = encodeField(field, options);
  }
  return createInterfaceTypeDefinition(
    fields,
    node.interfaces?.map((iface) => iface.name.value),
    getTypeDefinitionMetadata(node, options),
  );
}

function encodeUnionType(
  node: UnionTypeDefinitionNode | UnionTypeExtensionNode,
  options?: EncodeASTSchemaOptions,
): UnionTypeDefinitionTuple {
  return createUnionTypeDefinition(
    (node.types ?? []).map((type) => type.name.value),
    getTypeDefinitionMetadata(node, options),
  );
}

function encodeInputObjectType(
  node: InputObjectTypeDefinitionNode | InputObjectTypeExtensionNode,
  options?: EncodeASTSchemaOptions,
): InputObjectTypeDefinitionTuple {
  const fields = Object.create(null);
  for (const field of node.fields ?? []) {
    fields[field.name.value] = encodeInputValue(field);
  }

  return createInputObjectTypeDefinition(
    fields,
    getTypeDefinitionMetadata(node, options),
  );
}

function encodeField(
  node: FieldDefinitionNode,
  options?: EncodeASTSchemaOptions,
): TypeReference | FieldDefinitionTuple {
  const fieldMetadata: TypeDefinitionMetadata | undefined =
    getTypeDefinitionMetadata(node, options);

  if (!node.arguments?.length) {
    if (fieldMetadata) {
      return [typeReferenceFromNode(node.type), undefined, fieldMetadata];
    }

    return typeReferenceFromNode(node.type);
  }

  if (fieldMetadata) {
    return [
      typeReferenceFromNode(node.type),
      encodeArguments(node),
      fieldMetadata,
    ];
  }
  return [typeReferenceFromNode(node.type), encodeArguments(node)];
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
  options?: EncodeASTSchemaOptions,
): DirectiveDefinitionTuple {
  const directiveDefinitionMetadata: DirectiveDefinitionMetadata | undefined =
    getDirectiveDefinitionMetadata(node, options);

  if (node.arguments?.length) {
    if (directiveDefinitionMetadata) {
      return [
        node.name.value,
        node.locations.map((node) =>
          encodeDirectiveLocation(node.value as DirectiveLocationEnum),
        ),
        encodeArguments(node),
        directiveDefinitionMetadata,
      ];
    } else {
      return [
        node.name.value,
        node.locations.map((node) =>
          encodeDirectiveLocation(node.value as DirectiveLocationEnum),
        ),
        encodeArguments(node),
      ];
    }
  } else {
    if (directiveDefinitionMetadata) {
      [
        node.name.value,
        node.locations.map((node) =>
          encodeDirectiveLocation(node.value as DirectiveLocationEnum),
        ),
        undefined,
        directiveDefinitionMetadata,
      ];
    }
    return [
      node.name.value,
      node.locations.map((node) =>
        encodeDirectiveLocation(node.value as DirectiveLocationEnum),
      ),
    ];
  }
}

function getDirectiveDefinitionMetadata<T>(
  node: T & {
    repeatable?: boolean;
    description?: { value: string; block?: boolean };
  },
  options?: EncodeASTSchemaOptions,
) {
  let metadata: undefined | DirectiveDefinitionMetadata;
  const { includeDescriptions } = options || {};

  if (includeDescriptions && node.description) {
    metadata ??= {};
    metadata.description = {
      block: node.description.block,
      value: node.description.value,
    };
  }

  if (node.repeatable) {
    metadata ??= {};
    metadata.repeatable = node.repeatable;
  }

  return metadata;
}

function getEnumTypeDefinitionMetadata(
  node: EnumTypeDefinitionNode | EnumTypeExtensionNode,
  options?: EncodeASTSchemaOptions,
): EnumTypeDefinitionMetadata | undefined {
  const { includeDirectives, includeDescriptions } = options || {};
  let valuesMetadadata: Record<string, TypeDefinitionMetadata> | undefined;

  if (includeDirectives || includeDescriptions) {
    for (const value of node?.values || []) {
      if (value.directives?.length || value.description) {
        if (includeDirectives && value.directives?.length) {
          valuesMetadadata ??= {};
          valuesMetadadata[value.name.value] ??= {};
          valuesMetadadata[value.name.value]["directives"] = value.directives
            .map(encodeDirectiveTuple)
            .filter<DirectiveTuple>((directive) => !!directive);
        }

        if (includeDescriptions && value.description) {
          valuesMetadadata ??= {};
          valuesMetadadata[value.name.value] ??= {};
          valuesMetadadata[value.name.value]["description"] = {
            block: value.description.block,
            value: value.description.value,
          };
        }
      }
    }
  }
  const enumTypeMetadata = getTypeDefinitionMetadata(node, options);
  if (enumTypeMetadata || valuesMetadadata) {
    return {
      ...getTypeDefinitionMetadata(node, options),
      ...(valuesMetadadata && { values: valuesMetadadata }),
    };
  }
}

function getTypeDefinitionMetadata<T>(
  node: T & {
    directives?: readonly DirectiveNode[];
    description?: { value: string; block?: boolean };
  },
  options?: EncodeASTSchemaOptions,
): TypeDefinitionMetadata | undefined {
  let metadata: undefined | TypeDefinitionMetadata;
  const { includeDirectives, includeDescriptions } = options || {};

  if (includeDirectives && node.directives?.length) {
    const directives = node.directives
      .map(encodeDirectiveTuple)
      .filter<DirectiveTuple>((directive) => !!directive);

    if (directives.length) {
      metadata ??= {};
      metadata.directives = directives;
    }
  }

  if (includeDescriptions && node.description) {
    metadata ??= {};
    metadata.description = {
      block: node.description.block,
      value: node.description.value,
    };
  }

  return metadata;
}
