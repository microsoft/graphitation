import invariant from "invariant";

import type { FragmentReference } from "./types";
import type {
  CompiledArtefactModule,
  Metadata,
} from "@graphitation/apollo-react-relay-duct-tape-compiler";
import { DocumentNode } from "@apollo/client/core";
import { useFragment, UseFragmentOptions } from "@apollo/client";
import { Kind, ValueNode } from "graphql";

/**
 * @param documents Compiled watch query document that is used to setup a narrow
 *                  observable for just the data selected by the original fragment.
 * @param fragmentReference A Node object that has a globally unique `id` field.
 */
export function useCompiledFragment(
  documents: CompiledArtefactModule,
  fragmentReference: FragmentReference,
) {
  invariant(
    fragmentReference,
    "useFragment(): Expected metadata to have been extracted from " +
      "the fragment. Did you forget to invoke the compiler?",
  );
  const { watchQueryDocument, metadata } = documents;
  invariant(
    watchQueryDocument,
    "useFragment(): Expected a `watchQueryDocument` to have been " +
      "extracted. Did you forget to invoke the compiler?",
  );
  const from = fragmentReference.id;
  invariant(
    typeof from === "string",
    "useFragment(): Expected the fragment reference to have a string id.",
  );
  invariant(
    metadata,
    "useFragment(): Expected metadata to have been extracted from " +
      "the fragment. Did you forget to invoke the compiler?",
  );

  const defaultVariables = getDefaultVariables(watchQueryDocument);
  const variables = {
    ...defaultVariables,
    ...fragmentReference.__fragments,
  };

  const doc: UseFragmentOptions<unknown, unknown> = {
    fragment: getFragmentDocumentFromWatchQueryDocument(
      watchQueryDocument,
      metadata,
    ),
    fragmentName: metadata?.mainFragment?.name,
    from,
    variables,
  };

  const result = useFragment(doc);

  invariant(
    result.complete,
    "useFragment(): Missing data expected to be seeded by the execution query document. Please check your type policies and possibleTypes configuration. If only subset of properties is missing you might need to configure merge functions for non-normalized types.",
  );

  return result.data as object;
}

type DefaultValue =
  | string
  | number
  | boolean
  | { [key: string]: DefaultValue }
  | DefaultValue[]
  | undefined;

const extractValue = (node: ValueNode): DefaultValue => {
  if (!node) return undefined;

  switch (node.kind) {
    case Kind.INT:
    case Kind.FLOAT:
      return Number(node.value);
    case Kind.STRING:
    case Kind.ENUM:
    case Kind.BOOLEAN:
      return node.value;
    case Kind.LIST:
      return node.values.map(extractValue);
    case Kind.OBJECT:
      return node.fields.reduce<Record<string, DefaultValue>>((obj, field) => {
        obj[field.name.value] = extractValue(field.value);
        return obj;
      }, {});
    default:
      return undefined;
  }
};

function getDefaultVariables(documentNode: DocumentNode) {
  const variableDefinitions = documentNode.definitions
    .filter((def) => def.kind === Kind.OPERATION_DEFINITION)
    .flatMap((def) => def.variableDefinitions || []);

  return variableDefinitions.reduce<Record<string, DefaultValue>>(
    (acc, varDef) => {
      if (varDef.defaultValue) {
        acc[varDef.variable.name.value] = extractValue(varDef.defaultValue);
      }
      return acc;
    },
    {},
  );
}
function getFragmentDocumentFromWatchQueryDocument(
  watchQueryDocument: DocumentNode,
  metadata: Metadata,
): DocumentNode {
  const fragmentDefinition = watchQueryDocument.definitions.find((def) => {
    if (def.kind === "FragmentDefinition") {
      return def.name.value === metadata?.mainFragment?.name;
    }
    return false;
  });
  invariant(
    fragmentDefinition,
    "useFragment(): Expected a fragment definition to be found in the " +
      "watch query document. Did you forget to invoke the compiler?",
  );
  return {
    kind: "Document",
    definitions: [fragmentDefinition],
  };
}
