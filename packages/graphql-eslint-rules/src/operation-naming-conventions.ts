import {
  GraphQLESLintRule,
  GraphQLESTreeNode,
  GraphQLESLintRuleContext,
} from "@graphql-eslint/eslint-plugin";
import { OperationDefinitionNode, FragmentDefinitionNode } from "graphql";
import { RuleFixer } from "@typescript-eslint/utils/dist/ts-eslint";
import { Kind } from "graphql";
import { relative } from "path";
import { checkDirForPkg } from "./utils";
import path from "path";
import camelCase from "lodash.camelcase";
import kebabCase from "lodash.kebabcase";

const RULE_NAME = "operation-naming-convention";
const OPERATIONS = ["query", "mutation", "subscription"];

export const MISSING_OPERATION_NAME_ERROR_MESSAGE = `Filename should end with the operation name (query/mutation/subscription) e.g. foo-query.graphql`;

export function getMissingLastDirectoryPrefixErrorMessage(
  lastDirectory: string,
) {
  return `Filename should start with the package directory name: "${lastDirectory}"`;
}

export function isFilenamePrefixValid(filename: string, lastDirectory: string) {
  return filename.startsWith(`${lastDirectory}-`);
}

export function isFilenameSuffixValid(
  filename: string,
  additionalSuffixes?: string[],
) {
  const operations = additionalSuffixes
    ? [...additionalSuffixes, ...OPERATIONS]
    : OPERATIONS;

  return operations.some((operation) =>
    filename.endsWith(`-${operation.toLowerCase()}`),
  );
}

function pascalCase(text: string) {
  const camelCaseText = camelCase(text);
  return camelCaseText.charAt(0).toUpperCase() + camelCaseText.slice(1);
}

export function reportError(
  context: GraphQLESLintRuleContext,
  node: GraphQLESTreeNode<
    OperationDefinitionNode | FragmentDefinitionNode,
    true
  >,
  message: string,
  expectedName?: string,
) {
  const newNode = {
    ...node,
    loc: {
      start: {
        line: node.loc!.start.line,
        column: node.loc!.start.column - 1,
      },
      end: {
        line: node.loc!.end.line,
        column: node.loc!.end.column - 1,
      },
    },
  };

  const fix = (fixer: RuleFixer) => {
    if (!expectedName) {
      return;
    }
    return fixer.replaceText(node.name as any, expectedName);
  };

  context.report({
    node: newNode,
    message,
    fix: expectedName ? (fix as any) : undefined,
  });
}

const rule: GraphQLESLintRule = {
  meta: {
    type: "problem",
    fixable: "code",
    schema: undefined,
    docs: {
      ...({ description: `Enforce descriptive operation names` } as any), // FIXME: Why can we not pass this prop?
      category: "Operations",
      requiresSiblings: true,

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
      "OperationDefinition[name!=undefined]"(
        node: GraphQLESTreeNode<OperationDefinitionNode, true>,
      ) {
        if (!node?.name) return;
        const documentName = node.name.value;
        const filepath = context.getFilename();
        const packageJsonPath = checkDirForPkg(
          path.resolve(process.cwd(), path.dirname(filepath)),
        );

        if (!packageJsonPath || !filepath) {
          return;
        }

        const lastDirectory = path.basename(path.dirname(packageJsonPath));
        const filename = path.parse(path.basename(filepath)).name;

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
