/**
 * NOTE: This is currently in-flight and mostly re-uses code from the above mentioned package, where it's tested.
 */
/* istanbul ignore file */

import { FormatModule } from "relay-compiler/lib/language/RelayLanguagePluginInterface";
import { parse } from "graphql";

export const formatModule: FormatModule = ({
  docText,
  hash,
  moduleName,
  typeText,
}) => {
  let append = "";
  if (!!docText && moduleName.endsWith("WatchNodeQuery.graphql")) {
    append += "\n/*\n" + docText + "\n*/\n";
    append +=
      "export const documentNode = " +
      JSON.stringify(parse(docText, { noLocation: true })) +
      "\n";
  }
  return `/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
${hash ? `/* ${hash} */\n` : ""};
${typeText || ""}${append}`;
};
