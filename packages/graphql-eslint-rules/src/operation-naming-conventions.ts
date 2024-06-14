import type {
  GraphQLESLintRule,
  GraphQLESLintRuleContext,
} from "@graphql-eslint/eslint-plugin";
import { pascalCase, getFileInfo } from "./utils";

const OPERATIONS = ["query", "mutation", "subscription"];

export function reportError(
  context: GraphQLESLintRuleContext,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  node: any,
  message: string,
  expectedName?: string,
) {
  context.report({
    node,
    message,
    fix: expectedName
      ? (fixer) => fixer.replaceText(node.name, expectedName)
      : undefined,
  });
}

const rule: GraphQLESLintRule = {
  meta: {
    type: "problem",
    fixable: "code",
    schema: [],
    docs: {
      description: `Enforce descriptive operation names`,
      category: "Operations",
      examples: [
        {
          title: "Incorrect",
          code: /* GraphQL */ `
            # packages/eslint-rules-example/user-query.graphql
            query User {
              user {
                id
                name
              }
            }
          `,
        },
        {
          title: "Correct",
          code: /* GraphQL */ `
            # packages/chat-item-components/src/queries/chat-item-components-user-query.graphql
            query ChatItemComponentsUserQuery {
              user {
                id
                name
              }
            }
          `,
        },
      ],
    },
  },
  create(context) {
    return {
      OperationDefinition(node) {
        if (!node.name?.value) {
          return;
        }

        const documentName = node.name.value;
        const fileInfo = getFileInfo(context.getFilename());
        if (!fileInfo) {
          return;
        }

        const { name: filename, directory: lastDirectory } = fileInfo;

        if (
          !OPERATIONS.some((operation) => filename.endsWith(`-${operation}`))
        ) {
          return reportError(
            context,
            node,
            `Filename should end with the operation name (query/mutation/subscription) e.g. foo-query.graphql`,
          );
        }

        if (!filename.startsWith(`${lastDirectory}-`)) {
          return reportError(
            context,
            node,
            `Filename should start with the package directory name: "${lastDirectory}"`,
          );
        }

        const expectedName = pascalCase(filename);
        if (expectedName !== documentName) {
          return reportError(
            context,
            node,
            `Operation should follow the naming conventions, the expected name is ${expectedName}`,
            expectedName,
          );
        }
      },
    };
  },
};

export default rule;
