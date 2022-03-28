import {
  GraphQLESLintRule,
  GraphQLESTreeNode,
  GraphQLESLintRuleContext,
} from "@graphql-eslint/eslint-plugin";
import { OperationDefinitionNode } from "graphql";
import { RuleFixer } from "@typescript-eslint/utils/dist/ts-eslint";
import { Kind } from "graphql";
import { relative } from "path";
import { checkDirForPkg } from "./utils";
import path from "path";
import camelCase from "lodash.camelcase";

const RULE_NAME = "operation-naming-convention";
const OPERATIONS = ["Query", "Mutation", "Subscription"];

function pascalCase(text: string) {
  const camelCaseText = camelCase(text);
  return camelCaseText.charAt(0).toUpperCase() + camelCaseText.slice(1);
}

function reportError(
  context: GraphQLESLintRuleContext,
  node: GraphQLESTreeNode<OperationDefinitionNode, true>,
  message: string,
  expectedName?: string,
) {
  const newNode = {
    ...node,
    loc: {
      start: {
        line: node.loc.start.line,
        column: node.loc.start.column - 1,
      },
      end: {
        line: node.loc.end.line,
        column: node.loc.end.column - 1,
      },
    },
  };

  context.report({
    node: newNode,
    message,
    fix(fixer: RuleFixer) {
      if (!expectedName) {
        return;
      }
      return fixer.replaceText(node.name as any, expectedName);
    },
  });
}

const rule: GraphQLESLintRule = {
  meta: {
    type: "problem",
    fixable: "code",
    docs: {
      category: "Operations",
      description: `Enforce descriptive operation names`,
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
            # packages/eslint-rules-example/user-query.graphql
            query MsTeamsUserQuery {
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
        const pascalFilename = pascalCase(
          path.parse(path.basename(filepath)).name,
        );
        const expectedPrefix = pascalCase(lastDirectory);

        if (
          !OPERATIONS.some((operation) => pascalFilename.endsWith(operation))
        ) {
          return reportError(
            context,
            node,
            `Filename should end with the operation name (query/mutation/subscription) e.g. foo-query.graphql`,
          );
        }

        const expectedName = expectedPrefix + pascalFilename;

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
