import {
  DirectiveNode,
  DocumentNode,
  FragmentDefinitionNode,
  GraphQLOutputType,
  GraphQLSchema,
  isInterfaceType,
  isObjectType,
  parse,
  print,
} from "graphql";
import invariant from "invariant";
import { schema as _schema } from "./schema";

export function enableNodeWatchQuery(
  documentText: string,
  schema: GraphQLSchema | undefined = _schema
) {
  invariant(schema, "Expected a schema to be passed in or set in the env");

  const nodeType = schema.getType("Node");
  invariant(
    nodeType && isInterfaceType(nodeType),
    "Expected schema to define a Node interface"
  );

  const document = parse(documentText, { noLocation: true });
  const fragmentDefinition = document.definitions[0];
  if (fragmentDefinition.kind === "FragmentDefinition") {
    const typeConstraint = schema.getType(
      fragmentDefinition.typeCondition.name.value
    );
    if (
      isObjectType(typeConstraint) &&
      typeConstraint.getInterfaces().includes(nodeType)
    ) {
      return print({
        kind: "Document",
        definitions: [
          {
            ...fragmentDefinition,
            directives: [
              ...(fragmentDefinition.directives || []),
              emitRefetchableDirective(fragmentDefinition),
            ],
          },
          ...document.definitions.slice(1),
        ],
      });
    }
    // TODO: Handle fragment on Node ?
    // } else if (isInterfaceType(typeConstraint)) {
  }
  return documentText;
}

function emitRefetchableDirective(
  fragmentDefinitionNode: FragmentDefinitionNode
): DirectiveNode {
  const fragmentName = fragmentDefinitionNode.name.value;
  const fragmentBaseName = fragmentName.replace(/Fragment$/, "");
  return {
    kind: "Directive",
    name: {
      kind: "Name",
      value: "refetchable",
    },
    arguments: [
      {
        kind: "Argument",
        name: {
          kind: "Name",
          value: "queryName",
        },
        value: {
          kind: "StringValue",
          value: `${fragmentBaseName}WatchNodeQuery`,
        },
      },
    ],
  };
}
