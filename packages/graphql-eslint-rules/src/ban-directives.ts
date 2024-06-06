import { GraphQLESLintRule } from "@graphql-eslint/eslint-plugin";

const rule: GraphQLESLintRule<[{ bannedDirectives: string[] }]> = {
  meta: {
    type: "problem",
    docs: {
      description: `Prohibits use of certain directives in operation documents`,
      category: "Operations",
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
          bannedDirectives: {
            type: "array",
            description: "List of the directives to be banned.",
            minItems: 1,
            additionalItems: false,
            items: {
              type: "string",
              description: "Name of the directive to be banned (e.g. client)",
            },
          },
        },
      },
    },
  },
  create(context) {
    const { bannedDirectives } = context.options[0];
    return {
      Directive(node) {
        const directiveName = node.name?.value;
        if (!directiveName) {
          return;
        }

        if (bannedDirectives.includes(directiveName)) {
          context.report({
            message: `Use of directive @${directiveName} is prohibited`,
            node,
          });
        }
      },
    };
  },
};

export default rule;
