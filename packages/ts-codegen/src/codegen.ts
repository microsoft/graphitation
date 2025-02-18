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
   * Makes resolver types for type extensions mandatory to ensure that new resolvers are provided if module extends a type.
   *
   * @example
   * // module.graphql
   * extend type User {
   *    isAdmin: Boolean
   * }
   *
   * // generated resolver types (mandatoryResolverTypes: false)
   * export declare namespace User {
   *    export interface Resolvers {
   *       readonly isAdmin?: isAdmin;
   *    }
   * }
   *
   * // generated resolver types (mandatoryResolverTypes: true)
   * export declare namespace User {
   *    export interface Resolvers {
   *       readonly isAdmin: isAdmin;
   *    }
   * }
   */
  mandatoryResolverTypes?: boolean;
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
    generateResolverMap = false,
    mandatoryResolverTypes = false,
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
      if (context.hasResolvers) {
        result.push(
          generateResolvers(context, {
            generateResolverMap,
            mandatoryResolverTypes,
          }),
        );
      }
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
