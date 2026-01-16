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
  getDirectiveDefinitionName,
  getDirectiveDefinitionArgs,
  getDirectiveDefinitionLocations,
  decodeDirectiveLocation,
  getObjectTypeMetadata,
  getInterfaceTypeMetadata,
  getEnumMetadata,
  getUnionTypeMetadata,
  ScalarTypeDefinitionTuple,
  getScalarTypeMetadata,
  getInputTypeMetadata,
  DirectiveTuple,
  getDirectiveDefinitionMetadata,
  getFieldMetadata,
  Description,
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
import {
  ValueNode as ConstValueNode,
  DirectiveNode,
  StringValueNode,
} from "graphql/language/ast"; // TODO: use ConstValueNode in graphql@17
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
  const directiveDefinitions = encodedSchemaFragments[0].directives;

  for (const typeName in types) {
    const tuple = types[typeName];
    if (isScalarTypeDefinition(tuple)) {
      definitions.push(
        decodeScalarType(typeName, tuple, types, directiveDefinitions),
      );
    } else if (isEnumTypeDefinition(tuple)) {
      definitions.push(
        decodeEnumType(typeName, tuple, types, directiveDefinitions),
      );
    } else if (isObjectTypeDefinition(tuple)) {
      definitions.push(
        decodeObjectType(typeName, tuple, types, directiveDefinitions),
      );
    } else if (isInterfaceTypeDefinition(tuple)) {
      definitions.push(
        decodeInterfaceType(typeName, tuple, types, directiveDefinitions),
      );
    } else if (isUnionTypeDefinition(tuple)) {
      definitions.push(
        decodeUnionType(typeName, tuple, types, directiveDefinitions),
      );
    } else if (isInputObjectTypeDefinition(tuple)) {
      definitions.push(
        decodeInputObjectType(typeName, tuple, types, directiveDefinitions),
      );
    }
  }

  for (const directiveDefinition of directiveDefinitions ?? []) {
    definitions.push(decodeDirectiveDefinition(directiveDefinition, types));
  }

  return { kind: Kind.DOCUMENT, definitions };
}

function nameNode(value: string): NameNode {
  return { kind: Kind.NAME, value };
}

function decodeScalarType(
  typeName: string,
  tuple: ScalarTypeDefinitionTuple,
  types: TypeDefinitionsRecord,
  directiveDefinitions?: DirectiveDefinitionTuple[],
): ScalarTypeDefinitionNode {
  const { directives: metadataDirectives, description: metadataDescription } =
    getScalarTypeMetadata(tuple) || {};
  const decodedDescription = decodeDescription(metadataDescription);
  const decodedDirectives = decodeDirective(
    metadataDirectives,
    types,
    directiveDefinitions,
  );

  return {
    kind: Kind.SCALAR_TYPE_DEFINITION,
    name: nameNode(typeName),
    ...(decodedDirectives && { directives: decodedDirectives }),
    ...(decodedDescription && { description: decodedDescription }),
  };
}

function decodeEnumType(
  typeName: string,
  tuple: EnumTypeDefinitionTuple,
  types: TypeDefinitionsRecord,
  directiveDefinitions?: DirectiveDefinitionTuple[],
): EnumTypeDefinitionNode {
  const { directives: metadataDirectives, description: metadataDescription } =
    getEnumMetadata(tuple) || {};
  const decodedDescription = decodeDescription(metadataDescription);
  const decodedDirectives = decodeDirective(
    metadataDirectives,
    types,
    directiveDefinitions,
  );

  return {
    kind: Kind.ENUM_TYPE_DEFINITION,
    name: nameNode(typeName),
    values: getEnumValues(tuple).map((value) => ({
      kind: Kind.ENUM_VALUE_DEFINITION,
      name: nameNode(value),
    })),
    ...(decodedDirectives && { directives: decodedDirectives }),
    ...(decodedDescription && { description: decodedDescription }),
  };
}

function decodeObjectType(
  typeName: string,
  tuple: ObjectTypeDefinitionTuple,
  types: TypeDefinitionsRecord,
  directiveDefinitions?: DirectiveDefinitionTuple[],
): ObjectTypeDefinitionNode {
  const { directives: metadataDirectives, description: metadataDescription } =
    getObjectTypeMetadata(tuple) || {};
  const decodedDescription = decodeDescription(metadataDescription);
  const decodedDirectives = decodeDirective(
    metadataDirectives,
    types,
    directiveDefinitions,
  );

  return {
    kind: Kind.OBJECT_TYPE_DEFINITION,
    name: nameNode(typeName),
    fields: decodeFields(
      getObjectFields(tuple) ?? {},
      types,
      directiveDefinitions,
    ),
    interfaces: getObjectTypeInterfaces(tuple).map((name) => ({
      kind: Kind.NAMED_TYPE,
      name: nameNode(name),
    })),
    ...(decodedDirectives && { directives: decodedDirectives }),
    ...(decodedDescription && { description: decodedDescription }),
  };
}

function decodeInterfaceType(
  typeName: string,
  tuple: InterfaceTypeDefinitionTuple,
  types: TypeDefinitionsRecord,
  directiveDefinitions?: DirectiveDefinitionTuple[],
): InterfaceTypeDefinitionNode {
  const { directives: metadataDirectives, description: metadataDescription } =
    getInterfaceTypeMetadata(tuple) || {};
  const decodedDescription = decodeDescription(metadataDescription);
  const decodedDirectives = decodeDirective(
    metadataDirectives,
    types,
    directiveDefinitions,
  );

  return {
    kind: Kind.INTERFACE_TYPE_DEFINITION,
    name: nameNode(typeName),
    fields: decodeFields(getFields(tuple), types, directiveDefinitions),
    interfaces: getInterfaceTypeInterfaces(tuple).map((name) => ({
      kind: Kind.NAMED_TYPE,
      name: nameNode(name),
    })),
    ...(decodedDirectives && { directives: decodedDirectives }),
    ...(decodedDescription && { description: decodedDescription }),
  };
}

function decodeUnionType(
  typeName: string,
  tuple: UnionTypeDefinitionTuple,
  types: TypeDefinitionsRecord,
  directiveDefinitions?: DirectiveDefinitionTuple[],
): UnionTypeDefinitionNode {
  const { directives: metadataDirectives, description: metadataDescription } =
    getUnionTypeMetadata(tuple) || {};
  const decodedDescription = decodeDescription(metadataDescription);
  const decodedDirectives = decodeDirective(
    metadataDirectives,
    types,
    directiveDefinitions,
  );

  return {
    kind: Kind.UNION_TYPE_DEFINITION,
    name: nameNode(typeName),
    types: getUnionTypeMembers(tuple).map((name) => ({
      kind: Kind.NAMED_TYPE,
      name: nameNode(name),
    })),
    ...(decodedDirectives && { directives: decodedDirectives }),
    ...(decodedDescription && { description: decodedDescription }),
  };
}

function decodeInputObjectType(
  typeName: string,
  tuple: InputObjectTypeDefinitionTuple,
  types: TypeDefinitionsRecord,
  directiveDefinitions?: DirectiveDefinitionTuple[],
): InputObjectTypeDefinitionNode {
  const { directives: metadataDirectives, description: metadataDescription } =
    getInputTypeMetadata(tuple) || {};
  const decodedDescription = decodeDescription(metadataDescription);
  const decodedDirectives = decodeDirective(
    metadataDirectives,
    types,
    directiveDefinitions,
  );

  return {
    kind: Kind.INPUT_OBJECT_TYPE_DEFINITION,
    name: nameNode(typeName),
    fields: Object.entries(getInputObjectFields(tuple)).map(([name, value]) =>
      decodeInputValue(name, value, types),
    ),
    ...(decodedDirectives && { directives: decodedDirectives }),
    ...(decodedDescription && { description: decodedDescription }),
  };
}

function decodeFields(
  fields: Record<string, FieldDefinition>,
  types: TypeDefinitionsRecord,
  directiveDefinitions?: DirectiveDefinitionTuple[],
): FieldDefinitionNode[] {
  return Object.entries(fields).map(([name, value]) => {
    const type = decodeTypeReference(getFieldTypeReference(value));
    const { directives: metadataDirectives, description: metadataDescription } =
      getFieldMetadata(value) || {};
    const decodedDescription = decodeDescription(metadataDescription);
    const decodedDirectives = decodeDirective(
      metadataDirectives,
      types,
      directiveDefinitions,
    );
    return {
      kind: Kind.FIELD_DEFINITION,
      name: nameNode(name),
      type,
      arguments: decodeArguments(getFieldArgs(value) ?? {}, types),
      ...(decodedDirectives && { directives: decodedDirectives }),
      ...(decodedDescription && { description: decodedDescription }),
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
  if (typeof jsValue === "boolean") {
    return { kind: Kind.BOOLEAN, value: jsValue };
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

function decodeDirectiveDefinition(
  tuple: DirectiveDefinitionTuple,
  types: TypeDefinitionsRecord,
): DirectiveDefinitionNode {
  const name = getDirectiveDefinitionName(tuple);
  const args = getDirectiveDefinitionArgs(tuple);
  const locations = getDirectiveDefinitionLocations(tuple);
  const { repeatable, description } =
    getDirectiveDefinitionMetadata(tuple) || {};
  return {
    kind: Kind.DIRECTIVE_DEFINITION,
    name: nameNode(name),
    arguments: args ? decodeArguments(args, types) : [],
    locations: locations.map((loc) => ({
      kind: Kind.NAME,
      value: decodeDirectiveLocation(loc),
    })),
    description: decodeDescription(description),
    repeatable: Boolean(repeatable),
  };
}

function decodeDirective(
  directiveTuples: DirectiveTuple[] | undefined,
  types: TypeDefinitionsRecord,
  directiveDefinitions?: DirectiveDefinitionTuple[],
): ReadonlyArray<DirectiveNode> | undefined {
  if (!directiveTuples || !directiveDefinitions) {
    return;
  }

  return directiveTuples.map(([directiveName, args]) => {
    const directiveTuple = directiveDefinitions?.find(
      (directiveDefinition) =>
        getDirectiveDefinitionName(directiveDefinition) === directiveName,
    );

    invariant(
      directiveTuple !== undefined,
      `Could not find directive definition for "${directiveName}"`,
    );

    const argumentDefinitions = getDirectiveDefinitionArgs(directiveTuple);
    const repeatable = Boolean(
      getDirectiveDefinitionMetadata(directiveTuple)?.repeatable,
    );

    return {
      kind: Kind.DIRECTIVE,
      name: nameNode(directiveName),
      ...(repeatable && { repeatable }),
      arguments:
        args && argumentDefinitions
          ? Object.entries(args)?.map(([argName, argValue]) => {
              invariant(
                argumentDefinitions[argName] !== undefined,
                `Could not find directive argument definition "${argName}"for "${directiveName}" directive`,
              );

              const inputValueTypeRef = getInputValueTypeReference(
                argumentDefinitions[argName],
              );

              return {
                kind: Kind.ARGUMENT,
                name: nameNode(argName),
                value: valueToConstValueNode(
                  argValue,
                  inputValueTypeRef,
                  types,
                ),
              };
            })
          : [],
    };
  });
}

function decodeDescription(
  description?: Description,
): StringValueNode | undefined {
  if (!description) {
    return;
  }

  const { value, block } = description;
  return {
    kind: "StringValue",
    value,
    block,
  };
}
