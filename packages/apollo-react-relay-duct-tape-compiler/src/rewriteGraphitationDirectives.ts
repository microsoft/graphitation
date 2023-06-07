import {
  DirectiveNode,
  parse,
  print,
  visit,
  FragmentDefinitionNode,
  Kind,
} from "graphql";
import invariant from "invariant";

declare global {
  interface ArrayConstructor {
    isArray(arg: ReadonlyArray<any> | any): arg is ReadonlyArray<any>;
  }
}

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
    Directive(
      directiveNode,
      _key,
      _parent,
      _path,
      ancestors,
    ): DirectiveNode | undefined {
      switch (directiveNode.name.value) {
        case "watchNode": {
          const fragmentDefinitionNode = ancestors[ancestors.length - 1];
          invariant(
            !Array.isArray(fragmentDefinitionNode) &&
              fragmentDefinitionNode.kind === "FragmentDefinition",
            "Expected @watchNode to be used on a fragment",
          );
          return emitRefetchableDirective(fragmentDefinitionNode);
        }
        case "graphitation_test_operation": {
          return {
            ...directiveNode,
            name: {
              kind: Kind.NAME,
              value: "raw_response_type",
            },
          };
        }
        default: {
          return undefined;
        }
      }
    },
  });
  return print(rewrittenDocumentNode);
}

function emitRefetchableDirective(
  fragmentDefinitionNode: FragmentDefinitionNode,
): DirectiveNode {
  const fragmentName = fragmentDefinitionNode.name.value;
  const fragmentBaseName = fragmentName.replace(/Fragment$/, "");
  return {
    kind: Kind.DIRECTIVE,
    name: {
      kind: Kind.NAME,
      value: "refetchable",
    },
    arguments: [
      {
        kind: Kind.ARGUMENT,
        name: {
          kind: Kind.NAME,
          value: "queryName",
        },
        value: {
          kind: Kind.STRING,
          value: `${fragmentBaseName}WatchNodeQuery`,
        },
      },
    ],
  };
}
