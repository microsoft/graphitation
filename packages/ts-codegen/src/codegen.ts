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
    legacyEnumsCompatibility,
    legacyNoModelsForObjects,
    modelScope,
  }: {
    outputPath: string;
    documentPath: string;
    contextImport?: string | null;
    contextName?: string;
    enumsImport?: string | null;
    legacyCompat?: boolean;
    legacyEnumsCompatibility?: boolean;
    legacyNoModelsForObjects?: boolean;
    modelScope?: string | null;
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
        legacyEnumsCompatibility,
        enumsImport,
        legacyNoModelsForObjects,
        modelScope,
      },
      document,
      outputPath,
      documentPath,
    );
    const result: ts.SourceFile[] = [];
    result.push(generateModels(context));
    result.push(generateResolvers(context));
    if (context.hasEnums) {
      result.push(generateEnums(context));
    }
    if (context.hasInputs) {
      result.push(generateInputs(context));
    }
    if (legacyCompat) {
      result.push(generateLegacyTypes(context));
      result.push(generateLegacyResolvers(context));
    }
    return { files: result };
  } catch (e) {
    console.error(e);
    throw e;
  }
}
