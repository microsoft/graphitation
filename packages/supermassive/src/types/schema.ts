import {
  ASTNode,
  GraphQLLeafType,
  parseType,
  print,
  GraphQLString,
  GraphQLID,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLScalarType,
  isScalarType,
  GraphQLEnumType,
} from "graphql";
import {
  ObjectKeys,
  EncodedSchemaFragment,
  EncodedSpecTypes,
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
} from "./definition";
import { TypeNode } from "../supermassive-ast";
import { typeNameFromAST } from "../utilities/typeNameFromAST";
import { UserResolvers } from "../types";
import { isObjectLike } from "../jsutils/isObjectLike";

export const specifiedScalars: { [key: string]: GraphQLScalarType } = {
  ID: GraphQLID,
  String: GraphQLString,
  Int: GraphQLInt,
  Float: GraphQLFloat,
  Boolean: GraphQLBoolean,
};

const emptyObject = Object.freeze(Object.create(null));

// Lifecycle: one instance per GraphQL operation
export class SchemaFragment {
  static parseOptions = { noLocation: true };
  static specTypeNodes: TypeNode[];

  private typeNodes: Record<string, TypeNode> = Object.create(null);
  private enumTypes: Record<string, GraphQLLeafType> = Object.create(null);

  constructor(
    private encodedFragment: EncodedSchemaFragment,
    private resolvers: UserResolvers,
  ) {
    if (!SchemaFragment.specTypeNodes) {
      SchemaFragment.specTypeNodes = EncodedSpecTypes.map((name) =>
        parseType(name, SchemaFragment.parseOptions),
      );
    }
  }

  public getFieldTypeRef(field: FieldDefinitionTuple): TypeReference {
    return field[FieldKeys.type];
  }

  public getFieldArguments(
    field: FieldDefinitionTuple,
  ): Record<string, InputValueDefinitionTuple> | undefined {
    return field[FieldKeys.arguments];
  }

  public getObjectField(
    typeName: string,
    fieldName: string,
  ): FieldDefinitionTuple | undefined {
    const types = this.encodedFragment.types;
    const parentType = types[typeName];

    return parentType &&
      (parentType[0] === TypeKind.OBJECT ||
        parentType[0] === TypeKind.INTERFACE)
      ? parentType[ObjectKeys.fields]?.[fieldName]
      : undefined;
  }

  public getDefaultValue(
    inputValue: InputValueDefinitionTuple,
  ): unknown | undefined {
    return inputValue[InputValueKeys.defaultValue];
  }

  public getTypeRef(
    tuple: FieldDefinitionTuple | InputValueDefinitionTuple,
  ): TypeReference {
    return tuple[0];
  }

  public isDefined(typeRef: TypeReference) {
    if (typeof typeRef === "number" && EncodedSpecTypes[typeRef]) {
      return true;
    }
    const types = this.encodedFragment.types;
    const typeNode = this.resolveTypeNode(typeRef);
    return typeNode ? !!types[typeNameFromAST(typeNode)] : false;
  }

  public isInputType(typeRef: TypeReference): boolean {
    if (typeof typeRef === "number" && EncodedSpecTypes[typeRef]) {
      return true;
    }
    const types = this.encodedFragment.types;
    const typeNode = this.resolveTypeNode(typeRef);
    if (!typeNode) {
      return false;
    }
    const typeName = typeNameFromAST(typeNode);
    return (
      types[typeName]?.[0] === TypeKind.INPUT ||
      EncodedSpecTypes.includes(typeName)
    );
  }

  public getInputObjectType(
    typeRef: TypeReference,
  ): InputObjectTypeDefinitionTuple | undefined {
    const type = this.encodedFragment.types[typeRef];
    return type?.[0] === TypeKind.INPUT ? type : undefined;
  }

  public getLeafTypeResolver(
    typeRef: TypeReference,
  ): GraphQLLeafType | undefined {
    // TODO: consider removing these bits?
    const typeName =
      typeof typeRef === "number" ? EncodedSpecTypes[typeRef] : typeRef;

    if (specifiedScalars[typeName]) {
      return specifiedScalars[typeName];
    }

    const typeDef = this.getLeafType(typeRef);
    if (!typeDef) {
      // Could be still in resolvers
      return undefined;
    }

    if (typeDef[0] === TypeKind.SCALAR) {
      const scalarResolver =
        specifiedScalars[typeName] ?? this.resolvers[typeName];
      return isScalarType(scalarResolver) ? scalarResolver : undefined;
    }
    if (typeDef[0] === TypeKind.ENUM) {
      let enumType = this.enumTypes[typeName];
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
        this.enumTypes[typeName] = enumType;
      }
      return enumType;
    }
    return undefined;
  }

  public getLeafType(
    typeRef: TypeReference,
  ): EnumTypeDefinitionTuple | ScalarTypeDefinitionTuple | undefined {
    const typeNode = this.resolveTypeNode(typeRef);
    if (typeNode?.kind !== "NamedType") {
      return undefined;
    }
    const types = this.encodedFragment.types;
    const type = types[typeNode.name.value];

    // TODO: specified scalars
    if (type?.[0] !== TypeKind.ENUM && type?.[0] !== TypeKind.SCALAR) {
      return undefined;
    }
    return type;
  }

  public isNonNullType(typeRef: TypeReference): boolean {
    const typeNode = this.resolveTypeNode(typeRef);
    return typeNode?.kind === "NonNullType";
  }

  public isListType(typeRef: TypeReference): boolean {
    const typeNode = this.resolveTypeNode(typeRef);
    return typeNode?.kind === "ListType";
  }

  public unwrap(typeRef: TypeReference): TypeReference {
    const typeNode = this.resolveTypeNode(typeRef);
    if (typeNode?.kind !== "NonNullType" && typeNode?.kind !== "ListType") {
      const type = this.printTypeRef(typeRef);
      throw new Error(
        `Cannot unwrap type "${type}": it is not a wrapping type`,
      );
    }
    const printed = print(typeNode.type as ASTNode);
    const index = EncodedSpecTypes.indexOf(printed);
    return index === -1 ? printed : index;
  }

  public printTypeRef(typeRef: TypeReference): string {
    return typeof typeRef === "number"
      ? EncodedSpecTypes[typeRef] ?? "(UnknownType)"
      : typeRef;
  }

  public getInputObjectFields(
    obj: InputObjectTypeDefinitionTuple,
  ): InputValueDefinitionRecord {
    return obj[InputObjectKeys.fields];
  }

  private getInputObjectField(
    typeName: string,
    fieldName: string,
  ): InputValueDefinitionTuple | undefined {
    const types = this.encodedFragment.types;
    const parentType = types[typeName];

    return parentType && parentType[0] === TypeKind.INPUT
      ? parentType[InputObjectKeys.fields]?.[fieldName]
      : undefined;
  }

  private resolveTypeNode(typeRef: TypeReference): TypeNode | undefined {
    if (typeof typeRef === "number") {
      return SchemaFragment.specTypeNodes[typeRef];
    }
    let typeNode = this.typeNodes[typeRef];
    if (!typeNode) {
      typeNode = parseType(typeRef, SchemaFragment.parseOptions);
      this.typeNodes[typeRef] = typeNode;
    }
    return typeNode;
  }
}
