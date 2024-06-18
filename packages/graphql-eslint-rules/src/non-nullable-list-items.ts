import { GraphQLESLintRule } from "@graphql-eslint/eslint-plugin";

const rule: GraphQLESLintRule = {
  meta: {
    type: "problem",
    docs: {
      description: `Ensures that list items are not nullable`,
      category: "Schema",
    },
    schema: [],
  },
  create(context) {
    return {
      ListType(node) {
        if (node.gqlType.kind !== "NonNullType") {
          context.report({
            message: `List items must be not nullable.`,
            node,
          });
        }
      },
    };
  },
};

export default rule;
