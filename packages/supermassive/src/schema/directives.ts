import {
  DirectiveDefinitionTuple,
  DirectiveName,
  getDirectiveName,
} from "./definition";

/**
 * Used to conditionally include fields or fragments.
 */
export const GraphQLIncludeDirective: DirectiveDefinitionTuple = [
  "include",
  { if: "Boolean!" },
  // TODO: locations for all directives (maybe not - they are irrelevant for runtime)?
];

/**
 * Used to conditionally skip (exclude) fields or fragments.
 */
export const GraphQLSkipDirective: DirectiveDefinitionTuple = [
  "skip",
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
  { reason: ["String", DEFAULT_DEPRECATION_REASON] },
];

/**
 * Used to provide a URL for specifying the behaviour of custom scalar definitions.
 */
export const GraphQLSpecifiedByDirective: DirectiveDefinitionTuple = [
  "specifiedBy",
  { url: "String!" },
];

/**
 * Used to conditionally defer fragments.
 */
export const GraphQLDeferDirective: DirectiveDefinitionTuple = [
  "defer",
  { if: ["Boolean!", true], label: "String" },
];

/**
 * Used to conditionally stream list fields.
 */
export const GraphQLStreamDirective: DirectiveDefinitionTuple = [
  "stream",
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
