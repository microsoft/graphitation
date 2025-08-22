import { factory } from "typescript";
import path from "path";
import { ContextMap } from ".";
import { ArgumentNode, DirectiveNode } from "graphql";
import { ContextTypeExtension } from "../types";

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

export type OutputMetadata = RootResolersMetadata | TypeMetadata;

export function buildContextMetadataOutput(
  contextMap: ContextMap,
  resolverTypeMap: Record<string, string[] | null>,
) {
  const metadata: OutputMetadata = {};

  for (const [key, values] of Object.entries(resolverTypeMap)) {
    if (!contextMap[key]) {
      continue;
    }

    if (values === null) {
      if (contextMap[key]?.__context) {
        for (const contextValue of contextMap[key].__context.values) {
          const [namespace, subTypeName] = contextValue.id.split(":");

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
        for (const typeValue of contextMap[key][value].values) {
          buildContextMetadataOutputItem(metadata, typeValue.id, key, value);
        }
        continue;
      } else if (contextMap[key].__context) {
        for (const contextValue of contextMap[key].__context.values) {
          buildContextMetadataOutputItem(metadata, contextValue.id, key, value);
        }
        continue;
      }
    }
  }

  return metadata;
}

export function getRequiredAndOptionalContextArguments(
  node: DirectiveNode,
  contextTypeExtensions: ContextTypeExtension,
) {
  if (!node.arguments?.length) {
    throw new Error(
      "Invalid context use: No arguments provided. Provide either required or optional arguments",
    );
  }

  let requiredKeys: Set<string> | undefined;
  let optionalKeys: Set<string> | undefined;

  const required = node.arguments.find(
    (value) => value.name.value === "required",
  );
  const optional = node.arguments.find(
    (value) => value.name.value === "optional",
  );

  if (!required && !optional) {
    throw new Error(
      "Invalid context use: Required and optional arguments must be provided",
    );
  }

  if (required && required?.value.kind !== "ObjectValue") {
    throw new Error(
      `Invalid context use: "required" argument must be an object`,
    );
  }

  if (optional && optional?.value.kind !== "ObjectValue") {
    throw new Error(
      `Invalid context use: "optional" argument must be an object`,
    );
  }

  if (required) {
    requiredKeys = new Set(
      new Set(getContextKeysFromArgumentNode(required, contextTypeExtensions)),
    );
  }

  if (optional) {
    optionalKeys = new Set(
      new Set(getContextKeysFromArgumentNode(optional, contextTypeExtensions)),
    );
  }

  return { requiredKeys, optionalKeys };
}

function getContextKeysFromArgumentNode(
  argumentNode: ArgumentNode,
  contextTypeExtensions: ContextTypeExtension,
) {
  if (argumentNode?.value.kind !== "ObjectValue") {
    throw new Error(`Invalid context use: arguments must be an object`);
  }

  const output: string[] = [];
  argumentNode?.value.fields.forEach(({ name, value, kind }) => {
    if (kind !== "ObjectField") {
      throw new Error("Invalid context use");
    }
    const namespace = name.value;
    if (value.kind !== "ListValue") {
      throw new Error(`Namespace "${namespace}" must be list of strings`);
    }

    let usedValueKind: "StringValue" | "EnumValue" | undefined;
    const namespaceValues: string[] = value.values.map((v) => {
      if (v.kind !== "StringValue" && v.kind !== "EnumValue") {
        throw new Error(
          `Namespace "${namespace}" must be list of strings or enum values`,
        );
      }

      if (usedValueKind && usedValueKind !== v.kind) {
        throw new Error(
          `Namespace "${namespace}" must be list of same kind values`,
        );
      }

      if (!usedValueKind) {
        usedValueKind = v.kind;
      }

      return v.value;
    });

    if (!contextTypeExtensions?.contextTypes?.[namespace]) {
      throw new Error(`Namespace "${namespace}" is not supported`);
    }

    namespaceValues.forEach((namespaceValue) => {
      if (!contextTypeExtensions?.contextTypes?.[namespace]?.[namespaceValue]) {
        throw new Error(
          `Value "${namespaceValue}" in namespace "${namespace}" is not supported`,
        );
      }

      output.push(`${namespace}:${namespaceValue}`);
    });
  });
  return output;
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

export function isRootOperationType(typeName: string) {
  return ["Query", "Mutation", "Subscription"].includes(typeName);
}
