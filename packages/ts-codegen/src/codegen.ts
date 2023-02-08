import ts from "typescript";
import { DocumentNode } from "graphql";
import { extractContext } from "./context/index";
import { generateResolvers } from "./resolvers";
import { generateModels } from "./models";
import { generateLegacyTypes } from "./legacyTypes";
import { generateLegacyResolvers } from "./legacyResolvers";
import { generateEnums } from "./enums";

export function generateTS(
  document: DocumentNode,
  {
    outputPath,
    documentPath,
    contextImport,
    contextName,
    legacyCompat,
  }: {
    outputPath: string;
    documentPath: string;
    contextImport?: string | null;
    contextName?: string;
    legacyCompat?: boolean;
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
      },
      document,
      outputPath,
      documentPath,
    );
    const result: ts.SourceFile[] = [];
    result.push(generateModels(context, document));
    result.push(generateResolvers(context, document));
    result.push(generateEnums(context, document));
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
