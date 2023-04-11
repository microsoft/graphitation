import {
  visit,
  DocumentNode,
  ObjectTypeDefinitionNode,
  InputObjectTypeDefinitionNode,
  TypeNode,
  ListTypeNode,
  NonNullTypeNode,
} from "graphql";

export function getTypesRelations(
  document: DocumentNode,
  definedEntities: Set<string>,
) {
  const typeFieldsEntities = new Map();
  visit(document, {
    ObjectTypeDefinition: {
      leave(node) {
        typeFieldsEntities.set(
          node.name.value,
          getTypeNames(node, definedEntities),
        );
      },
    },
    InputObjectTypeDefinition: {
      leave(node) {
        typeFieldsEntities.set(
          node.name.value,
          getTypeNames(node, definedEntities),
        );
      },
    },
  });

  return typeFieldsEntities;
}

function getTypeNames(
  node: ObjectTypeDefinitionNode | InputObjectTypeDefinitionNode,
  definedEntities: Set<string>,
) {
  return Array.from(
    new Set(
      node.fields
        ?.map((field) => {
          const fieldTypeName = getFieldTypeName(field.type);
          if (definedEntities.has(fieldTypeName)) return fieldTypeName;
        })
        .filter(Boolean) as string[],
    ) || [],
  );
}

function isListTypeNode(typeNode: TypeNode): typeNode is ListTypeNode {
  return typeNode.kind === "ListType";
}

function isNonNullType(typeNode: TypeNode): typeNode is NonNullTypeNode {
  return typeNode.kind === "NonNullType";
}

function getFieldTypeName(typeNode: TypeNode): string {
  if (isListTypeNode(typeNode) || isNonNullType(typeNode)) {
    return getFieldTypeName(typeNode.type);
  }
  return typeNode.name.value;
}
