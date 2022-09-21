declare module "relay-compiler";

declare module "relay-compiler/lib/core/Schema" {
  import { Source } from "graphql";
  import {
    TypeNode,
    DocumentNode,
    DirectiveLocationEnum,
    ValueNode,
  } from "graphql";
  import { Field as IRField } from "relay-compiler/lib/core/IR";

  export type AbstractTypeID = any;
  export type CompositeTypeID = any;
  export type EnumTypeID = any;
  export type FieldID = any;
  export type InputObjectTypeID = any;
  export type InputTypeID = any;
  export type InterfaceTypeID = any;
  export type LinkedFieldTypeID = any;
  export type ObjectTypeID = any;
  export type ScalarTypeID = any;
  export type ScalarFieldTypeID = any;
  export type TypeID = any;
  export type UnionTypeID = any;

  export type Argument = Readonly<{
    name: string;
    type: InputTypeID;
    defaultValue: any;
  }>;

  export type Directive = Readonly<{
    args: ReadonlyArray<Argument>;
    isClient: boolean;
    locations: ReadonlyArray<DirectiveLocationEnum>;
    name: string;
  }>;

  export interface Schema {
    areEqualTypes: (typeA: TypeID, typeB: TypeID) => boolean;
    asCompositeType: (type: any) => CompositeTypeID | null | undefined;
    asInputType: (type: any) => InputTypeID | null | undefined;
    asScalarFieldType: (type: any) => ScalarFieldTypeID | null | undefined;
    assertLinkedFieldType: (type: any) => LinkedFieldTypeID;
    assertAbstractType: (type: TypeID) => AbstractTypeID;
    assertBooleanType: (type: TypeID) => ScalarTypeID;
    assertCompositeType: (type: TypeID) => CompositeTypeID;
    assertEnumType: (type: TypeID) => EnumTypeID;
    assertInputObjectType: (type: TypeID) => InputObjectTypeID;
    assertInputType: (type: any) => InputTypeID;
    assertIntType: (type: TypeID) => ScalarTypeID;
    assertInterfaceType: (type: TypeID) => InterfaceTypeID;
    assertFloatType: (type: TypeID) => ScalarTypeID;
    assertIdType: (type: TypeID) => ScalarTypeID;
    assertLeafType: (type: TypeID) => TypeID;
    assertObjectType: (type: TypeID) => ObjectTypeID;
    assertScalarFieldType: (type: any) => ScalarFieldTypeID;
    assertScalarType: (type: TypeID) => ScalarTypeID;
    assertStringType: (type: TypeID) => ScalarTypeID;
    assertUnionType: (type: TypeID) => UnionTypeID;
    canHaveSelections: (type: TypeID) => boolean;
    doTypesOverlap: (typeA: CompositeTypeID, typeB: CompositeTypeID) => boolean;
    expectBooleanType: () => ScalarTypeID;
    expectIdType: () => ScalarTypeID;
    expectIntType: () => ScalarTypeID;
    expectField: (
      type: CompositeTypeID | InputObjectTypeID,
      fieldName: string,
    ) => FieldID;
    expectFloatType: () => ScalarTypeID;
    expectMutationType: () => ObjectTypeID;
    expectQueryType: () => ObjectTypeID;
    expectStringType: () => ScalarTypeID;
    expectSubscriptionType: () => ObjectTypeID;
    expectTypeFromAST: (ast: TypeNode) => TypeID;
    expectTypeFromString: (typeName: string) => TypeID;
    extend: (extensions: DocumentNode | ReadonlyArray<string>) => Schema;
    getDirectives: () => ReadonlyArray<Directive>;
    getDirective: (directiveName: string) => Directive | null | undefined;
    getEnumValues: (type: EnumTypeID) => string[];
    getFieldByName: (
      type: CompositeTypeID | InputObjectTypeID,
      fieldName: string,
    ) => FieldID | null | undefined;
    getFieldArgs: (field: FieldID) => ReadonlyArray<Argument>;
    getFieldArgByName: (
      field: FieldID,
      argName: string,
    ) => Argument | null | undefined;
    getFieldConfig: (
      field: FieldID,
    ) => { type: TypeID; args: ReadonlyArray<Argument> };
    getFieldName: (field: FieldID) => string;
    getFieldParentType: (field: FieldID) => TypeID;
    getFields: (type: TypeID) => FieldID[];
    getFieldType: (field: FieldID) => TypeID;
    getInterfaces: (type: CompositeTypeID) => ReadonlyArray<TypeID>;
    getListItemType: (type: TypeID) => TypeID;
    getMutationType: () => ObjectTypeID | null | undefined;
    getNonNullType: (type: TypeID) => TypeID;
    getNullableType: (type: TypeID) => TypeID;
    getPossibleTypes: (type: AbstractTypeID) => ReadonlySet<ObjectTypeID>;
    getQueryType: () => ObjectTypeID | null | undefined;
    getRawType: (type: TypeID) => TypeID;
    getSubscriptionType: () => ObjectTypeID | null | undefined;
    getTypes: () => ReadonlyArray<TypeID>;
    getTypeFromAST: (typeNode: TypeNode) => TypeID | null | undefined;
    getTypeFromString: (typeName: string) => TypeID | null | undefined;
    getTypeString: (type: TypeID) => string;
    getUnionTypes: (type: UnionTypeID) => ReadonlyArray<TypeID>;
    hasField: (
      type: CompositeTypeID | InputObjectTypeID,
      fieldName: string,
    ) => boolean;
    hasId: (type: CompositeTypeID) => boolean;
    isAbstractType: (type: TypeID) => boolean;
    implementsInterface: (
      type: CompositeTypeID,
      interfaceType: InterfaceTypeID,
    ) => boolean;
    isBoolean: (type: TypeID) => boolean;
    isClientDefinedField: (type: CompositeTypeID, field: IRField) => boolean;
    isCompositeType: (type: TypeID) => boolean;
    isEnum: (type: TypeID) => boolean;
    isFloat: (type: TypeID) => boolean;
    isId: (type: TypeID) => boolean;
    isInputObject: (type: TypeID) => boolean;
    isInputType: (type: TypeID) => boolean;
    isInt: (type: TypeID) => boolean;
    isInterface: (type: TypeID) => boolean;
    isLeafType: (type: TypeID) => boolean;
    isList: (type: TypeID) => boolean;
    isNonNull: (type: TypeID) => boolean;
    isObject: (type: TypeID) => boolean;
    isPossibleType: (
      superType: AbstractTypeID,
      maybeSubType: ObjectTypeID,
    ) => boolean;
    isScalar: (type: TypeID) => boolean;
    isServerDefinedField: (type: CompositeTypeID, field: IRField) => boolean;
    isServerDirective: (directiveName: string) => boolean;
    isServerField: (field: FieldID) => boolean;
    isServerType: (type: TypeID) => boolean;
    isString: (type: TypeID) => boolean;
    isTypeSubTypeOf: (maybeSubType: TypeID, superType: TypeID) => boolean;
    isUnion: (type: TypeID) => boolean;
    isWrapper: (type: TypeID) => boolean;
    mayImplement: (
      type: CompositeTypeID,
      interfaceType: InterfaceTypeID,
    ) => boolean;
    parseLiteral: (
      type: ScalarTypeID | EnumTypeID,
      valueNode: ValueNode,
    ) => any;
    parseValue: (type: ScalarTypeID | EnumTypeID, value: any) => any;
    serialize: (type: ScalarTypeID | EnumTypeID, value: any) => any;
  }

  export function create(source: Source): Schema;
}

declare module "relay-compiler/lib/core/RelayParser" {
  import { DefinitionNode } from "graphql";
  import { Root, Fragment } from "relay-compiler/lib/core/IR";
  import { Schema } from "relay-compiler/lib/core/Schema";

  export function parse(
    schema: Schema,
    text: string,
    filename?: string,
  ): ReadonlyArray<Root | Fragment>;

  export function transform(
    schema: Schema,
    documents: DefinitionNode[],
  ): ReadonlyArray<Root | Fragment>;
}

declare module "relay-compiler/lib/core/CompilerContext" {
  import {
    Field as IRField,
    Fragment,
    SplitOperation,
    Root,
  } from "relay-compiler/lib/core/IR";
  import { Schema } from "relay-compiler/lib/core/Schema";
  import { Reporter } from "relay-compiler/lib/reporters/Reporter";

  export type IRTransform = (context: CompilerContext) => CompilerContext;

  export type CompilerContextDocument = Fragment | Root | SplitOperation;

  export default class CompilerContext {
    constructor(schema: Schema);
    documents(): CompilerContextDocument[];
    forEachDocument(fn: (doc: CompilerContextDocument) => void): void;
    replace(node: CompilerContextDocument): CompilerContext;
    add(node: CompilerContextDocument): CompilerContext;
    addAll(nodes: ReadonlyArray<CompilerContextDocument>): CompilerContext;
    applyTransforms(
      transforms: ReadonlyArray<IRTransform>,
      reporter?: Reporter,
    ): CompilerContext;
    applyTransform(
      transform: IRTransform,
      reporter?: Reporter,
    ): CompilerContext;
    get(name: string): CompilerContextDocument | undefined;
    getFragment(name: string, referencedFrom?: Location): Fragment;
    getRoot(name: string): Root;
    remove(name: string): CompilerContext;
    withMutations(
      fn: (context: CompilerContext) => CompilerContext,
    ): CompilerContext;
    getSchema(): Schema;
  }
}

declare module "relay-compiler/lib/codegen/RelayCodeGenerator" {
  import { Schema } from "relay-compiler/lib/core/Schema";
  import {
    Fragment,
    SplitOperation,
    Request,
  } from "relay-compiler/lib/core/IR";
  import {
    ReaderFragment,
    ConcreteRequest,
    NormalizationSplitOperation,
  } from "relay-runtime";

  export function generate(schema: Schema, node: Fragment): ReaderFragment;
  export function generate(schema: Schema, node: Request): ConcreteRequest;
  export function generate(
    schema: Schema,
    node: SplitOperation,
  ): NormalizationSplitOperation;
}

declare module "relay-compiler/lib/util";

declare module "relay-compiler/lib/util/dedupeJSONSringify" {
  export default function dedupeJSONStringify(jsonValue: any): string;
}
