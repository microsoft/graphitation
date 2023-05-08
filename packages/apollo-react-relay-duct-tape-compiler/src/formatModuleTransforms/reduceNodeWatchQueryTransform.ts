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
  FragmentDefinitionNode,
} from "graphql";
import invariant from "invariant";

const ALLOWED_REFETCH_QUERY_FIELD_SELECTIONS = [
  "__fragments",
  "__typename",
  "id",
];

/**
 * Given the execution query document, that is the fat query that is used to
 * actually fetch the data, this transform will reduce the operation to limit
 * it to just the first fragment (on either a `Node` type of the `Query` type).
 * This is the operation that the `use*Fragment` hooks will use to observe the
 * Apollo Client store for data changes.
 *
 * @param schema The schema that the operation executes on
 * @param document The execution query document
 * @returns The watch query document
 */
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
  let retainFragment: string;

  const removeNonWatchQueryFragmentNodes = (
    node: FragmentSpreadNode | FragmentDefinitionNode
  ) => {
    if (retainFragment && node.name.value === retainFragment) {
      return undefined;
    }
    const unnamedTypeConstraint = typeInfo.getType();
    invariant(unnamedTypeConstraint, "Expected a type constraint");
    const typeConstraint = getNamedType(unnamedTypeConstraint);
    if (
      typeConstraint === schema.getQueryType() ||
      ((isObjectType(typeConstraint) || isInterfaceType(typeConstraint)) &&
        typeConstraint.getInterfaces().includes(nodeType))
    ) {
      return null;
      // TODO: Handle fragment on Node ?
      // } else if (isInterfaceType(typeConstraint)) {
    }
    return undefined;
  };

  return visit(
    document,
    visitWithTypeInfo(typeInfo, {
      OperationDefinition(operationDefinitionNode) {
        const selections = operationDefinitionNode.selectionSet!.selections;
        const fragmentSpreadNode = selections.find(
          (sel) => sel.kind === "FragmentSpread"
        ) as FragmentSpreadNode;
        if (
          selections.length === 2 &&
          fragmentSpreadNode &&
          selections.find(
            (sel) => sel.kind === "Field" && sel.name.value === "__fragments"
          )
        ) {
          retainFragment = fragmentSpreadNode.name.value;
        }
      },
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
            retainFragment = fragmentSpreadNode.name.value;
          }
        }
      },
      FragmentSpread: removeNonWatchQueryFragmentNodes,
      FragmentDefinition: removeNonWatchQueryFragmentNodes,
    })
  );
}
