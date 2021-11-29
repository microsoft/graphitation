/**
 * NOTE: This is currently in-flight and mostly re-uses code from the above mentioned package, where it's tested.
 */
/* istanbul ignore file */

import { FormatModule } from "relay-compiler/lib/language/RelayLanguagePluginInterface";
import { DocumentNode, parse, print } from "graphql";
import { reduceNodeWatchQueryTransform } from "./formatModuleTransforms/reduceNodeWatchQueryTransform";
import { schema } from "./schema";
import invariant from "invariant";
import { stripFragmentReferenceFieldSelectionTransform } from "./formatModuleTransforms/stripFragmentReferenceFieldSelectionTransform";
import { extractMetadataTransform } from "./formatModuleTransforms/extractMetadataTransform";

function emitConst(exportName: string, data: any) {
  return `\nexport const ${exportName} = ${JSON.stringify(data, null, 2)};`;
}

function emitDocument(document: DocumentNode, exportName: string) {
  return `\n/*\n${print(document)}\n*/${emitConst(exportName, document)}`;
}

export const formatModule: FormatModule = ({
  docText,
  hash,
  moduleName,
  typeText,
}) => {
  let append = "";
  if (docText) {
    const originalDocument = parse(docText, { noLocation: true });
    if (!moduleName.endsWith("WatchNodeQuery.graphql")) {
      const executionQueryDocument = stripFragmentReferenceFieldSelectionTransform(
        originalDocument
      );
      append += emitDocument(executionQueryDocument, "executionQueryDocument");
      append += "\n";
    }

    invariant(schema, "Expected a schema to be passed in or set in the env");
    const watchQueryDocument = reduceNodeWatchQueryTransform(
      schema,
      originalDocument
    );
    append += emitDocument(watchQueryDocument, "watchQueryDocument");

    const metadata = extractMetadataTransform(watchQueryDocument);
    if (metadata) {
      append += "\n";
      append += emitConst("metadata", metadata);
    }
  }
  return `/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
${hash ? `/* ${hash} */\n` : ""};
${typeText || ""}${append}`;
};
