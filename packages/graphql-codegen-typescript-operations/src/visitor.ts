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
  PreResolveTypesProcessor,
  SelectionSetProcessorConfig,
  SelectionSetToObject,
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
  NonNullTypeNode,
  ListTypeNode,
  GraphQLInputObjectType,
  InputObjectTypeDefinitionNode,
} from "graphql";
import { TypeScriptDocumentsPluginConfig } from "./config";
import { TypeScriptOperationVariablesToObject } from "./ts-operation-variables-to-object";
import { TypeScriptSelectionSetProcessor } from "./ts-selection-set-processor";

export interface TypeScriptDocumentsParsedConfig extends ParsedDocumentsConfig {
  avoidOptionals: AvoidOptionalsConfig;
  immutableTypes: boolean;
  baseTypesPath: string;
  noExport: boolean;
}

const OPERATIONS = ["Mutation", "Query", "Subscription"];
export class TypeScriptDocumentsVisitor extends BaseDocumentsVisitor<
  TypeScriptDocumentsPluginConfig,
  TypeScriptDocumentsParsedConfig
> {
  private usedTypes: Set<string>;
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
      } as TypeScriptDocumentsParsedConfig,
      schema,
    );

    autoBind(this);

    this.usedTypes = new Set();
    const wrapOptional = (type: string) => {
      const prefix = this.config.namespacedImportName
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
      enumPrefix: this.config.enumPrefix,
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
        ? PreResolveTypesProcessor
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
        this.config.enumPrefix,
        this.config.enumValues,
        true,
      ),
    );
    this._declarationBlockConfig = {
      ignoreExport: this.config.noExport,
    };
  }

  public getImports(): Array<string> {
    return !this.config.globalNamespace
      ? this.config.fragmentImports
          .map((fragmentImport) =>
            generateFragmentImportStatement(fragmentImport, "type"),
          )
          .concat(
            this.config.baseTypesPath && this.usedTypes.size
              ? `export {${Array.from(this.usedTypes).join(",")}} from "${
                  this.config.baseTypesPath
                }"`
              : "",
          )
      : [];
  }

  private getTypeNames(node: InputObjectTypeDefinitionNode) {
    return Array.from(
      new Set(
        node.fields
          ?.map((field) => {
            return this.getFieldTypeName(field.type);
          })
          .filter(Boolean) as string[],
      ) || [],
    );
  }

  private getFieldTypeName(typeNode: TypeNode): string {
    if (this.isListTypeNode(typeNode) || this.isNonNullType(typeNode)) {
      return this.getFieldTypeName(typeNode.type);
    }
    return typeNode.name.value;
  }

  isListTypeNode(typeNode: TypeNode): typeNode is ListTypeNode {
    return typeNode.kind === "ListType";
  }

  isNonNullType(typeNode: TypeNode): typeNode is NonNullTypeNode {
    return typeNode.kind === "NonNullType";
  }

  private getAllEntitiesRelatedToInput(
    inputNode: InputObjectTypeDefinitionNode,
  ) {
    const typeNames = this.getTypeNames(inputNode);
    for (const typeName of typeNames) {
      const fieldType = this.schema.getType(typeName);
      if (!fieldType || this.usedTypes.has(fieldType.name)) {
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
        this.usedTypes.add(fieldType.name);
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
      this.usedTypes.add(convertedName);
    }

    return super.convertName(node, options);
  }

  protected getPunctuation(_declarationKind: DeclarationKind): string {
    return ";";
  }

  protected applyVariablesWrapper(variablesBlock: string): string {
    const prefix = this.config.namespacedImportName
      ? `${this.config.namespacedImportName}.`
      : "";

    return `${prefix}Exact<${
      variablesBlock === "{}" ? `{ [key: string]: never; }` : variablesBlock
    }>`;
  }
}
