import {
  FieldNode,
  GraphQLArgument,
  GraphQLCompositeType,
  GraphQLEnumType,
  GraphQLField,
  GraphQLInputObjectType,
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
  locatedError,
  specifiedDirectives,
  visit,
} from "graphql";
import * as TypelessAST from "graphql/language/ast";
import {
  makeReadableErrorPath,
  TypeInfo,
  visitWithTypeInfo,
} from "./utilities";
import {
  CompositeTypeTuple,
  DirectiveDefinitionTuple,
  DirectiveKeys,
  EncodedSchemaFragment,
  EnumTypeDefinitionTuple,
  FieldDefinition,
  FieldDefinitionTuple,
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
  TypeDefinitionRecord,
  TypeKind,
  TypeReference,
} from "../types/definition";
import {
  inspectTypeReference,
  typeNameFromReference,
  typeReferenceFromName,
} from "../types/reference";
import { GraphQLInputField } from "graphql/type/definition";
import { invariant } from "../jsutils/invariant";

// TODO:
export function addMinimalViableSchemaToRequestDocument(
  _schema: GraphQLSchema,
  _document: TypelessAST.DocumentNode,
): TypelessAST.DocumentNode | undefined {
  return undefined;
}

export function extractMinimalViableSchemaForRequestDocument(
  schema: GraphQLSchema,
  document: TypelessAST.DocumentNode,
  options: {
    ignoredDirectives?: string[];
  } = {},
): EncodedSchemaFragment {
  const types: TypeDefinitionRecord = Object.create(null);
  const directives: DirectiveDefinitionTuple[] = Object.create(null);

  const typeInfo = new TypeInfo(schema, {
    defaultDirectives: specifiedDirectives,
    ignoredDirectives: options.ignoredDirectives,
  });
  visit(
    document,
    visitWithTypeInfo(typeInfo, {
      Field(node, _key, _parent, _path, ancestors): void {
        const parentType = typeInfo.getParentType();
        if (!parentType) {
          const path =
            makeReadableErrorPath(ancestors).join(".") + "." + node.name.value;
          throw locatedError(`Cannot find type for field: ${path}`, [node]);
        }
        const typeDef = addCompositeType(types, parentType);
        if (typeDef[0] === TypeKind.UNION || node.name.value === "__typename") {
          return;
        }
        const field = typeInfo.getFieldDef();
        if (!field) {
          const path =
            makeReadableErrorPath(ancestors).join(".") + "." + node.name.value;
          throw locatedError(`Cannot find field: ${path}`, [node]);
        }
        const fieldDef = addField(typeDef, field, node);
        if (Array.isArray(fieldDef)) {
          addReferencedOutputType(schema, types, fieldDef[FieldKeys.type]);
          addReferencedInputTypes(schema, types, fieldDef[FieldKeys.arguments]);
        } else {
          addReferencedOutputType(schema, types, fieldDef);
        }
      },
      Argument() {
        return false;
      },
      Directive(node, _key, _parent, _path, ancestors) {
        const directive = typeInfo.getDirective();

        if (!directive && !typeInfo.isInIgnoredDirective()) {
          const errorPath = makeReadableErrorPath(ancestors);

          // This happens whenever a directive is requested that hasn't been defined in schema
          throw locatedError(
            `Cannot find type for directive: ${errorPath.join(".")}.${
              node.name.value
            }`,
            [node],
          );
        }

        if (
          directive &&
          !directives.some((d) => d[DirectiveKeys.name] === directive.name)
        ) {
          directives.push([directive.name]);
        }
      },
    }),
  );
  return { types, directives };
}

function addReferencedOutputType(
  schema: GraphQLSchema,
  types: TypeDefinitionRecord,
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
  types: TypeDefinitionRecord,
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
  types: TypeDefinitionRecord,
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

  const nodeArgs = new Set(fieldNode.arguments?.map((node) => node.name.value));

  const argsFilter = (argDef: GraphQLArgument) =>
    previouslyAddedArgs[argDef.name] ||
    isNonNullType(argDef.type) ||
    argDef.defaultValue !== undefined ||
    nodeArgs.has(argDef.name);

  return (fields[field.name] = encodeFieldDef(field, argsFilter));
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
  if (!field.args.length) {
    return typeReference;
  }
  const args: InputValueDefinitionRecord = {};
  const fieldDef: FieldDefinitionTuple = [typeReference, args];

  for (const argDef of field.args) {
    if (argumentsFilter && !argumentsFilter(argDef)) {
      continue;
    }
    const typeReference = typeReferenceFromName(argDef.type.toString());
    args[argDef.name] =
      argDef.defaultValue === undefined
        ? typeReference
        : [typeReference, argDef.defaultValue];
  }
  return fieldDef;
}

function encodeEnumType(type: GraphQLEnumType): EnumTypeDefinitionTuple {
  return [TypeKind.ENUM, type.getValues().map((v) => v.name)];
}

function encodeScalarType(_type: GraphQLScalarType): ScalarTypeDefinitionTuple {
  return [TypeKind.SCALAR];
}
