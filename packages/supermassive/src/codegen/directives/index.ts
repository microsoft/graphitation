import { TsConfigResolver } from "@ts-morph/common";
import {
  DocumentNode,
  DirectiveNode,
  GraphQLError,
  visit,
  ArgumentNode,
  ValueNode,
} from "graphql";
import ts, { factory, nodeModuleNameResolver } from "typescript";
import models from "../../benchmarks/swapi-schema/models";
import { DefinitionImport, DefinitionModel, DefinitionModels } from "../types";
import { IMPORT_DIRECTIVE_NAME, processImportDirective } from "./import";
import { MODEL_DIRECTIVE_NAME } from "./model";

export type TsCodegenContextOptions = {
  moduleRoot: string;
  moduleModelsPath: string;
  moduleResolversPath: string;
  baseModel: {
    name: string;
    from: string;
  };
  context: {
    name: string;
    from: string;
  };
  resolveInfo: {
    name: string;
    from: string;
  };
  graphQLToTsTypeMap: { [record: string]: string };
};

const TsCodegenContextDefault: TsCodegenContextOptions = {
  moduleRoot: "",
  moduleModelsPath: "./__generated__/models.interface.ts",
  moduleResolversPath: "./__generated__/resolvers.interface.ts",
  baseModel: {
    name: "BaseModel",
    from: "./base-model.interface.ts",
  },
  context: {
    name: "Context",
    from: "./context.interface.ts",
  },
  resolveInfo: {
    name: "ResolveInfo",
    from: "@graphitation/supermassive",
  },
  graphQLToTsTypeMap: {
    ID: "string",
    Int: "number",
    String: "string",
    Boolean: "boolean",
  },
};

export type TypeNameToTypeReference = Map<string, ts.TypeReferenceNode>;

export class TsCodegenContext {
  private typeNameToModule: TypeNameToTypeReference;

  constructor(
    private options: TsCodegenContextOptions,
    private imports: DefinitionImport[],
    private models: DefinitionModel[],
  ) {
    this.typeNameToModule = new Map();
    imports.forEach((imp) => {
      imp.defs.forEach((def) => {
        this.typeNameToModule.set(
          def,
          factory.createTypeReferenceNode(
            factory.createQualifiedName(
              factory.createIdentifier(imp.importName),
              factory.createIdentifier(`${def}Model`),
            ),
            undefined,
          ),
        );
      });
    });
  }

  getAllModelImportDeclarations(): ts.ImportDeclaration[] {
    return this.imports.map(({ importName, from }) =>
      factory.createImportDeclaration(
        undefined,
        undefined,
        factory.createImportClause(
          false,
          undefined,
          factory.createNamespaceImport(factory.createIdentifier(importName)),
        ),
        factory.createStringLiteral(from),
      ),
    );
  }

  getAllResolverImportDeclarations(): ts.ImportDeclaration[] {
    const imports = this.getAllModelImportDeclarations();
    imports.unshift(
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
    imports.unshift(
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
    imports.unshift(
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

    return imports;
  }

  getContextTypeReference(): ts.TypeReferenceNode {
    return factory.createTypeReferenceNode(this.options.context.name);
  }
  getResolveInfoTypeReference(): ts.TypeReferenceNode {
    return factory.createTypeReferenceNode(this.options.resolveInfo.name);
  }

  getModelTypeReferenceForTypeName(typeName: string): ts.TypeReferenceNode {
    if (this.options.graphQLToTsTypeMap[typeName]) {
      return factory.createTypeReferenceNode(
        this.options.graphQLToTsTypeMap[typeName],
      );
    } else if (this.typeNameToModule.has(typeName)) {
      return this.typeNameToModule.get(typeName) as ts.TypeReferenceNode;
    } else {
      return factory.createTypeReferenceNode(
        factory.createQualifiedName(
          factory.createIdentifier("models"),
          factory.createIdentifier(`${typeName}Model`),
        ),
        undefined,
      );
    }
  }

  getDefinedModelForTypeName() {}
}

export function extractContext(
  options: Partial<TsCodegenContextOptions>,
  document: DocumentNode,
): TsCodegenContext {
  const fullOptions: TsCodegenContextOptions = {
    ...TsCodegenContextDefault,
    ...options,
  };
  let imports: DefinitionImport[] = [];
  let models: DefinitionModel[] = [];

  const mapForDuplicatesCheck = new Map<
    string,
    { from: string; directive: DirectiveNode }
  >();

  visit(document, {
    Directive: {
      enter(node) {
        if (node.name.value === IMPORT_DIRECTIVE_NAME) {
          const imp = processImportDirective(node);
          for (const def in imp.defs) {
            const existingImport = mapForDuplicatesCheck.get(def);

            if (existingImport) {
              throw new GraphQLError(
                `Definition ${def} is imported multiple times: ${existingImport.from}`,
                [
                  getArgumentValue(
                    existingImport.directive.arguments,
                    "from",
                  ) ?? existingImport.directive,
                  imp.directive,
                ],
              );
            }
            // TODO: from.value needs to lead to another "module" index
            mapForDuplicatesCheck.set(def, {
              from: imp.from,
              directive: imp.directive,
            });
          }
          imports.push(imp);
        } else if (node.name.value === MODEL_DIRECTIVE_NAME) {
          // const model = processModelDirective(node);
        }
      },
    },
  });

  return new TsCodegenContext(fullOptions, imports, models);
}

const getArgumentValue = (
  args: readonly ArgumentNode[] = [],
  name: string,
): ValueNode | undefined => args.find((arg) => arg.name.value === name)?.value;
