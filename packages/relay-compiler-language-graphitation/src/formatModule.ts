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

function emitDocument(document: DocumentNode, exportName: string) {
  return `
/*\n${print(document)}\n*/
export const ${exportName} = ${JSON.stringify(document, null, 2)};`;
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
  }
  return `/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
${hash ? `/* ${hash} */\n` : ""};
${typeText || ""}${append}`;
};
