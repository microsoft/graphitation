import { GraphQLESLintRule } from "@graphql-eslint/eslint-plugin";

interface ParameterGroup {
  keywords: string[];
  description: string;
  partialMatch?: boolean;
}

interface Options {
  bannedParameters: ParameterGroup[];
}

const rule: GraphQLESLintRule<[Options]> = {
  meta: {
    type: "problem",
    docs: {
      description: `Prohibits use of certain parameter names in schema.`,
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
          bannedParameters: {
            type: "array",
            minItems: 1,
            additionalItems: false,
            items: {
              type: "object",
              additionalProperties: false,
              description:
                "Describes a group of parameter names that is prohibited and the reason why. e.g. cache busting parameters: 'force', 'noCache', etc.",
              properties: {
                keywords: {
                  type: "array",
                  description: "List of prohibited parameter names.",
                  minItems: 1,
                  items: {
                    type: "string",
                  },
                },
                description: {
                  type: "string",
                  description:
                    "Explains the reason why keywords in this group could not be used as parameter names. It appears as a part of error message.",
                },
                partialMatch: {
                  type: "boolean",
                  description:
                    "When enabled triggers error for parameters that contain any of the keywords instead of exact match",
                  default: false,
                },
              },
            },
          },
        },
      },
    },
  },
  create(context) {
    const { bannedParameters } = context.options[0];
    return {
      InputValueDefinition(node) {
        for (const {
          keywords,
          description,
          partialMatch,
        } of bannedParameters) {
          const paramName = node.name.value;
          const normalizedParamName = paramName.toLocaleLowerCase();
          const normalizedKeywords = keywords.map((keyword) =>
            keyword.toLocaleLowerCase(),
          );
          if (partialMatch) {
            const matchingKeyword = normalizedKeywords.find(
              (keyword) => normalizedParamName.indexOf(keyword) !== -1,
            );
            if (typeof matchingKeyword === "string") {
              context.report({
                message: `"Parameter name can not contain "${matchingKeyword}". Reason: ${description}"`,
                node,
              });
            }
          } else {
            if (normalizedKeywords.includes(normalizedParamName)) {
              context.report({
                message: `"${paramName}" is a prohibited parameter name. Reason: ${description}"`,
                node,
              });
            }
          }
        }
      },
    };
  },
};

export default rule;
