import { printSchema, Source } from "graphql";
import { create as createRelaySchema } from "relay-compiler/lib/core/Schema";
import { transform as transformToIR } from "relay-compiler/lib/core/RelayParser";
import CompilerContext from "relay-compiler/lib/core/CompilerContext";
import * as FlattenTransform from "relay-compiler/lib/transforms/FlattenTransform";
import * as InlineFragmentsTransform from "relay-compiler/lib/transforms/InlineFragmentsTransform";
import { generate as generateIRDocument } from "relay-compiler/lib/codegen/RelayCodeGenerator";
import dedupeJSONStringify from "relay-compiler/lib/util/dedupeJSONStringify";
import crypto from "crypto";

import { PluginFunction, Types } from "@graphql-codegen/plugin-helpers";
import type { RawClientSideBasePluginConfig } from "@graphql-codegen/visitor-plugin-common";
import type { FragmentDefinitionNode, OperationDefinitionNode } from "graphql";
import type { Schema } from "relay-compiler/lib/core/Schema";
import type { Request } from "relay-compiler/lib/core/IR";
import type { ConcreteRequest, ReaderFragment } from "relay-runtime";
import invariant from "invariant";

const SchemaCache = new WeakMap();

export const plugin: PluginFunction<
  RawClientSideBasePluginConfig,
  Types.ComplexPluginOutput
> = async (schema, documents, config, info) => {
  if (!SchemaCache.has(schema)) {
    SchemaCache.set(schema, createRelaySchema(new Source(printSchema(schema))));
  }

  invariant(
    documents.length === 1,
    "Expected only a single document at a time",
  );

  const operationsInDocument = documents[0]
    .document!.definitions.filter((def) => def.kind === "OperationDefinition")
    .map((def) => (def as OperationDefinitionNode).name!.value);
  const fragmentsInDocument = documents[0]
    .document!.definitions.filter((def) => def.kind === "FragmentDefinition")
    .map((def) => (def as FragmentDefinitionNode).name!.value);

  const relaySchema = SchemaCache.get(schema);
  const nodes = collectIRNodes(relaySchema, documents, config);

  let compilerContext = new CompilerContext(relaySchema);
  for (const node of nodes) {
    compilerContext = compilerContext.add(node);
  }
  const operationCompilerContext = compilerContext.applyTransform(
    InlineFragmentsTransform.transform,
  );
  const fragmentCompilerContext = compilerContext.applyTransform(
    FlattenTransform.transformWithOptions({
      isForCodegen: true,
    } as any),
  );

  const generatedIRDocuments: Array<ConcreteRequest | ReaderFragment> = [];
  operationCompilerContext.forEachDocument((node) => {
    if (node.kind === "Root" && operationsInDocument.includes(node.name)) {
      const fragment = operationCompilerContext.getRoot(node.name);
      const name = fragment.name;
      const request: Request = {
        kind: "Request",
        fragment: {
          kind: "Fragment",
          name,
          argumentDefinitions: fragment.argumentDefinitions,
          directives: fragment.directives,
          loc: { kind: "Derived", source: node.loc },
          metadata: undefined,
          selections: fragment.selections as any,
          type: fragment.type,
        },
        id: undefined,
        loc: node.loc,
        metadata: node.metadata || {},
        name: fragment.name,
        root: node,
        text: "",
      };
      generatedIRDocuments.push(generateIRDocument(relaySchema, request));
    }
  });
  fragmentCompilerContext.forEachDocument((node) => {
    if (node.kind === "Fragment" && fragmentsInDocument.includes(node.name)) {
      generatedIRDocuments.push(generateIRDocument(relaySchema, node));
    }
  });

  return {
    content: generatedIRDocuments
      .flatMap((doc) => {
        const variable =
          doc.kind === "Request"
            ? `${(doc as ConcreteRequest).operation.name}${
                config.documentVariableSuffix || "Document"
              }`
            : `${(doc as ReaderFragment).name}${
                config.fragmentVariableSuffix || "FragmentDoc"
              }`;
        const json = dedupeJSONStringify(doc);
        return [
          `(${variable} as any).__relay = ${json};`,
          `(${variable} as any).__relay.hash = "${crypto
            .createHash("md5")
            .update(json, "utf8")
            .digest("hex")}";`,
        ];
      })
      .join("\n"),
  };
};

function collectIRNodes(
  schema: Schema,
  documents: Types.DocumentFile[],
  config: RawClientSideBasePluginConfig,
) {
  const operationNodes = new Map<string, OperationDefinitionNode>();
  const fragmentNodes = new Map<string, FragmentDefinitionNode>();

  documents.forEach((doc) => {
    invariant(doc.document, "Expected document to be parsed");
    (doc.document.definitions as Array<
      OperationDefinitionNode | FragmentDefinitionNode
    >).forEach((definition) => {
      if (definition.kind === "OperationDefinition") {
        addNode(operationNodes, definition, doc.location);
      } else {
        addNode(fragmentNodes, definition, doc.location);
      }
    });
  });

  config.externalFragments!.forEach((fragment) => {
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
