import {
  AvoidOptionalsConfig,
  BaseDocumentsVisitor,
  BaseVisitorConvertOptions,
  ConvertOptions,
  DeclarationKind,
  generateFragmentImportStatement,
  getConfigValue,
  LoadedFragment,
  normalizeAvoidOptionals,
  ParsedDocumentsConfig,
  SelectionSetProcessorConfig,
  SelectionSetToObject,
  PreResolveTypesProcessor as CodegenPreResolveTypesProcessor,
  wrapTypeWithModifiers,
} from "@graphql-codegen/visitor-plugin-common";
import autoBind from "auto-bind";
import {
  ASTNode,
  GraphQLNamedType,
  GraphQLOutputType,
  GraphQLSchema,
  isEnumType,
  GraphQLEnumType,
  isNonNullType,
  TypeNode,
  Kind,
  GraphQLInputObjectType,
  InputObjectTypeDefinitionNode,
} from "graphql";
import { TypeScriptDocumentsPluginConfig } from "./config";
import { TypeScriptOperationVariablesToObject } from "./ts-operation-variables-to-object";
import { TypeScriptSelectionSetProcessor } from "./ts-selection-set-processor";
import { PreResolveTypesProcessor } from "./ts-pre-resolve-types-processor";

export interface TypeScriptDocumentsParsedConfig extends ParsedDocumentsConfig {
  avoidOptionals: AvoidOptionalsConfig;
  immutableTypes: boolean;
  baseTypesPath: string;
  noExport: boolean;
  isTypeOnly: boolean;
  inlineCommonTypes: boolean;
}
export class TypeScriptDocumentsVisitor extends BaseDocumentsVisitor<
  TypeScriptDocumentsPluginConfig,
  TypeScriptDocumentsParsedConfig
> {
  private usedTypes: Set<string>;
  private usedEnums: Set<string>;
  private isExactUsed = false;

  constructor(
    schema: GraphQLSchema,
    config: TypeScriptDocumentsPluginConfig,
    allFragments: LoadedFragment[],
  ) {
    super(
      config,
      {
        noExport: getConfigValue(config.noExport, false),
        baseTypesPath: getConfigValue(config.baseTypesPath, ""),
        avoidOptionals: normalizeAvoidOptionals(
          getConfigValue(config.avoidOptionals, false),
        ),
        immutableTypes: getConfigValue(config.immutableTypes, false),
        nonOptionalTypename: getConfigValue(config.nonOptionalTypename, false),
        isTypeOnly: getConfigValue(config.isTypeOnly, false),
        inlineCommonTypes: getConfigValue(config.inlineCommonTypes, false),
      } as TypeScriptDocumentsParsedConfig,
      schema,
    );

    autoBind(this);

    this.usedTypes = new Set();
    this.usedEnums = new Set();
    const wrapOptional = (type: string) => {
      const prefix =
        !this.config.inlineCommonTypes && this.config.namespacedImportName
          ? `${this.config.namespacedImportName}.`
          : "";
      return `${prefix}Maybe<${type}>`;
    };
    const wrapArray = (type: string) => {
      const listModifier = this.config.immutableTypes
        ? "ReadonlyArray"
        : "Array";
      return `${listModifier}<${type}>`;
    };

    const formatNamedField = (
      name: string,
      type: GraphQLOutputType | GraphQLNamedType | null,
    ): string => {
      const optional =
        !this.config.avoidOptionals.field && !!type && !isNonNullType(type);

      return (
        (this.config.immutableTypes ? `readonly ${name}` : name) +
        (optional ? "?" : "")
      );
    };

    const processorConfig: SelectionSetProcessorConfig = {
      namespacedImportName: this.config.namespacedImportName,
      convertName: this.convertName.bind(this),
      enumPrefix: false,
      scalars: this.scalars,
      formatNamedField,
      wrapTypeWithModifiers(baseType, type) {
        return wrapTypeWithModifiers(baseType, type, {
          wrapOptional,
          wrapArray,
        });
      },
      avoidOptionals: this.config.avoidOptionals,
    };

    const processor = new (
      config.preResolveTypes
        ? config.inlineCommonTypes
          ? PreResolveTypesProcessor
          : CodegenPreResolveTypesProcessor
        : TypeScriptSelectionSetProcessor
    )(processorConfig);
    this.setSelectionSetHandler(
      new SelectionSetToObject(
        processor,
        this.scalars,
        this.schema,
        this.convertName.bind(this),
        this.getFragmentSuffix.bind(this),
        allFragments,
        this.config,
      ),
    );
    const enumsNames = Object.keys(schema.getTypeMap()).filter((typeName) =>
      isEnumType(schema.getType(typeName)),
    );
    this.setVariablesTransformer(
      new TypeScriptOperationVariablesToObject(
        this.scalars,
        this.convertName.bind(this),
        this.config.avoidOptionals.object as boolean | AvoidOptionalsConfig,
        this.config.immutableTypes,
        this.config.namespacedImportName,
        enumsNames,
        false,
        this.config.enumValues,
        true,
        this.config.inlineCommonTypes,
        this.usedEnums,
      ),
    );
    this._declarationBlockConfig = {
      ignoreExport: this.config.noExport,
    };
  }

  private getExportNames(): string[] {
    const exportNames: string[] = Array.from(this.usedTypes);

    if (!this.config.inlineCommonTypes) {
      exportNames.push(...Array.from(this.usedEnums));
    }

    return exportNames;
  }
  public getImports(): Array<string> {
    const imports = !this.config.globalNamespace
      ? this.config.fragmentImports
          .map((fragmentImport) =>
            generateFragmentImportStatement(fragmentImport, "type"),
          )
          .concat(
            this.config.baseTypesPath && this.usedTypes.size
              ? `export ${
                  this.config.isTypeOnly ? "type " : ""
                }{${this.getExportNames().join(",")}} from "${
                  this.config.baseTypesPath
                }"`
              : "",
          )
      : [];

    if (this.config.inlineCommonTypes && this.isExactUsed) {
      imports.push(`type Exact<T extends { [key: string]: unknown }> = {
        [K in keyof T]: T[K];
      }`);
    }

    if (this.config.inlineCommonTypes && this.usedEnums.size) {
      for (const usedEnum of this.usedEnums.values()) {
        const enumType = this.schema.getType(usedEnum) as GraphQLEnumType;
        imports.push(
          `export type ${usedEnum} = ${enumType
            .getValues()
            .map((value) => `"${value.name}"`)
            .join(" | ")}`,
        );
      }
    }

    return imports;
  }

  private getTypeNames(node: InputObjectTypeDefinitionNode) {
    return Array.from(
      new Set(
        node.fields
          ?.map((field) => {
            return this.typeNameFromAST(field.type);
          })
          .filter(Boolean) as string[],
      ) || [],
    );
  }

  private typeNameFromAST(typeAst: TypeNode): string {
    if (
      typeAst.kind === Kind.LIST_TYPE ||
      typeAst.kind === Kind.NON_NULL_TYPE
    ) {
      return this.typeNameFromAST(typeAst.type);
    } else {
      return typeAst.name.value;
    }
  }

  private getAllEntitiesRelatedToInput(
    inputNode: InputObjectTypeDefinitionNode,
  ) {
    const typeNames = this.getTypeNames(inputNode);
    for (const typeName of typeNames) {
      const fieldType = this.schema.getType(typeName);
      if (!fieldType || this.usedTypes.has(typeName)) {
        continue;
      }

      if (
        this.schema.getType(fieldType.name) instanceof GraphQLInputObjectType
      ) {
        const astNode = this.schema.getType(fieldType.name)?.astNode;
        this.usedTypes.add(fieldType.name);

        if (this.isInputObjectTypeDefinitionNode(astNode)) {
          this.getAllEntitiesRelatedToInput(astNode);
        }
      } else if (
        this.schema.getType(fieldType.name) instanceof GraphQLEnumType
      ) {
        this.usedEnums.add(fieldType.name);
      }
    }
  }

  private isInputObjectTypeDefinitionNode(
    astNode?: ASTNode | null,
  ): astNode is InputObjectTypeDefinitionNode {
    return astNode?.kind === "InputObjectTypeDefinition";
  }

  public convertName(
    node: string | ASTNode,
    options?: (BaseVisitorConvertOptions & ConvertOptions) | undefined,
  ): string {
    const convertedName = this.config.convert(node, options);

    if (this.schema.getType(convertedName) instanceof GraphQLInputObjectType) {
      const astNode = this.schema.getType(convertedName)?.astNode;

      if (this.isInputObjectTypeDefinitionNode(astNode)) {
        this.usedTypes.add(convertedName);
        this.getAllEntitiesRelatedToInput(astNode);
      }
    } else if (this.schema.getType(convertedName) instanceof GraphQLEnumType) {
      this.usedEnums.add(convertedName);
    }

    return super.convertName(node, options);
  }

  protected getPunctuation(_declarationKind: DeclarationKind): string {
    return ";";
  }

  protected applyVariablesWrapper(variablesBlock: string): string {
    this.isExactUsed = true;
    const prefix =
      !this.config.inlineCommonTypes && this.config.namespacedImportName
        ? `${this.config.namespacedImportName}.`
        : "";

    return `${prefix}Exact<${
      variablesBlock === "{}" ? `{ [key: string]: never; }` : variablesBlock
    }>`;
  }
}
