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
import invariant from "invariant";

const SchemaCache = new WeakMap();

export const plugin: PluginFunction<
  RawClientSideBasePluginConfig,
  Types.ComplexPluginOutput
> = async (schema, documents, config, info) => {
  if (!SchemaCache.has(schema)) {
    SchemaCache.set(schema, createRelaySchema(new Source(printSchema(schema))));
  }

  const mainNode = documents[0].document!.definitions[0] as
    | OperationDefinitionNode
    | FragmentDefinitionNode;

  const relaySchema = SchemaCache.get(schema);
  const nodes = collectIRNodes(relaySchema, documents, config);

  let compilerContext = new CompilerContext(relaySchema);
  for (const node of nodes) {
    compilerContext = compilerContext.add(node);
  }

  const generate = () => {
    if (mainNode.kind === "OperationDefinition") {
      const operationCompilerContext = compilerContext.applyTransform(
        InlineFragmentsTransform.transform,
      );
      const fragment = operationCompilerContext.getRoot(mainNode.name!.value);
      const name = fragment.name;
      const request: Request = {
        kind: "Request",
        fragment: {
          kind: "Fragment",
          name,
          argumentDefinitions: fragment.argumentDefinitions,
          directives: fragment.directives,
          loc: { kind: "Derived", source: fragment.loc },
          metadata: undefined,
          selections: fragment.selections as any,
          type: fragment.type,
        },
        id: undefined,
        loc: fragment.loc,
        metadata: fragment.metadata || {},
        name: fragment.name,
        root: fragment,
        text: "",
      };
      return request;
    } else {
      const fragmentCompilerContext = compilerContext.applyTransform(
        FlattenTransform.transformWithOptions({
          isForCodegen: true,
        } as any),
      );
      const fragment = fragmentCompilerContext.getFragment(mainNode.name.value);
      return fragment;
    }
  };

  const content = generateIRDocument(relaySchema, generate() as any);

  const mainVariable =
    mainNode.name!.value +
    (mainNode.kind === "OperationDefinition"
      ? config.documentVariableSuffix || "Document"
      : config.fragmentVariableSuffix || "FragmentDoc");

  const json = dedupeJSONStringify(content);
  return {
    content: [
      `(${mainVariable} as any).__relay = ${json};`,
      `(${mainVariable} as any).__relay.hash = "${crypto
        .createHash("md5")
        .update(json, "utf8")
        .digest("hex")}";`,
    ].join("\n"),
  };
};

function collectIRNodes(
  schema: Schema,
  documents: Types.DocumentFile[],
  config: RawClientSideBasePluginConfig,
) {
  let operationNode: OperationDefinitionNode | null = null;
  const fragmentNodes = new Map<string, FragmentDefinitionNode>();

  const addFragmentNode = (
    definition: FragmentDefinitionNode,
    location: string | undefined | null,
  ) => {
    const name = definition.name!.value;
    invariant(
      fragmentNodes.get(name) === undefined ||
        fragmentNodes.get(name)?.loc?.source?.name === location,
      "graphql-codegen-relay-ir-plugin: Duplicate fragment definition %s in document %s and %s",
      name,
      location || "unknown",
      fragmentNodes.get(name)?.loc?.source?.name || "unknown",
    );
    fragmentNodes.set(name, definition);
  };

  documents.forEach((doc) => {
    invariant(doc.document, "Expected document to be parsed");
    (doc.document.definitions as Array<
      OperationDefinitionNode | FragmentDefinitionNode
    >).forEach((definition) => {
      if (definition.kind === "OperationDefinition") {
        invariant(
          operationNode === null,
          "graphql-codegen-relay-ir-plugin: Expected only one operation definition in document %s",
          doc.location || "unknown",
        );
        operationNode = definition;
      } else {
        addFragmentNode(definition, doc.location);
      }
    });
  });

  config.externalFragments!.forEach((fragment) => {
    addFragmentNode(fragment.node, fragment.importFrom);
  });

  return transformToIR(
    schema,
    operationNode
      ? [operationNode, ...fragmentNodes.values()]
      : Array.from(fragmentNodes.values()),
  );
}
