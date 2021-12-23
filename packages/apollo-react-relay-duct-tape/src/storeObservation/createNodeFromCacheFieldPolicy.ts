import { FieldReadFunction } from "@apollo/client";
import { FragmentSpreadNode, FragmentDefinitionNode } from "graphql";
import invariant from "invariant";

/**
 * Use this as the field policy function for the node root field, which is what
 * gets invoked when using relay-compiler's refetch query. Queries that use a
 * cache-only cache-policy will read the data from the store, which is expected
 * to be populated by a different query beforehand.
 *
 * @param prefixIdWithTypename By default Apollo Client will prefix all ids used
 *                             to normalize store objects with the GraphQL type
 *                             name. If a custom `dataIdFromObject` function is
 *                             defined that assumes the `id` value of an object
 *                             is already globally unique, then this needs to be
 *                             disabled here too.
 */
export function createNodeFromCacheFieldPolicy(
  prefixIdWithTypename: boolean = true
): FieldReadFunction {
  return (_existing, options) => {
    // TODO: Does the result get written to the store? If so, return `existing` immediately if it's defined.

    const id = options.args?.id;
    invariant(id, "Expected a node id");

    const fragmentNames = (options.field!.selectionSet!.selections.filter(
      (sel) => sel.kind === "FragmentSpread"
    ) as FragmentSpreadNode[]).map(
      (fragmentSpreadNode) => fragmentSpreadNode.name.value
    );
    invariant(
      fragmentNames.length === 1,
      "Expected a single fragment spread in the watch node query"
    );

    const fragment = options.query.definitions.find(
      (defNode) =>
        defNode.kind === "FragmentDefinition" &&
        defNode.name.value === fragmentNames[0]
    ) as FragmentDefinitionNode;
    invariant(fragment, "Expected to find a fragment");

    const data =
      // TODO: Check if we can just pass all fragments at once?
      options.cache.readFragment({
        id: prefixIdWithTypename ? `${fragment.typeCondition.name.value}` : id,
        fragment: { kind: "Document", definitions: [fragment] },
      });
    invariant(data, "Expected to find cached data");

    // TODO: Work with multiple fragments, although this is only relevant when having fragments
    //       on non-node types.

    return data;
  };
}
