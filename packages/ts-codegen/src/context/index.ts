import {
  DocumentNode,
  GraphQLError,
  visit,
  ArgumentNode,
  ValueNode,
  ASTNode,
  FieldDefinitionNode,
  ObjectTypeDefinitionNode,
  EnumTypeDefinitionNode,
  UnionTypeDefinitionNode,
  InterfaceTypeDefinitionNode,
  InputObjectTypeDefinitionNode,
  ScalarTypeDefinitionNode,
  ObjectTypeExtensionNode,
  InputValueDefinitionNode,
  Kind,
  TypeNode,
} from "graphql";
import ts, {
  factory,
  addSyntheticLeadingComment,
  SyntaxKind,
} from "typescript";
import { DefinitionImport, DefinitionModel } from "../types";
import {
  createImportDeclaration,
  isRootOperationType,
  buildContextMetadataOutput,
  getContextKeysFromArgumentNode,
} from "./utilities";
import {
  createListType,
  createNonNullableType,
  createNullableType,
  getResolverReturnListType,
} from "../utilities";
import { IMPORT_DIRECTIVE_NAME, processImportDirective } from "./import";
import { MODEL_DIRECTIVE_NAME, processModelDirective } from "./model";
import { SubTypeNamespace } from "../codegen";

export type TsCodegenContextOptions = {
  moduleRoot: string;
  moduleModelsPath: string;
  moduleResolversPath: string;
  baseModel: {
    name: string;
    from: string | null;
  };
  context: {
    name?: string;
    from: string | null;
  };
  enumsImport: string | null;
  resolveInfo: {
    name: string;
    from: string | null;
  };
  legacyCompat: boolean;
  legacyNoModelsForObjects: boolean;
  baseContextTypePath?: string;
  baseContextTypeName?: string;
  contextTypeExtensions?: SubTypeNamespace;
  useStringUnionsInsteadOfEnums: boolean;
  enumNamesToMigrate: string[] | null;
  enumNamesToKeep: string[] | null;
  modelScope: string | null;
};

const DEFAULT_SCALAR_TYPE = "unknown";

export const BUILT_IN_SCALARS: Record<string, string> = {
  ID: "string",
  Int: "number",
  Float: "number",
  String: "string",
  Boolean: "boolean",
};

const TsCodegenContextDefault: TsCodegenContextOptions = {
  moduleRoot: "",
  moduleModelsPath: "./__generated__/models.interface.ts",
  moduleResolversPath: "./__generated__/resolvers.interface.ts",
  enumsImport: null,
  baseModel: {
    name: "BaseModel",
    from: null,
  },
  context: {
    name: "unknown",
    from: null,
  },
  resolveInfo: {
    name: "ResolveInfo",
    from: "@graphitation/supermassive",
  },
  legacyCompat: false,
  enumNamesToMigrate: null,
  enumNamesToKeep: null,
  legacyNoModelsForObjects: false,
  useStringUnionsInsteadOfEnums: false,

  modelScope: null,
};

type ModelNameAndImport = { modelName: string; imp: DefinitionImport };

export type ContextMap = {
  [key: string]: ContextMapTypeItem;
};

export type ContextTypeItem = { id: string; optional?: boolean };

export type ContextMapTypeItem = {
  __context?: ContextTypeItem[];
} & {
  [key: string]: ContextTypeItem[];
};

export class TsCodegenContext {
  private allTypes: Array<Type>;
  private resolverTypeMap: Record<string, string[] | null>;
  private typeContextMap: ContextMap;
  private typeNameToType: Map<string, Type>;
  private usedEntitiesInModels: Set<string>;
  private usedEntitiesInResolvers: Set<string>;
  private imports: DefinitionImport[];
  private typeNameToImports: Map<
    string,
    { modelName: string } & ModelNameAndImport
  >;
  private typeNameToModels: Map<string, DefinitionModel>;
  private legacyInterfaces: Set<string>;
  private iterableTypeUsed: boolean;
  context?: { name: string; from: string };
  contextDefaultSubTypeContext?: { name: string; from: string };
  hasUsedEnumsInModels: boolean;
  hasEnums: boolean;
  hasModels: boolean;
  hasResolvers: boolean;

  constructor(private options: TsCodegenContextOptions) {
    this.allTypes = [];
    this.typeContextMap = {};
    this.resolverTypeMap = {};
    this.typeNameToType = new Map();
    this.usedEntitiesInModels = new Set();
    this.usedEntitiesInResolvers = new Set();

    this.imports = [];
    this.typeNameToImports = new Map();
    this.typeNameToModels = new Map();
    this.legacyInterfaces = new Set();
    this.hasResolvers = false;
    this.hasModels = false;
    this.hasEnums = Boolean(options.enumsImport);
    this.hasUsedEnumsInModels = false;
    this.iterableTypeUsed = false;

    if (options.baseContextTypeName && options.baseContextTypePath) {
      this.contextDefaultSubTypeContext = {
        name: options.baseContextTypeName,
        from: options.baseContextTypePath,
      };
    }

    if (options.context.from && options.context.name) {
      this.context = {
        name: options.context.name,
        from: options.context.from,
      };
    }
  }

  public getContextTypes<T>(
    contextRootType: T & {
      __context?: ContextTypeItem[];
    },
  ): ContextTypeItem[] | null {
    if (contextRootType) {
      if (contextRootType.__context) {
        return contextRootType.__context;
      }
    }
    return null;
  }

  public getContextTypeNode(typeNames?: ContextTypeItem[] | null) {
    const contextTypeExtensions = this.getContextTypeExtensions();

    if (!typeNames || !contextTypeExtensions) {
      return this.getContextType().toTypeReference();
    } else {
      if (typeNames.length === 0 && this.contextDefaultSubTypeContext?.name) {
        return factory.createTypeReferenceNode(
          factory.createIdentifier(this.contextDefaultSubTypeContext.name),
          undefined,
        );
      }

      const typeNameWithNamespace =
        this.buildContextSubTypeNamespaceObject(typeNames);

      return factory.createIntersectionTypeNode(
        [
          this.contextDefaultSubTypeContext?.name &&
            factory.createTypeReferenceNode(
              factory.createIdentifier(this.contextDefaultSubTypeContext.name),
              undefined,
            ),
          factory.createTypeLiteralNode(
            Object.entries(typeNameWithNamespace).map(
              ([namespace, subTypes]) => {
                return factory.createPropertySignature(
                  undefined,
                  factory.createIdentifier(namespace),
                  undefined,
                  factory.createTypeLiteralNode(
                    subTypes.map(({ subType, name, optional }) => {
                      return factory.createPropertySignature(
                        undefined,
                        factory.createIdentifier(`"${name}"`),
                        optional
                          ? factory.createToken(ts.SyntaxKind.QuestionToken)
                          : undefined,
                        factory.createTypeReferenceNode(
                          factory.createIdentifier(subType),
                          undefined,
                        ),
                      );
                    }),
                  ),
                );
              },
            ),
          ),
        ].filter(Boolean) as ts.TypeNode[],
      );
    }
  }
  public getContextTypeExtensions() {
    return this.options.contextTypeExtensions;
  }

  private buildContextSubTypeNamespaceObject(
    contextTypeItems: ContextTypeItem[],
  ) {
    const contextTypeExtensions = this.getContextTypeExtensions();

    if (!contextTypeExtensions || !contextTypeExtensions.contextTypes) {
      throw new Error("Context type extensions are not defined in the options");
    }

    return contextTypeItems.reduce<
      Record<string, { subType: string; name: string; optional: boolean }[]>
    >((acc, contextTypeItem) => {
      const [namespaceName, subTypeName] = contextTypeItem.id.split(":");
      if (!acc[namespaceName]) {
        acc[namespaceName] = [];
      }

      const namespace = contextTypeExtensions.contextTypes[namespaceName];

      if (!namespace) {
        throw new Error(
          `Namespace "${namespaceName}" is not supported in context type extensions`,
        );
      }

      if (!namespace[subTypeName]) {
        throw new Error(
          `SubType "${subTypeName}" in namespace "${namespaceName}" is not supported in context type extensions`,
        );
      }

      const subTypeRawMetadata = namespace[subTypeName];
      if (!subTypeRawMetadata.typeName) {
        throw new Error(
          `typeName is not defined for subType "${subTypeName}" in namespace "${namespaceName}"`,
        );
      }
      const subType = subTypeRawMetadata.typeName;

      acc[namespaceName].push({
        subType,
        name: subTypeName,
        optional: contextTypeItem.optional || false,
      });

      return acc;
    }, {});
  }

  private isNonArrayNode(
    node: ASTNode | ReadonlyArray<ASTNode>,
  ): node is ASTNode {
    return !Array.isArray(node);
  }

  public initContextMap(
    ancestors: ReadonlyArray<ASTNode | ReadonlyArray<ASTNode>>,
    values: { required?: string[]; optional?: string[] },
  ) {
    if (ancestors.length < 2) {
      throw new Error("Invalid document provided");
    }

    const node = ancestors[ancestors.length - 1];
    const nonArrayNode = this.isNonArrayNode(node) ? node : null;

    if (nonArrayNode) {
      if (
        nonArrayNode?.kind === "ObjectTypeDefinition" ||
        nonArrayNode?.kind === "InterfaceTypeDefinition" ||
        nonArrayNode?.kind === "UnionTypeDefinition"
      ) {
        if (this.typeContextMap[nonArrayNode.name.value]?.__context) {
          throw new Error(`Type "${nonArrayNode.name.value}" already visited`);
        }

        const typeName = nonArrayNode.name.value;
        if (!this.typeContextMap[typeName]) {
          this.typeContextMap[typeName] = {};
        }

        this.typeContextMap[typeName].__context = [
          ...(values.required
            ? values.required.map((value) => ({ id: value, optional: false }))
            : []),
          ...(values.optional
            ? values.optional.map((value) => ({ id: value, optional: true }))
            : []),
        ];
      } else if (nonArrayNode?.kind === "FieldDefinition") {
        const node = ancestors[ancestors.length - 3];
        const typeName =
          this.isNonArrayNode(node) &&
          (node.kind === "ObjectTypeDefinition" ||
            node.kind === "ObjectTypeExtension")
            ? node.name.value
            : null;

        if (typeName) {
          if (!this.typeContextMap[typeName]) {
            this.typeContextMap[typeName] = {};
          }

          this.typeContextMap[typeName][nonArrayNode.name.value] = [
            ...(values.required
              ? values.required.map((value) => ({ id: value, optional: false }))
              : []),
            ...(values.optional
              ? values.optional.map((value) => ({ id: value, optional: true }))
              : []),
          ];
        }
      }
    }
  }

  getMetadataObject() {
    if (!this.typeContextMap || !this.resolverTypeMap) {
      return null;
    }

    return buildContextMetadataOutput(
      this.typeContextMap,
      this.resolverTypeMap,
    );
  }

  setResolverTypeMapItem(typeName: string, fieldName: string | null) {
    if (fieldName === null) {
      this.resolverTypeMap[typeName] = null;
      return;
    }

    if (!this.resolverTypeMap[typeName]) {
      this.resolverTypeMap[typeName] = [];
    }

    this.resolverTypeMap[typeName].push(fieldName);
  }

  getSubTypeNamesImportMap(subTypes: ContextTypeItem[]) {
    const subTypeMetadata = this.getContextTypeExtensions();
    return subTypes.reduce<Record<string, string[]>>(
      (acc: Record<string, string[]>, { id: importName }) => {
        const [namespace, subTypeName] = importName.split(":");
        const subType =
          subTypeMetadata?.contextTypes?.[namespace]?.[subTypeName];

        if (!subType) {
          throw new Error(
            `Critical Error: Subtype ${importName} not found in metadata`,
          );
        }

        const { importPath, importNamespaceName } = subType;

        if (importPath) {
          if (!acc[importPath]) {
            acc[importPath] = [];
          }
          acc[importPath].push(importNamespaceName || subTypeName);
        }
        return acc;
      },
      {},
    );
  }

  isLegacyCompatMode(): boolean {
    return this.options.legacyCompat;
  }

  shouldNotGenerateObjectModels(): boolean {
    return this.options.legacyNoModelsForObjects;
  }

  getEnumsImport(): string | null {
    return this.options.enumsImport;
  }

  getContextMap() {
    return this.typeContextMap;
  }

  addType(type: Type): void {
    this.allTypes.push(type);
    this.typeNameToType.set(type.name, type);
  }

  getAllTypes(): Array<Type> {
    return this.allTypes;
  }

  shouldMigrateEnum(enumName: string) {
    if (!this.options.enumNamesToKeep && !this.options.enumNamesToMigrate) {
      return true;
    }

    if (this.options.enumNamesToKeep) {
      return !this.options.enumNamesToKeep.includes(enumName);
    }

    if (this.options.enumNamesToMigrate) {
      return this.options.enumNamesToMigrate.includes(enumName);
    }

    return true;
  }

  getTypeReferenceFromTypeNode(
    node: TypeNode,
    markUsage?: "MODELS" | "RESOLVERS",
  ): ts.TypeNode {
    if (node.kind === Kind.NON_NULL_TYPE) {
      return createNonNullableType(
        this.getTypeReferenceFromTypeNode(node.type, markUsage),
      );
    } else if (node.kind === Kind.LIST_TYPE) {
      return createListType(
        this.getTypeReferenceFromTypeNode(node.type, markUsage),
        markUsage === "RESOLVERS" ? true : false,
      );
    } else {
      return createNullableType(
        this.getModelType(node.name.value, markUsage).toTypeReference(),
        markUsage === "RESOLVERS" ? true : false,
      );
    }
  }

  getTypeReferenceForFieldResolverResultFromTypeNode(
    node: TypeNode,
  ): ts.TypeNode {
    if (node.kind === Kind.NON_NULL_TYPE) {
      return createNonNullableType(
        this.getTypeReferenceForFieldResolverResultFromTypeNode(node.type),
      );
    } else if (node.kind === Kind.LIST_TYPE) {
      this.iterableTypeUsed = true;
      return getResolverReturnListType(
        this.getTypeReferenceForFieldResolverResultFromTypeNode(node.type),
      );
    } else {
      return createNullableType(
        this.getModelType(node.name.value, "RESOLVERS").toTypeReference(),
        true,
      );
    }
  }

  getTypeFromTypeNode(node: TypeNode): string {
    if (typeof node === "string") {
      return node;
    }

    if (node.kind === Kind.NON_NULL_TYPE) {
      return this.getTypeFromTypeNode(node.type);
    } else if (node.kind === Kind.LIST_TYPE) {
      return this.getTypeFromTypeNode(node.type);
    } else {
      return node.name.value;
    }
  }

  isUseStringUnionsInsteadOfEnumsEnabled(): boolean {
    return Boolean(this.options.useStringUnionsInsteadOfEnums);
  }

  getTypeReferenceForInputTypeFromTypeNode(
    node: TypeNode,
    markUsage?: "MODELS" | "RESOLVERS",
  ): ts.TypeNode {
    if (node.kind === Kind.NON_NULL_TYPE) {
      return createNonNullableType(
        this.getTypeReferenceForInputTypeFromTypeNode(node.type, markUsage),
      );
    } else if (node.kind === Kind.LIST_TYPE) {
      return createListType(
        this.getTypeReferenceForInputTypeFromTypeNode(node.type, markUsage),
      );
    } else {
      return createNullableType(
        this.getModelType(node.name.value, markUsage).toTypeReference(),
      );
    }
  }

  addImport(imp: DefinitionImport, node: ASTNode): void {
    for (const { typeName } of imp.defs) {
      const { imp: existingImport } =
        this.typeNameToImports.get(typeName) || {};

      if (existingImport) {
        throw new GraphQLError(
          `Definition ${typeName} is imported multiple times: ${existingImport.from}`,
          [
            getArgumentValue(existingImport.directive.arguments, "from") ??
              existingImport.directive,
            imp.directive,
            node,
          ],
        );
      }
      // TODO: from.value needs to lead to another "module" index
      this.typeNameToImports.set(typeName, {
        modelName: typeName,
        imp,
      });
    }
    this.imports.push(imp);
  }

  addModel(model: DefinitionModel, _node: ASTNode): void {
    const scope = this.options.modelScope;
    if (!scope || model.modelScope === scope) {
      // const existingModel = this.typeNameToModels.get(model.typeName);

      // if (existingModel) {
      //   throw new GraphQLError(
      //     `Model for type ${model.typeName} is defined multiple times`,

      //     [existingModel.directive, node],
      //   );
      // }
      this.typeNameToModels.set(model.typeName, model);
    }
  }

  getModel(typeName: string): DefinitionModel | null {
    return this.typeNameToModels.get(typeName) || null;
  }

  isUsedEntityInModels(typeName: string) {
    return this.usedEntitiesInModels.has(typeName);
  }

  getAllImportDeclarations(
    filterFor: "MODELS" | "RESOLVERS",
  ): ts.ImportDeclaration[] {
    let filter: (typeName: string) => boolean;
    if (filterFor === "MODELS") {
      filter = (typeName: string) => this.usedEntitiesInModels.has(typeName);
    } else {
      filter = (typeName: string) => this.usedEntitiesInResolvers.has(typeName);
    }
    return Array.from(this.imports)
      .sort()
      .reduce<ts.ImportDeclaration[]>((acc, { defs, from, importName }) => {
        const filteredDefs = defs.filter(({ typeName }) => filter(typeName));

        if (filteredDefs.length) {
          acc.push(createImportDeclaration([importName], from, "models"));
        }
        return acc;
      }, [])
      .sort();
  }

  getAllModelImportDeclarations(): ts.ImportDeclaration[] {
    const imports = this.getAllImportDeclarations("MODELS");
    const models = Array.from(this.typeNameToModels.values())
      .sort()
      .map((model) => {
        if (
          model.on === "ObjectTypeDefinition" &&
          this.shouldNotGenerateObjectModels()
        ) {
          return;
        }

        if (!model.from) {
          return;
        }

        return createImportDeclaration(
          [model.modelName],
          model.from,
          model.tsType !== model.modelName ? model.tsType : undefined,
        );
      })
      .filter(Boolean) as ts.ImportDeclaration[];

    return imports.concat(models);
  }

  getBasicImports(): ts.ImportDeclaration[] {
    const imports = [];
    const supermassiveTypes = ["PromiseOrValue"];
    if (this.iterableTypeUsed) {
      supermassiveTypes.push("IterableOrAsyncIterable");
    }

    imports.push(
      createImportDeclaration(supermassiveTypes, "@graphitation/supermassive"),
    );

    if (this.options.resolveInfo.from) {
      imports.push(
        createImportDeclaration(
          [this.options.resolveInfo.name],
          this.options.resolveInfo.from,
        ),
      );
    }
    if (this.options.context.from && this.options.context.name) {
      imports.push(
        createImportDeclaration(
          [this.options.context.name],
          this.options.context.from,
        ),
      );
    }

    return imports;
  }

  getScalarDefinition(scalarName: string | null) {
    if (
      !scalarName ||
      Object.prototype.hasOwnProperty.call(BUILT_IN_SCALARS, scalarName)
    ) {
      return;
    }

    let model;
    if (this.typeNameToModels.has(scalarName)) {
      const { from, modelName, tsType } = this.typeNameToModels.get(
        scalarName,
      ) as DefinitionModel;
      model = from ? modelName : tsType;
    } else {
      model = DEFAULT_SCALAR_TYPE;
    }

    return factory.createTypeAliasDeclaration(
      [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      factory.createIdentifier(scalarName),
      undefined,
      factory.createTypeReferenceNode(
        factory.createIdentifier(model),
        undefined,
      ),
    );
  }

  getBaseModelType(): TypeLocation {
    return new TypeLocation(null, this.options.baseModel.name);
  }

  getContextType(): TypeLocation {
    return new TypeLocation(
      null,
      this.options.context.name ||
        (TsCodegenContextDefault.context.name as string),
    );
  }

  getResolveInfoType(): TypeLocation {
    return new TypeLocation(null, this.options.resolveInfo.name);
  }

  addLegacyInterface(string: string): void {
    this.legacyInterfaces.add(string);
  }

  isLegacyInterface(string: string): boolean {
    return this.legacyInterfaces.has(string);
  }

  getDefaultTypes() {
    return [
      addSyntheticLeadingComment(
        factory.createInterfaceDeclaration(
          [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
          factory.createIdentifier("BaseModel"),
          undefined,
          undefined,
          [
            factory.createPropertySignature(
              [factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
              factory.createIdentifier("__typename"),
              factory.createToken(ts.SyntaxKind.QuestionToken),
              factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
            ),
          ],
        ),
        SyntaxKind.SingleLineCommentTrivia,
        " Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)",
        true,
      ),
    ];
  }

  getModelType(
    typeName: string,
    markUsage?: "MODELS" | "RESOLVERS",
  ): TypeLocation {
    if (Object.prototype.hasOwnProperty.call(BUILT_IN_SCALARS, typeName)) {
      return new TypeLocation(null, BUILT_IN_SCALARS[typeName]);
    } else {
      if (markUsage === "MODELS") {
        this.usedEntitiesInModels.add(typeName);
      } else if (markUsage === "RESOLVERS") {
        this.usedEntitiesInResolvers.add(typeName);
      }
      let namespace = "";
      const type = this.typeNameToType.get(typeName);

      if (markUsage === "MODELS") {
        if (type && type.kind === "ENUM") {
          this.hasUsedEnumsInModels = true;
          namespace = "Enums";
        }
      } else if (markUsage === "RESOLVERS") {
        namespace = "Models";
      }

      if (this.typeNameToImports.has(typeName)) {
        const { modelName, imp } = this.typeNameToImports.get(
          typeName,
        ) as ModelNameAndImport;
        return new TypeLocation(null, `${imp.importName}.${modelName}`);
      } else {
        return new TypeLocation(
          null,
          namespace ? `${namespace}.${typeName}` : typeName,
        );
      }
    }
  }

  getDefinedModelType(typeName: string): TypeLocation | null {
    if (this.typeNameToModels.has(typeName)) {
      const imp = this.typeNameToModels.get(typeName) as DefinitionModel;
      this.usedEntitiesInModels.add(typeName);
      return new TypeLocation(null, imp.modelName);
    } else {
      return null;
    }
  }
}

const LEGACY_INTERFACE_DIRECTIVE_NAME = "legacyInterface_DO_NOT_USE";

export function extractContext(
  options: Partial<TsCodegenContextOptions>,
  document: DocumentNode,
  outputPath: string,
  documentPath: string,
): TsCodegenContext {
  const fullOptions: TsCodegenContextOptions = {
    ...TsCodegenContextDefault,
    ...options,
  };

  const context = new TsCodegenContext(fullOptions);

  visit(document, {
    Directive: {
      enter(node, _key, _parent, _path, ancestors) {
        if (node.name.value === IMPORT_DIRECTIVE_NAME) {
          context.addImport(
            processImportDirective(node, outputPath, documentPath),
            node,
          );
        } else if (node.name.value === MODEL_DIRECTIVE_NAME) {
          context.addModel(
            processModelDirective(node, ancestors, outputPath, documentPath),
            node,
          );
        } else if (node.name.value === LEGACY_INTERFACE_DIRECTIVE_NAME) {
          const typeDef: ASTNode | readonly ASTNode[] | undefined =
            ancestors[ancestors.length - 1];

          if (
            !typeDef ||
            Array.isArray(typeDef) ||
            (typeDef as ASTNode).kind !== "InterfaceTypeDefinition"
          ) {
            throw new GraphQLError(
              "Directive @legacyInterface_DO_NOT_USE must be defined on Interface type",
              [node],
            );
          }
          const typeName = (typeDef as InterfaceTypeDefinitionNode).name.value;
          context.addLegacyInterface(typeName);
        } else if (
          node.name.value === "context" &&
          options.contextTypeExtensions
        ) {
          let requiredKeys: Set<string> | undefined;
          let optionalKeys: Set<string> | undefined;
          if (!node.arguments?.length) {
            throw new Error(
              "Invalid context use: No arguments provided. Provide either required or optional arguments",
            );
          }

          const required = node.arguments.find(
            (value) => value.name.value === "required",
          );
          const optional = node.arguments.find(
            (value) => value.name.value === "optional",
          );

          if (!required && !optional) {
            throw new Error(
              "Invalid context use: Required and optional arguments must be provided",
            );
          }

          if (required && required?.value.kind !== "ObjectValue") {
            throw new Error(
              `Invalid context use: "required" argument must be an object`,
            );
          }

          if (optional && optional?.value.kind !== "ObjectValue") {
            throw new Error(
              `Invalid context use: "optional" argument must be an object`,
            );
          }

          if (required) {
            requiredKeys = new Set(
              new Set(
                getContextKeysFromArgumentNode(
                  required,
                  options.contextTypeExtensions,
                ),
              ),
            );
          }

          if (optional) {
            optionalKeys = new Set(
              new Set(
                getContextKeysFromArgumentNode(
                  optional,
                  options.contextTypeExtensions,
                ),
              ),
            );
          }

          context.initContextMap(ancestors, {
            required: requiredKeys ? Array.from(requiredKeys) : undefined,
            optional: optionalKeys ? Array.from(optionalKeys) : undefined,
          });
        } else if (
          options.contextTypeExtensions?.groups &&
          options.contextTypeExtensions.groups[node.name.value]
        ) {
          const subTypeKeys: Set<string> = new Set();
          const group = options.contextTypeExtensions.groups[node.name.value];

          for (const [namespace, namespaceValues] of Object.entries(group)) {
            namespaceValues.forEach((namespaceValue) => {
              if (
                !options.contextTypeExtensions?.contextTypes?.[namespace]?.[
                  namespaceValue
                ]
              ) {
                throw new Error(
                  `Value "${namespaceValue}" in namespace "${namespace}" is not supported`,
                );
              }

              subTypeKeys.add(`${namespace}:${namespaceValue}`);
            });
            context.initContextMap(ancestors, {
              required: Array.from(subTypeKeys),
            });
          }
        }
      },
    },
    EnumTypeDefinition: {
      leave(node) {
        context.hasEnums = true;

        context.addType({
          kind: "ENUM",
          name: node.name.value,
          values: node.values?.map(({ name: { value } }) => value) || [],
          node,
        });
      },
    },
    ObjectTypeDefinition: {
      leave(node) {
        context.hasResolvers = true;
        context.hasModels = true;

        context.addType({
          kind: "OBJECT",
          name: node.name.value,
          model: context.getModel(node.name.value),
          isExtension: false,
          interfaces:
            node.interfaces?.map(({ name: { value } }) => value) || [],
          fields: node.fields?.map((field) => processField(field)) || [],
          node,
        });
      },
    },
    InterfaceTypeDefinition: {
      leave(node) {
        context.hasModels = true;

        context.addType({
          kind: "INTERFACE",
          name: node.name.value,
          interfaces:
            node.interfaces?.map(({ name: { value } }) => value) || [],
          fields: node.fields?.map((field) => processField(field)) || [],
          node,
        });
      },
    },
    InputObjectTypeDefinition: {
      leave(node) {
        context.hasModels = true;

        context.addType({
          kind: "INPUT_OBJECT",
          name: node.name.value,
          fields: node.fields?.map((field) => processField(field)) || [],
          node,
        });
      },
    },
    ObjectTypeExtension: {
      leave(node) {
        context.hasResolvers = true;

        if (!isRootOperationType(node.name.value)) {
          context.hasModels = true;
        }

        context.addType({
          kind: "OBJECT",
          name: node.name.value,
          model: null,
          isExtension: true,
          interfaces: [],
          fields: node.fields?.map((field) => processField(field)) || [],
          node,
        });
      },
    },
    UnionTypeDefinition: {
      leave(node) {
        context.hasModels = true;

        context.addType({
          kind: "UNION",
          name: node.name.value,
          types: node.types?.map(({ name: { value } }) => value) || [],
          node,
        });
      },
    },
    ScalarTypeDefinition: {
      leave(node) {
        const isCustomScalar = BUILT_IN_SCALARS[node.name.value] == null;
        if (isCustomScalar) {
          context.hasModels = true;
        }

        context.addType({
          kind: "SCALAR",
          name: node.name.value,
          model: context.getModel(node.name.value),
          node,
        });
      },
    },
  });

  // model file also re-exports enums, so we need to emit it if either is present
  context.hasModels = context.hasModels || context.hasEnums;

  return context;
}

export class TypeLocation {
  constructor(private from: string | null, private name: string) {}

  toTypeReference(): ts.TypeReferenceNode {
    if (this.from != null) {
      return factory.createTypeReferenceNode(
        factory.createQualifiedName(
          factory.createIdentifier(this.from),
          factory.createIdentifier(this.name),
        ),
      );
    } else {
      return factory.createTypeReferenceNode(this.name);
    }
  }

  toExpression(): ts.Expression {
    if (this.from != null) {
      return factory.createPropertyAccessExpression(
        factory.createIdentifier(this.from),
        factory.createIdentifier(this.name),
      );
    } else {
      return factory.createIdentifier(this.name);
    }
  }
}

const getArgumentValue = (
  args: readonly ArgumentNode[] = [],
  name: string,
): ValueNode | undefined => args.find((arg) => arg.name.value === name)?.value;

const processField = (
  field: FieldDefinitionNode | InputValueDefinitionNode,
): Field => ({
  name: field.name.value,
  arguments:
    field.kind === "FieldDefinition" && field.arguments
      ? field.arguments.map((argument) => processArgument(argument))
      : [],
  type: field.type,
  node: field,
});

const processArgument = (argument: InputValueDefinitionNode): Argument => ({
  name: argument.name.value,
  type: argument.type,
  node: argument,
});

export interface FieldDefinition {
  typeName: string;
}

export type Argument = {
  name: string;
  type: TypeNode;
  node: InputValueDefinitionNode;
};

export interface Field {
  name: string;
  type: TypeNode;
  arguments: Array<Argument>;
  node: FieldDefinitionNode | InputValueDefinitionNode;
}

export type Type =
  | EnumType
  | ObjectType
  | InterfaceType
  | UnionType
  | InputObjectType
  | ScalarType;

export type ResolverType = ObjectType | InterfaceType | UnionType;

export interface EnumType {
  kind: "ENUM";

  name: string;
  values: string[];

  node: EnumTypeDefinitionNode;
}

export interface ObjectType {
  kind: "OBJECT";
  name: string;
  isExtension: boolean;
  model: DefinitionModel | null;
  interfaces: string[];
  fields: Array<Field>;

  node: ObjectTypeDefinitionNode | ObjectTypeExtensionNode;
}

export interface UnionType {
  kind: "UNION";
  name: string;
  types: Array<string>;

  node: UnionTypeDefinitionNode;
}

export interface InterfaceType {
  kind: "INTERFACE";
  name: string;
  interfaces: string[];
  fields: Array<Field>;

  node: InterfaceTypeDefinitionNode;
}

export interface InputObjectType {
  kind: "INPUT_OBJECT";
  name: string;
  fields: Array<Field>;

  node: InputObjectTypeDefinitionNode;
}

export interface ScalarType {
  kind: "SCALAR";
  name: string;
  model: DefinitionModel | null;

  node: ScalarTypeDefinitionNode;
}
