import ts from "typescript";
import { DocumentNode } from "graphql";
import { extractContext } from "./context/index";
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
    contextImport,
    contextName,
    enumsImport,
    legacyCompat,
    useStringUnionsInsteadOfEnums,
    legacyNoModelsForObjects,
    modelScope,
    generateOnlyEnums,
    enumNamesToMigrate,
  }: {
    outputPath: string;
    documentPath: string;
    contextImport?: string | null;
    contextName?: string;
    enumsImport?: string | null;
    legacyCompat?: boolean;
    useStringUnionsInsteadOfEnums?: boolean;
    legacyNoModelsForObjects?: boolean;
    modelScope?: string | null;
    generateOnlyEnums?: boolean;
    enumNamesToMigrate?: string[];
  },
): {
  files: ts.SourceFile[];
} {
  try {
    const context = extractContext(
      {
        context: {
          name: contextName,
          from: contextImport || null,
        },
        legacyCompat,
        useStringUnionsInsteadOfEnums,
        enumsImport,
        legacyNoModelsForObjects,
        modelScope,
        enumNamesToMigrate,
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
    return { files: result };
  } catch (e) {
    console.error(e);
    throw e;
  }
}
