import ts from "typescript";
import { DocumentNode } from "graphql";
import { extractContext } from "./context";
import { generateResolvers } from "./resolvers";
import { generateModels } from "./models";

export function generateTS(
  document: DocumentNode,
): { models: ts.SourceFile; resolvers: ts.SourceFile } {
  try {
    let context = extractContext({}, document);
    let models = generateModels(context, document);
    let resolvers = generateResolvers(context, document);
    return { models, resolvers };
  } catch (e) {
    console.error(e);
    throw e;
  }
}
