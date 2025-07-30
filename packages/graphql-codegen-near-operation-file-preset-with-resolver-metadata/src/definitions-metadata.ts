import { buildASTSchema, DocumentNode } from "graphql";
import { Types } from "@graphql-codegen/plugin-helpers";
import {
  extractMinimalViableSchemaForRequestDocument,
  mergeSchemaDefinitions,
  SchemaDefinitions,
  type ExtractMinimalViableSchemaResult,
} from "@graphitation/supermassive";
import { NearOperationFileConfig, SupportedResolvers } from ".";

export type ResolversPerOperation = {
  [key: string]: {
    [operation: string]: string[];
  };
};

export type SupportedOperations = { [rootOperationType: string]: string[] };
export type DefinitionsMetadata = {
  resolverMetadata?: Record<string, string[]>;
  supportedOperations?: SupportedOperations;
  schemaMetadata?: SchemaDefinitions;
};

export function getDefinitionsMetadata(
  documents: DocumentNode[],
  options: Types.PresetFnArgs<NearOperationFileConfig>,
) {
  const {
    supportedResolvers,
    supportedOperations: configSupportedOperations,
    usedResolversMetadataDirectoryPath,
  } = options.presetConfig;
  const schema = options.schemaAst || buildASTSchema(options.schema);
  if (usedResolversMetadataDirectoryPath) {
    const supportedOperations: SupportedOperations =
      configSupportedOperations || {};

    if (!Object.keys(supportedOperations).length && supportedResolvers) {
      for (const document of documents) {
        if (!document) {
          continue;
        }

        for (const definition of document.definitions) {
          if (definition.kind === "OperationDefinition") {
            definition.selectionSet.selections.forEach((selection) => {
              if (
                selection.kind === "Field" &&
                existsInSupportedResolvers(
                  supportedResolvers,
                  selection.name.value,
                  definition.operation,
                )
              ) {
                const { operation } = definition;
                if (!supportedOperations[operation]) {
                  supportedOperations[operation] = [];
                }

                if (
                  definition.name?.value &&
                  !supportedOperations[operation].includes(
                    definition.name.value,
                  )
                ) {
                  supportedOperations[operation].push(definition.name?.value);
                }
              }
            });
          }
        }
      }
    }

    const operationDefinitions: Record<
      string,
      ExtractMinimalViableSchemaResult
    > = {};
    const fragmentDefinitions: Record<
      string,
      ExtractMinimalViableSchemaResult
    > = {};

    for (const document of documents) {
      if (!document) {
        continue;
      }

      for (const definition of document.definitions) {
        switch (definition.kind) {
          case "OperationDefinition": {
            if (!definition.name) {
              throw Error("Operation should have a name");
            }

            if (
              !supportedOperations[definition.operation]?.includes(
                definition.name.value,
              )
            ) {
              break;
            }

            operationDefinitions[definition.name.value] =
              extractMinimalViableSchemaForRequestDocument(schema, {
                kind: "Document",
                definitions: [definition],
              });
            break;
          }
          case "FragmentDefinition": {
            fragmentDefinitions[definition.name.value] =
              extractMinimalViableSchemaForRequestDocument(schema, {
                kind: "Document",
                definitions: [definition],
              });

            break;
          }
          default: {
            break;
          }
        }
      }
    }

    const { fragmentSpreadMap } = getTraverseMetadata(
      operationDefinitions,
      fragmentDefinitions,
    );

    const usedFragmentDefinitions: Record<
      string,
      ExtractMinimalViableSchemaResult
    > = {};

    for (const [key, value] of Object.entries(fragmentDefinitions)) {
      for (const fragmentSpreadValues of Object.values(fragmentSpreadMap)) {
        if (fragmentSpreadValues.includes(key)) {
          usedFragmentDefinitions[key] = value;
        }
      }
    }

    const mergedDefinitions = mergeSchemaDefinitions({ types: {} }, [
      ...Object.values(operationDefinitions).map((item) => item.definitions),
      ...Object.values(usedFragmentDefinitions).map((item) => item.definitions),
    ]);

    const resolverMetadata = getResolverMetadata(mergedDefinitions);
    const output: DefinitionsMetadata = {};

    if (Object.keys(supportedOperations).length) {
      output.supportedOperations = supportedOperations;
    }

    if (Object.keys(resolverMetadata).length) {
      output.resolverMetadata = resolverMetadata;
    }

    output.schemaMetadata = mergedDefinitions;

    return output;
  }

  return null;
}

const TypeKind = {
  SCALAR: 1,
  OBJECT: 2,
  INTERFACE: 3,
  UNION: 4,
  ENUM: 5,
  INPUT: 6,
} as const;

function getResolverMetadata(mergedDefinitions: SchemaDefinitions) {
  const resolverMetadata: Record<string, string[]> = {};

  const interfaceFields: Record<string, string[]> = {};
  for (const [type, [typeKind, fields]] of Object.entries(
    mergedDefinitions.types,
  )) {
    if (typeKind === TypeKind.INTERFACE) {
      for (const field of Object.keys(fields ?? {})) {
        interfaceFields[type] ??= [];
        if (!interfaceFields[type].includes(field)) {
          interfaceFields[type].push(field);
        }
      }
    }
  }

  for (const [type, [typeKind, fields, interfaces]] of Object.entries(
    mergedDefinitions.types,
  )) {
    if (typeKind === TypeKind.ENUM) {
      continue;
    }
    if (typeKind === TypeKind.UNION) {
      resolverMetadata[type] ??= [];
      if (!resolverMetadata[type].includes("__resolveType")) {
        resolverMetadata[type].push("__resolveType");
      }
      continue;
    }

    if (typeKind === TypeKind.INTERFACE) {
      resolverMetadata[type] ??= [];
      if (!resolverMetadata[type].includes("__resolveType")) {
        resolverMetadata[type].push("__resolveType");
      }
      continue;
    }

    for (const field of Object.keys(fields ?? {})) {
      resolverMetadata[type] ??= [];
      if (!resolverMetadata[type].includes(field)) {
        resolverMetadata[type].push(field);
      }
    }

    if (interfaces?.length) {
      for (const interfaceName of interfaces) {
        const fields = interfaceFields[interfaceName];
        if (!fields) {
          continue;
        }
        for (const field of fields) {
          resolverMetadata[type] ??= [];
          if (!resolverMetadata[type].includes(field)) {
            resolverMetadata[type].push(field);
          }
        }
      }
    }
  }

  return resolverMetadata;
}

function getTraverseMetadata(
  operationDefinitions: Record<string, ExtractMinimalViableSchemaResult>,
  fragmentDefinitions: Record<string, ExtractMinimalViableSchemaResult>,
) {
  const fragmentSpreadMap: Record<string, string[]> = {};
  const fragmentSpreadsUsed: Record<string, boolean> = {};
  for (const [definitionName, { fragmentSpreads }] of Object.entries(
    operationDefinitions,
  )) {
    fragmentSpreads.map((value) => {
      fragmentSpreadMap[definitionName] ??= [];

      fragmentSpreadMap[definitionName].push(value);
      if (fragmentSpreadsUsed[value] === undefined) {
        fragmentSpreadsUsed[value] = false;
      }
    });
  }

  collectFragmentSpreads(
    fragmentDefinitions,
    fragmentSpreadMap,
    fragmentSpreadsUsed,
  );

  // Validation that everyFragment in spread visited its implementation
  for (const [key, value] of Object.entries(fragmentSpreadsUsed)) {
    if (!value) {
      throw new Error(`Fragment "${key}" was not visited`);
    }

    if (!fragmentSpreadMap[key]) {
      console.log(fragmentSpreadMap, fragmentSpreadsUsed);
      throw new Error(`Something wrong during visit of fragment ${key}`);
    }
  }

  return {
    fragmentSpreadMap,
  };
}

function collectFragmentSpreads(
  fragmentDefinitions: Record<string, ExtractMinimalViableSchemaResult>,
  fragmentSpreadMap: Record<string, string[]>,
  fragmentSpreadsUsed: Record<string, boolean>,
) {
  if (Object.values(fragmentSpreadsUsed).every(Boolean)) {
    return;
  }

  const localFragmentSpreads = new Set<string>();
  for (const [key, value] of Object.entries(fragmentSpreadsUsed)) {
    if (value) {
      continue;
    }

    const definition = fragmentDefinitions[key];
    fragmentSpreadsUsed[key] = true;
    if (!definition.fragmentSpreads.length) {
      fragmentSpreadMap[key] ??= [];
    }

    for (const fragmentSpread of definition.fragmentSpreads) {
      localFragmentSpreads.add(fragmentSpread);

      fragmentSpreadMap[key] ??= [];

      fragmentSpreadMap[key].push(fragmentSpread);
    }
  }

  if (!localFragmentSpreads.size) {
    return;
  }

  for (const localFragmentSpread of localFragmentSpreads) {
    if (typeof fragmentSpreadsUsed[localFragmentSpread] === "boolean") {
      continue;
    }

    fragmentSpreadsUsed[localFragmentSpread] = false;
  }

  return collectFragmentSpreads(
    fragmentDefinitions,
    fragmentSpreadMap,
    fragmentSpreadsUsed,
  );
}

function existsInSupportedResolvers(
  { supportedResolvers }: SupportedResolvers,
  resolverName: string,
  operationName: string,
): boolean {
  if (!supportedResolvers || !supportedResolvers.configs) {
    return false;
  }

  return supportedResolvers.configs.some((config) => {
    if (config.value && config.value[operationName]) {
      const resolvers = config.value[operationName];
      if (resolvers.includes(resolverName)) {
        return true;
      }
    }
  });
}
