import { GraphQLLeafType, GraphQLEnumType } from "graphql";
import {
  ObjectKeys,
  EncodedSchemaFragment,
  TypeKind,
  FieldKeys,
  InputObjectKeys,
  InputValueKeys,
  FieldDefinitionTuple,
  InputValueDefinitionTuple,
  TypeReference,
  InputObjectTypeDefinitionTuple,
  InputValueDefinitionRecord,
  EnumTypeDefinitionTuple,
  ScalarTypeDefinitionTuple,
  EnumKeys,
  isSpecifiedScalarType,
  ObjectTypeDefinitionTuple,
  specifiedScalars,
  DirectiveDefinitionTuple,
  DirectiveKeys,
  InterfaceKeys,
  UnionTypeDefinitionTuple,
  UnionKeys,
  InterfaceTypeDefinitionTuple,
  TypeName,
} from "./definition";
import {
  FunctionFieldResolver,
  ObjectTypeResolver,
  ScalarTypeResolver,
  UserResolvers,
} from "../types";
import { isObjectLike } from "../jsutils/isObjectLike";
import {
  isInterfaceTypeResolver,
  isUnionTypeResolver,
  isScalarTypeResolver,
} from "./resolvers";
import { typeNameFromReference } from "./reference";

const specifiedScalarDefinition: ScalarTypeDefinitionTuple = [TypeKind.SCALAR];
const typeNameMetaFieldDef: FieldDefinitionTuple = ["String"];
const emptyObject = Object.freeze(Object.create(null));

// Lifecycle: one instance per GraphQL operation
export class SchemaFragment {
  static parseOptions = { noLocation: true };

  private static scalarTypeResolvers: Record<string, ScalarTypeResolver> =
    Object.create(null);

  private static enumTypeResolvers: Record<string, GraphQLEnumType> =
    Object.create(null);

  constructor(
    private encodedFragment: EncodedSchemaFragment,
    private resolvers: UserResolvers,
  ) {}

  public getTypeReference(
    tuple: FieldDefinitionTuple | InputValueDefinitionTuple,
  ): TypeReference {
    return tuple[0];
  }

  public getObjectType(
    typeName: TypeName,
  ): ObjectTypeDefinitionTuple | undefined {
    const type = this.encodedFragment.types[typeName];
    return type?.[0] === TypeKind.OBJECT ? type : undefined;
  }

  public getObjectFields(
    def: ObjectTypeDefinitionTuple,
  ): Record<string, FieldDefinitionTuple> | undefined {
    return def[ObjectKeys.fields];
  }

  public getField(
    typeName: TypeName,
    fieldName: string,
  ): FieldDefinitionTuple | undefined {
    const type = this.encodedFragment.types[typeName];
    if (!type) {
      return undefined;
    }
    if (fieldName === "__typename") {
      return typeNameMetaFieldDef;
    }
    if (type[0] === TypeKind.OBJECT) {
      return type[ObjectKeys.fields]?.[fieldName];
    }
    if (type[0] === TypeKind.INTERFACE) {
      return type[InterfaceKeys.fields]?.[fieldName];
    }
    return undefined;
  }

  public getFieldArguments(
    field: FieldDefinitionTuple,
  ): Record<string, InputValueDefinitionTuple> | undefined {
    return field[FieldKeys.arguments];
  }

  public getDirectiveArguments(
    directive: DirectiveDefinitionTuple,
  ): Record<string, InputValueDefinitionTuple> | undefined {
    return directive[DirectiveKeys.arguments];
  }

  public resolveDefinitionArguments(
    def: FieldDefinitionTuple | DirectiveDefinitionTuple,
  ): Record<string, InputValueDefinitionTuple> | undefined {
    // Note: both FieldDefinition and DirectiveDefinition store arguments at the same position
    return def[FieldKeys.arguments];
  }

  public getInputObjectType(
    typeRef: TypeReference,
  ): InputObjectTypeDefinitionTuple | undefined {
    const type = this.encodedFragment.types[typeNameFromReference(typeRef)];
    return type?.[0] === TypeKind.INPUT ? type : undefined;
  }

  public getInputObjectFields(
    obj: InputObjectTypeDefinitionTuple,
  ): InputValueDefinitionRecord {
    return obj[InputObjectKeys.fields];
  }

  public getInputDefaultValue(
    inputValue: InputValueDefinitionTuple,
  ): unknown | undefined {
    return inputValue[InputValueKeys.defaultValue];
  }

  public getLeafType(
    typeRef: TypeReference,
  ): EnumTypeDefinitionTuple | ScalarTypeDefinitionTuple | undefined {
    const typeName = typeNameFromReference(typeRef);

    if (isSpecifiedScalarType(typeName)) {
      return specifiedScalarDefinition;
    }

    const type = this.encodedFragment.types[typeName];

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
    const types = this.encodedFragment.types;
    return Boolean(types[typeRef] || types[typeNameFromReference(typeRef)]);
  }

  public isInputType(typeRef: TypeReference): boolean {
    if (typeof typeRef === "number") {
      // Fast-path: all spec types are input types
      return true;
    }
    const typeName = typeNameFromReference(typeRef);
    return (
      this.encodedFragment.types[typeName]?.[0] === TypeKind.INPUT ||
      isSpecifiedScalarType(typeName)
    );
  }

  public isObjectType(typeRef: TypeReference): boolean {
    if (typeof typeRef === "number") {
      // Fast-path: all spec types are scalars
      return false;
    }
    const types = this.encodedFragment.types;
    const type = types[typeRef] ?? types[typeNameFromReference(typeRef)];
    return type?.[0] === TypeKind.OBJECT;
  }

  public isAbstractType(typeRef: TypeReference): boolean {
    if (typeof typeRef === "number") {
      // Fast-path: all spec types are scalars
      return false;
    }
    const types = this.encodedFragment.types;
    const type = types[typeRef] ?? types[typeNameFromReference(typeRef)];
    return type?.[0] === TypeKind.UNION || type?.[0] === TypeKind.INTERFACE;
  }

  public getUnionType(
    typeRef: TypeReference,
  ): UnionTypeDefinitionTuple | undefined {
    const types = this.encodedFragment.types;
    const type = types[typeRef] ?? types[typeNameFromReference(typeRef)];
    return type?.[0] === TypeKind.UNION ? type : undefined;
  }

  public getInterfaceType(
    typeRef: TypeReference,
  ): InterfaceTypeDefinitionTuple | undefined {
    const types = this.encodedFragment.types;
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

  public getAbstractTypeResolver(typeName: TypeName) {
    const resolver = this.resolvers[typeName];
    return isUnionTypeResolver(resolver) || isInterfaceTypeResolver(resolver)
      ? resolver.__resolveType
      : undefined; // FIXME: should this throw instead?
  }

  public getLeafTypeResolver(
    typeRef: TypeReference,
  ): GraphQLLeafType | undefined {
    // TODO: consider removing GraphQLEnumType and GraphQLScalarType
    const typeName = typeNameFromReference(typeRef);

    if (specifiedScalars[typeName]) {
      return specifiedScalars[typeName];
    }

    const typeDef = this.getLeafType(typeRef);
    if (!typeDef) {
      // FIXME: Could be still in resolvers (i.e., add "found in resolvers, not found in schema" error?)
      return undefined;
    }

    if (typeDef[0] === TypeKind.SCALAR) {
      if (SchemaFragment.scalarTypeResolvers[typeName]) {
        return SchemaFragment.scalarTypeResolvers[typeName];
      }
      const resolver = this.resolvers[typeName];
      const scalarResolver = isScalarTypeResolver(resolver)
        ? resolver
        : undefined;
      if (scalarResolver) {
        SchemaFragment.scalarTypeResolvers[typeName] = scalarResolver;
        return scalarResolver;
      }
      return undefined;
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
