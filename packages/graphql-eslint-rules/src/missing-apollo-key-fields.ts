/*
 * Taken from https://github.com/dotansimha/graphql-eslint/blob/300f73be802bdd06432a5df34939521d1ce0d93b/packages/plugin/src/rules/require-id-when-available.ts
 * MIT license https://github.com/dotansimha/graphql-eslint/blob/300f73be802bdd06432a5df34939521d1ce0d93b/LICENSE
 */

import {
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLNamedType,
  isNonNullType,
  isListType,
  ASTNode,
} from "graphql";
import {
  GraphQLESLintRule,
  CategoryType,
  requireGraphQLSchemaFromContext,
  requireSiblingsOperations,
} from "@graphql-eslint/eslint-plugin";

export const REQUIRE_KEY_FIELDS_WHEN_AVAILABLE = "missing-apollo-key-fields";
const DEFAULT_KEY_FIELD_NAME = "id";

interface MissingApolloKeyFieldsRuleConfig {
  typePolicies: TypePolicies;
}

type TypePolicies = Record<
  string,
  { keyFields?: KeySpecifier | false | (() => unknown) }
>;
export type KeySpecifier = (string | KeySpecifier)[];
export interface KeyFieldSpec {
  name: string;
  nested?: KeyFieldSpec[];
}

export function parseKeySpecifier(specifier: KeySpecifier): KeyFieldSpec[] {
  const specs: KeyFieldSpec[] = [];
  for (const keyField of specifier) {
    if (typeof keyField === "string") {
      specs.push({ name: keyField });
    } else if (Array.isArray(keyField)) {
      const previous = specs[specs.length - 1];
      if (!previous) {
        throw new Error("Expected a field name to precede nested keyFields");
      }
      previous.nested = parseKeySpecifier(keyField);
    } else {
      throw new Error(
        "Expected keyFields to be an array of strings and nested key specifiers",
      );
    }
  }
  return specs;
}

function getBaseType(type: GraphQLOutputType): GraphQLNamedType {
  if (isNonNullType(type) || isListType(type)) {
    return getBaseType(type.ofType);
  }

  return type;
}

export function keyFieldsForType(
  type: GraphQLObjectType | GraphQLInterfaceType,
  typePolicies: TypePolicies,
): KeyFieldSpec[] {
  const typePolicy = typePolicies[type.name];
  if (typePolicy && "keyFields" in typePolicy) {
    const { keyFields } = typePolicy;
    if (Array.isArray(keyFields)) {
      return parseKeySpecifier(keyFields);
    }
    // `false` disables normalization and a function computes key fields
    // dynamically; in both cases no specific fields are required.
    if (keyFields === false || typeof keyFields === "function") {
      return [];
    }
    if (keyFields !== undefined) {
      throw new Error(
        "Expected keyFields to be an array of strings and nested key specifiers",
      );
    }
  }
  if (type.getFields().id !== undefined) {
    return [{ name: DEFAULT_KEY_FIELD_NAME }];
  }
  return [];
}

function hasIdFieldInInterfaceSelectionSet(node: unknown, keyFields: string[]) {
  // FIXME: Upstream needs to be fixed to type the parent field on their ASTNode.
  type ASTNodeWithParent = ASTNode & { parent?: ASTNodeWithParent };

  const { parent } = node as ASTNodeWithParent;
  if (parent && parent.kind === "InlineFragment") {
    const parentSelectionSetNode = parent.parent;
    if (
      parentSelectionSetNode &&
      parentSelectionSetNode.kind === "SelectionSet"
    ) {
      return keyFields.every((keyField) =>
        parentSelectionSetNode.selections.some(
          (s) => s.kind === "Field" && s.name.value === keyField,
        ),
      );
    }
  }
}

const missingApolloKeyFieldsRule: GraphQLESLintRule<
  [MissingApolloKeyFieldsRuleConfig],
  true
> = {
  meta: {
    type: "problem",
    fixable: "code",
    docs: {
      category: "Operations" as CategoryType,
      description: `Enforce selecting specific key fields when they are available on the GraphQL type.`,
      requiresSchema: true,
      requiresSiblings: true,
      examples: [
        {
          title: "Incorrect",
          code: /* GraphQL */ `
            # In your schema
            type User {
              id: ID!
              name: String!
            }
            # Query
            query user {
              user {
                name
              }
            }
          `,
        },
        {
          title: "Correct",
          code: /* GraphQL */ `
            # In your schema
            type User {
              id: ID!
              name: String!
            }
            # Query
            query user {
              user {
                id
                name
              }
            }
          `,
        },
      ],
      recommended: true,
    },
    schema: {
      type: "array",
      additionalItems: false,
      minItems: 0,
      maxItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          typePolicies: {
            type: "object",
          },
        },
      },
    },
  },
  create(context) {
    requireGraphQLSchemaFromContext(REQUIRE_KEY_FIELDS_WHEN_AVAILABLE, context);
    requireSiblingsOperations(REQUIRE_KEY_FIELDS_WHEN_AVAILABLE, context);

    return {
      SelectionSet(node) {
        const { typePolicies } = context.options[0];
        const siblings = context.parserServices?.siblingOperations;

        if (!node.selections || node.selections.length === 0) {
          return;
        }

        const typeInfo = node.typeInfo?.();
        if (typeInfo && typeInfo.gqlType) {
          const rawType = getBaseType(typeInfo.gqlType);
          if (
            rawType instanceof GraphQLObjectType ||
            rawType instanceof GraphQLInterfaceType
          ) {
            const keyFields = keyFieldsForType(rawType, typePolicies);
            const checkedFragmentSpreads = new Set();

            if (keyFields.length) {
              const gatherPresentFields = (
                selections: readonly ASTNode[] | undefined,
                visited: Set<string>,
              ): Map<string, (readonly ASTNode[])[]> => {
                const fields = new Map<string, (readonly ASTNode[])[]>();
                const mergeInto = (
                  source: Map<string, (readonly ASTNode[])[]>,
                ) => {
                  for (const [name, subs] of source) {
                    fields.set(name, (fields.get(name) ?? []).concat(subs));
                  }
                };

                for (const selection of selections || []) {
                  if (selection.kind === "Field") {
                    const name = selection.name.value;
                    const existing = fields.get(name) ?? [];
                    if (selection.selectionSet?.selections) {
                      existing.push(selection.selectionSet.selections);
                    }
                    fields.set(name, existing);
                  } else if (selection.kind === "InlineFragment") {
                    mergeInto(
                      gatherPresentFields(
                        selection.selectionSet?.selections,
                        visited,
                      ),
                    );
                  } else if (siblings && selection.kind === "FragmentSpread") {
                    const fragmentName = selection.name.value;
                    if (visited.has(fragmentName)) {
                      continue;
                    }
                    visited.add(fragmentName);

                    const foundSpread = siblings.getFragment(fragmentName);
                    if (foundSpread[0]) {
                      checkedFragmentSpreads.add(
                        foundSpread[0].document.name.value,
                      );
                      mergeInto(
                        gatherPresentFields(
                          foundSpread[0].document.selectionSet
                            ?.selections as unknown as readonly ASTNode[],
                          visited,
                        ),
                      );
                    }
                  }
                }
                return fields;
              };

              const getUnusedKeyFieldPaths = (
                specs: KeyFieldSpec[],
                presentFields: Map<string, (readonly ASTNode[])[]>,
              ): string[] => {
                const unused: string[] = [];
                for (const spec of specs) {
                  const occurrences = presentFields.get(spec.name);
                  if (!occurrences) {
                    unused.push(spec.name);
                    continue;
                  }
                  if (spec.nested && spec.nested.length) {
                    const nestedFields = new Map<
                      string,
                      (readonly ASTNode[])[]
                    >();
                    for (const subSelections of occurrences) {
                      const gathered = gatherPresentFields(
                        subSelections,
                        new Set<string>(),
                      );
                      for (const [name, subs] of gathered) {
                        nestedFields.set(
                          name,
                          (nestedFields.get(name) ?? []).concat(subs),
                        );
                      }
                    }
                    for (const nestedUnused of getUnusedKeyFieldPaths(
                      spec.nested,
                      nestedFields,
                    )) {
                      unused.push(`${spec.name}.${nestedUnused}`);
                    }
                  }
                }
                return unused;
              };

              const presentFields = gatherPresentFields(
                node.selections as unknown as readonly ASTNode[],
                new Set<string>(),
              );
              const unusedKeyFields = getUnusedKeyFieldPaths(
                keyFields,
                presentFields,
              );
              const keyFieldNames = keyFields.map((spec) => spec.name);

              if (
                unusedKeyFields.length &&
                !hasIdFieldInInterfaceSelectionSet(node, keyFieldNames)
              ) {
                const nestedKeyFieldNames = new Set(
                  keyFields
                    .filter((spec) => spec.nested && spec.nested.length)
                    .map((spec) => spec.name),
                );
                const fixableKeyFields = unusedKeyFields.filter(
                  (field) =>
                    !field.includes(".") && !nestedKeyFieldNames.has(field),
                );

                context.report({
                  node: node,
                  message: `The key-field${
                    unusedKeyFields.length === 1 ? "" : "s"
                  } "${
                    unusedKeyFields.length === 1
                      ? unusedKeyFields[0]
                      : unusedKeyFields.slice(0, -1).join(", ") +
                        " and " +
                        unusedKeyFields[unusedKeyFields.length - 1]
                  }" must be selected for proper Apollo Client store denormalisation purposes.`,
                  fix(fixer) {
                    if (!fixableKeyFields.length || !node.selections.length) {
                      return null;
                    }

                    const firstSelection = node.selections[0];

                    if (firstSelection.kind !== "Field") {
                      return null;
                    }

                    return fixer.insertTextBefore(
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      firstSelection as any,
                      `${fixableKeyFields.join(`\n`)}\n`,
                    );
                  },
                });
              }
            }
          }
        }
      },
    };
  },
};

export default missingApolloKeyFieldsRule;
