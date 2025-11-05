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
        metadata[key] ??= {};
        metadata[key][value] ??= {};

        for (const typeValue of contextMap[key][value].values) {
          buildContextMetadataOutputItem(metadata, typeValue.id, key, value);
        }
        continue;
      } else if (contextMap[key].__context) {
        metadata[key] ??= {};
        metadata[key][value] ??= {};

        for (const contextValue of contextMap[key].__context.values) {
          buildContextMetadataOutputItem(metadata, contextValue.id, key, value);
        }
        continue;
      }
    }
  }

  return metadata;
}

export function getExtendsGroupContextArguments(
  node: DirectiveNode,
  contextTypeExtensions: ContextTypeExtension,
) {
  if (!node.arguments?.length) {
    throw new Error(
      "Invalid context use: No arguments provided. Provide either required, optional or extends arguments",
    );
  }

  const extendsGroup = node.arguments.find(
    (value) => value.name.value === "extends",
  );

  const extendGroupValue = extendsGroup?.value;
  if (extendsGroup) {
    if (extendGroupValue?.kind !== "StringValue") {
      throw new Error(
        `Invalid context use: "extends" argument must be an object`,
      );
    }

    const group = contextTypeExtensions?.groups?.[extendGroupValue?.value];
    if (!group) {
      throw new Error(`Invalid context use: "extends" group doesn't exist`);
    }

    const subTypeKeys: Set<string> = new Set();
    const { required: groupItems, useLegacy: useLegacyContext } = group;

    if (!groupItems || Object.keys(groupItems).length === 0) {
      return {
        required: [],
        useLegacyContext,
      };
    } else {
      for (const [namespace, namespaceValues] of Object.entries(groupItems)) {
        namespaceValues.forEach((namespaceValue) => {
          if (
            !contextTypeExtensions?.contextTypes?.[namespace]?.[namespaceValue]
          ) {
            throw new Error(
              `Value "${namespaceValue}" in namespace "${namespace}" is not supported`,
            );
          }

          subTypeKeys.add(getNamespaceValueKey(namespace, namespaceValue));
        });
      }

      return {
        required: Array.from(subTypeKeys),
        useLegacyContext,
      };
    }
  }
}

function getNamespaceValueKey(namespace: string, namespaceValue: string) {
  return `${namespace}:${namespaceValue}`;
}
export function getRequiredAndOptionalContextArguments(
  node: DirectiveNode,
  contextTypeExtensions: ContextTypeExtension,
  contextGroupRequiredArgument?: string[],
) {
  if (!node.arguments?.length) {
    throw new Error(
      "Invalid context use: No arguments provided. Provide either required, optional or extends arguments",
    );
  }

  let requiredKeys: Set<string> | undefined;
  let optionalKeys: Set<string> | undefined;

  const extendsGroup = node.arguments.find(
    (value) => value.name.value === "extends",
  );

  const required = node.arguments.find(
    (value) => value.name.value === "required",
  );
  const optional = node.arguments.find(
    (value) => value.name.value === "optional",
  );

  if (!required && !optional && !extendsGroup) {
    throw new Error(
      "Invalid context use: required, optional or extends arguments must be provided",
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

  if (contextGroupRequiredArgument) {
    if (!requiredKeys) {
      requiredKeys = new Set();
    }

    contextGroupRequiredArgument.forEach((value) => {
      requiredKeys?.add(value);
    });
  }

  if (optional) {
    optionalKeys = new Set(
      new Set(getContextKeysFromArgumentNode(optional, contextTypeExtensions)),
    );
  }

  return { requiredKeys, optionalKeys };
}

export function getUseLegacyContextValue(
  rootUseLegacyContext?: boolean,
  groupUseLegacyContext?: boolean,
) {
  if (
    typeof rootUseLegacyContext === "boolean" &&
    typeof groupUseLegacyContext === "boolean" &&
    rootUseLegacyContext !== groupUseLegacyContext
  ) {
    throw new Error(
      "useLegacy argument must has the same value as it is in the group in 'extends'",
    );
  }

  return Boolean(rootUseLegacyContext || groupUseLegacyContext);
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

      output.push(getNamespaceValueKey(namespace, namespaceValue));
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
  if (Array.isArray(metadata[key][value])) {
    throw Error("Invalid context metadata");
  }

  const [namespace, subTypeName] = contextKey.split(":");

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
