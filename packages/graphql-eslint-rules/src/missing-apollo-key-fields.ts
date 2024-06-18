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
type KeySpecifier = (string | KeySpecifier)[];

function getBaseType(type: GraphQLOutputType): GraphQLNamedType {
  if (isNonNullType(type) || isListType(type)) {
    return getBaseType(type.ofType);
  }

  return type;
}

function keyFieldsForType(
  type: GraphQLObjectType | GraphQLInterfaceType,
  typePolicies: TypePolicies,
) {
  const keyFields: string[] = [];
  const typePolicy = typePolicies[type.name];
  if (typePolicy && typePolicy.keyFields) {
    if (Array.isArray(typePolicy.keyFields)) {
      typePolicy.keyFields.forEach((keyField) => {
        if (typeof keyField === "string") {
          keyFields.push(keyField);
        } else {
          throw new Error("Expected keyFields to be array of strings");
        }
      });
    } else {
      throw new Error("Expected keyFields to be array of strings");
    }
  } else if (type.getFields().id !== undefined) {
    keyFields.push(DEFAULT_KEY_FIELD_NAME);
  }
  return keyFields;
}

function getKeyFieldsObjectForCheck(keyFields: string[]) {
  return keyFields.reduce((acc, id) => {
    acc[id] = false;
    return acc;
  }, {} as Record<string, boolean>);
}

function getUnusedKeyFields(keyFieldsObjectForCheck: Record<string, boolean>) {
  return Object.entries(keyFieldsObjectForCheck).reduce((acc, [key, value]) => {
    if (value) {
      return acc;
    }
    acc.push(key);
    return acc;
  }, [] as string[]);
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
              const keyFieldsFound = getKeyFieldsObjectForCheck(keyFields);

              for (const selection of node.selections) {
                if (
                  selection.kind === "Field" &&
                  keyFieldsFound[selection.name.value] === false
                ) {
                  keyFieldsFound[selection.name.value] = true;
                } else if (selection.kind === "InlineFragment") {
                  for (const fragmentSelection of selection.selectionSet
                    ?.selections || []) {
                    if (
                      fragmentSelection.kind === "Field" &&
                      keyFieldsFound[fragmentSelection.name.value] === false
                    ) {
                      keyFieldsFound[fragmentSelection.name.value] = true;
                    }
                  }
                } else if (siblings && selection.kind === "FragmentSpread") {
                  const foundSpread = siblings.getFragment(
                    selection.name.value,
                  );

                  if (foundSpread[0]) {
                    checkedFragmentSpreads.add(
                      foundSpread[0].document.name.value,
                    );

                    for (const fragmentSpreadSelection of foundSpread[0]
                      .document.selectionSet?.selections || []) {
                      if (
                        fragmentSpreadSelection.kind === "Field" &&
                        keyFieldsFound[fragmentSpreadSelection.name.value] ===
                          false
                      ) {
                        keyFieldsFound[fragmentSpreadSelection.name.value] =
                          true;
                      }
                    }
                  }
                }
              }

              const unusedKeyFields = getUnusedKeyFields(keyFieldsFound);
              if (
                unusedKeyFields.length &&
                !hasIdFieldInInterfaceSelectionSet(node, keyFields)
              ) {
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
                    if (!node.selections.length) {
                      return null;
                    }

                    const firstSelection = node.selections[0];

                    if (firstSelection.kind !== "Field") {
                      return null;
                    }

                    return fixer.insertTextBefore(
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      firstSelection as any,
                      `${unusedKeyFields.join(`\n`)}\n`,
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
