import { GraphQLDirective } from "graphql";
import { inspect } from "./jsutils/inspect";
import { instanceOf } from "./jsutils/instanceOf";

export {
  specifiedDirectives,
  isSpecifiedDirective,
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
  GraphQLDeprecatedDirective,
  GraphQLSpecifiedByDirective,
  GraphQLDeferDirective,
  GraphQLStreamDirective,
} from "./supermassive-ast";

/**
 * Test if the given value is a GraphQL directive.
 */
export function isDirective(directive: unknown): directive is GraphQLDirective {
  return instanceOf(directive, GraphQLDirective);
}

export function assertDirective(directive: unknown): GraphQLDirective {
  if (!isDirective(directive)) {
    throw new Error(
      `Expected ${inspect(directive)} to be a GraphQL directive.`,
    );
  }
  return directive;
}
