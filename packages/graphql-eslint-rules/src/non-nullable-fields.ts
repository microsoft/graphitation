import { GraphQLESLintRule } from "@graphql-eslint/eslint-plugin";

interface Options {
  fields: string[];
}

const rule: GraphQLESLintRule<[Options]> = {
  meta: {
    type: "problem",
    docs: {
      description: `Ensures that fields are not nullable`,
      category: "Schema",
    },
    schema: {
      type: "array",
      minItems: 1,
      maxItems: 1,
      additionalItems: false,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          fields: {
            type: "array",
            description: "List of the fields that must be non-nullable",
            minItems: 1,
            additionalItems: false,
            items: {
              type: "string",
            },
          },
        },
      },
    },
  },
  create(context) {
    const { fields } = context.options[0];
    return {
      FieldDefinition(node) {
        const fieldName = node.name?.value;
        if (!fields.includes(fieldName)) {
          return;
        }

        if (node.gqlType.kind !== "NonNullType") {
          context.report({
            message: `Field "${fieldName}" cannot be nullable.`,
            node,
          });
        }
      },
    };
  },
};

export default rule;
