import {
  Types,
  PluginValidateFn,
  PluginFunction,
} from "@graphql-codegen/plugin-helpers";
import {
  GraphQLSchema,
  Source,
  printSchema,
  DocumentNode,
  visit,
  Kind,
} from "graphql";
import { extname } from "path";
import {
  RawClientSideBasePluginConfig,
  DocumentMode,
} from "@graphql-codegen/visitor-plugin-common";
import CompilerContext, {
  IRTransform,
} from "relay-compiler/lib/core/CompilerContext";
import { create as createRelaySchema } from "relay-compiler/lib/core/Schema";
import { parse as parseRelay } from "relay-compiler/lib/core/RelayParser";
import { generate as generateRelay } from "relay-compiler/lib/codegen/RelayCodeGenerator";
import {
  codegenTransforms,
  fragmentTransforms,
} from "relay-compiler/lib/core/RelayIRTransforms";
import dedupeJSONStringify from "relay-compiler/lib/util/dedupeJSONStringify";
import { Request } from "relay-compiler/lib/core/IR";
import { addTypesToRequestDocument } from "@graphitation/supermassive/lib/index.js";
import type { DocumentNode as SupermassiveDocumentNode } from "@graphitation/supermassive";
import { DefinitionNode } from "@graphitation/supermassive/src/ast/TypedAST";

export const plugin: PluginFunction<RawClientSideBasePluginConfig> = (
  schema: GraphQLSchema,
  documents: Types.DocumentFile[],
  config: RawClientSideBasePluginConfig,
) => {
  const relaySchema = createRelaySchema(new Source(printSchema(schema)));
  let compilerContext = new CompilerContext(relaySchema);
  const definitionsByName: { [key: string]: DefinitionNode } = {};
  documents.forEach(({ document, rawSDL }) => {
    if (document && rawSDL) {
      const supermassiveDocument: SupermassiveDocumentNode = addTypesToRequestDocument(
        schema,
        visit(document, {
          leave(node) {
            if (node.loc) {
              return {
                ...node,
                loc: undefined,
              };
            } else {
              return node;
            }
          },
        }),
      );
      for (const definition of supermassiveDocument.definitions) {
        if (
          definition &&
          (definition.kind === "OperationDefinition" ||
            definition.kind === "FragmentDefinition") &&
          definition.name?.value
        ) {
          definitionsByName[definition.name.value] = definition;
        }
      }
      const parsed = parseRelay(relaySchema, rawSDL);
      for (const node of parsed) {
        compilerContext = compilerContext.add(node);
      }
    }
  });

  const queryCompilerContext = compilerContext.applyTransforms([
    ...(codegenTransforms as IRTransform[]),
  ]);
  const fragmentCompilerContext = compilerContext.applyTransforms([
    ...(fragmentTransforms as IRTransform[]),
  ]);
  const results: Array<{ name: string; node: string }> = [];
  queryCompilerContext.forEachDocument((node) => {
    if (node.kind === "Root") {
      const fragment = compilerContext.getRoot(node.name);
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
      const definition = definitionsByName[name] || {};
      const document = {
        kind: Kind.DOCUMENT,
        definitions: [definition],
      };
      let generatedNode = generateRelay(relaySchema, request);
      results.push({
        name,
        node: dedupeJSONStringify({
          ...document,
          __relay: generatedNode,
        }),
      });
    }
  });

  fragmentCompilerContext.forEachDocument((node) => {
    if (node.kind === "Fragment") {
      const generatedNode = generateRelay(relaySchema, node);
      const name = generatedNode.name;
      const definition = definitionsByName[name] || {};
      const document = {
        kind: Kind.DOCUMENT,
        definitions: [definition],
      };

      results.push({
        name,
        node: dedupeJSONStringify({
          ...document,
          __relay: generatedNode,
        }),
      });
    }
  });
  return {
    prepend: [`import { DocumentNode } from "graphql";`],
    content: results
      .map(
        ({ name, node }) =>
          `export const ${name}Document: DocumentNode = ${node};`,
      )
      .join(`\n`),
  };
};

export const validate: PluginValidateFn<RawClientSideBasePluginConfig> = async (
  schema: GraphQLSchema,
  documents: Types.DocumentFile[],
  config,
  outputFile: string,
) => {
  if (config && config.documentMode === DocumentMode.string) {
    throw new Error(
      `Plugin "supermassive-typed-document-node" does not allow using 'documentMode: string' configuration!`,
    );
  }

  if (extname(outputFile) !== ".ts" && extname(outputFile) !== ".tsx") {
    throw new Error(
      `Plugin "supermassive-typed-document-node" requires extension to be ".ts" or ".tsx"!`,
    );
  }
};
