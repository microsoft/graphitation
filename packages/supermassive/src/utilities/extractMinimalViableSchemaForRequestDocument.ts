import {
  ASTNode,
  DirectiveNode,
  DocumentNode,
  FieldNode,
  GraphQLArgument,
  GraphQLCompositeType,
  GraphQLDirective,
  GraphQLEnumType,
  GraphQLError,
  GraphQLField,
  GraphQLInputField,
  GraphQLInputObjectType,
  GraphQLOutputType,
  GraphQLScalarType,
  GraphQLSchema,
  isCompositeType,
  isEnumType,
  isInputObjectType,
  isNonNullType,
  isObjectType,
  isScalarType,
  isSpecifiedScalarType,
  isUnionType,
  Kind,
  TypeInfo,
  visit,
  visitWithTypeInfo,
} from "graphql";
import {
  CompositeTypeTuple,
  DirectiveDefinitionTuple,
  DirectiveKeys,
  EnumTypeDefinitionTuple,
  FieldDefinition,
  FieldKeys,
  InputObjectKeys,
  InputObjectTypeDefinitionTuple,
  InputValueDefinition,
  InputValueDefinitionRecord,
  InputValueKeys,
  InterfaceKeys,
  InterfaceTypeDefinitionTuple,
  ObjectKeys,
  ObjectTypeDefinitionTuple,
  ScalarTypeDefinitionTuple,
  SchemaDefinitions,
  TypeDefinitionsRecord,
  TypeKind,
  TypeReference,
} from "../schema/definition";
import { isKnownDirective } from "../schema/directives";
import { makeReadableErrorPath } from "./makeReadableErrorPath";
import {
  inspectTypeReference,
  typeNameFromReference,
  typeReferenceFromName,
} from "../schema/reference";
import { invariant } from "../jsutils/invariant";
import { Maybe } from "../jsutils/Maybe";

export type ExtractMinimalViableSchemaToRequestDocumentOptions = {
  ignoredDirectives?: string[];
};

export function extractMinimalViableSchemaForRequestDocument(
  schema: GraphQLSchema,
  requestDocument: DocumentNode,
  options?: ExtractMinimalViableSchemaToRequestDocumentOptions,
): SchemaDefinitions {
  const types: TypeDefinitionsRecord = Object.create(null);
  const directives: DirectiveDefinitionTuple[] = [];

  const typeInfo = new TypeInfo(schema);
  visit(
    requestDocument,
    visitWithTypeInfo(typeInfo, {
      Field(node, _key, _parent, _path, ancestors): void {
        const parentType = typeInfo.getParentType();
        assertCompositeType(parentType, node, ancestors);

        const typeDef = addCompositeType(types, parentType);
        if (typeDef[0] === TypeKind.UNION || node.name.value === "__typename") {
          return;
        }
        const field = typeInfo.getFieldDef();
        assertExistingField(field, node, ancestors);
        assertAllArgumentsAreDefined(field, node, ancestors);

        const fieldDef = addField(typeDef, field, node);
        if (Array.isArray(fieldDef)) {
          addReferencedOutputType(schema, types, fieldDef[FieldKeys.type]);
          addReferencedInputTypes(schema, types, fieldDef[FieldKeys.arguments]);
        } else {
          addReferencedOutputType(schema, types, fieldDef);
        }
      },
      Directive(node, _key, _parent, _path, ancestors) {
        if (
          isKnownDirective(node.name.value) ||
          options?.ignoredDirectives?.includes(node.name.value)
        ) {
          return;
        }
        const directive = typeInfo.getDirective();
        if (!directive) {
          const errorPath = makeReadableErrorPath(ancestors);

          // This happens whenever a directive is requested that hasn't been defined in schema
          throw new GraphQLError(
            `Cannot find definition for directive: ${errorPath.join(".")} @${
              node.name.value
            }`,
            { nodes: node },
          );
        }
        addDirective(directives, directive, node);
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
      Argument() {
        // Perf: no need to visit arguments - they were handled by Field/Directive visitors
        return false;
      },
    }),
  );
  return directives.length ? { types, directives } : { types };
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
  inputValues: InputValueDefinitionRecord,
): void {
  for (const inputValueDef of Object.values(inputValues)) {
    const typeRef = Array.isArray(inputValueDef)
      ? inputValueDef[InputValueKeys.type]
      : inputValueDef;

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
        inputObjectDef[InputObjectKeys.fields],
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
  fieldNode: FieldNode,
): FieldDefinition {
  const fields =
    type[0] === TypeKind.OBJECT
      ? type[ObjectKeys.fields]
      : type[InterfaceKeys.fields];

  const existingFieldDef: FieldDefinition = fields[field.name];
  const previouslyAddedArgs = Array.isArray(existingFieldDef)
    ? existingFieldDef[FieldKeys.arguments]
    : Object.create(null);

  const nodeArgs = new Set(fieldNode.arguments?.map((arg) => arg.name.value));

  const argsFilter = (argDef: GraphQLArgument) =>
    Boolean(
      previouslyAddedArgs[argDef.name] ||
        isNonNullType(argDef.type) ||
        argDef.defaultValue !== undefined ||
        nodeArgs.has(argDef.name),
    );

  return (fields[field.name] = encodeFieldDef(field, argsFilter));
}

function addDirective(
  directives: DirectiveDefinitionTuple[],
  directive: GraphQLDirective,
  node: DirectiveNode,
) {
  const name = directive.name;
  let tuple = directives.find((d) => d[DirectiveKeys.name] === name);
  if (!tuple) {
    tuple = [directive.name];
    directives.push(tuple);
  }

  const previouslyAddedArgs = tuple[DirectiveKeys.arguments];
  const nodeArgs = new Set(node.arguments?.map((arg) => arg.name.value));

  const argsFilter = (argDef: GraphQLArgument) =>
    Boolean(
      previouslyAddedArgs?.[argDef.name] ||
        isNonNullType(argDef.type) ||
        argDef.defaultValue !== undefined ||
        nodeArgs.has(argDef.name),
    );
  const [hasArgs, argsRecord] = encodeArguments(directive.args, argsFilter);
  if (hasArgs) {
    tuple[DirectiveKeys.arguments] = argsRecord;
  }
  return tuple;
}

function encodeCompositeType(type: GraphQLCompositeType): CompositeTypeTuple {
  if (isUnionType(type)) {
    return [TypeKind.UNION, type.getTypes().map((type) => type.name)];
  }
  const ifaces = type.getInterfaces().map((iface) => iface.name);
  const typeKind = isObjectType(type) ? TypeKind.OBJECT : TypeKind.INTERFACE;
  return ifaces.length ? [typeKind, {}, ifaces] : [typeKind, {}];
}

function encodeInputObjectType(
  type: GraphQLInputObjectType,
): InputObjectTypeDefinitionTuple {
  const result = Object.create(null);
  for (const [fieldName, field] of Object.entries(type.getFields())) {
    result[fieldName] = encodeInputField(field);
  }
  return [TypeKind.INPUT, result];
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
  return [TypeKind.ENUM, type.getValues().map((v) => v.name)];
}

function encodeScalarType(_type: GraphQLScalarType): ScalarTypeDefinitionTuple {
  return [TypeKind.SCALAR];
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
    throw new GraphQLError(`Cannot find type for: ${path}`, {
      nodes: node,
    });
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
    throw new GraphQLError(`Cannot find field: ${path}`, { nodes: node });
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
      throw new GraphQLError(`Cannot find type for argument: ${path}`, {
        nodes: arg,
      });
    }
  }
}
