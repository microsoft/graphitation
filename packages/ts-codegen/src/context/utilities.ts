import { factory } from "typescript";
import path from "path";

export function createImportDeclaration(
  importNames: string[],
  from: string,
  importAlias?: string,
) {
  return factory.createImportDeclaration(
    undefined,
    undefined,
    factory.createImportClause(
      true,
      undefined,
      factory.createNamedImports(
        importNames.map((importName) =>
          factory.createImportSpecifier(
            importAlias ? factory.createIdentifier(importAlias) : undefined,
            factory.createIdentifier(importName),
          ),
        ),
      ),
    ),
    factory.createStringLiteral(from),
  );
}

function sliceJSExtensions(filePath: string) {
  return filePath.replace(/\.(js|ts|tsx)$/, "");
}

export function getRelativePath(
  from: string | undefined,
  outputPath: string,
  documentPath: string,
) {
  if (!from) {
    return null;
  }

  if (!from.startsWith(".")) {
    return from;
  }

  const modelFullPath = path.resolve(path.dirname(documentPath), from);
  return sliceJSExtensions(
    path
      .relative(outputPath, modelFullPath)
      .split(path.sep)
      .join(path.posix.sep),
  );
}
