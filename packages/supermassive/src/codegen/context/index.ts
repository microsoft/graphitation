import {
  DocumentNode,
  GraphQLError,
  visit,
  ArgumentNode,
  ValueNode,
  ASTNode,
} from "graphql";
import ts, { factory } from "typescript";
import { BASE_SCALARS } from "../scalars";
import { DefinitionImport, DefinitionModel } from "../types";
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

export const SCALARS_TYPE_NAME = "Scalars";
const DEFAULT_SCALAR_TYPE = "any";
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
  private typeNameToImports: Map<string, ModelNameAndImport>;
  private typeNameToModels: Map<string, DefinitionModel>;
  private allModelNames: Set<string>;
  private scalars: Map<string, string>;

  constructor(private options: TsCodegenContextOptions) {
    this.imports = [];
    this.typeNameToImports = new Map();
    this.typeNameToModels = new Map();
    this.allModelNames = new Set([SCALARS_TYPE_NAME]);
    this.scalars = new Map(Object.entries(BASE_SCALARS));
  }

  addImport(imp: DefinitionImport, node: ASTNode): void {
    for (const { typeName, modelName } of imp.defs) {
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
      this.typeNameToImports.set(typeName, { modelName, imp });
    }
    this.imports.push(imp);
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

  getAllImportDeclarations(): ts.ImportDeclaration[] {
    return this.imports.map(({ defs, from }) =>
      factory.createImportDeclaration(
        undefined,
        undefined,
        factory.createImportClause(
          false,
          undefined,
          factory.createNamedImports(
            defs.map(({ modelName }) =>
              factory.createImportSpecifier(
                undefined,
                factory.createIdentifier(modelName),
              ),
            ),
          ),
        ),
        factory.createStringLiteral(from),
      ),
    );
  }

  getAllModelImportDeclarations(): ts.ImportDeclaration[] {
    const imports = this.getAllImportDeclarations();
    const models = Array.from(this.typeNameToModels.values()).map((model) =>
      factory.createImportDeclaration(
        undefined,
        undefined,
        factory.createImportClause(
          false,
          undefined,
          factory.createNamedImports([
            factory.createImportSpecifier(
              factory.createIdentifier(model.tsType),
              factory.createIdentifier(model.modelName),
            ),
          ]),
        ),
        factory.createStringLiteral(model.from),
      ),
    );

    const baseScalarsImport = factory.createImportDeclaration(
      undefined,
      undefined,
      factory.createImportClause(
        false,
        undefined,
        factory.createNamedImports([
          factory.createImportSpecifier(
            undefined,
            factory.createIdentifier("BaseScalars"),
          ),
        ]),
      ),
      factory.createStringLiteral("@graphitation/supermassive"),
    );

    return imports.concat(models).concat(baseScalarsImport);
  }

  addScalar(scalarName: string | null) {
    if (!scalarName) {
      return;
    }
    this.scalars.set(scalarName, DEFAULT_SCALAR_TYPE);
  }

  getAllResolverImportDeclarations(): ts.ImportDeclaration[] {
    const imports = [];
    imports.push(
      factory.createImportDeclaration(
        undefined,
        undefined,
        factory.createImportClause(
          true,
          undefined,
          factory.createNamedImports([
            factory.createImportSpecifier(
              undefined,
              factory.createIdentifier("PromiseOrValue"),
            ),
          ]),
        ),
        factory.createStringLiteral("@graphitation/supermassive"),
      ),
    );
    if (this.options.resolveInfo.from) {
      imports.push(
        factory.createImportDeclaration(
          undefined,
          undefined,
          factory.createImportClause(
            true,
            undefined,
            factory.createNamedImports([
              factory.createImportSpecifier(
                undefined,
                factory.createIdentifier(this.options.resolveInfo.name),
              ),
            ]),
          ),
          factory.createStringLiteral(this.options.resolveInfo.from),
        ),
      );
    }
    if (this.options.context.from && this.options.context.name) {
      imports.push(
        factory.createImportDeclaration(
          undefined,
          undefined,
          factory.createImportClause(
            true,
            undefined,
            factory.createNamedImports([
              factory.createImportSpecifier(
                undefined,
                factory.createIdentifier(this.options.context.name),
              ),
            ]),
          ),
          factory.createStringLiteral(this.options.context.from),
        ),
      );
    }

    imports.push(
      factory.createImportDeclaration(
        undefined,
        undefined,
        factory.createImportClause(
          true,
          undefined,
          factory.createNamedImports(
            Array.from(this.allModelNames).map((modelName) =>
              factory.createImportSpecifier(
                undefined,
                factory.createIdentifier(modelName),
              ),
            ),
          ),
        ),
        factory.createStringLiteral("./models.interface.ts"),
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
      factory.createTypeAliasDeclaration(
        undefined,
        [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
        factory.createIdentifier("BaseModel"),
        undefined,
        factory.createTypeLiteralNode([
          factory.createPropertySignature(
            undefined,
            factory.createIdentifier("__typename"),
            undefined,
            factory.createTypeReferenceNode(
              factory.createQualifiedName(
                factory.createIdentifier(SCALARS_TYPE_NAME),
                factory.createIdentifier("String"),
              ),
            ),
          ),
        ]),
      ),
      factory.createTypeAliasDeclaration(
        undefined,
        [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
        factory.createIdentifier(SCALARS_TYPE_NAME),
        undefined,
        factory.createIntersectionTypeNode([
          factory.createTypeReferenceNode(
            factory.createIdentifier("BaseScalars"),
            undefined,
          ),
          factory.createTypeLiteralNode(
            Array.from(this.scalars)
              .filter(([key]) => !BASE_SCALARS.hasOwnProperty(key))
              .map(([key, type]) =>
                factory.createPropertySignature(
                  undefined,
                  factory.createIdentifier(key),
                  undefined,
                  factory.createTypeReferenceNode(
                    factory.createIdentifier(type),
                    undefined,
                  ),
                ),
              ),
          ),
        ]),
      ),
    ];
  }

  getModelType(
    typeName: string,
    putModelSuffix: boolean,
    saveModels = false,
  ): TypeLocation {
    if (this.scalars.has(typeName)) {
      return new TypeLocation(SCALARS_TYPE_NAME, typeName);
    } else if (this.typeNameToImports.has(typeName)) {
      let { modelName } = this.typeNameToImports.get(
        typeName,
      ) as ModelNameAndImport;
      return new TypeLocation(null, modelName);
    } else {
      if (saveModels) {
        this.allModelNames.add(`${typeName}${putModelSuffix ? "Model" : ""}`);
      }
      return new TypeLocation(
        null,
        `${typeName}${putModelSuffix ? "Model" : ""}`,
      );
    }
  }

  getDefinedModelType(typeName: string): TypeLocation | null {
    if (this.scalars.has(typeName)) {
      return new TypeLocation(SCALARS_TYPE_NAME, typeName);
    } else if (this.typeNameToModels.has(typeName)) {
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
          context.addImport(processImportDirective(node), node);
        } else if (node.name.value === MODEL_DIRECTIVE_NAME) {
          context.addModel(processModelDirective(node, ancestors), node);
        }
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
