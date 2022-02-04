import { FieldReadFunction } from "@apollo/client";
import { FragmentSpreadNode, FragmentDefinitionNode } from "graphql";
import invariant from "invariant";

const fragmentDocumentCache = new WeakMap();

/**
 * Use this as the field policy function for the node root field, which is what
 * gets invoked when using relay-compiler's refetch query. Queries that use a
 * cache-only cache-policy will read the data from the store, which is expected
 * to be populated by a different query beforehand.
 */
export const nodeFromCacheFieldPolicy: FieldReadFunction = (
  _existingCacheData,
  options
) => {
  const nodeId = options.args!.id;
  invariant(nodeId, "Expected an `id` argument");

  const fragmentNames = (options.field!.selectionSet!.selections.filter(
    (sel) => sel.kind === "FragmentSpread"
  ) as FragmentSpreadNode[]).map(
    (fragmentSpreadNode) => fragmentSpreadNode.name.value
  );
  invariant(
    fragmentNames.length === 1,
    "Expected a single fragment spread in the watch node query, instead got `%s`",
    fragmentNames.length
  );
  const fragmentName = fragmentNames[0];

  const fragment = options.query.definitions.find(
    (defNode) =>
      defNode.kind === "FragmentDefinition" &&
      defNode.name.value === fragmentName
  ) as FragmentDefinitionNode;
  invariant(
    fragment,
    "Expected document to contain a fragment by name `%s`",
    fragmentName
  );

  let fragmentDocument = fragmentDocumentCache.get(options.query);

  if (!fragmentDocument) {
    fragmentDocument = {
      kind: "Document",
      definitions: options.query.definitions.filter(
        (def) => def.kind === "FragmentDefinition"
      ),
    };
    fragmentDocumentCache.set(options.query, fragmentDocument);
  }

  const id = `${fragment.typeCondition.name.value}:${nodeId}`;
  const data = options.cache.readFragment({
    id,
    variables: options.variables,
    fragmentName,
    fragment: fragmentDocument,
  });
  invariant(data, "Expected to find cached data with id `%s`", id);

  return data;
};
