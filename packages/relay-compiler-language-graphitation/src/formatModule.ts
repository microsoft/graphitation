/**
 * NOTE: This is currently in-flight and mostly re-uses code from the above mentioned package, where it's tested.
 */
/* istanbul ignore file */

import { FormatModule } from "relay-compiler/lib/language/RelayLanguagePluginInterface";
import { parse } from "graphql";

export const formatModule: FormatModule = ({
  hash,
  typeText,
  concreteText,
  node,
  documentType,
  docText,
  definition,
  kind,
}) => {
  console.log(documentType, kind, docText, definition);
  return `/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
${hash ? `/* ${hash} */\n` : ""};
${typeText || ""}

export const node = ${concreteText};

export const document = ${JSON.stringify(
    parse(definition.loc.source.body),
    null,
    2,
  )};
`;
};
