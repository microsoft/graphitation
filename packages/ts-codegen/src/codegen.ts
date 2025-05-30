import ts from "typescript";
import { DocumentNode } from "graphql";
import { extractContext } from "./context/index";
import { generateResolvers } from "./resolvers";
import { generateModels } from "./models";
import { generateLegacyTypes } from "./legacyTypes";
import { generateLegacyResolvers } from "./legacyResolvers";
import { generateEnums } from "./enums";
import { OutputMetadata } from "./context/utilities";
import { getContextPath } from "./utilities";

export type SubTypeItem = {
  [subType: string]: {
    importNamespaceName?: string;
    importPath: string;
  };
};

export type SubTypeNamespace = {
  baseContextSubTypeName?: string;
  baseContextSubTypePath?: string;
  contextSubTypes: { [namespace: string]: SubTypeItem };
};

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
  contextTypeExtensions?: SubTypeNamespace;
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
    contextTypeExtensions,
    generateResolverMap = false,
    mandatoryResolverTypes = false,
  }: GenerateTSOptions,
): {
  files: ts.SourceFile[];
  contextMappingOutput: OutputMetadata | null;
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
        contextTypeExtensions,
        baseContextSubTypePath: getContextPath(
          outputPath,
          contextTypeExtensions?.baseContextSubTypePath,
        ),
        baseContextSubTypeName: contextTypeExtensions?.baseContextSubTypeName,
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
      if (context.hasModels) {
        result.push(generateModels(context));
      }
      if (context.hasResolvers) {
        result.push(
          generateResolvers(context, {
            generateResolverMap,
            mandatoryResolverTypes,
          }),
        );
      }

      if (legacyCompat) {
        result.push(generateLegacyTypes(context));
        result.push(generateLegacyResolvers(context));
      }
    }
    return {
      files: result,
      contextMappingOutput: context.getMetadataObject(),
    };
  } catch (e) {
    console.error(e);
    throw e;
  }
}
