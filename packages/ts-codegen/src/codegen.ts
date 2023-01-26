import ts from "typescript";
import { DocumentNode } from "graphql";
import { extractContext } from "./context/index";
import { generateResolvers } from "./resolvers";
import { generateModels } from "./models";

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
): { models: ts.SourceFile; resolvers: ts.SourceFile } {
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
    let models = generateModels(context, document);
    let resolvers = generateResolvers(context, document);
    return { models, resolvers };
  } catch (e) {
    console.error(e);
    throw e;
  }
}
