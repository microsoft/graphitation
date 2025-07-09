import { Types, CodegenPlugin } from "@graphql-codegen/plugin-helpers";
import addPlugin from "@graphql-codegen/add";
import { join } from "path";
import {
  FragmentDefinitionNode,
  buildASTSchema,
  GraphQLSchema,
  visit,
  visitWithTypeInfo,
  TypeInfo,
  OperationDefinitionNode,
} from "graphql";
import { appendExtensionToFilePath, defineFilepathSubfolder } from "./utils";
import {
  resolveDocumentImports,
  DocumentImportResolverOptions,
} from "./resolve-document-imports";
import {
  FragmentImport,
  ImportDeclaration,
  ImportSource,
} from "@graphql-codegen/visitor-plugin-common";

export { resolveDocumentImports, DocumentImportResolverOptions };

export type FragmentImportFromFn = (
  source: ImportSource<FragmentImport>,
  sourceFilePath: string,
) => ImportSource<FragmentImport>;

export type NearOperationFileConfig = {
  /**
   * @description Required, should point to the base schema types file.
   * The key of the output is used a the base path for this file.
   *
   * If you wish to use an NPM package or a local workspace package, make sure to prefix the package name with `~`.
   *
   * @exampleMarkdown
   * ```yml
   * generates:
   * src/:
   *  preset: near-operation-file
   *  presetConfig:
   *    baseTypesPath: types.ts
   *  plugins:
   *    - typescript-operations
   * ```
   */
  baseTypesPath: string;
  /**
   * @description Overrides all external fragments import types by using a specific file path or a package name.
   *
   * If you wish to use an NPM package or a local workspace package, make sure to prefix the package name with `~`.
   *
   * @exampleMarkdown
   * ```yml
   * generates:
   * src/:
   *  preset: near-operation-file
   *  presetConfig:
   *    baseTypesPath: types.ts
   *    importAllFragmentsFrom: '@fragments'
   *  plugins:
   *    - typescript-operations
   * ```
   */
  importAllFragmentsFrom?: string | FragmentImportFromFn;
  /**
   * @description Optional, sets the extension for the generated files. Use this to override the extension if you are using plugins that requires a different type of extensions (such as `typescript-react-apollo`)
   * @default .generates.ts
   *
   * @exampleMarkdown
   * ```yml
   * generates:
   * src/:
   *  preset: near-operation-file
   *  presetConfig:
   *    baseTypesPath: types.ts
   *    extension: .generated.tsx
   *  plugins:
   *    - typescript-operations
   *    - typescript-react-apollo
   * ```
   */
  extension?: string;
  /**
   * @description Optional, override the `cwd` of the execution. We are using `cwd` to figure out the imports between files. Use this if your execuion path is not your project root directory.
   * @default process.cwd()
   *
   * @exampleMarkdown
   * ```yml
   * generates:
   * src/:
   *  preset: near-operation-file
   *  presetConfig:
   *    baseTypesPath: types.ts
   *    cwd: /some/path
   *  plugins:
   *    - typescript-operations
   * ```
   */
  cwd?: string;
  /**
   * @description Optional, defines a folder, (Relative to the source files) where the generated files will be created.
   * @default ''
   *
   * @exampleMarkdown
   * ```yml
   * generates:
   * src/:
   *  preset: near-operation-file
   *  presetConfig:
   *    baseTypesPath: types.ts
   *    folder: __generated__
   *  plugins:
   *    - typescript-operations
   * ```
   */
  folder?: string;
  /**
   * @description Optional, override the name of the import namespace used to import from the `baseTypesPath` file.
   * @default Types
   *
   * @exampleMarkdown
   * ```yml
   * generates:
   * src/:
   *  preset: near-operation-file
   *  presetConfig:
   *    baseTypesPath: types.ts
   *    importTypesNamespace: SchemaTypes
   *  plugins:
   *    - typescript-operations
   * ```
   */
  importTypesNamespace?: string;
  supportedResolvers?: string[];
  availableResolvers?: {
    [type: string]: string[];
  };
  sharedFragmentsDirectoryName?: string;
};

export type FragmentNameToFile = {
  [fragmentName: string]: {
    location: string;
    importsNames: string[];
    onType: string;
    node: FragmentDefinitionNode;
  };
};

export const preset: Types.OutputPreset<NearOperationFileConfig> = {
  buildGeneratesSection: (options) => {
    const schemaObject: GraphQLSchema = options.schemaAst
      ? options.schemaAst
      : buildASTSchema(options.schema, options.config as any);
    const baseDir = options.presetConfig.cwd || process.cwd();
    const extension = options.presetConfig.extension || ".generated.ts";
    const folder = options.presetConfig.folder || "";
    const { supportedResolvers } = options.presetConfig;
    const importTypesNamespace =
      options.presetConfig.importTypesNamespace || "Types";
    const importAllFragmentsFrom: FragmentImportFromFn | string | null =
      options.presetConfig.importAllFragmentsFrom || null;

    const baseTypesPath = options.presetConfig.baseTypesPath;

    if (!baseTypesPath) {
      throw new Error(
        `Preset "near-operation-file" requires you to specify "baseTypesPath" configuration and point it to your base types file (generated by "typescript" plugin)!`,
      );
    }

    const shouldAbsolute = !baseTypesPath.startsWith("~");

    const pluginMap: { [name: string]: CodegenPlugin } = {
      ...options.pluginMap,
      add: addPlugin,
    };

    const sources = resolveDocumentImports(options, schemaObject, {
      baseDir,
      generateFilePath(location: string) {
        const newFilePath = defineFilepathSubfolder(location, folder);

        return appendExtensionToFilePath(newFilePath, extension);
      },
      schemaTypesSource: {
        path: shouldAbsolute
          ? join(options.baseOutputDir, baseTypesPath)
          : baseTypesPath,
        namespace: importTypesNamespace,
      },
      typesImport: options.config.useTypeImports ?? false,
    });

    const supportedOperations: string[] = [];

    const typeInfo = new TypeInfo(
      options.schemaAst || buildASTSchema(options.schema),
    );

    if (supportedResolvers) {
      for (const source of sources) {
        for (const document of source.documents) {
          if (!document.document) {
            continue;
          }

          visit(document.document, {
            OperationDefinition: (node) => {
              node.selectionSet.selections.forEach((selection) => {
                if (
                  selection.kind === "Field" &&
                  supportedResolvers.includes(selection.name.value)
                ) {
                  if (node.name?.value) {
                    supportedOperations.push(node.name.value);
                  }
                }
              });
            },
          });
        }
      }
    }

    const fieldResolverMap: {
      [parentType: string]: {
        nodeType: "operation" | "fragment";
        type: string;
        fields?: string[];
        fragmentSpreads?: string[];
      };
    } = {};

    for (const source of sources) {
      for (const document of source.documents) {
        if (!document.document) {
          continue;
        }

        visit(
          document.document,
          visitWithTypeInfo(typeInfo, {
            FragmentSpread: (node, _key, _parent, path, ancestors) => {
              const ancestor: unknown = getGrandParent(
                ancestors as any,
                path as any,
              );

              if (
                isGrandParentFragment(ancestor) ||
                isGrandParentOperation(ancestor)
              ) {
                const nodeType = isGrandParentFragment(ancestor)
                  ? "fragment"
                  : "operation";

                if (!ancestor.name) {
                  return;
                }

                const fragmentName = ancestor.name.value;

                const parentType = typeInfo.getParentType()?.name;
                if (!parentType) {
                  return;
                }
                if (!fieldResolverMap[fragmentName]) {
                  fieldResolverMap[fragmentName] = {
                    nodeType,
                    type: parentType,
                  };
                }

                if (!fieldResolverMap[fragmentName].fragmentSpreads) {
                  fieldResolverMap[fragmentName].fragmentSpreads = [];
                }

                if (
                  !fieldResolverMap[fragmentName].fragmentSpreads.includes(
                    node.name.value,
                  )
                ) {
                  fieldResolverMap[fragmentName].fragmentSpreads.push(
                    node.name.value,
                  );
                }
              }
            },
            Field: (node, _key, _parent, path, ancestors) => {
              const typeName = typeInfo
                .getType()
                ?.toString()
                .replace(/[[\]!]/g, "");

              const ancestor: unknown = getGrandParent(
                ancestors as any,
                path as any,
              );
              if (
                isGrandParentFragment(ancestor) ||
                isGrandParentOperation(ancestor)
              ) {
                const nodeType = isGrandParentFragment(ancestor)
                  ? "fragment"
                  : "operation";

                const parentType = typeInfo.getParentType()?.name;
                if (typeName && parentType && node.name.value) {
                  const key = isGrandParentFragment(ancestor)
                    ? ancestor.name.value
                    : parentType;

                  if (!fieldResolverMap[key]) {
                    fieldResolverMap[key] = { nodeType, type: parentType };
                  }
                  if (!fieldResolverMap[key].fields) {
                    fieldResolverMap[key].fields = [];
                  }
                  if (!fieldResolverMap[key].fields.includes(node.name.value)) {
                    fieldResolverMap[key].fields.push(node.name.value);
                  }
                }
              }
            },
          }),
        );
      }
    }

    console.log(fieldResolverMap);
    return sources.map<Types.GenerateOptions>(
      ({ importStatements, externalFragments, fragmentImports, ...source }) => {
        let fragmentImportsArr = fragmentImports;

        if (importAllFragmentsFrom) {
          fragmentImportsArr = fragmentImports.map<
            ImportDeclaration<FragmentImport>
          >((t) => {
            const newImportSource: ImportSource<FragmentImport> =
              typeof importAllFragmentsFrom === "string"
                ? { ...t.importSource, path: importAllFragmentsFrom }
                : importAllFragmentsFrom(t.importSource, source.filename);

            return {
              ...t,
              importSource: newImportSource || t.importSource,
            };
          });
        }

        const plugins = [
          // TODO/NOTE I made globalNamespace include schema types - is that correct?
          ...(options.config.globalNamespace
            ? []
            : importStatements.map((importStatement) => ({
                add: { content: importStatement },
              }))),
          ...options.plugins,
        ];
        const config = {
          ...options.config,
          // This is set here in order to make sure the fragment spreads sub types
          // are exported from operations file
          exportFragmentSpreadSubTypes: true,
          namespacedImportName: importTypesNamespace,
          externalFragments,
          fragmentImports: fragmentImportsArr,
        };

        return {
          ...source,
          plugins,
          pluginMap,
          config,
          schema: options.schema,
          schemaAst: schemaObject,
          skipDocumentsValidation: true,
        };
      },
    );
  },
};

function getGrandParent(ancestors: unknown[], path: (string | number)[]) {
  const firstVistitLayerAfterDocument = ancestors[1];
  if (!Array.isArray(firstVistitLayerAfterDocument)) {
    return null;
  }

  if (path[0] !== "definitions" || typeof path[1] !== "number") {
    return null;
  }

  return firstVistitLayerAfterDocument[path[1]];
}
function isGrandParentFragment(
  ancestor: unknown,
): ancestor is FragmentDefinitionNode {
  return (
    typeof ancestor === "object" &&
    ancestor !== null &&
    "kind" in ancestor &&
    ancestor.kind === "FragmentDefinition"
  );
}

function isGrandParentOperation(
  ancestor: unknown,
): ancestor is OperationDefinitionNode {
  return (
    typeof ancestor === "object" &&
    ancestor !== null &&
    "kind" in ancestor &&
    ancestor.kind === "OperationDefinition"
  );
}

export default preset;
