/**
 * NOTE: This is currently in-flight and mostly re-uses code from the above mentioned package, where it's tested.
 */
/* istanbul ignore file */

import { FormatModule } from "relay-compiler/lib/language/RelayLanguagePluginInterface";
import { buildSchema, DocumentNode, parse, print, Source } from "graphql";
import invariant from "invariant";
import { readFileSync } from "fs";
import { reduceNodeWatchQuery } from "./reduceNodeWatchQuery";

// TODO: Just a dirty hack to side-step this issue for now.
const schemaPath = process.env.SCHEMA_PATH;
invariant(schemaPath, "Expected the SCHEMA_PATH env variable to be set");
const schema = buildSchema(
  new Source(readFileSync(schemaPath, "utf-8"), schemaPath)
);

function emitDocument(document: DocumentNode, exportName: string) {
  return `
/*\n${print(document)}\n*/
export const ${exportName} = ${JSON.stringify(document)};`;
}

export const formatModule: FormatModule = ({ docText, hash, typeText }) => {
  let append = "";
  if (docText) {
    const originalDocument = parse(docText, { noLocation: true });
    append += emitDocument(originalDocument, "executionQueryDocument");
    append += "\n";
    const reducedDocument = reduceNodeWatchQuery(schema, originalDocument);
    append += emitDocument(reducedDocument, "watchQueryDocument");
  }
  return `/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
${hash ? `/* ${hash} */\n` : ""};
${typeText || ""}${append}`;
};
