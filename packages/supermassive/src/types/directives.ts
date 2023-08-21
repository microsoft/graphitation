import { DirectiveDefinitionTuple, DirectiveKeys } from "./definition";

/**
 * Used to conditionally include fields or fragments.
 */
export const GraphQLIncludeDirective: DirectiveDefinitionTuple = [
  "include",
  { if: ["Boolean!"] },
  // TODO: locations for all directives (maybe not - they are irrelevant for runtime)?
];

/**
 * Used to conditionally skip (exclude) fields or fragments.
 */
export const GraphQLSkipDirective: DirectiveDefinitionTuple = [
  "skip",
  { if: ["Boolean!"] },
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
  { url: ["String!"] },
];

/**
 * Used to conditionally defer fragments.
 */
export const GraphQLDeferDirective: DirectiveDefinitionTuple = [
  "defer",
  { if: ["Boolean!", true], label: ["String"] },
];

/**
 * Used to conditionally stream list fields.
 */
export const GraphQLStreamDirective: DirectiveDefinitionTuple = [
  "stream",
  { if: ["Boolean!", true], label: ["String"], initialCount: ["Int", 0] },
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

export function isSpecifiedDirective(
  directive: DirectiveDefinitionTuple,
): boolean {
  return specifiedDirectives.some(
    (specDirective) =>
      specDirective[DirectiveKeys.name] === directive[DirectiveKeys.name],
  );
}

export const specifiedDirectivesSDL = `
directive @skip(if: Boolean!) on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT

directive @include(if: Boolean!) on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT

directive @deprecated(
  reason: String = "No longer supported"
) on FIELD_DEFINITION | ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION | ENUM_VALUE

directive @specifiedBy(url: String!) on SCALAR

directive @defer(
  label: String
  if: Boolean! = true
) on FRAGMENT_SPREAD | INLINE_FRAGMENT

directive @stream(
  label: String
  if: Boolean! = true
  initialCount: Int = 0
) on FIELD
`;
