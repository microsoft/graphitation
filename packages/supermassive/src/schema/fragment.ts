import { GraphQLEnumType, GraphQLLeafType, GraphQLScalarType } from "graphql";
import {
  DirectiveDefinitionTuple,
  DirectiveKeys,
  EnumKeys,
  EnumTypeDefinitionTuple,
  FieldDefinition,
  FieldDefinitionRecord,
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
  SchemaFragmentDefinitions,
  TypeKind,
  TypeName,
  TypeReference,
  UnionKeys,
  UnionTypeDefinitionTuple,
} from "./definition";
import {
  FunctionFieldResolver,
  ObjectTypeResolver,
  ScalarTypeResolver,
  TypeResolver,
  UserResolvers,
} from "../types";
import { isObjectLike } from "../jsutils/isObjectLike";
import {
  isInterfaceTypeResolver,
  isScalarTypeResolver,
  isSpecifiedScalarType,
  isUnionTypeResolver,
  specifiedScalarResolvers,
} from "./resolvers";
import { typeNameFromReference } from "./reference";

const specifiedScalarDefinition: ScalarTypeDefinitionTuple = [TypeKind.SCALAR];
const typeNameMetaFieldDef: FieldDefinition = "String";
const resolveTypeName: FunctionFieldResolver<unknown, unknown> = (
  _source,
  _args,
  _context,
  info,
) => info.parentTypeName;
const emptyObject = Object.freeze(Object.create(null));

export class SchemaFragment {
  static parseOptions = { noLocation: true };

  private static scalarTypeResolvers: Record<string, ScalarTypeResolver> =
    Object.create(null);

  private static enumTypeResolvers: Record<string, GraphQLEnumType> =
    Object.create(null);

  // Lifecycle: one instance per GraphQL operation
  constructor(
    private definitions: SchemaFragmentDefinitions,
    private resolvers: UserResolvers,
  ) {}

  public getTypeReference(
    tupleOrRef: FieldDefinition | InputValueDefinition,
  ): TypeReference {
    return Array.isArray(tupleOrRef) ? tupleOrRef[0] : tupleOrRef;
  }

  public getObjectType(
    typeName: TypeName,
  ): ObjectTypeDefinitionTuple | undefined {
    const type = this.definitions.types[typeName];
    return type?.[0] === TypeKind.OBJECT ? type : undefined;
  }

  public getObjectFields(
    def: ObjectTypeDefinitionTuple,
  ): FieldDefinitionRecord | undefined {
    return def[ObjectKeys.fields];
  }

  public addInterfaceImplementation(
    interfaceType: TypeName,
    objectType: TypeName,
  ) {
    const iface = this.getInterfaceType(interfaceType);
    const type = this.definitions.types[objectType];

    if (!iface) {
      throw new Error(
        `Type ${interfaceType} either doesn't exist or is not an interface`,
      );
    }
    if (!type) {
      this.definitions.types[objectType] = [
        TypeKind.OBJECT,
        Object.create(null),
        [interfaceType],
      ];
      return;
    }
    let knownInterfaces = type[ObjectKeys.interfaces];
    if (!knownInterfaces) {
      knownInterfaces = [];
      type[ObjectKeys.interfaces] = knownInterfaces;
    }
    if (!knownInterfaces.includes(interfaceType)) {
      knownInterfaces.push(interfaceType);
    }
  }

  public getField(typeName: TypeName, fieldName: string) {
    if (fieldName === "__typename") {
      return typeNameMetaFieldDef;
    }
    return (
      this.getOwnField(typeName, fieldName) ??
      this.findInterfaceField(typeName, fieldName)
    );
  }

  private getOwnField(
    typeName: TypeName,
    fieldName: string,
  ): FieldDefinition | undefined {
    const type = this.definitions.types[typeName];
    if (!type) {
      return undefined;
    }
    if (type[0] === TypeKind.INTERFACE) {
      return type[InterfaceKeys.fields]?.[fieldName];
    }
    if (type[0] === TypeKind.OBJECT) {
      return type[ObjectKeys.fields]?.[fieldName];
    }
    return undefined;
  }

  private findInterfaceField(typeName: TypeName, fieldName: string) {
    const type = this.definitions.types[typeName];
    if (!type) {
      return undefined;
    }
    if (type[0] === TypeKind.INTERFACE && type[InterfaceKeys.interfaces]) {
      return this.findField(type[InterfaceKeys.interfaces], fieldName);
    }
    if (type[0] === TypeKind.OBJECT && type[ObjectKeys.interfaces]) {
      return this.findField(type[ObjectKeys.interfaces], fieldName);
    }
    return undefined;
  }

  private findField(interfaceTypes: TypeName[], fieldName: string) {
    // TODO: merge field definition from all interface types to ensure all necessary arguments are present
    //   (or maybe instead always encode all arguments in the schema fragment for simplicity?)
    for (const interfaceName of interfaceTypes) {
      const ownField = this.getOwnField(interfaceName, fieldName);
      if (ownField !== undefined) {
        return ownField;
      }
    }
    return undefined;
  }

  public getFieldArguments(
    field: FieldDefinition,
  ): InputValueDefinitionRecord | undefined {
    return Array.isArray(field) ? field[FieldKeys.arguments] : undefined;
  }

  public getDirectiveArguments(
    directive: DirectiveDefinitionTuple,
  ): InputValueDefinitionRecord | undefined {
    return directive[DirectiveKeys.arguments];
  }

  public resolveDefinitionArguments(
    def: FieldDefinition | DirectiveDefinitionTuple,
  ): InputValueDefinitionRecord | undefined {
    // Note: both FieldDefinition and DirectiveDefinition store arguments at the same position
    return Array.isArray(def) ? def[FieldKeys.arguments] : undefined;
  }

  public getInputObjectType(
    typeRef: TypeReference,
  ): InputObjectTypeDefinitionTuple | undefined {
    const type = this.definitions.types[typeNameFromReference(typeRef)];
    return type?.[0] === TypeKind.INPUT ? type : undefined;
  }

  public getInputObjectFields(
    obj: InputObjectTypeDefinitionTuple,
  ): InputValueDefinitionRecord {
    return obj[InputObjectKeys.fields];
  }

  public getInputDefaultValue(
    inputValue: InputValueDefinition,
  ): unknown | undefined {
    return Array.isArray(inputValue)
      ? inputValue[InputValueKeys.defaultValue]
      : undefined;
  }

  public getLeafType(
    typeRef: TypeReference,
  ): EnumTypeDefinitionTuple | ScalarTypeDefinitionTuple | undefined {
    const typeName = typeNameFromReference(typeRef);

    if (isSpecifiedScalarType(typeName)) {
      return specifiedScalarDefinition;
    }
    const type = this.definitions.types[typeName];
    if (type?.[0] !== TypeKind.ENUM && type?.[0] !== TypeKind.SCALAR) {
      return undefined;
    }
    return type;
  }

  public isDefined(typeRef: TypeReference): boolean {
    if (typeof typeRef === "number") {
      // Fast-path: spec type
      return true;
    }
    const types = this.definitions.types;
    const typeName = typeNameFromReference(typeRef);
    return !!types[typeName] || isSpecifiedScalarType(typeName);
  }

  public isInputType(typeRef: TypeReference): boolean {
    if (typeof typeRef === "number") {
      // Fast-path: all spec types are input types
      return true;
    }
    const typeName = typeNameFromReference(typeRef);
    const kind = this.definitions.types[typeName]?.[0];
    return (
      isSpecifiedScalarType(typeName) ||
      kind === TypeKind.ENUM ||
      kind === TypeKind.INPUT ||
      kind === TypeKind.SCALAR
    );
  }

  public isObjectType(typeRef: TypeReference): boolean {
    if (typeof typeRef === "number") {
      // Fast-path: all spec types are scalars
      return false;
    }
    const types = this.definitions.types;
    const type = types[typeRef] ?? types[typeNameFromReference(typeRef)];
    return type?.[0] === TypeKind.OBJECT;
  }

  public isAbstractType(typeRef: TypeReference): boolean {
    if (typeof typeRef === "number") {
      // Fast-path: all spec types are scalars
      return false;
    }
    const types = this.definitions.types;
    const type = types[typeRef] ?? types[typeNameFromReference(typeRef)];
    return type?.[0] === TypeKind.UNION || type?.[0] === TypeKind.INTERFACE;
  }

  public getUnionType(
    typeRef: TypeReference,
  ): UnionTypeDefinitionTuple | undefined {
    const types = this.definitions.types;
    const type = types[typeRef] ?? types[typeNameFromReference(typeRef)];
    return type?.[0] === TypeKind.UNION ? type : undefined;
  }

  public getInterfaceType(
    typeRef: TypeReference,
  ): InterfaceTypeDefinitionTuple | undefined {
    const types = this.definitions.types;
    const type = types[typeRef] ?? types[typeNameFromReference(typeRef)];
    return type?.[0] === TypeKind.INTERFACE ? type : undefined;
  }

  public isSubType(
    abstractTypeName: TypeName,
    maybeSubTypeName: TypeName,
  ): boolean {
    const union = this.getUnionType(abstractTypeName);
    if (union) {
      return union[UnionKeys.types].includes(maybeSubTypeName);
    }
    const object = this.getObjectType(maybeSubTypeName);
    if (object) {
      return !!object[ObjectKeys.interfaces]?.includes(abstractTypeName);
    }
    const iface = this.getInterfaceType(maybeSubTypeName);
    if (iface) {
      return !!iface[InterfaceKeys.interfaces]?.includes(abstractTypeName);
    }
    return false;
  }

  public getFieldResolver(
    typeName: TypeName,
    fieldName: string,
  ): FunctionFieldResolver<unknown, unknown> | undefined {
    if (fieldName === "__typename") {
      return resolveTypeName;
    }
    // TODO: sanity check that this is an object type resolver
    const typeResolvers = this.resolvers[typeName] as
      | ObjectTypeResolver<unknown, unknown, unknown>
      | undefined;
    const fieldResolver = typeResolvers?.[fieldName];
    return typeof fieldResolver === "function"
      ? fieldResolver
      : fieldResolver?.resolve;
  }

  public getSubscriptionFieldResolver(
    subscriptionTypeName: TypeName,
    fieldName: string,
  ): FunctionFieldResolver<unknown, unknown> | undefined {
    // TODO: sanity check that this is an object type resolver
    const typeResolvers = this.resolvers[subscriptionTypeName] as
      | ObjectTypeResolver<unknown, unknown, unknown>
      | undefined;
    const fieldResolver = typeResolvers?.[fieldName];
    return typeof fieldResolver === "function"
      ? fieldResolver
      : fieldResolver?.subscribe;
  }

  public getAbstractTypeResolver(
    typeName: TypeName,
  ): TypeResolver<unknown, unknown> | undefined {
    const resolver = this.resolvers[typeName];
    return resolver &&
      (isUnionTypeResolver(resolver) || isInterfaceTypeResolver(resolver))
      ? resolver.__resolveType
      : undefined;
  }

  public getLeafTypeResolver(
    typeRef: TypeReference,
  ): GraphQLLeafType | undefined {
    // TODO: consider removing GraphQLEnumType and GraphQLScalarType
    const typeName = typeNameFromReference(typeRef);

    if (specifiedScalarResolvers[typeName]) {
      return specifiedScalarResolvers[typeName];
    }

    const typeDef = this.getLeafType(typeRef);
    if (!typeDef) {
      // TODO: Could be still in resolvers (i.e., add "found in resolvers, not found in schema" error?)
      return undefined;
    }

    if (typeDef[0] === TypeKind.SCALAR) {
      let scalarType = SchemaFragment.scalarTypeResolvers[typeName];
      if (!scalarType) {
        const tmp = this.resolvers[typeName];
        scalarType = isScalarTypeResolver(tmp)
          ? tmp
          : new GraphQLScalarType({ name: typeName, description: "" });
        SchemaFragment.scalarTypeResolvers[typeName] = scalarType;
      }
      return scalarType;
    }
    if (typeDef[0] === TypeKind.ENUM) {
      let enumType = SchemaFragment.enumTypeResolvers[typeName];
      if (!enumType) {
        const tmp = this.resolvers[typeName]; // Can only be graphql-tools map
        const customValues = isObjectLike(tmp) ? tmp : emptyObject;

        const values: Record<string, object> = {};
        for (const value of typeDef[EnumKeys.values] ?? []) {
          values[value] =
            typeof customValues[value] !== "undefined"
              ? { value: customValues[value] }
              : {};
        }
        enumType = new GraphQLEnumType({
          name: typeName,
          values,
        });
        SchemaFragment.enumTypeResolvers[typeName] = enumType;
      }
      return enumType;
    }
    return undefined;
  }

  public getDirectiveName(def: DirectiveDefinitionTuple) {
    return def[DirectiveKeys.name];
  }
}
