import {
  DocumentNode,
  GraphQLSchema,
  visit,
  visitWithTypeInfo,
  TypeInfo,
  isObjectType,
  isInterfaceType,
  getNamedType,
  FragmentSpreadNode,
} from "graphql";
import invariant from "invariant";

const ALLOWED_REFETCH_QUERY_FIELD_SELECTIONS = ["__typename", "id"];

export function reduceNodeWatchQueryTransform(
  schema: GraphQLSchema,
  document: DocumentNode
): DocumentNode {
  const nodeType = schema.getType("Node");
  invariant(
    nodeType && isInterfaceType(nodeType),
    "Expected schema to define a Node interface"
  );

  const typeInfo = new TypeInfo(schema);

  const removeNodeType = () => {
    const unnamedTypeConstraint = typeInfo.getType();
    invariant(unnamedTypeConstraint, "Expected a type constraint");
    const typeConstraint = getNamedType(unnamedTypeConstraint);
    if (
      isObjectType(typeConstraint) &&
      typeConstraint.getInterfaces().includes(nodeType)
    ) {
      return null;
      // TODO: Handle fragment on Node ?
      // } else if (isInterfaceType(typeConstraint)) {
    }
    return undefined;
  };

  let retainFragment: string;
  let currentlyInNodeRootField = false;

  return visit(
    document,
    visitWithTypeInfo(typeInfo, {
      Field(fieldNode) {
        const parentType = typeInfo.getParentType();
        if (
          fieldNode.name.value === "node" &&
          parentType &&
          parentType.name === "Query"
        ) {
          const selections = fieldNode.selectionSet!.selections;
          const fragmentSpreadSelections = selections.filter(
            (sel) => sel.kind === "FragmentSpread"
          ) as FragmentSpreadNode[];
          // This is a refetch query only if...
          if (
            // ...there's one fragment spread...
            fragmentSpreadSelections.length === 1 ||
            // ...and no fields but id and __typename...
            selections.filter(
              (sel) =>
                sel.kind === "Field" &&
                !ALLOWED_REFETCH_QUERY_FIELD_SELECTIONS.includes(sel.name.value)
            ).length === 0 ||
            // ...and no inline fragment.
            selections.filter((sel) => sel.kind === "InlineFragment").length ===
              0
          ) {
            const fragmentSpreadNode = fragmentSpreadSelections[0];
            currentlyInNodeRootField = true;
            retainFragment = fragmentSpreadNode.name.value;
          }
        }
      },
      FragmentSpread() {
        if (currentlyInNodeRootField) {
          currentlyInNodeRootField = false;
          return undefined;
        }
        return removeNodeType();
      },
      FragmentDefinition(fragmentDefinitionNode) {
        if (
          retainFragment &&
          fragmentDefinitionNode.name.value === retainFragment
        ) {
          return undefined;
        }
        return removeNodeType();
      },
    })
  );
}
