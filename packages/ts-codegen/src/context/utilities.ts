import ts, { factory } from "typescript";
import path from "path";

export function getImportIdentifierForTypenames(
  importNames: string[],
  importPath: string,
  contextImportNames: Set<string>,
) {
  return factory.createImportDeclaration(
    undefined,
    factory.createImportClause(
      true,
      undefined,
      factory.createNamedImports(
        importNames
          .map((importName: string) => {
            if (contextImportNames.has(importName)) {
              return;
            }
            contextImportNames.add(importName);
            return factory.createImportSpecifier(
              false,
              undefined,
              factory.createIdentifier(importName),
            );
          })
          .filter(Boolean) as ts.ImportSpecifier[],
      ),
    ),
    factory.createStringLiteral(importPath),
  );
}

export function createImportDeclaration(
  importNames: string[],
  from: string,
  importAlias?: string,
) {
  return factory.createImportDeclaration(
    undefined,
    factory.createImportClause(
      true,
      undefined,
      factory.createNamedImports(
        importNames.map((importName) =>
          factory.createImportSpecifier(
            false,
            importAlias ? factory.createIdentifier(importAlias) : undefined,
            factory.createIdentifier(importName),
          ),
        ),
      ),
    ),
    factory.createStringLiteral(from),
  );
}

function cleanRelativePath(relativePath: string) {
  const cleanedRelativePath = relativePath.startsWith(".")
    ? relativePath
    : `./${relativePath}`;

  return cleanedRelativePath
    .replace(/\.(js|ts|tsx)$/, "")
    .split(path.sep)
    .join(path.posix.sep);
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

  return cleanRelativePath(path.relative(outputPath, modelFullPath));
}

export function isRootOperationType(typeName: string) {
  return ["Query", "Mutation", "Subscription"].includes(typeName);
}
