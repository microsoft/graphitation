import ts from "typescript";
import { DocumentNode } from "graphql";
import { ContextMap, extractContext } from "./context/index";
import { generateResolvers } from "./resolvers";
import { generateModels } from "./models";
import { generateLegacyTypes } from "./legacyTypes";
import { generateLegacyResolvers } from "./legacyResolvers";
import { generateEnums } from "./enums";
import { generateInputs } from "./inputs";

export interface GenerateTSOptions {
  outputPath: string;
  documentPath: string;
  contextTypePath?: string | null;
  contextTypeName?: string;
  enumsImport?: string | null;
  legacyCompat?: boolean;
  useStringUnionsInsteadOfEnums?: boolean;
  legacyNoModelsForObjects?: boolean;
  modelScope?: string | null;
  generateOnlyEnums?: boolean;
  enumNamesToMigrate?: string[];
  enumNamesToKeep?: string[];
  contextSubTypeNameTemplate?: string;
  contextSubTypePathTemplate?: string;
  defaultContextSubTypePath?: string;
  defaultContextSubTypeName?: string;
  /**
   * Enable the generation of the resolver map as the default export in the resolvers file.
   *
   * @see createResolversMap in packages/ts-codegen/src/resolvers.ts
   *
   * @example
   * export default interface ResolversMap {
   *    readonly User?: User.Resolvers;
   *    readonly Post?: Post.Resolvers;
   *    readonly Query?: Query.Resolvers;
   *   }
   * */
  generateResolverMap?: boolean;
  /**
   * Makes root operation types and its properties mandatory in all generated resolver interfaces,
   * including ResolverMap.
   *
   * @example
   * // mandatoryRootOperationTypes: enabled
   * export declare namespace Query {
   *    export interface Resolvers {
   *       readonly allTodos: allTodos;
   *    }
   * }
   * export default interface ResolversMap {
   *    readonly Query: Query.Resolvers;
   *    readonly User?: User.Resolvers;
   * }
   *
   * // mandatoryRootOperationTypes: disabled
   * export declare namespace Query {
   *    export interface Resolvers {
   *       readonly allTodos?: allTodos;
   *    }
   * }
   * export default interface ResolversMap {
   *    readonly Query?: Query.Resolvers;
   *    readonly User?: User.Resolvers;
   * }
   */
  mandatoryRootOperationTypes?: boolean;
}

export function generateTS(
  document: DocumentNode,
  {
    outputPath,
    documentPath,
    contextTypePath,
    contextTypeName,
    enumsImport,
    legacyCompat,
    useStringUnionsInsteadOfEnums,
    legacyNoModelsForObjects,
    modelScope,
    generateOnlyEnums,
    enumNamesToMigrate,
    enumNamesToKeep,
    contextSubTypeNameTemplate,
    contextSubTypePathTemplate,
    defaultContextSubTypePath,
    defaultContextSubTypeName,
    generateResolverMap,
    mandatoryRootOperationTypes,
  }: GenerateTSOptions,
): {
  files: ts.SourceFile[];
  contextMappingOutput: ContextMap | null;
} {
  try {
    const context = extractContext(
      {
        context: {
          name: contextTypeName,
          from: contextTypePath || null,
        },
        legacyCompat,
        useStringUnionsInsteadOfEnums,
        enumsImport,
        legacyNoModelsForObjects,
        modelScope,
        enumNamesToMigrate,
        enumNamesToKeep,
        contextSubTypeNameTemplate,
        contextSubTypePathTemplate,
        defaultContextSubTypePath,
        defaultContextSubTypeName,
      },
      document,
      outputPath,
      documentPath,
    );
    const result: ts.SourceFile[] = [];

    if (context.hasEnums) {
      result.push(generateEnums(context));
    }

    if (!generateOnlyEnums) {
      result.push(generateModels(context));
      result.push(
        generateResolvers(context, {
          generateResolverMap,
          mandatoryRootOperationTypes,
        }),
      );
      if (context.hasInputs) {
        result.push(generateInputs(context));
      }
      if (legacyCompat) {
        result.push(generateLegacyTypes(context));
        result.push(generateLegacyResolvers(context));
      }
    }
    return {
      files: result,
      contextMappingOutput: context.getContextMap(),
    };
  } catch (e) {
    console.error(e);
    throw e;
  }
}
