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
    legacyNoModelsForObjects,
    modelScope,
  }: {
    outputPath: string;
    documentPath: string;
    contextImport?: string | null;
    contextName?: string;
    enumsImport?: string | null;
    legacyCompat?: boolean;
    legacyNoModelsForObjects?: boolean;
    modelScope?: string | null;
  },
): {
  files: ts.SourceFile[];
} {
  try {
    let context = extractContext(
      {
        context: {
          name: contextName,
          from: contextImport || null,
        },
        legacyCompat,
        enumsImport,
        legacyNoModelsForObjects,
        modelScope,
      },
      document,
      outputPath,
      documentPath,
    );
    const result: ts.SourceFile[] = [];
    result.push(generateModels(context, document));
    result.push(generateResolvers(context, document));
    result.push(generateEnums(context, document));
    result.push(generateInputs(context, document));
    if (legacyCompat) {
      result.push(generateLegacyTypes(context, document));
      result.push(generateLegacyResolvers(context, document));
    }
    return { files: result };
  } catch (e) {
    console.error(e);
    throw e;
  }
}
