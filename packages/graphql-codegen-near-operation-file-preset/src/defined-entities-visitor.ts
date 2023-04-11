import { visit, DocumentNode } from "graphql";

export function getDefinedEntities(document: DocumentNode) {
  const definedEntities: Set<string> = new Set();

  visit(document, {
    ObjectTypeDefinition: {
      leave(node) {
        definedEntities.add(node.name.value);
      },
    },
    InputObjectTypeDefinition: {
      leave(node) {
        definedEntities.add(node.name.value);
      },
    },
    EnumTypeDefinition: {
      leave(node) {
        definedEntities.add(node.name.value);
      },
    },
  });

  return definedEntities;
}
