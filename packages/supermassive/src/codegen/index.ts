import ts, { factory } from "typescript";
import { DocumentNode } from "graphql";
import { collectModelImports } from "./directives/model";
import { collectImports } from "./directives/import";
// import { validateExpectDirective } from "./directives/expect";
import { generateResolvers } from "./resolvers";
import { TypeNameToTypeReference } from "./types";
import { createTypeNameToTypeReferenceMap } from "./utilities";

export function genResolvers(document: DocumentNode): ts.SourceFile {
  try {
    const imports = collectImports(document);
    const models = collectModelImports(document);
    // validateExpectDirective(doc);
    const typeNameToTypeReference = createTypeNameToTypeReferenceMap(imports);
    let resolvers = generateResolvers(
      document,
      imports,
      typeNameToTypeReference,
    );
    return resolvers;
  } catch (e) {
    console.error(e);
    throw e;
  }
}
