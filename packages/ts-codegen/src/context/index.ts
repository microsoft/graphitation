import {
  DocumentNode,
  GraphQLError,
  visit,
  ArgumentNode,
  ValueNode,
  ASTNode,
  NamedTypeNode,
  isScalarType,
  FieldNode,
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
  collapseTextChangeRangesAcrossMultipleVersions,
} from "typescript";
import { DefinitionImport, DefinitionModel } from "../types";
import { createImportDeclaration } from "./utilities";
import { addModelSuffix } from "../utilities";
import { IMPORT_DIRECTIVE_NAME, processImportDirective } from "./import";
import { MODEL_DIRECTIVE_NAME, processModelDirective } from "./model";

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
  resolveInfo: {
    name: string;
    from: string | null;
  };
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
};

type ModelNameAndImport = { modelName: string; imp: DefinitionImport };

export class TsCodegenContext {
  private imports: DefinitionImport[];
  private typeNameToImports: Map<
    string,
    { modelName: string } & ModelNameAndImport
  >;
  private typeNameToModels: Map<string, DefinitionModel>;
  private allModelNames: Set<string>;
  private entitiesToImport: Set<string>;
  private defaultModels: Set<string>;
  public importedEntity: Set<string>;

  private allTypes: Array<Type>;

  constructor(private options: TsCodegenContextOptions) {
    this.imports = [];
    this.typeNameToImports = new Map();
    this.typeNameToModels = new Map();
    this.allModelNames = new Set();
    this.entitiesToImport = new Set();
    this.defaultModels = new Set();
    this.importedEntity = new Set();

    this.allTypes = [];
  }

  addType(type: Type): void {
    this.allTypes.push(type);
  }

  getAllTypes(): Array<Type> {
    return this.allTypes;
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
      this.importedEntity.add(typeName);
      // TODO: from.value needs to lead to another "module" index
      this.typeNameToImports.set(typeName, {
        modelName: addModelSuffix(typeName),
        imp,
      });
    }
    this.imports.push(imp);
  }

  addDefaultModel(model: string): void {
    this.defaultModels.add(model);
  }

  addEntityToImport(model: string): void {
    this.entitiesToImport.add(model);
  }

  clearEntitiesToImport(): void {
    this.entitiesToImport = new Set(Array.from(this.defaultModels));
  }

  addModel(model: DefinitionModel, node: ASTNode): void {
    const existingModel = this.typeNameToModels.get(model.typeName);

    if (existingModel) {
      throw new GraphQLError(
        `Model for type ${model.typeName} is defined multiple times`,

        [existingModel.directive, node],
      );
    }

    this.typeNameToModels.set(model.typeName, model);
  }

  getModel(typeName: string): DefinitionModel | null {
    return this.typeNameToModels.get(typeName) || null;
  }

  getAllImportDeclarations(): ts.ImportDeclaration[] {
    return this.imports.reduce<ts.ImportDeclaration[]>(
      (acc, { defs, from }) => {
        const filteredDefs = defs.filter(({ typeName }) =>
          this.entitiesToImport.has(typeName),
        );

        if (filteredDefs.length) {
          acc.push(
            createImportDeclaration(
              filteredDefs.map(({ typeName }) => addModelSuffix(typeName)),
              from,
            ),
          );
        }
        return acc;
      },
      [],
    );
  }

  getAllModelImportDeclarations(): ts.ImportDeclaration[] {
    const imports = this.getAllImportDeclarations();
    const models = Array.from(this.typeNameToModels.values())
      .map((model) => {
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

  getScalarDeclaration(scalarName: string | null) {
    if (!scalarName || BUILT_IN_SCALARS.hasOwnProperty(scalarName)) {
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
      undefined,
      [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      factory.createIdentifier(addModelSuffix(scalarName)),
      undefined,
      factory.createTypeReferenceNode(
        factory.createIdentifier(model),
        undefined,
      ),
    );
  }

  getAllResolverImportDeclarations(): ts.ImportDeclaration[] {
    const imports = [];
    imports.push(
      createImportDeclaration(["PromiseOrValue"], "@graphitation/supermassive"),
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

    imports.push(
      createImportDeclaration(
        Array.from(this.allModelNames),
        "./models.interface",
      ),
    );

    imports.push(...this.getAllImportDeclarations());

    return imports;
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

  getDefaultTypes() {
    return [
      addSyntheticLeadingComment(
        factory.createInterfaceDeclaration(
          undefined,
          [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
          factory.createIdentifier("BaseModel"),
          undefined,
          undefined,
          [
            factory.createPropertySignature(
              [factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
              factory.createIdentifier("__typename"),
              undefined,
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
    addPossibleModel = true,
    shouldAddModelSuffix = true,
  ): TypeLocation {
    if (BUILT_IN_SCALARS.hasOwnProperty(typeName)) {
      return new TypeLocation(null, BUILT_IN_SCALARS[typeName]);
    } else if (this.typeNameToImports.has(typeName)) {
      let { modelName } = this.typeNameToImports.get(
        typeName,
      ) as ModelNameAndImport;
      return new TypeLocation(null, modelName);
    } else {
      const modelName = shouldAddModelSuffix
        ? addModelSuffix(typeName)
        : typeName;

      if (this.entitiesToImport.has(typeName) && addPossibleModel) {
        this.allModelNames.add(modelName);
      }
      return new TypeLocation(null, modelName);
    }
  }

  getDefinedModelType(typeName: string): TypeLocation | null {
    if (this.typeNameToModels.has(typeName)) {
      let imp = this.typeNameToModels.get(typeName) as DefinitionModel;
      return new TypeLocation(null, imp.modelName);
    } else {
      return null;
    }
  }
}

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
  let context = new TsCodegenContext(fullOptions);

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
        }
      },
    },
    EnumTypeDefinition: {
      leave(node) {
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
        context.addType({
          kind: "INTERFACE",
          name: node.name.value,
          interfaces:
            node.interfaces?.map(({ name: { value } }) => value) || [],
          node,
        });
      },
    },
    InputObjectTypeDefinition: {
      leave(node) {
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
        context.addType({
          kind: "SCALAR",
          name: node.name.value,
          model: context.getModel(node.name.value),
          node,
        });
      },
    },
  });

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
