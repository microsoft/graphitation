import {
  GraphQLESLintRule,
  requireGraphQLSchemaFromContext,
} from "@graphql-eslint/eslint-plugin";
import { isNonNullType } from "graphql";

const RULE_ID = "strict-non-nullable-variables";

const rule: GraphQLESLintRule<[], true> = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Prohibits use of nullable variables in non nullable positions. RFC: https://github.com/graphql/graphql-spec/pull/1059",
      category: "Operations",
      requiresSchema: true,
    },
    schema: [],
  },
  create(context) {
    const nullableVariables = new Set();
    requireGraphQLSchemaFromContext(RULE_ID, context);

    return {
      Variable(node) {
        const varName = node.name.value;
        const { inputType } = node.typeInfo();
        if (node.parent.kind === "VariableDefinition") {
          if (!isNonNullType(inputType)) {
            nullableVariables.add(varName);
          }
          return;
        }

        if (!inputType) {
          return;
        }

        if (isNonNullType(inputType)) {
          if (nullableVariables.has(varName)) {
            context.report({
              message: `Can't use nullable variable in non nullable position.`,
              node,
            });
          }
        }
      },
    };
  },
};

export default rule;
