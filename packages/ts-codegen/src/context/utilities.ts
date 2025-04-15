import { factory } from "typescript";
import path from "path";

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

type MetadataItem = { [namespace: string]: string[] };

type RootResolersMetadata = {
  [resolver: string]: MetadataItem;
};

type TypeMetadata = {
  [typeName: string]: { [field: string]: MetadataItem };
};

type OutputMetadata = RootResolersMetadata | TypeMetadata;

export function buildContextMetadataOutput(
  contextMap: any,
  resolverTypeMap: any,
) {
  const metadata: OutputMetadata = {};

  for (const [key, values] of Object.entries(
    resolverTypeMap as Record<string, string>,
  )) {
    if (!contextMap[key]) {
      continue;
    }

    if (values === null) {
      if (contextMap[key]?.__context) {
        for (const contextValue of contextMap[key].__context) {
          const [namespace, subTypeName] = contextValue.split(":");

          if (!metadata[key]) {
            metadata[key] = {};
          }

          if (!metadata[key][namespace]) {
            metadata[key][namespace] = [];
          }

          if (!Array.isArray(metadata[key][namespace])) {
            throw Error("Invalid context metadata");
          }

          if (!metadata[key][namespace].includes(subTypeName)) {
            metadata[key][namespace].push(subTypeName);
          }
        }
        continue;
      }
      continue;
    }

    for (const value of values) {
      if (contextMap[key][value]) {
        for (const typeValue of contextMap[key][value]) {
          buildContextMetadataOutputItem(metadata, typeValue, key, value);
        }
        continue;
      } else if (contextMap[key].__context) {
        for (const contextValue of contextMap[key].__context) {
          buildContextMetadataOutputItem(metadata, contextValue, key, value);
        }
        continue;
      }
    }
  }

  return metadata;
}

function buildContextMetadataOutputItem(
  metadata: OutputMetadata,
  contextKey: string,
  key: string,
  value: string,
) {
  const [namespace, subTypeName] = contextKey.split(":");

  if (!metadata[key]) {
    metadata[key] = {};
  }

  if (!metadata[key][value]) {
    metadata[key][value] = {};
  }

  if (Array.isArray(metadata[key][value])) {
    throw Error("Invalid context metadata");
  }

  if (!metadata[key][value][namespace]) {
    metadata[key][value][namespace] = [];
  }

  if (!metadata[key][value][namespace].includes(subTypeName)) {
    metadata[key][value][namespace].push(subTypeName);
  }
}
