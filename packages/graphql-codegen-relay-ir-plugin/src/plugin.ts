import { printSchema, Source, visit as visitAST } from "graphql";
import { create as createRelaySchema } from "relay-compiler/lib/core/Schema";
import { transform as transformToIR } from "relay-compiler/lib/core/RelayParser";
import * as IRTransformer from "relay-compiler/lib/core/IRTransformer";
import CompilerContext, {
  IRTransform,
} from "relay-compiler/lib/core/CompilerContext";
import dedupeJSONStringify from "relay-compiler/lib/util/dedupeJSONStringify";
import crypto from "crypto";

import compileRelayArtifacts from "relay-compiler/lib/codegen/compileRelayArtifacts";
import * as InlineFragmentsTransform from "./vendor/relay-compiler-v12.0.0/lib/transforms/InlineFragmentsTransform";
import * as RelayIRTransforms from "relay-compiler/lib/core/RelayIRTransforms";

import { PluginFunction, Types } from "@graphql-codegen/plugin-helpers";
import type { RawClientSideBasePluginConfig } from "@graphql-codegen/visitor-plugin-common";
import type {
  ASTNode,
  DocumentNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
} from "graphql";
import type { Schema } from "relay-compiler/lib/core/Schema";
import type {
  GeneratedNode,
  ConcreteRequest,
  ReaderFragment,
} from "relay-runtime";
import invariant from "invariant";

const SchemaCache = new WeakMap();

const SCHEMA_EXTENSIONS = `
  directive @connection(key: String!, filter: [String]) on FIELD
`;

// Inline all fragments, including for ReaderFragments, but do not remove them.
const PluginIRTransforms = {
  ...RelayIRTransforms,
  fragmentTransforms: [
    InlineFragmentsTransform.transform,
    ...RelayIRTransforms.fragmentTransforms,
  ],
  codegenTransforms: RelayIRTransforms.codegenTransforms
    .filter((transform) => transform.name !== "generateTypeNameTransform")
    .map((transform) =>
      // FIXME: This isn't actually removing the transform, but unsure what the
      //        ramifications are of removing this now.
      transform.name === "InlineFragmentsTransform"
        ? InlineFragmentsTransform.transform
        : transform,
    ),
};

/**
 * Changes the name of the "filter" argument to "filters" to match what
 * relay-compiler expects.
 */
const ConnectionFilterPluralizationTransform: IRTransform = (context) =>
  IRTransformer.transform(context, {
    Directive: (node) =>
      node.name === "connection" &&
      node.args.find((arg) => arg.name === "filter")
        ? {
            ...node,
            args: node.args.map((arg) =>
              arg.name === "filter" ? { ...arg, name: "filters" } : arg,
            ),
          }
        : node,
  });

export const plugin: PluginFunction<
  RawClientSideBasePluginConfig,
  Types.ComplexPluginOutput
> = async (schema, documents, config, _info) => {
  if (!SchemaCache.has(schema)) {
    SchemaCache.set(
      schema,
      createRelaySchema(
        new Source(SCHEMA_EXTENSIONS + "\n\n" + printSchema(schema)),
      ),
    );
  }

  const relaySchema = SchemaCache.get(schema);
  const nodes = collectIRNodes(relaySchema, documents, config);

  let compilerContext = new CompilerContext(relaySchema);
  for (const node of nodes) {
    compilerContext = compilerContext.add(node);
  }
  compilerContext = compilerContext.applyTransform(
    ConnectionFilterPluralizationTransform,
  );

  const generatedNodes = compileRelayArtifacts(
    compilerContext,
    PluginIRTransforms,
  ).map<GeneratedNode>(([_, node]) =>
    isConcreteRequest(node)
      ? // We do not need to include the operation text, at this time.
        { ...node, params: { ...node.params, text: null } }
      : node,
  );

  return {
    content: generatedNodes
      .filter(isNodePartOfMainDocuments(documents))
      .flatMap(generateVariableDefinitions(config))
      .join("\n"),
  };
};

const generateVariableDefinitions = (config: RawClientSideBasePluginConfig) => {
  return (node: GeneratedNode): string[] => {
    const variable = getVariableName(node, config);
    const json = dedupeJSONStringify(node);
    return [
      `(${variable} as any).__relay = ${json};`,
      `(${variable} as any).__relay.hash = "${
        isConcreteRequest(node) && node.params.cacheID
          ? // For a ConcreteRequest we can re-use the cacheID and avoid some overhead
            node.params.cacheID
          : // For a ReaderFragment we need to generate a hash ourselves
            crypto.createHash("md5").update(json, "utf8").digest("hex")
      }";`,
    ];
  };
};

function isNodePartOfMainDocuments(documents: Types.DocumentFile[]) {
  const operationsInDocument = documents.flatMap((source) =>
    source
      .document!.definitions.filter((def) => def.kind === "OperationDefinition")
      .map((def) => (def as OperationDefinitionNode).name!.value),
  );
  const fragmentsInDocument = documents.flatMap((source) =>
    source
      .document!.definitions.filter((def) => def.kind === "FragmentDefinition")
      .map((def) => (def as FragmentDefinitionNode).name!.value),
  );
  return (node: GeneratedNode) =>
    isConcreteRequest(node)
      ? operationsInDocument.includes(node.operation.name)
      : isReaderFragment(node)
      ? fragmentsInDocument.includes(node.name)
      : false;
}

function isConcreteRequest(node: GeneratedNode): node is ConcreteRequest {
  return node.kind === "Request";
}

function isReaderFragment(node: GeneratedNode): node is ReaderFragment {
  return node.kind === "Fragment";
}

// TODO: This name faffing in graphql-codegen isn't really clear to me. It
//       would be great if we could just re-use their logic in BaseVisitor, but
//       we don't have graphql-js AST nodes here.
function getVariableName(
  node: GeneratedNode,
  config: RawClientSideBasePluginConfig,
) {
  if (isConcreteRequest(node)) {
    const name = node.operation.name;
    return `${name}${config.documentVariableSuffix || "Document"}`;
  } else if (isReaderFragment(node)) {
    const name = node.name;
    return `${
      config.dedupeOperationSuffix ? name.replace(/Fragment$/, "") : name
    }${config.fragmentVariableSuffix || "FragmentDoc"}`;
  } else {
    throw new Error("Unexpected node type");
  }
}

function collectIRNodes(
  schema: Schema,
  documents: Types.DocumentFile[],
  config: RawClientSideBasePluginConfig,
) {
  const operationNodes = new Map<string, OperationDefinitionNode>();
  const fragmentNodes = new Map<string, FragmentDefinitionNode>();

  documents.forEach((doc) => {
    invariant(doc.document, "Expected document to be parsed");
    const docWithTypenames = addTypename(doc.document);
    (
      docWithTypenames.definitions as Array<
        OperationDefinitionNode | FragmentDefinitionNode
      >
    ).forEach((definition) => {
      if (definition.kind === "OperationDefinition") {
        addNode(operationNodes, definition, doc.location);
      } else {
        addNode(fragmentNodes, definition, doc.location);
      }
    });
  });

  config.externalFragments?.forEach((fragment) => {
    addNode(fragmentNodes, fragment.node, fragment.importFrom);
  });

  return transformToIR(schema, [
    ...operationNodes.values(),
    ...fragmentNodes.values(),
  ]);
}

function addNode(
  nodes: Map<string, OperationDefinitionNode | FragmentDefinitionNode>,
  definition: OperationDefinitionNode | FragmentDefinitionNode,
  location: string | undefined | null,
) {
  const name = definition.name!.value;
  invariant(
    nodes.get(name) === undefined ||
      nodes.get(name)?.loc?.source?.name === location,
    "graphql-codegen-relay-ir-plugin: Duplicate definition %s in document %s and %s",
    name,
    location || "unknown",
    nodes.get(name)?.loc?.source?.name || "unknown",
  );
  nodes.set(name, definition);
}

// Doing this on the graphql-js AST for now, because we do the same in our
// patched version of @graphql-codegen/typed-document-node and this will keep
// it in sync more easily.
function addTypename(document: DocumentNode): DocumentNode {
  return visitAST(document, {
    SelectionSet: {
      leave(node, _, parent) {
        if (
          parent &&
          !Array.isArray(parent) &&
          (parent as ASTNode).kind === "OperationDefinition"
        ) {
          return;
        }
        const { selections } = node;
        if (!selections) {
          return;
        }
        // Check if there already is an unaliased __typename selection
        if (
          selections.some(
            (selection) =>
              selection.kind === "Field" &&
              selection.name.value === "__typename" &&
              selection.alias === undefined,
          )
        ) {
          return;
        }
        return {
          ...node,
          selections: [
            ...selections,
            {
              kind: "Field",
              name: {
                kind: "Name",
                value: "__typename",
              },
            },
          ],
        };
      },
    },
  });
}
