/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * Taken from https://github.com/ardatan/graphql-tools/blob/820b4d3e052a8fb08b96a9d45456355a7affc168/
 * MIT license https://github.com/ardatan/graphql-tools/blob/820b4d3e052a8fb08b96a9d45456355a7affc168/LICENSE
 */

import {
  DocumentNode,
  EnumValueDefinitionNode,
  FieldDefinitionNode,
  GraphQLArgumentConfig,
  GraphQLBoolean,
  GraphQLDirective,
  GraphQLEnumType,
  GraphQLEnumValueConfig,
  GraphQLEnumValueConfigMap,
  GraphQLField,
  GraphQLFieldConfig,
  GraphQLFieldConfigArgumentMap,
  GraphQLFieldConfigMap,
  GraphQLFloat,
  GraphQLID,
  GraphQLInputFieldConfig,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLInputObjectTypeConfig,
  GraphQLInputType,
  GraphQLInt,
  GraphQLInterfaceType,
  GraphQLInterfaceTypeConfig,
  GraphQLList,
  GraphQLNamedType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLObjectTypeConfig,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLString,
  GraphQLType,
  GraphQLUnionType,
  InputValueDefinitionNode,
  Kind,
  buildASTSchema,
  getNullableType,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isLeafType,
  isListType,
  isNamedType,
  isNonNullType,
  isObjectType,
  isScalarType,
  isSpecifiedDirective,
  isSpecifiedScalarType,
  isUnionType,
} from "graphql";
import { Resolvers } from "../../types";
import { Maybe } from "../../jsutils/Maybe";

export const makeExecutableSchema = <TSource, TContext>({
  typeDefs,
  resolvers,
}: {
  typeDefs: DocumentNode;
  resolvers: Resolvers<TSource, TContext>;
}): GraphQLSchema => {
  const schema = buildASTSchema(typeDefs);
  return createNewSchemaWithResolvers(schema, resolvers);
};

const createNewSchemaWithResolvers = <TSource, TContext>(
  schema: GraphQLSchema,
  resolvers: Resolvers<TSource, TContext>,
): GraphQLSchema => {
  schema = mapSchema(schema, {
    [MapperKind.SCALAR_TYPE]: (type) => {
      const config = type.toConfig();
      const resolverValue: any = resolvers[type.name];
      if (!isSpecifiedScalarType(type) && resolverValue != null) {
        for (const fieldName in resolverValue) {
          if (fieldName.startsWith("__")) {
            (config as any)[fieldName.substring(2)] = resolverValue[fieldName];
          } else if (fieldName === "astNode" && config.astNode != null) {
            config.astNode = {
              ...config.astNode,
              description:
                (resolverValue as GraphQLScalarType)?.astNode?.description ??
                config.astNode.description,
              directives: (config.astNode.directives ?? []).concat(
                (resolverValue as GraphQLScalarType)?.astNode?.directives ?? [],
              ),
            };
          } else if (
            fieldName === "extensionASTNodes" &&
            config.extensionASTNodes != null
          ) {
            config.extensionASTNodes = config.extensionASTNodes.concat(
              (resolverValue as GraphQLScalarType)?.extensionASTNodes ?? [],
            );
          } else if (
            fieldName === "extensions" &&
            config.extensions != null &&
            (resolverValue as GraphQLScalarType).extensions != null
          ) {
            config.extensions = Object.assign(
              Object.create(null),
              type.extensions,
              (resolverValue as GraphQLScalarType).extensions,
            );
          } else {
            (config as any)[fieldName] = resolverValue[fieldName];
          }
        }

        return new GraphQLScalarType(config);
      }
    },
    [MapperKind.ENUM_TYPE]: (type) => {
      const resolverValue: any = resolvers[type.name];

      const config = type.toConfig();
      const enumValueConfigMap = config.values;

      if (resolverValue != null) {
        for (const fieldName in resolverValue) {
          if (fieldName.startsWith("__")) {
            (config as any)[fieldName.substring(2)] = resolverValue[fieldName];
          } else if (fieldName === "astNode" && config.astNode != null) {
            config.astNode = {
              ...config.astNode,
              description:
                (resolverValue as GraphQLScalarType)?.astNode?.description ??
                config.astNode.description,
              directives: (config.astNode.directives ?? []).concat(
                (resolverValue as GraphQLEnumType)?.astNode?.directives ?? [],
              ),
            };
          } else if (
            fieldName === "extensionASTNodes" &&
            config.extensionASTNodes != null
          ) {
            config.extensionASTNodes = config.extensionASTNodes.concat(
              (resolverValue as GraphQLEnumType)?.extensionASTNodes ?? [],
            );
          } else if (
            fieldName === "extensions" &&
            config.extensions != null &&
            (resolverValue as GraphQLEnumType).extensions != null
          ) {
            config.extensions = Object.assign(
              Object.create(null),
              type.extensions,
              (resolverValue as GraphQLEnumType).extensions,
            );
          } else if (enumValueConfigMap[fieldName]) {
            enumValueConfigMap[fieldName].value = resolverValue[fieldName];
          }
        }

        return new GraphQLEnumType(config);
      }
    },
    [MapperKind.UNION_TYPE]: (type) => {
      const resolverValue: any = resolvers[type.name];

      if (resolverValue != null) {
        const config = type.toConfig();

        if (resolverValue["__resolveType"]) {
          config.resolveType = resolverValue["__resolveType"];
        }

        return new GraphQLUnionType(config);
      }
    },
    [MapperKind.OBJECT_TYPE]: (type) => {
      const resolverValue: any = resolvers[type.name];
      if (resolverValue != null) {
        const config = type.toConfig();

        if (resolverValue["__isTypeOf"]) {
          config.isTypeOf = resolverValue["__isTypeOf"];
        }

        return new GraphQLObjectType(config);
      }
    },
    [MapperKind.INTERFACE_TYPE]: (type) => {
      const resolverValue: any = resolvers[type.name];
      if (resolverValue != null) {
        const config = type.toConfig();

        if (resolverValue["__resolveType"]) {
          config.resolveType = resolverValue["__resolveType"];
        }

        return new GraphQLInterfaceType(config);
      }
    },
    [MapperKind.COMPOSITE_FIELD]: (fieldConfig, fieldName, typeName) => {
      const resolverValue: any = resolvers[typeName];

      if (resolverValue != null) {
        const fieldResolve = resolverValue[fieldName];
        if (fieldResolve != null) {
          const newFieldConfig = { ...fieldConfig };
          if (typeof fieldResolve === "function") {
            // for convenience. Allows shorter syntax in resolver definition file
            newFieldConfig.resolve = fieldResolve.bind(resolverValue);
          } else {
            setFieldProperties(newFieldConfig, fieldResolve);
          }
          return newFieldConfig;
        }
      }
    },
  });

  function setFieldProperties(
    field: GraphQLField<any, any> | GraphQLFieldConfig<any, any>,
    propertiesObj: Record<string, any>,
  ) {
    for (const propertyName in propertiesObj) {
      (field as any)[propertyName] = propertiesObj[propertyName];
    }
  }

  return schema;
};

function mapSchema(
  schema: GraphQLSchema,
  schemaMapper: SchemaMapper = {},
): GraphQLSchema {
  const newTypeMap = mapArguments(
    mapFields(
      mapTypes(
        mapDefaultValues(
          mapEnumValues(
            mapTypes(
              mapDefaultValues(
                schema.getTypeMap(),
                schema,
                serializeInputValue,
              ),
              schema,
              schemaMapper,
              (type) => isLeafType(type),
            ),
            schema,
            schemaMapper,
          ),
          schema,
          parseInputValue,
        ),
        schema,
        schemaMapper,
        (type) => !isLeafType(type),
      ),
      schema,
      schemaMapper,
    ),
    schema,
    schemaMapper,
  );

  const originalDirectives = schema.getDirectives();
  const newDirectives = mapDirectives(originalDirectives, schema, schemaMapper);

  const { typeMap, directives } = rewireTypes(newTypeMap, newDirectives);

  return new GraphQLSchema({
    ...schema.toConfig(),
    query: getObjectTypeFromTypeMap(
      typeMap,
      getObjectTypeFromTypeMap(newTypeMap, schema.getQueryType()),
    ),
    mutation: getObjectTypeFromTypeMap(
      typeMap,
      getObjectTypeFromTypeMap(newTypeMap, schema.getMutationType()),
    ),
    subscription: getObjectTypeFromTypeMap(
      typeMap,
      getObjectTypeFromTypeMap(newTypeMap, schema.getSubscriptionType()),
    ),
    types: Object.values(typeMap),
    directives,
  });
}

function mapTypes(
  originalTypeMap: Record<string, GraphQLNamedType>,
  schema: GraphQLSchema,
  schemaMapper: SchemaMapper,
  testFn: (originalType: GraphQLNamedType) => boolean = () => true,
): Record<string, GraphQLNamedType> {
  const newTypeMap: Record<string, GraphQLNamedType> = {};

  for (const typeName in originalTypeMap) {
    if (!typeName.startsWith("__")) {
      const originalType = originalTypeMap[typeName];

      if (originalType == null || !testFn(originalType)) {
        newTypeMap[typeName] = originalType;
        continue;
      }

      const typeMapper = getTypeMapper(schema, schemaMapper, typeName);

      if (typeMapper == null) {
        newTypeMap[typeName] = originalType;
        continue;
      }

      const maybeNewType = typeMapper(originalType, schema);

      if (maybeNewType === undefined) {
        newTypeMap[typeName] = originalType;
        continue;
      }

      newTypeMap[typeName] = maybeNewType as GraphQLNamedType;
    }
  }

  return newTypeMap;
}

function mapEnumValues(
  originalTypeMap: Record<string, GraphQLNamedType>,
  schema: GraphQLSchema,
  schemaMapper: SchemaMapper,
): Record<string, GraphQLNamedType> {
  const enumValueMapper = getEnumValueMapper(schemaMapper);
  if (!enumValueMapper) {
    return originalTypeMap;
  }

  return mapTypes(
    originalTypeMap,
    schema,
    {
      [MapperKind.ENUM_TYPE]: (type) => {
        const config = type.toConfig();
        const originalEnumValueConfigMap = config.values;
        const newEnumValueConfigMap: GraphQLEnumValueConfigMap = {};
        for (const externalValue in originalEnumValueConfigMap) {
          const originalEnumValueConfig =
            originalEnumValueConfigMap[externalValue];
          const mappedEnumValue = enumValueMapper(
            originalEnumValueConfig,
            type.name,
            schema,
            externalValue,
          );
          if (mappedEnumValue === undefined) {
            newEnumValueConfigMap[externalValue] = originalEnumValueConfig;
          } else if (Array.isArray(mappedEnumValue)) {
            const [newExternalValue, newEnumValueConfig] = mappedEnumValue;
            newEnumValueConfigMap[newExternalValue] =
              newEnumValueConfig === undefined
                ? originalEnumValueConfig
                : newEnumValueConfig;
          } else if (mappedEnumValue !== null) {
            newEnumValueConfigMap[externalValue] = mappedEnumValue;
          }
        }
        return correctASTNodes(
          new GraphQLEnumType({
            ...config,
            values: newEnumValueConfigMap,
          }),
        );
      },
    },
    (type) => isEnumType(type),
  );
}

function mapDefaultValues(
  originalTypeMap: Record<string, GraphQLNamedType>,
  schema: GraphQLSchema,
  fn: IDefaultValueIteratorFn,
): Record<string, GraphQLNamedType> {
  const newTypeMap = mapArguments(originalTypeMap, schema, {
    [MapperKind.ARGUMENT]: (argumentConfig) => {
      if (argumentConfig.defaultValue === undefined) {
        return argumentConfig;
      }

      const maybeNewType = getNewType(originalTypeMap, argumentConfig.type);
      if (maybeNewType != null) {
        return {
          ...argumentConfig,
          defaultValue: fn(maybeNewType, argumentConfig.defaultValue),
        };
      }
    },
  });

  return mapFields(newTypeMap, schema, {
    [MapperKind.INPUT_OBJECT_FIELD]: (inputFieldConfig) => {
      if (inputFieldConfig.defaultValue === undefined) {
        return inputFieldConfig;
      }

      const maybeNewType = getNewType(newTypeMap, inputFieldConfig.type);
      if (maybeNewType != null) {
        return {
          ...inputFieldConfig,
          defaultValue: fn(maybeNewType, inputFieldConfig.defaultValue),
        };
      }
    },
  });
}

function getNewType<T extends GraphQLType>(
  newTypeMap: Record<string, GraphQLNamedType>,
  type: T,
): T | null {
  if (isListType(type)) {
    const newType = getNewType(newTypeMap, type.ofType);
    return newType != null ? (new GraphQLList(newType) as T) : null;
  } else if (isNonNullType(type)) {
    const newType = getNewType(newTypeMap, type.ofType);
    return newType != null ? (new GraphQLNonNull(newType) as T) : null;
  } else if (isNamedType(type)) {
    const newType = newTypeMap[type.name];
    return newType != null ? (newType as T) : null;
  }

  return null;
}

function mapFields(
  originalTypeMap: Record<string, GraphQLNamedType>,
  schema: GraphQLSchema,
  schemaMapper: SchemaMapper,
): Record<string, GraphQLNamedType> {
  const newTypeMap: Record<string, GraphQLNamedType> = {};

  for (const typeName in originalTypeMap) {
    if (!typeName.startsWith("__")) {
      const originalType = originalTypeMap[typeName];

      if (
        !isObjectType(originalType) &&
        !isInterfaceType(originalType) &&
        !isInputObjectType(originalType)
      ) {
        newTypeMap[typeName] = originalType;
        continue;
      }

      const fieldMapper = getFieldMapper(schema, schemaMapper, typeName);
      if (fieldMapper == null) {
        newTypeMap[typeName] = originalType;
        continue;
      }

      const config = originalType.toConfig();

      const originalFieldConfigMap = config.fields;
      const newFieldConfigMap:
        | GraphQLFieldConfigMap<unknown, unknown>
        | GraphQLInputFieldConfigMap = {};
      for (const fieldName in originalFieldConfigMap) {
        const originalFieldConfig = originalFieldConfigMap[fieldName];
        const mappedField = fieldMapper(
          originalFieldConfig,
          fieldName,
          typeName,
          schema,
        );
        if (mappedField === undefined) {
          newFieldConfigMap[fieldName] = originalFieldConfig;
        } else if (Array.isArray(mappedField)) {
          const [newFieldName, newFieldConfig] = mappedField;
          if (newFieldConfig.astNode != null) {
            newFieldConfig.astNode = {
              ...newFieldConfig.astNode,
              name: {
                ...newFieldConfig.astNode.name,
                value: newFieldName,
              },
            };
          }
          newFieldConfigMap[newFieldName] =
            newFieldConfig === undefined ? originalFieldConfig : newFieldConfig;
        } else if (mappedField !== null) {
          newFieldConfigMap[fieldName] = mappedField;
        }
      }

      if (isObjectType(originalType)) {
        newTypeMap[typeName] = correctASTNodes(
          new GraphQLObjectType({
            ...(config as GraphQLObjectTypeConfig<any, any>),
            fields: newFieldConfigMap as GraphQLFieldConfigMap<
              unknown,
              unknown
            >,
          }),
        );
      } else if (isInterfaceType(originalType)) {
        newTypeMap[typeName] = correctASTNodes(
          new GraphQLInterfaceType({
            ...(config as GraphQLInterfaceTypeConfig<any, any>),
            fields: newFieldConfigMap as GraphQLFieldConfigMap<
              unknown,
              unknown
            >,
          }),
        );
      } else {
        newTypeMap[typeName] = correctASTNodes(
          new GraphQLInputObjectType({
            ...(config as GraphQLInputObjectTypeConfig),
            fields: newFieldConfigMap as GraphQLInputFieldConfigMap,
          }),
        );
      }
    }
  }

  return newTypeMap;
}

function mapArguments(
  originalTypeMap: Record<string, GraphQLNamedType>,
  schema: GraphQLSchema,
  schemaMapper: SchemaMapper,
): Record<string, GraphQLNamedType> {
  const newTypeMap: Record<string, GraphQLNamedType> = {};

  for (const typeName in originalTypeMap) {
    if (!typeName.startsWith("__")) {
      const originalType = originalTypeMap[typeName];

      if (!isObjectType(originalType) && !isInterfaceType(originalType)) {
        newTypeMap[typeName] = originalType;
        continue;
      }

      const argumentMapper = getArgumentMapper(schemaMapper);
      if (argumentMapper == null) {
        newTypeMap[typeName] = originalType;
        continue;
      }

      const config = originalType.toConfig();

      const originalFieldConfigMap = config.fields;
      const newFieldConfigMap:
        | GraphQLFieldConfigMap<unknown, unknown>
        | GraphQLInputFieldConfigMap = {};
      for (const fieldName in originalFieldConfigMap) {
        const originalFieldConfig = originalFieldConfigMap[fieldName];
        const originalArgumentConfigMap = originalFieldConfig.args;

        if (originalArgumentConfigMap == null) {
          newFieldConfigMap[fieldName] = originalFieldConfig;
          continue;
        }

        const argumentNames = Object.keys(originalArgumentConfigMap);

        if (!argumentNames.length) {
          newFieldConfigMap[fieldName] = originalFieldConfig;
          continue;
        }

        const newArgumentConfigMap: GraphQLFieldConfigArgumentMap = {};

        for (const argumentName of argumentNames) {
          const originalArgumentConfig =
            originalArgumentConfigMap[argumentName];

          const mappedArgument = argumentMapper(
            originalArgumentConfig,
            fieldName,
            typeName,
            schema,
          );

          if (mappedArgument === undefined) {
            newArgumentConfigMap[argumentName] = originalArgumentConfig;
          } else if (Array.isArray(mappedArgument)) {
            const [newArgumentName, newArgumentConfig] = mappedArgument;
            newArgumentConfigMap[newArgumentName] = newArgumentConfig;
          } else if (mappedArgument !== null) {
            newArgumentConfigMap[argumentName] = mappedArgument;
          }
        }

        newFieldConfigMap[fieldName] = {
          ...originalFieldConfig,
          args: newArgumentConfigMap,
        };
      }

      if (isObjectType(originalType)) {
        newTypeMap[typeName] = new GraphQLObjectType({
          ...(config as unknown as GraphQLObjectTypeConfig<any, any>),
          fields: newFieldConfigMap as GraphQLFieldConfigMap<unknown, unknown>,
        });
      } else if (isInterfaceType(originalType)) {
        newTypeMap[typeName] = new GraphQLInterfaceType({
          ...(config as unknown as GraphQLInterfaceTypeConfig<any, any>),
          fields: newFieldConfigMap as GraphQLFieldConfigMap<unknown, unknown>,
        });
      } else {
        newTypeMap[typeName] = new GraphQLInputObjectType({
          ...(config as unknown as GraphQLInputObjectTypeConfig),
          fields: newFieldConfigMap as GraphQLInputFieldConfigMap,
        });
      }
    }
  }

  return newTypeMap;
}

function mapDirectives(
  originalDirectives: ReadonlyArray<GraphQLDirective>,
  schema: GraphQLSchema,
  schemaMapper: SchemaMapper,
): Array<GraphQLDirective> {
  const directiveMapper = getDirectiveMapper(schemaMapper);
  if (directiveMapper == null) {
    return originalDirectives.slice();
  }

  const newDirectives: Array<GraphQLDirective> = [];

  for (const directive of originalDirectives) {
    const mappedDirective = directiveMapper(directive, schema);
    if (mappedDirective === undefined) {
      newDirectives.push(directive);
    } else if (mappedDirective !== null) {
      newDirectives.push(mappedDirective);
    }
  }

  return newDirectives;
}

function getTypeSpecifiers(
  schema: GraphQLSchema,
  typeName: string,
): Array<MapperKind> {
  const type = schema.getType(typeName);
  const specifiers = [MapperKind.TYPE];

  if (isObjectType(type)) {
    specifiers.push(MapperKind.COMPOSITE_TYPE, MapperKind.OBJECT_TYPE);
    if (typeName === schema.getQueryType()?.name) {
      specifiers.push(MapperKind.ROOT_OBJECT, MapperKind.QUERY);
    } else if (typeName === schema.getMutationType()?.name) {
      specifiers.push(MapperKind.ROOT_OBJECT, MapperKind.MUTATION);
    } else if (typeName === schema.getSubscriptionType()?.name) {
      specifiers.push(MapperKind.ROOT_OBJECT, MapperKind.SUBSCRIPTION);
    }
  } else if (isInputObjectType(type)) {
    specifiers.push(MapperKind.INPUT_OBJECT_TYPE);
  } else if (isInterfaceType(type)) {
    specifiers.push(
      MapperKind.COMPOSITE_TYPE,
      MapperKind.ABSTRACT_TYPE,
      MapperKind.INTERFACE_TYPE,
    );
  } else if (isUnionType(type)) {
    specifiers.push(
      MapperKind.COMPOSITE_TYPE,
      MapperKind.ABSTRACT_TYPE,
      MapperKind.UNION_TYPE,
    );
  } else if (isEnumType(type)) {
    specifiers.push(MapperKind.ENUM_TYPE);
  } else if (isScalarType(type)) {
    specifiers.push(MapperKind.SCALAR_TYPE);
  }

  return specifiers;
}

function getTypeMapper(
  schema: GraphQLSchema,
  schemaMapper: SchemaMapper,
  typeName: string,
): NamedTypeMapper | null {
  const specifiers = getTypeSpecifiers(schema, typeName);
  let typeMapper: NamedTypeMapper | undefined;
  const stack = [...specifiers];
  while (!typeMapper && stack.length > 0) {
    const next = stack.pop() as MapperKind;
    typeMapper = schemaMapper[next] as NamedTypeMapper;
  }

  return typeMapper != null ? typeMapper : null;
}

function getFieldSpecifiers(
  schema: GraphQLSchema,
  typeName: string,
): SchemaFieldMapperTypes {
  const type = schema.getType(typeName);
  const specifiers: SchemaFieldMapperTypes = [MapperKind.FIELD];

  if (isObjectType(type)) {
    specifiers.push(MapperKind.COMPOSITE_FIELD, MapperKind.OBJECT_FIELD);
    if (typeName === schema.getQueryType()?.name) {
      specifiers.push(MapperKind.ROOT_FIELD, MapperKind.QUERY_ROOT_FIELD);
    } else if (typeName === schema.getMutationType()?.name) {
      specifiers.push(MapperKind.ROOT_FIELD, MapperKind.MUTATION_ROOT_FIELD);
    } else if (typeName === schema.getSubscriptionType()?.name) {
      specifiers.push(
        MapperKind.ROOT_FIELD,
        MapperKind.SUBSCRIPTION_ROOT_FIELD,
      );
    }
  } else if (isInterfaceType(type)) {
    specifiers.push(MapperKind.COMPOSITE_FIELD, MapperKind.INTERFACE_FIELD);
  } else if (isInputObjectType(type)) {
    specifiers.push(MapperKind.INPUT_OBJECT_FIELD);
  }

  return specifiers;
}

function getFieldMapper<
  F extends GraphQLFieldConfig<any, any> | GraphQLInputFieldConfig,
>(
  schema: GraphQLSchema,
  schemaMapper: SchemaMapper,
  typeName: string,
): GenericFieldMapper<F> | null {
  const specifiers = getFieldSpecifiers(schema, typeName);
  let fieldMapper: GenericFieldMapper<F> | undefined;
  const stack = [...specifiers];
  while (!fieldMapper && stack.length > 0) {
    // It is safe to use as here as we check the length.
    const next = stack.pop() as MapperKind;
    // TODO: fix this as unknown cast
    fieldMapper = schemaMapper[next] as unknown as GenericFieldMapper<F>;
  }

  return fieldMapper ?? null;
}

function getArgumentMapper(schemaMapper: SchemaMapper): ArgumentMapper | null {
  const argumentMapper = schemaMapper[MapperKind.ARGUMENT];
  return argumentMapper != null ? argumentMapper : null;
}

function getDirectiveMapper(
  schemaMapper: SchemaMapper,
): DirectiveMapper | null {
  const directiveMapper = schemaMapper[MapperKind.DIRECTIVE];
  return directiveMapper != null ? directiveMapper : null;
}

function getEnumValueMapper(
  schemaMapper: SchemaMapper,
): EnumValueMapper | null {
  const enumValueMapper = schemaMapper[MapperKind.ENUM_VALUE];
  return enumValueMapper != null ? enumValueMapper : null;
}

function correctASTNodes(type: GraphQLObjectType): GraphQLObjectType;
function correctASTNodes(type: GraphQLInterfaceType): GraphQLInterfaceType;
function correctASTNodes(type: GraphQLInputObjectType): GraphQLInputObjectType;
function correctASTNodes(type: GraphQLEnumType): GraphQLEnumType;
function correctASTNodes(type: GraphQLNamedType): GraphQLNamedType {
  if (isObjectType(type)) {
    const config = (type as GraphQLObjectType).toConfig();
    if (config.astNode != null) {
      const fields: Array<FieldDefinitionNode> = [];
      for (const fieldName in config.fields) {
        const fieldConfig = config.fields[fieldName];

        if (fieldConfig.astNode != null) {
          fields.push(fieldConfig.astNode);
        }
      }

      config.astNode = {
        ...config.astNode,
        kind: Kind.OBJECT_TYPE_DEFINITION,
        fields,
      };
    }

    if (config.extensionASTNodes != null) {
      config.extensionASTNodes = config.extensionASTNodes.map((node) => ({
        ...node,
        kind: Kind.OBJECT_TYPE_EXTENSION,
        fields: undefined,
      }));
    }

    return new GraphQLObjectType(config);
  } else if (isInterfaceType(type)) {
    const config = (type as GraphQLInterfaceType).toConfig();
    if (config.astNode != null) {
      const fields: Array<FieldDefinitionNode> = [];
      for (const fieldName in config.fields) {
        const fieldConfig = config.fields[fieldName];

        if (fieldConfig.astNode != null) {
          fields.push(fieldConfig.astNode);
        }
      }
      config.astNode = {
        ...config.astNode,
        kind: Kind.INTERFACE_TYPE_DEFINITION,
        fields,
      };
    }

    if (config.extensionASTNodes != null) {
      config.extensionASTNodes = config.extensionASTNodes.map((node) => ({
        ...node,
        kind: Kind.INTERFACE_TYPE_EXTENSION,
        fields: undefined,
      }));
    }

    return new GraphQLInterfaceType(config);
  } else if (isInputObjectType(type)) {
    const config = (type as GraphQLInputObjectType).toConfig();
    if (config.astNode != null) {
      const fields: Array<InputValueDefinitionNode> = [];
      for (const fieldName in config.fields) {
        const fieldConfig = config.fields[fieldName];

        if (fieldConfig.astNode != null) {
          fields.push(fieldConfig.astNode);
        }
      }
      config.astNode = {
        ...config.astNode,
        kind: Kind.INPUT_OBJECT_TYPE_DEFINITION,
        fields,
      };
    }

    if (config.extensionASTNodes != null) {
      config.extensionASTNodes = config.extensionASTNodes.map((node) => ({
        ...node,
        kind: Kind.INPUT_OBJECT_TYPE_EXTENSION,
        fields: undefined,
      }));
    }

    return new GraphQLInputObjectType(config);
  } else if (isEnumType(type)) {
    const config = (type as GraphQLEnumType).toConfig();
    if (config.astNode != null) {
      const values: Array<EnumValueDefinitionNode> = [];
      for (const enumKey in config.values) {
        const enumValueConfig = config.values[enumKey];
        if (enumValueConfig.astNode != null) {
          values.push(enumValueConfig.astNode);
        }
      }
      config.astNode = {
        ...config.astNode,
        values,
      };
    }

    if (config.extensionASTNodes != null) {
      config.extensionASTNodes = config.extensionASTNodes.map((node) => ({
        ...node,
        values: undefined,
      }));
    }

    return new GraphQLEnumType(config);
  } else {
    return type;
  }
}

function getObjectTypeFromTypeMap(
  typeMap: Record<string, GraphQLNamedType>,
  type: Maybe<GraphQLObjectType>,
): GraphQLObjectType | undefined {
  if (type) {
    const maybeObjectType = typeMap[type.name];
    if (isObjectType(maybeObjectType)) {
      return maybeObjectType;
    }
  }
}

enum MapperKind {
  TYPE = "MapperKind.TYPE",
  SCALAR_TYPE = "MapperKind.SCALAR_TYPE",
  ENUM_TYPE = "MapperKind.ENUM_TYPE",
  COMPOSITE_TYPE = "MapperKind.COMPOSITE_TYPE",
  OBJECT_TYPE = "MapperKind.OBJECT_TYPE",
  INPUT_OBJECT_TYPE = "MapperKind.INPUT_OBJECT_TYPE",
  ABSTRACT_TYPE = "MapperKind.ABSTRACT_TYPE",
  UNION_TYPE = "MapperKind.UNION_TYPE",
  INTERFACE_TYPE = "MapperKind.INTERFACE_TYPE",
  ROOT_OBJECT = "MapperKind.ROOT_OBJECT",
  QUERY = "MapperKind.QUERY",
  MUTATION = "MapperKind.MUTATION",
  SUBSCRIPTION = "MapperKind.SUBSCRIPTION",
  DIRECTIVE = "MapperKind.DIRECTIVE",
  FIELD = "MapperKind.FIELD",
  COMPOSITE_FIELD = "MapperKind.COMPOSITE_FIELD",
  OBJECT_FIELD = "MapperKind.OBJECT_FIELD",
  ROOT_FIELD = "MapperKind.ROOT_FIELD",
  QUERY_ROOT_FIELD = "MapperKind.QUERY_ROOT_FIELD",
  MUTATION_ROOT_FIELD = "MapperKind.MUTATION_ROOT_FIELD",
  SUBSCRIPTION_ROOT_FIELD = "MapperKind.SUBSCRIPTION_ROOT_FIELD",
  INTERFACE_FIELD = "MapperKind.INTERFACE_FIELD",
  INPUT_OBJECT_FIELD = "MapperKind.INPUT_OBJECT_FIELD",
  ARGUMENT = "MapperKind.ARGUMENT",
  ENUM_VALUE = "MapperKind.ENUM_VALUE",
}

interface SchemaMapper {
  [MapperKind.TYPE]?: NamedTypeMapper;
  [MapperKind.SCALAR_TYPE]?: ScalarTypeMapper;
  [MapperKind.ENUM_TYPE]?: EnumTypeMapper;
  [MapperKind.COMPOSITE_TYPE]?: CompositeTypeMapper;
  [MapperKind.OBJECT_TYPE]?: ObjectTypeMapper;
  [MapperKind.INPUT_OBJECT_TYPE]?: InputObjectTypeMapper;
  [MapperKind.ABSTRACT_TYPE]?: AbstractTypeMapper;
  [MapperKind.UNION_TYPE]?: UnionTypeMapper;
  [MapperKind.INTERFACE_TYPE]?: InterfaceTypeMapper;
  [MapperKind.ROOT_OBJECT]?: ObjectTypeMapper;
  [MapperKind.QUERY]?: ObjectTypeMapper;
  [MapperKind.MUTATION]?: ObjectTypeMapper;
  [MapperKind.SUBSCRIPTION]?: ObjectTypeMapper;
  [MapperKind.ENUM_VALUE]?: EnumValueMapper;
  [MapperKind.FIELD]?: GenericFieldMapper<
    GraphQLFieldConfig<any, any> | GraphQLInputFieldConfig
  >;
  [MapperKind.OBJECT_FIELD]?: FieldMapper;
  [MapperKind.ROOT_FIELD]?: FieldMapper;
  [MapperKind.QUERY_ROOT_FIELD]?: FieldMapper;
  [MapperKind.MUTATION_ROOT_FIELD]?: FieldMapper;
  [MapperKind.SUBSCRIPTION_ROOT_FIELD]?: FieldMapper;
  [MapperKind.INTERFACE_FIELD]?: FieldMapper;
  [MapperKind.COMPOSITE_FIELD]?: FieldMapper;
  [MapperKind.ARGUMENT]?: ArgumentMapper;
  [MapperKind.INPUT_OBJECT_FIELD]?: InputFieldMapper;
  [MapperKind.DIRECTIVE]?: DirectiveMapper;
}

type SchemaFieldMapperTypes = Array<
  | MapperKind.FIELD
  | MapperKind.COMPOSITE_FIELD
  | MapperKind.OBJECT_FIELD
  | MapperKind.ROOT_FIELD
  | MapperKind.QUERY_ROOT_FIELD
  | MapperKind.MUTATION_ROOT_FIELD
  | MapperKind.SUBSCRIPTION_ROOT_FIELD
  | MapperKind.INTERFACE_FIELD
  | MapperKind.INPUT_OBJECT_FIELD
>;

type NamedTypeMapper = (
  type: GraphQLNamedType,
  schema: GraphQLSchema,
) => GraphQLNamedType | null | undefined;

type ScalarTypeMapper = (
  type: GraphQLScalarType,
  schema: GraphQLSchema,
) => GraphQLScalarType | null | undefined;

type EnumTypeMapper = (
  type: GraphQLEnumType,
  schema: GraphQLSchema,
) => GraphQLEnumType | null | undefined;

type EnumValueMapper = (
  valueConfig: GraphQLEnumValueConfig,
  typeName: string,
  schema: GraphQLSchema,
  externalValue: string,
) =>
  | GraphQLEnumValueConfig
  | [string, GraphQLEnumValueConfig]
  | null
  | undefined;

type CompositeTypeMapper = (
  type: GraphQLObjectType | GraphQLInterfaceType | GraphQLUnionType,
  schema: GraphQLSchema,
) =>
  | GraphQLObjectType
  | GraphQLInterfaceType
  | GraphQLUnionType
  | null
  | undefined;

type ObjectTypeMapper = (
  type: GraphQLObjectType,
  schema: GraphQLSchema,
) => GraphQLObjectType | null | undefined;

type InputObjectTypeMapper = (
  type: GraphQLInputObjectType,
  schema: GraphQLSchema,
) => GraphQLInputObjectType | null | undefined;

type AbstractTypeMapper = (
  type: GraphQLInterfaceType | GraphQLUnionType,
  schema: GraphQLSchema,
) => GraphQLInterfaceType | GraphQLUnionType | null | undefined;

type UnionTypeMapper = (
  type: GraphQLUnionType,
  schema: GraphQLSchema,
) => GraphQLUnionType | null | undefined;

type InterfaceTypeMapper = (
  type: GraphQLInterfaceType,
  schema: GraphQLSchema,
) => GraphQLInterfaceType | null | undefined;

type DirectiveMapper = (
  directive: GraphQLDirective,
  schema: GraphQLSchema,
) => GraphQLDirective | null | undefined;

type GenericFieldMapper<
  F extends GraphQLFieldConfig<any, any> | GraphQLInputFieldConfig,
> = (
  fieldConfig: F,
  fieldName: string,
  typeName: string,
  schema: GraphQLSchema,
) => F | [string, F] | null | undefined;

type FieldMapper = GenericFieldMapper<GraphQLFieldConfig<any, any>>;

type ArgumentMapper = (
  argumentConfig: GraphQLArgumentConfig,
  fieldName: string,
  typeName: string,
  schema: GraphQLSchema,
) => GraphQLArgumentConfig | [string, GraphQLArgumentConfig] | null | undefined;

type InputFieldMapper = GenericFieldMapper<GraphQLInputFieldConfig>;

function rewireTypes(
  originalTypeMap: Record<string, GraphQLNamedType | null>,
  directives: ReadonlyArray<GraphQLDirective>,
): {
  typeMap: Record<string, GraphQLNamedType>;
  directives: Array<GraphQLDirective>;
} {
  const referenceTypeMap = Object.create(null);
  for (const typeName in originalTypeMap) {
    referenceTypeMap[typeName] = originalTypeMap[typeName];
  }
  const newTypeMap: Record<string, GraphQLNamedType> = Object.create(null);

  for (const typeName in referenceTypeMap) {
    const namedType = referenceTypeMap[typeName];

    if (namedType == null || typeName.startsWith("__")) {
      continue;
    }

    const newName = namedType.name;
    if (newName.startsWith("__")) {
      continue;
    }

    if (newTypeMap[newName] != null) {
      console.warn(
        `Duplicate schema type name ${newName} found; keeping the existing one found in the schema`,
      );
      continue;
    }

    newTypeMap[newName] = namedType;
  }

  for (const typeName in newTypeMap) {
    newTypeMap[typeName] = rewireNamedType(newTypeMap[typeName]);
  }

  const newDirectives = directives.map((directive) =>
    rewireDirective(directive),
  );

  return {
    typeMap: newTypeMap,
    directives: newDirectives,
  };

  function rewireDirective(directive: GraphQLDirective): GraphQLDirective {
    if (isSpecifiedDirective(directive)) {
      return directive;
    }
    const directiveConfig = directive.toConfig();
    directiveConfig.args = rewireArgs(directiveConfig.args);
    return new GraphQLDirective(directiveConfig);
  }

  function rewireArgs(
    args: GraphQLFieldConfigArgumentMap,
  ): GraphQLFieldConfigArgumentMap {
    const rewiredArgs: GraphQLFieldConfigArgumentMap = {};
    for (const argName in args) {
      const arg = args[argName];
      const rewiredArgType = rewireType(arg.type);
      if (rewiredArgType != null) {
        arg.type = rewiredArgType;
        rewiredArgs[argName] = arg;
      }
    }
    return rewiredArgs;
  }

  function rewireNamedType<T extends GraphQLNamedType>(type: T) {
    if (isObjectType(type)) {
      const config = (type as GraphQLObjectType).toConfig();
      const newConfig = {
        ...config,
        fields: () => rewireFields(config.fields),
        interfaces: () => rewireNamedTypes(config.interfaces),
      };
      return new GraphQLObjectType(newConfig);
    } else if (isInterfaceType(type)) {
      const config = (type as GraphQLInterfaceType).toConfig();
      const newConfig: any = {
        ...config,
        fields: () => rewireFields(config.fields),
      };
      if ("interfaces" in newConfig) {
        newConfig.interfaces = () =>
          rewireNamedTypes(
            (config as unknown as { interfaces: Array<GraphQLInterfaceType> })
              .interfaces,
          );
      }
      return new GraphQLInterfaceType(newConfig);
    } else if (isUnionType(type)) {
      const config = (type as GraphQLUnionType).toConfig();
      const newConfig = {
        ...config,
        types: () => rewireNamedTypes(config.types),
      };
      return new GraphQLUnionType(newConfig);
    } else if (isInputObjectType(type)) {
      const config = (type as GraphQLInputObjectType).toConfig();
      const newConfig = {
        ...config,
        fields: () => rewireInputFields(config.fields),
      };
      return new GraphQLInputObjectType(newConfig);
    } else if (isEnumType(type)) {
      const enumConfig = (type as GraphQLEnumType).toConfig();
      return new GraphQLEnumType(enumConfig);
    } else if (isScalarType(type)) {
      if (isSpecifiedScalarType(type)) {
        return type;
      }
      const scalarConfig = (type as GraphQLScalarType).toConfig();
      return new GraphQLScalarType(scalarConfig);
    }

    throw new Error(`Unexpected schema type: ${type as unknown as string}`);
  }

  function rewireFields(
    fields: GraphQLFieldConfigMap<any, any>,
  ): GraphQLFieldConfigMap<any, any> {
    const rewiredFields: GraphQLFieldConfigMap<any, any> = {};
    for (const fieldName in fields) {
      const field = fields[fieldName];
      const rewiredFieldType = rewireType(field.type);
      if (rewiredFieldType != null && field.args) {
        field.type = rewiredFieldType;
        field.args = rewireArgs(field.args);
        rewiredFields[fieldName] = field;
      }
    }
    return rewiredFields;
  }

  function rewireInputFields(
    fields: GraphQLInputFieldConfigMap,
  ): GraphQLInputFieldConfigMap {
    const rewiredFields: GraphQLInputFieldConfigMap = {};
    for (const fieldName in fields) {
      const field = fields[fieldName];
      const rewiredFieldType = rewireType(field.type);
      if (rewiredFieldType != null) {
        field.type = rewiredFieldType;
        rewiredFields[fieldName] = field;
      }
    }
    return rewiredFields;
  }

  function rewireNamedTypes<T extends GraphQLNamedType>(
    namedTypes: Iterable<T>,
  ): Array<T> {
    const rewiredTypes: Array<T> = [];
    for (const namedType of namedTypes) {
      const rewiredType = rewireType(namedType);
      if (rewiredType != null) {
        rewiredTypes.push(rewiredType);
      }
    }
    return rewiredTypes;
  }

  function rewireType<T extends GraphQLType>(type: T): T | null {
    if (isListType(type)) {
      const rewiredType = rewireType(type.ofType);
      return rewiredType != null ? (new GraphQLList(rewiredType) as T) : null;
    } else if (isNonNullType(type)) {
      const rewiredType = rewireType(type.ofType);
      return rewiredType != null
        ? (new GraphQLNonNull(rewiredType) as T)
        : null;
    } else if (isNamedType(type)) {
      let rewiredType = referenceTypeMap[type.name];
      if (rewiredType === undefined) {
        rewiredType = isNamedStub(type)
          ? getBuiltInForStub(type)
          : rewireNamedType(type);
        newTypeMap[rewiredType.name] = referenceTypeMap[type.name] =
          rewiredType;
      }
      return rewiredType != null ? (newTypeMap[rewiredType.name] as T) : null;
    }

    return null;
  }
}

function isNamedStub(type: GraphQLNamedType): boolean {
  if ("getFields" in type) {
    const fields = type.getFields();
    // eslint-disable-next-line no-unreachable-loop
    for (const fieldName in fields) {
      const field = fields[fieldName];
      return field.name === "_fake";
    }
  }

  return false;
}

function getBuiltInForStub(type: GraphQLNamedType): GraphQLNamedType {
  switch (type.name) {
    case GraphQLInt.name:
      return GraphQLInt;
    case GraphQLFloat.name:
      return GraphQLFloat;
    case GraphQLString.name:
      return GraphQLString;
    case GraphQLBoolean.name:
      return GraphQLBoolean;
    case GraphQLID.name:
      return GraphQLID;
    default:
      return type;
  }
}

type IDefaultValueIteratorFn = (type: GraphQLInputType, value: any) => void;

function transformInputValue(
  type: GraphQLInputType,
  value: any,
  inputLeafValueTransformer: Maybe<InputLeafValueTransformer> = null,
  inputObjectValueTransformer: Maybe<InputObjectValueTransformer> = null,
): any {
  if (value == null) {
    return value;
  }

  const nullableType = getNullableType(type);

  if (isLeafType(nullableType)) {
    return inputLeafValueTransformer != null
      ? inputLeafValueTransformer(nullableType, value)
      : value;
  } else if (isListType(nullableType)) {
    return asArray(value).map((listMember: any) =>
      transformInputValue(
        nullableType.ofType,
        listMember,
        inputLeafValueTransformer,
        inputObjectValueTransformer,
      ),
    );
  } else if (isInputObjectType(nullableType)) {
    const fields = nullableType.getFields();
    const newValue: GraphQLInputFieldConfigMap = {};
    for (const key in value) {
      const field = fields[key];
      if (field != null) {
        newValue[key] = transformInputValue(
          field.type,
          value[key],
          inputLeafValueTransformer,
          inputObjectValueTransformer,
        );
      }
    }
    return inputObjectValueTransformer != null
      ? inputObjectValueTransformer(nullableType, newValue)
      : newValue;
  }

  // unreachable, no other possible return value
}

function serializeInputValue(type: GraphQLInputType, value: any) {
  return transformInputValue(type, value, (t, v) => {
    try {
      return t.serialize(v);
    } catch {
      return v;
    }
  });
}

function parseInputValue(type: GraphQLInputType, value: any) {
  return transformInputValue(type, value, (t, v) => {
    try {
      return t.parseValue(v);
    } catch {
      return v;
    }
  });
}

type InputLeafValueTransformer = (
  type: GraphQLEnumType | GraphQLScalarType,
  originalValue: any,
) => any;
type InputObjectValueTransformer = (
  type: GraphQLInputObjectType,
  originalValue: Record<string, any>,
) => Record<string, any>;

const asArray = <T>(fns: T | T[]) =>
  Array.isArray(fns) ? fns : fns ? [fns] : [];
