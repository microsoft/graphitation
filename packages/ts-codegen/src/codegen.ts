import ts from "typescript";
import { DocumentNode } from "graphql";
import { ContextMap, extractContext } from "./context/index";
import { generateResolvers } from "./resolvers";
import { generateModels } from "./models";
import { generateLegacyTypes } from "./legacyTypes";
import { generateLegacyResolvers } from "./legacyResolvers";
import { generateEnums } from "./enums";
import { generateInputs } from "./inputs";

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
  }: {
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
  },
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
      result.push(generateResolvers(context));
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
