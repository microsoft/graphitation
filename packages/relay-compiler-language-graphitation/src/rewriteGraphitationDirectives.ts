/**
 * NOTE: This is currently in-flight and mostly re-uses code from the above mentioned package, where it's tested.
 */

import { parse, print, visit } from "graphql";

/**
 * This rewrites graphitation specific directives to relay ones. Currently it does the following:
 *
 * - `@graphitation_test_operation` is rewritten to `@raw_response_type`.
 *   In the future this should probably also add `@relay_test_operation`.
 *
 * @param document A single GraphQL document
 */
export function rewriteGraphitationDirectives(document: string) {
  const documentNode = parse(document);
  const rewrittenDocumentNode = visit(documentNode, {
    Directive(directiveNode) {
      if (directiveNode.name.value === "graphitation_test_operation") {
        return {
          ...directiveNode,
          name: {
            kind: "Name",
            value: "raw_response_type",
          },
        };
      }
      return undefined;
    },
  });
  return print(rewrittenDocumentNode);
}
