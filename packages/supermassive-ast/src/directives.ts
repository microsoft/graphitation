import {
  GraphQLString,
  GraphQLBoolean,
  GraphQLNonNull,
  DirectiveLocation,
  GraphQLDirective,
  GraphQLInt,
} from "graphql";

/**
 * Used to conditionally include fields or fragments.
 */
export const GraphQLIncludeDirective: GraphQLDirective = new GraphQLDirective({
  name: "include",
  description:
    "Directs the executor to include this field or fragment only when the `if` argument is true.",
  locations: [
    DirectiveLocation.FIELD,
    DirectiveLocation.FRAGMENT_SPREAD,
    DirectiveLocation.INLINE_FRAGMENT,
  ],
  args: {
    if: {
      type: new GraphQLNonNull(GraphQLBoolean),
      description: "Included when true.",
    },
  },
});

/**
 * Used to conditionally skip (exclude) fields or fragments.
 */
export const GraphQLSkipDirective: GraphQLDirective = new GraphQLDirective({
  name: "skip",
  description:
    "Directs the executor to skip this field or fragment when the `if` argument is true.",
  locations: [
    DirectiveLocation.FIELD,
    DirectiveLocation.FRAGMENT_SPREAD,
    DirectiveLocation.INLINE_FRAGMENT,
  ],
  args: {
    if: {
      type: new GraphQLNonNull(GraphQLBoolean),
      description: "Skipped when true.",
    },
  },
});

/**
 * Constant string used for default reason for a deprecation.
 */
export const DEFAULT_DEPRECATION_REASON = "No longer supported";

/**
 * Used to declare element of a GraphQL schema as deprecated.
 */
export const GraphQLDeprecatedDirective: GraphQLDirective =
  new GraphQLDirective({
    name: "deprecated",
    description: "Marks an element of a GraphQL schema as no longer supported.",
    locations: [
      DirectiveLocation.FIELD_DEFINITION,
      DirectiveLocation.ARGUMENT_DEFINITION,
      DirectiveLocation.INPUT_FIELD_DEFINITION,
      DirectiveLocation.ENUM_VALUE,
    ],
    args: {
      reason: {
        type: GraphQLString,
        description:
          "Explains why this element was deprecated, usually also including a suggestion for how to access supported similar data. Formatted using the Markdown syntax, as specified by [CommonMark](https://commonmark.org/).",
        defaultValue: DEFAULT_DEPRECATION_REASON,
      },
    },
  });

/**
 * Used to provide a URL for specifying the behaviour of custom scalar definitions.
 */
export const GraphQLSpecifiedByDirective: GraphQLDirective =
  new GraphQLDirective({
    name: "specifiedBy",
    description: "Exposes a URL that specifies the behaviour of this scalar.",
    locations: [DirectiveLocation.SCALAR],
    args: {
      url: {
        type: new GraphQLNonNull(GraphQLString),
        description: "The URL that specifies the behaviour of this scalar.",
      },
    },
  });

/**
 * Used to conditionally defer fragments.
 */
export const GraphQLDeferDirective = new GraphQLDirective({
  name: "defer",
  description:
    "Directs the executor to defer this fragment when the `if` argument is true or undefined.",
  locations: [
    DirectiveLocation.FRAGMENT_SPREAD,
    DirectiveLocation.INLINE_FRAGMENT,
  ],
  args: {
    if: {
      type: new GraphQLNonNull(GraphQLBoolean),
      description: "Deferred when true or undefined.",
      defaultValue: true,
    },
    label: {
      type: GraphQLString,
      description: "Unique name",
    },
  },
});

/**
 * Used to conditionally stream list fields.
 */
export const GraphQLStreamDirective = new GraphQLDirective({
  name: "stream",
  description:
    "Directs the executor to stream plural fields when the `if` argument is true or undefined.",
  locations: [DirectiveLocation.FIELD],
  args: {
    if: {
      type: new GraphQLNonNull(GraphQLBoolean),
      description: "Stream when true or undefined.",
      defaultValue: true,
    },
    label: {
      type: GraphQLString,
      description: "Unique name",
    },
    initialCount: {
      defaultValue: 0,
      type: GraphQLInt,
      description: "Number of items to return immediately",
    },
  },
});

/**
 * The full list of specified directives.
 */
export const specifiedDirectives: ReadonlyArray<GraphQLDirective> =
  Object.freeze([
    GraphQLIncludeDirective,
    GraphQLSkipDirective,
    GraphQLDeprecatedDirective,
    GraphQLSpecifiedByDirective,
    GraphQLDeferDirective,
    GraphQLStreamDirective,
  ]);

export function isSpecifiedDirective(directive: GraphQLDirective): boolean {
  return specifiedDirectives.some(({ name }) => name === directive.name);
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
