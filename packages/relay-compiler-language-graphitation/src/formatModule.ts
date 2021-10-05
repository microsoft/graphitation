/**
 * NOTE: This is currently in-flight and mostly re-uses code from the above mentioned package, where it's tested.
 */
/* istanbul ignore file */

import { FormatModule } from "relay-compiler/lib/language/RelayLanguagePluginInterface";

export const formatModule: FormatModule = ({ hash, typeText }) =>
  `/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
${hash ? `/* ${hash} */\n` : ""};
${typeText || ""}`;
