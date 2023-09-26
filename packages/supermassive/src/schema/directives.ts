import { DirectiveLocation } from "graphql";
import {
  DirectiveDefinitionTuple,
  DirectiveName,
  encodeDirectiveLocation,
  getDirectiveName,
} from "./definition";

/**
 * Used to conditionally include fields or fragments.
 */
export const GraphQLIncludeDirective: DirectiveDefinitionTuple = [
  "include",
  [
    DirectiveLocation.FIELD,
    DirectiveLocation.FRAGMENT_SPREAD,
    DirectiveLocation.INLINE_FRAGMENT,
  ].map(encodeDirectiveLocation),
  { if: "Boolean!" },
];

/**
 * Used to conditionally skip (exclude) fields or fragments.
 */
export const GraphQLSkipDirective: DirectiveDefinitionTuple = [
  "skip",
  [
    DirectiveLocation.FIELD,
    DirectiveLocation.FRAGMENT_SPREAD,
    DirectiveLocation.INLINE_FRAGMENT,
  ].map(encodeDirectiveLocation),
  { if: "Boolean!" },
];

/**
 * Constant string used for default reason for a deprecation.
 */
export const DEFAULT_DEPRECATION_REASON = "No longer supported";
/**
 * Used to declare element of a GraphQL schema as deprecated.
 */
export const GraphQLDeprecatedDirective: DirectiveDefinitionTuple = [
  "deprecated",
  [DirectiveLocation.FIELD_DEFINITION].map(encodeDirectiveLocation),
  { reason: ["String", DEFAULT_DEPRECATION_REASON] },
];

/**
 * Used to provide a URL for specifying the behaviour of custom scalar definitions.
 */
export const GraphQLSpecifiedByDirective: DirectiveDefinitionTuple = [
  "specifiedBy",
  [DirectiveLocation.INPUT_OBJECT].map(encodeDirectiveLocation),
  { url: "String!" },
];

/**
 * Used to conditionally defer fragments.
 */
export const GraphQLDeferDirective: DirectiveDefinitionTuple = [
  "defer",
  [DirectiveLocation.FRAGMENT_SPREAD, DirectiveLocation.INLINE_FRAGMENT].map(
    encodeDirectiveLocation,
  ),
  { if: ["Boolean!", true], label: "String" },
];

/**
 * Used to conditionally stream list fields.
 */
export const GraphQLStreamDirective: DirectiveDefinitionTuple = [
  "stream",
  [DirectiveLocation.FIELD].map(encodeDirectiveLocation),
  { if: ["Boolean!", true], label: "String", initialCount: ["Int", 0] },
];

/**
 * The full list of specified directives.
 */
export const specifiedDirectives: ReadonlyArray<DirectiveDefinitionTuple> =
  Object.freeze([
    GraphQLIncludeDirective,
    GraphQLSkipDirective,
    GraphQLDeprecatedDirective,
    GraphQLSpecifiedByDirective,
    GraphQLDeferDirective,
    GraphQLStreamDirective,
  ]);
export const SUPERMASSIVE_SCHEMA_DIRECTIVE_NAME = "schema";
export const SUPERMASSIVE_SCHEMA_DIRECTIVE_DEFINITIONS_ARGUMENT_NAME =
  "definitions";
/**
 * Used to conditionally stream list fields.
 */
export const SupermassiveSchemaDirective: DirectiveDefinitionTuple = [
  SUPERMASSIVE_SCHEMA_DIRECTIVE_NAME,
  [
    DirectiveLocation.QUERY,
    DirectiveLocation.MUTATION,
    DirectiveLocation.SUBSCRIPTION,
  ].map(encodeDirectiveLocation),
  { [SUPERMASSIVE_SCHEMA_DIRECTIVE_DEFINITIONS_ARGUMENT_NAME]: "String!" }, // Essentially JSON
];

export function isKnownDirective(
  directive: DirectiveName | DirectiveDefinitionTuple,
): boolean {
  const name =
    typeof directive === "string" ? directive : getDirectiveName(directive);
  return (
    isSpecifiedDirective(directive) ||
    name === SUPERMASSIVE_SCHEMA_DIRECTIVE_NAME
  );
}
export function isSpecifiedDirective(
  directive: DirectiveName | DirectiveDefinitionTuple,
): boolean {
  const name =
    typeof directive === "string" ? directive : getDirectiveName(directive);
  return specifiedDirectives.some(
    (specDirective) => getDirectiveName(specDirective) === name,
  );
}
