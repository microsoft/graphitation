import {
  FragmentDefinitionNode,
  buildASTSchema,
  visit,
  visitWithTypeInfo,
  TypeInfo,
  OperationDefinitionNode,
  FieldNode,
  DocumentNode,
} from "graphql";
import { Types } from "@graphql-codegen/plugin-helpers";
import { NearOperationFileConfig, SupportedResolvers } from ".";
import { ResolveDocumentImportResult } from "./resolve-document-imports";

export type ResolversPerOperation = {
  [key: string]: {
    [operation: string]: string[];
  };
};

type Field = {
  name: string;
  fieldParentType: string;
};

export type DefinitionsMetadata = {
  resolversPerOperation?: ResolversPerOperation;
  operationDefinitions?: DefinitionsMap;
  fragmentDefinitions?: DefinitionsMap;
  supportedOperations?: {
    [rootOperationType: string]: string[];
  };
};

type Definition = {
  type?: string;
  fields: Field[];
  fragmentSpreads: string[];
};

export type DefinitionsMap = {
  [parentType: string]: Definition;
};

export function getDefinitionsMetadata(
  sources: ResolveDocumentImportResult[],
  options: Types.PresetFnArgs<NearOperationFileConfig>,
) {
  const { supportedResolvers, usedResolversMetadataFilePath } =
    options.presetConfig;
  if (usedResolversMetadataFilePath) {
    const supportedOperations: {
      [rootOperationType: string]: string[];
    } = {};

    const typeInfo = new TypeInfo(
      options.schemaAst || buildASTSchema(options.schema),
    );

    if (supportedResolvers) {
      for (const source of sources) {
        for (const document of source.documents) {
          if (!document.document) {
            continue;
          }

          visit(document.document, {
            OperationDefinition: (node) => {
              node.selectionSet.selections.forEach((selection) => {
                if (
                  selection.kind === "Field" &&
                  existsInSupportedResolvers(
                    supportedResolvers,
                    selection.name.value,
                    node.operation,
                  )
                ) {
                  const operation =
                    node.operation.charAt(0).toUpperCase() +
                    node.operation.slice(1);
                  if (!supportedOperations[operation]) {
                    supportedOperations[operation] = [];
                  }

                  if (
                    node.name?.value &&
                    !supportedOperations[operation].includes(node.name.value)
                  ) {
                    supportedOperations[operation].push(node.name?.value);
                  }
                }
              });
            },
          });
        }
      }
    }

    const resolversPerOperation: ResolversPerOperation = {};

    const operationDefinitions: DefinitionsMap = {};
    const fragmentDefinitions: DefinitionsMap = {};

    for (const source of sources) {
      for (const document of source.documents) {
        if (!document.document) {
          continue;
        }

        visit(
          document.document,
          visitWithTypeInfo(typeInfo, {
            FragmentSpread: (node, _key, _parent, path, ancestors) => {
              const operationOrFragmentNode = getFragmentOrOperationDefinition(
                ancestors as any,
                path as any,
              );

              if (operationOrFragmentNode) {
                if (!operationOrFragmentNode.name) {
                  return;
                }
                const parentType = typeInfo.getParentType()?.name;

                if (!parentType) {
                  return;
                }

                if (isOperationDefinitionNode(operationOrFragmentNode)) {
                  const parentFieldDefinitionNode =
                    getParentFieldDefinitionNode(ancestors as any, path as any);

                  if (parentFieldDefinitionNode) {
                    const key = parentFieldDefinitionNode.name.value;

                    const definition = operationDefinitions[key];
                    operationDefinitions[key] = addFieldToDefinition(
                      parentType,
                      node.name.value,
                      "ADD_FRAGMENT_SPREAD",
                      definition,
                    );
                  }
                } else if (isFragmentDefinitionNode(operationOrFragmentNode)) {
                  const key = operationOrFragmentNode.name.value;

                  const definition = fragmentDefinitions[key];
                  fragmentDefinitions[key] = addFieldToDefinition(
                    parentType,
                    node.name.value,
                    "ADD_FRAGMENT_SPREAD",
                    definition,
                  );
                }
              }
            },
            Field: (node, _key, _parent, path, ancestors) => {
              const operationOrFragmentNode = getFragmentOrOperationDefinition(
                ancestors as any,
                path as any,
              );
              if (operationOrFragmentNode) {
                const parentType = typeInfo.getParentType()?.name;

                if (!parentType) {
                  return;
                }

                if (
                  ["Query", "Mutation", "Subscription"].includes(parentType) &&
                  operationOrFragmentNode.name?.value
                ) {
                  if (!resolversPerOperation[parentType]) {
                    resolversPerOperation[parentType] = {};
                  }

                  if (
                    !resolversPerOperation[parentType][
                      operationOrFragmentNode.name.value
                    ]
                  ) {
                    resolversPerOperation[parentType][
                      operationOrFragmentNode.name.value
                    ] = [];
                  }

                  const operationResolverList =
                    resolversPerOperation[parentType][
                      operationOrFragmentNode.name.value
                    ];

                  if (!operationResolverList.includes(node.name.value)) {
                    operationResolverList.push(node.name.value);
                    return;
                  }
                }

                if (node.name.value) {
                  if (isOperationDefinitionNode(operationOrFragmentNode)) {
                    const parentFieldDefinitionNode =
                      getParentFieldDefinitionNode(
                        ancestors as any,
                        path as any,
                      );

                    if (parentFieldDefinitionNode) {
                      const key = parentFieldDefinitionNode.name.value;

                      const definition = operationDefinitions[key];
                      operationDefinitions[key] = addFieldToDefinition(
                        parentType,
                        node.name.value,
                        "ADD_FIELD",
                        definition,
                      );
                    }
                  } else if (
                    isFragmentDefinitionNode(operationOrFragmentNode)
                  ) {
                    const key = operationOrFragmentNode.name.value;

                    const definition = fragmentDefinitions[key];
                    fragmentDefinitions[key] = addFieldToDefinition(
                      parentType,
                      node.name.value,
                      "ADD_FIELD",
                      definition,
                    );
                  }
                }
              }
            },
          }),
        );
      }
    }

    const output: DefinitionsMetadata = {};
    if (Object.keys(resolversPerOperation).length) {
      output.resolversPerOperation = resolversPerOperation;
    }

    if (Object.keys(operationDefinitions).length) {
      output.operationDefinitions = operationDefinitions;
    }

    if (Object.keys(fragmentDefinitions).length) {
      output.fragmentDefinitions = fragmentDefinitions;
    }

    if (Object.keys(supportedOperations).length) {
      output.supportedOperations = supportedOperations;
    }

    return output;
  }

  return null;
}
function getDefinition(definition?: Definition): Definition {
  if (!definition) {
    return {
      fields: [],
      fragmentSpreads: [],
    };
  }
  return definition;
}

function addFieldToDefinition(
  parentType: string,
  name: string,
  actionType: "ADD_FIELD" | "ADD_FRAGMENT_SPREAD",
  def?: Definition,
) {
  const definition = getDefinition(def);
  if (actionType === "ADD_FIELD") {
    if (
      !definition.fields.find((value) => {
        return value.name === name && value.fieldParentType === parentType;
      })
    ) {
      definition.fields.push({
        name: name,
        fieldParentType: parentType,
      });
    }
  } else if (actionType === "ADD_FRAGMENT_SPREAD") {
    if (!definition.fragmentSpreads.includes(name)) {
      definition.fragmentSpreads.push(name);
    }
  }
  return definition;
}

function getFragmentOrOperationDefinition(
  ancestors: unknown[],
  path: (string | number)[],
) {
  // It's one of the document's definitions
  if (path[0] !== "definitions" || typeof path[1] !== "number") {
    return null;
  }
  const documentDefinition: unknown = ancestors[0];

  if (!isDocument(documentDefinition)) {
    return null;
  }

  const definitionNode = documentDefinition.definitions[path[1]];

  if (
    isOperationDefinitionNode(definitionNode) ||
    isFragmentDefinitionNode(definitionNode)
  ) {
    return definitionNode;
  }

  return null;
}

function getParentFieldDefinitionNode(
  ancestors: unknown[],
  path: (string | number)[],
): FieldNode | null {
  if (
    typeof path[path.length - 1] !== "number" ||
    path[path.length - 2] !== "selections" ||
    path[path.length - 3] !== "selectionSet"
  ) {
    return null;
  }

  const parentAncestor = ancestors[ancestors.length - 2] as any;

  if (!parentAncestor || parentAncestor?.kind !== "Field") {
    return null;
  }

  return parentAncestor;
}

function isDocument(node: unknown): node is DocumentNode {
  return (
    typeof node === "object" &&
    node !== null &&
    "kind" in node &&
    node.kind === "Document"
  );
}

function isFragmentDefinitionNode(
  definitionNode: unknown,
): definitionNode is FragmentDefinitionNode {
  return (
    typeof definitionNode === "object" &&
    definitionNode !== null &&
    "kind" in definitionNode &&
    definitionNode.kind === "FragmentDefinition"
  );
}

function isOperationDefinitionNode(
  definitionNode: unknown,
): definitionNode is OperationDefinitionNode {
  return (
    typeof definitionNode === "object" &&
    definitionNode !== null &&
    "kind" in definitionNode &&
    definitionNode.kind === "OperationDefinition"
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
