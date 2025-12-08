import {
  ASTNode,
  DirectiveNode,
  DocumentNode,
  FieldNode,
  GraphQLArgument,
  GraphQLCompositeType,
  GraphQLDirective,
  GraphQLEnumType,
  GraphQLField,
  GraphQLInputField,
  GraphQLInputObjectType,
  GraphQLOutputType,
  GraphQLScalarType,
  GraphQLSchema,
  isCompositeType,
  isEnumType,
  isInputObjectType,
  isObjectType,
  isScalarType,
  isSpecifiedScalarType,
  isUnionType,
  Kind,
  TypeInfo,
  visit,
  visitWithTypeInfo,
  locatedError,
} from "graphql";
import {
  CompositeTypeTuple,
  createEnumTypeDefinition,
  createInputObjectTypeDefinition,
  createInterfaceTypeDefinition,
  createObjectTypeDefinition,
  createScalarTypeDefinition,
  createUnionTypeDefinition,
  DirectiveDefinitionTuple,
  encodeDirectiveLocation,
  EnumTypeDefinitionTuple,
  FieldDefinition,
  getDirectiveName,
  getFieldArgs,
  getFields,
  getFieldTypeReference,
  getInputObjectFields,
  getInputValueTypeReference,
  InputObjectTypeDefinitionTuple,
  InputValueDefinition,
  InputValueDefinitionRecord,
  InterfaceTypeDefinitionTuple,
  isUnionTypeDefinition,
  ObjectTypeDefinitionTuple,
  ScalarTypeDefinitionTuple,
  SchemaDefinitions,
  setDirectiveDefinitionArgs,
  TypeDefinitionsRecord,
} from "../schema/definition";
import { isKnownDirective } from "../schema/directives";
import { makeReadableErrorPath } from "./makeReadableErrorPath";
import {
  inspectTypeReference,
  typeNameFromReference,
  TypeReference,
  typeReferenceFromName,
} from "../schema/reference";
import { invariant } from "../jsutils/invariant";
import { Maybe } from "../jsutils/Maybe";

export type ExtractMinimalViableSchemaResult = {
  definitions: SchemaDefinitions;
  unknownDirectives: DirectiveNode[];
  fragmentSpreads: string[];
};

export function extractMinimalViableSchemaForRequestDocument(
  schema: GraphQLSchema,
  requestDocument: DocumentNode,
): ExtractMinimalViableSchemaResult {
  const types: TypeDefinitionsRecord = {};
  const directives: DirectiveDefinitionTuple[] = [];
  const unknownDirectives: DirectiveNode[] = [];
  const fragmentSpreads: string[] = [];

  const typeInfo = new TypeInfo(schema);
  visit(
    requestDocument,
    visitWithTypeInfo(typeInfo, {
      Field(node, _key, _parent, _path, ancestors): void {
        const parentType = typeInfo.getParentType();
        assertCompositeType(parentType, node, ancestors);

        const typeDef = addCompositeType(types, parentType);
        if (
          isUnionTypeDefinition(typeDef) ||
          node.name.value === "__typename"
        ) {
          return;
        }
        const field = typeInfo.getFieldDef();
        assertExistingField(field, node, ancestors);
        assertAllArgumentsAreDefined(field, node, ancestors);

        const fieldDef = addField(typeDef, field);
        addReferencedOutputType(schema, types, getFieldTypeReference(fieldDef));
        addReferencedInputTypes(schema, types, getFieldArgs(fieldDef));
      },
      Directive(node, _key, _parent, _path) {
        if (isKnownDirective(node.name.value)) {
          return;
        }
        const directive = typeInfo.getDirective();
        if (!directive) {
          // This happens whenever a directive is requested that hasn't been defined in schema
          unknownDirectives.push(node);
          return;
        }
        addDirective(directives, directive);
      },
      FragmentDefinition(node, _key, _parent, _path, ancestors): void {
        const type = typeInfo.getType();
        assertCompositeType(type, node, ancestors);
        addCompositeType(types, type);
      },
      InlineFragment(node, _key, _parent, _path, ancestors): void {
        if (node?.typeCondition) {
          const type = typeInfo.getType();
          assertCompositeType(type, node, ancestors);
          addCompositeType(types, type);
        }
      },
      FragmentSpread(node) {
        if (!fragmentSpreads.includes(node.name.value)) {
          fragmentSpreads.push(node.name.value);
        }
      },
      Argument() {
        // Perf: no need to visit arguments - they were handled by Field/Directive visitors
        return false;
      },
    }),
  );
  const definitions = directives.length ? { types, directives } : { types };
  return { definitions, unknownDirectives, fragmentSpreads };
}

function addReferencedOutputType(
  schema: GraphQLSchema,
  types: TypeDefinitionsRecord,
  typeRef: TypeReference,
) {
  const name = typeNameFromReference(typeRef);
  const schemaType = schema.getType(name);

  if (!schemaType) {
    throw new Error(`Type ${name} not found in schema`);
  }
  if (types[name] || isSpecifiedScalarType(schemaType)) {
    // Assuming already added
    return;
  }
  if (isCompositeType(schemaType)) {
    addCompositeType(types, schemaType);
  } else if (isEnumType(schemaType)) {
    types[name] = encodeEnumType(schemaType);
  } else if (isScalarType(schemaType)) {
    types[name] = encodeScalarType(schemaType);
  } else {
    invariant(false, "Got non-output type: " + inspectTypeReference(typeRef));
  }
}

function addReferencedInputTypes(
  schema: GraphQLSchema,
  types: TypeDefinitionsRecord,
  inputValues: InputValueDefinitionRecord | undefined,
): void {
  if (!inputValues) {
    return;
  }
  for (const inputValueDef of Object.values(inputValues)) {
    const typeRef = getInputValueTypeReference(inputValueDef);
    const name = typeNameFromReference(typeRef);
    const schemaType = schema.getType(name);

    if (!schemaType) {
      throw new Error(`Type ${name} not found in schema`);
    }
    if (types[name] || isSpecifiedScalarType(schemaType)) {
      // Assuming already fully added
      continue;
    }
    if (isInputObjectType(schemaType)) {
      const inputObjectDef = encodeInputObjectType(schemaType);
      types[name] = inputObjectDef;
      addReferencedInputTypes(
        schema,
        types,
        getInputObjectFields(inputObjectDef),
      );
    } else if (isEnumType(schemaType)) {
      types[name] = encodeEnumType(schemaType);
    } else if (isScalarType(schemaType)) {
      types[name] = encodeScalarType(schemaType);
    } else {
      invariant(false, "Got non-input type: " + inspectTypeReference(typeRef));
    }
  }
}

function addCompositeType(
  types: TypeDefinitionsRecord,
  type: GraphQLCompositeType,
): CompositeTypeTuple {
  if (types[type.name]) {
    // TODO: double check that the kind match?
    return types[type.name] as CompositeTypeTuple;
  }
  return (types[type.name] = encodeCompositeType(type));
}

function addField(
  type: ObjectTypeDefinitionTuple | InterfaceTypeDefinitionTuple,
  field: GraphQLField<unknown, unknown>,
): FieldDefinition {
  const fields = getFields(type);

  return (fields[field.name] = encodeFieldDef(field));
}

function addDirective(
  directives: DirectiveDefinitionTuple[],
  directive: GraphQLDirective,
) {
  const name = directive.name;
  let tuple = directives.find((d) => getDirectiveName(d) === name);
  if (!tuple) {
    tuple = [directive.name, directive.locations.map(encodeDirectiveLocation)];
    directives.push(tuple);
  }

  const [hasArgs, argsRecord] = encodeArguments(directive.args);
  if (hasArgs) {
    setDirectiveDefinitionArgs(tuple, argsRecord);
  }
  return tuple;
}

function encodeCompositeType(type: GraphQLCompositeType): CompositeTypeTuple {
  if (isUnionType(type)) {
    return createUnionTypeDefinition(type.getTypes().map((type) => type.name));
  }
  const ifaces = type.getInterfaces().map((iface) => iface.name);
  return isObjectType(type)
    ? createObjectTypeDefinition({}, ifaces)
    : createInterfaceTypeDefinition({}, ifaces);
}

function encodeInputObjectType(
  type: GraphQLInputObjectType,
): InputObjectTypeDefinitionTuple {
  const result = Object.create(null);
  for (const [fieldName, field] of Object.entries(type.getFields())) {
    result[fieldName] = encodeInputField(field);
  }
  return createInputObjectTypeDefinition(result);
}

function encodeInputField(field: GraphQLInputField): InputValueDefinition {
  const typeReference = typeReferenceFromName(field.type.toString());
  return field.defaultValue === undefined
    ? typeReference
    : [typeReference, field.defaultValue];
}

function encodeFieldDef(
  field: GraphQLField<unknown, unknown>,
  argumentsFilter?: (arg: GraphQLArgument) => boolean,
): FieldDefinition {
  const typeReference = typeReferenceFromName(field.type.toString());
  const [hasArgs, argsRecord] = encodeArguments(field.args, argumentsFilter);
  return !hasArgs ? typeReference : [typeReference, argsRecord];
}

function encodeArguments(
  args: ReadonlyArray<GraphQLArgument>,
  argumentsFilter?: (arg: GraphQLArgument) => boolean,
): [boolean, InputValueDefinitionRecord] {
  let hasArgs = false;
  const argsRecord: InputValueDefinitionRecord = {};
  for (const argDef of args) {
    if (argumentsFilter && !argumentsFilter(argDef)) {
      continue;
    }
    const typeReference = typeReferenceFromName(argDef.type.toString());
    argsRecord[argDef.name] =
      argDef.defaultValue === undefined
        ? typeReference
        : [typeReference, argDef.defaultValue];
    hasArgs = true;
  }
  return [hasArgs, argsRecord];
}

function encodeEnumType(type: GraphQLEnumType): EnumTypeDefinitionTuple {
  return createEnumTypeDefinition(type.getValues().map((v) => v.name));
}

function encodeScalarType(_type: GraphQLScalarType): ScalarTypeDefinitionTuple {
  return createScalarTypeDefinition();
}

function assertCompositeType(
  type: Maybe<GraphQLOutputType>,
  node: ASTNode,
  ancestors: ReadonlyArray<readonly ASTNode[] | ASTNode>,
): asserts type is GraphQLCompositeType {
  if (!type || !isCompositeType(type)) {
    const path =
      node.kind === Kind.FIELD
        ? makeReadableErrorPath(ancestors).join(".") + "." + node.name.value
        : makeReadableErrorPath(ancestors).join(".");
    throw locatedError(`Cannot find type for: ${path}`, [node]);
  }
}

function assertExistingField(
  field: Maybe<GraphQLField<unknown, unknown>>,
  node: FieldNode,
  ancestors: ReadonlyArray<readonly ASTNode[] | ASTNode>,
): asserts field is GraphQLField<unknown, unknown> {
  if (!field) {
    const path =
      makeReadableErrorPath(ancestors).join(".") + "." + node.name.value;
    throw locatedError(`Cannot find field: ${path}`, [node]);
  }
}

function assertAllArgumentsAreDefined(
  field: GraphQLField<unknown, unknown> | GraphQLDirective,
  node: FieldNode | DirectiveNode,
  ancestors: ReadonlyArray<readonly ASTNode[] | ASTNode>,
) {
  const defArgs = new Set(field.args.map((arg) => arg.name));
  for (const arg of node.arguments ?? []) {
    if (!defArgs.has(arg.name.value)) {
      const path =
        makeReadableErrorPath(ancestors).join(".") +
        "." +
        node.name.value +
        `(${arg.name.value}: ...)`;
      throw locatedError(`Cannot find type for argument: ${path}`, [arg]);
    }
  }
}
