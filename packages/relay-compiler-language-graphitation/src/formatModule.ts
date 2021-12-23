/**
 * NOTE: This is currently in-flight and mostly re-uses code from the above mentioned package, where it's tested.
 */
/* istanbul ignore file */

import { FormatModule } from "relay-compiler/lib/language/RelayLanguagePluginInterface";
import { DocumentNode, parse, print } from "graphql";
import { reduceNodeWatchQuery } from "./reduceNodeWatchQuery";
import { schema } from "./schema";
import invariant from "invariant";

function emitDocument(document: DocumentNode, exportName: string) {
  return `
/*\n${print(document)}\n*/
export const ${exportName} = ${JSON.stringify(document)};`;
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
      append += emitDocument(originalDocument, "executionQueryDocument");
      append += "\n";
    }
    invariant(schema, "Expected a schema to be passed in or set in the env");
    const reducedDocument = reduceNodeWatchQuery(schema, originalDocument);
    append += emitDocument(reducedDocument, "watchQueryDocument");
  }
  return `/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
${hash ? `/* ${hash} */\n` : ""};
${typeText || ""}${append}`;
};
