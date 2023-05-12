import { parse, print } from "graphql";
import { optimizeDocumentNode } from "@graphql-tools/optimize";
import { reduceNodeWatchQueryTransform } from "./formatModuleTransforms/reduceNodeWatchQueryTransform";
import invariant from "invariant";
import { stripFragmentReferenceFieldSelectionTransform } from "./formatModuleTransforms/stripFragmentReferenceFieldSelectionTransform";
import { extractMetadataTransform } from "./formatModuleTransforms/extractMetadataTransform";
import { buildSchema, Source } from "graphql";
import { readFileSync } from "fs";

import type { DocumentNode } from "graphql";
import type { FormatModule } from "relay-compiler/lib/language/RelayLanguagePluginInterface";
import type { CompiledArtefactModule } from "./types";

export interface FormatModuleOptions {
  emitDocuments: boolean;
  emitNarrowObservables: boolean;
  emitQueryDebugComments: boolean;
  emitSupermassiveDocuments: boolean;
  schema: string;
}

function printDocumentComment(document: DocumentNode) {
  return `/*\n${print(document).trim()}\n*/`;
}

export async function formatModuleFactory(
  options: FormatModuleOptions,
): Promise<FormatModule> {
  const schema = options.emitNarrowObservables
    ? buildSchema(
        new Source(readFileSync(options.schema, "utf-8"), options.schema),
      )
    : null;

  let addTypesToRequestDocument:
    | undefined
    | typeof import("@graphitation/supermassive").addTypesToRequestDocument;
  if (options.emitSupermassiveDocuments) {
    ({ addTypesToRequestDocument } = await import(
      "@graphitation/supermassive"
    ));
  }

  function generateExports(moduleName: string, docText: string) {
    const exports: CompiledArtefactModule = {};
    const originalDocument = parse(docText, { noLocation: true });
    const optimizedDocument = optimizeDocumentNode(originalDocument);

    if (!options.emitNarrowObservables) {
      exports.executionQueryDocument = optimizedDocument;
    } else {
      if (!moduleName.endsWith("WatchNodeQuery.graphql")) {
        exports.executionQueryDocument =
          stripFragmentReferenceFieldSelectionTransform(optimizedDocument);
      }

      invariant(schema, "Expected a schema instance");
      exports.watchQueryDocument = reduceNodeWatchQueryTransform(
        schema,
        optimizedDocument,
      );

      exports.metadata = extractMetadataTransform(exports.watchQueryDocument);
    }

    if (addTypesToRequestDocument && exports.executionQueryDocument) {
      invariant(schema, "Expected a schema instance");
      exports.executionQueryDocument = addTypesToRequestDocument(
        schema,
        exports.executionQueryDocument,
      ) as DocumentNode;
    }

    return exports;
  }

  return ({ docText, hash, moduleName, typeText }) => {
    const exports = options.emitDocuments
      ? docText && generateExports(moduleName, docText)
      : null;
    const components = [
      typeText,
      exports &&
        options.emitQueryDebugComments &&
        exports.executionQueryDocument &&
        printDocumentComment(exports.executionQueryDocument),
      exports &&
        options.emitQueryDebugComments &&
        exports.watchQueryDocument &&
        printDocumentComment(exports.watchQueryDocument),
      exports &&
        `export const documents: import("@graphitation/apollo-react-relay-duct-tape-compiler").CompiledArtefactModule = ${JSON.stringify(
          exports,
          null,
          2,
        )};`,
    ].filter(Boolean) as string[];

    return `/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
${hash ? `/* ${hash} */\n` : ""}
${components.join("\n\n")}`;
  };
}
